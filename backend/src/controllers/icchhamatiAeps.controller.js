import axios from 'axios';
import fs from 'fs/promises';
import mongoose from 'mongoose';
import sharp from 'sharp';
import Retailer from '../models/users/retailer.model.js';
import Transaction from '../models/transaction.model.js';
import AepsWallet from '../models/aepsWallet.model.js';
import {
  icchhamatiGet,
  icchhamatiPost,
  icchhamatiPostForm,
  isOk,
  providerMessage,
  providerCrashed,
  makeReferenceId,
} from '../utils/icchhamati.util.js';
import { applyAepsWithdrawalSuccess } from '../utils/wallet.util.js';
import { aepsKycDone } from '../utils/services.js';
import { uploadOnR2 } from '../utils/r2.js';
import { loggableResponse } from '../utils/integrationLogger.js';
import { AEPS_OTP_THRESHOLD } from './aepsPayment.controller.js';

/**
 * Icchhamati AEPS — Fingpay behind Icchhamati's /api/v2/aeps gateway.
 *
 * Onboarding is a draft the provider walks through verifications (PAN, mobile,
 * email, Aadhaar, bank, video KYC), then a Fingpay merchant, then a one-time
 * biometric eKYC and a daily 2FA. Every verification is keyed by the merchant's
 * PAN and every transaction by the outlet id (MID) the draft is given, so both
 * are always taken from the retailer's own record, never from the request:
 * otherwise a retailer could act on another merchant's onboarding.
 */

const AEPS_MAX_AMOUNT = 10000;

const maskAadhaar = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? `XXXXXXXX${digits.slice(-4)}` : null;
};

const loadRetailer = async (req, res) => {
  const retailer = await Retailer.findById(req.user.id);
  if (!retailer) res.status(404).json({ success: false, message: 'Retailer not found' });
  return retailer;
};

const outletOf = (retailer) => retailer.icchhamatiAeps?.outletId || null;

// Every call after registration names the merchant twice: the gateway refuses an
// API partner's call without the outlet ("Outlet ID is required for API
// partner"), and the onboarding endpoints find the draft by PAN.
const merchantKeys = (retailer) => ({ outletId: outletOf(retailer), pan_no: retailer.panNumber });

const needOutlet = (retailer, res) => {
  if (outletOf(retailer)) return false;
  res.status(409).json({ success: false, message: 'Complete AEPS registration first.' });
  return true;
};

/** Relays a provider answer in our envelope, with a readable message either way. */
/**
 * Fingpay's own answer sits inside Icchhamati's: { status: 1, message: "Success",
 * data: { status: false, message: "<why>" } } is a failure, not a success.
 */
export const fingpayFailed = (data) => data?.data?.status === false;

const relay = (res, data, okMessage, failMessage) =>
  isOk(data) && !fingpayFailed(data)
    ? res.status(200).json({
        success: true,
        message: providerMessage(data, okMessage),
        data: data?.data ?? null,
        raw: data,
      })
    : res.status(400).json({
        success: false,
        message: fingpayFailed(data) ? data.data.message || failMessage : providerMessage(data, failMessage),
        data: data?.data ?? null,
      });

const fail = (res, label, error) => {
  console.error(`Icchhamati AEPS ${label} error:`, error?.response?.data || error.message);
  return res.status(502).json({
    success: false,
    message: `Could not reach the AEPS provider (${label}). Please try again.`,
  });
};

/**
 * Where the merchant is in onboarding, from /draft-data. Mirrors the order the
 * provider's own portal walks a merchant through.
 *
 *   aeps_status 0 not onboarded, 1 needs eKYC, 2 needs today's 2FA, 3 ready.
 *   ap_status 0 means Aadhaar Pay needs its own 2FA even when AEPS is ready.
 */
export const onboardingStep = (draft) => {
  if (!draft) return 'register';
  if (Number(draft.pan_verified_at) === 0) return 'pan';
  if (Number(draft.phone_verified_at) === 0) return 'mobile';
  if (Number(draft.email_verified_at) === 0) return 'email';
  if (Number(draft.aadhaar_verified_at) === 0) return 'aadhaar';
  if (Number(draft.bank_verified_at) === 0) return 'bank';
  if (!draft.video_url) return 'video';
  if (Number(draft.video_kyc_status) === 0) return 'video_review';
  const aeps = Number(draft.aeps_status);
  if (aeps === 0) return 'onboard';
  if (aeps === 1) return 'ekyc';
  if (aeps === 2) return 'twofa';
  if (aeps === 3) return 'ready';
  return 'onboard';
};

/**
 * Outcome of /doAeps. The gateway envelope `status` says whether Icchhamati
 * accepted the call; Fingpay's verdict is the inner `data.status`.
 *
 * Money only moves on CW and Aadhaar Pay, and there an unclear answer must not
 * read as FAILED: a crash or timeout can come after the bank debited the
 * customer. Those are PROCESSING and wait for an admin, because doAeps takes no
 * client reference the provider could be asked about later.
 */
export const transactionOutcome = (data) => {
  if (!data || providerCrashed(data)) return 'PROCESSING';
  const envelope = Number(data.status);
  if (envelope === 2) return 'PROCESSING';
  if (isOk(data)) {
    const inner = data.data?.status;
    return inner === false || inner === 'false' ? 'FAILED' : 'SUCCESS';
  }
  return 'FAILED';
};

/**
 * Saves where the merchant is, so distributors and admins see it, and keeps
 * isMerchantKycComplete (which locks the identity documents) in step with it.
 */
export const recordStep = async (retailer, step) => {
  const done = aepsKycDone({ icchhamatiAeps: { step } });
  if (retailer.icchhamatiAeps.step === step && retailer.isMerchantKycComplete === done) return;
  retailer.icchhamatiAeps.step = step;
  retailer.icchhamatiAeps.stepAt = new Date();
  retailer.isMerchantKycComplete = done;
  await retailer.save();
};

/**
 * Asks the provider where this retailer's onboarding stands and records it.
 * Returns the step, or throws with the provider's message.
 */
export const refreshAepsStep = async (retailer) => {
  const outletId = outletOf(retailer);
  let step = 'register';
  if (outletId) {
    const data = await icchhamatiPost('/api/v2/aeps/draft-data', { outletId });
    if (!isOk(data))
      throw new Error(providerMessage(data, 'Could not load AEPS registration status.'));
    step = onboardingStep(data.data || {});
  }
  await recordStep(retailer, step);
  return { step, checkedAt: retailer.icchhamatiAeps.stepAt || new Date() };
};

// --- Onboarding ------------------------------------------------------------

/** GET /status — the retailer's onboarding step plus the provider draft. */
export const getStatus = async (req, res) => {
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer) return;
    const profile = {
      name: retailer.name,
      email: retailer.email,
      phone: retailer.contactNumber,
      pan: retailer.panNumber,
      aadhaar: maskAadhaar(retailer.aadhaarNumber),
      shopName: retailer.businessName,
      shopAddress: retailer.businessAddress,
      city: retailer.address?.city,
      district: retailer.address?.district,
      state: retailer.address?.state,
    };
    const outletId = outletOf(retailer);
    if (!outletId) {
      await recordStep(retailer, 'register');
      return res
        .status(200)
        .json({ success: true, data: { step: 'register', outletId: null, profile } });
    }

    const data = await icchhamatiPost('/api/v2/aeps/draft-data', { outletId });
    if (!isOk(data)) {
      return res.status(502).json({
        success: false,
        message: providerMessage(data, 'Could not load AEPS registration status.'),
      });
    }
    const draft = data.data || {};
    const step = onboardingStep(draft);
    await recordStep(retailer, step);
    return res.status(200).json({
      success: true,
      data: {
        step,
        outletId,
        aadhaarPayReady: Number(draft.ap_status) !== 0,
        primaryKeyId: draft.primaryKeyId ?? null,
        encodeFPTxnId: draft.encodeFPTxnId ?? null,
        deviceIMEI: draft.deviceIMEI || retailer.icchhamatiAeps?.deviceIMEI || '',
        deviceName: draft.deviceName || retailer.icchhamatiAeps?.deviceName || '',
        profile,
      },
    });
  } catch (error) {
    return fail(res, 'status', error);
  }
};

/**
 * The provider's state list as [{ stateId, stateName }]. It ships a
 * "Select State" placeholder (id 99) and the same state twice under different
 * ids and casings (Uttarakhand, Puducherry); the first of each is kept.
 */
export const normaliseStates = (rows) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.stateCode && Number(row.activeFlag) !== 0)
    .map((row) => ({
      stateId: String(row.stateId),
      stateName: String(row.state ?? row.stateName ?? '').trim(),
    }))
    .filter(({ stateName }) => {
      const key = stateName.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.stateName.localeCompare(b.stateName));
};

/** Banks a customer can be served from: the list opens with a "Last Used Bank" row whose IIN is "NULL". */
export const normaliseBanks = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => /^\d+$/.test(String(row?.iinno ?? '')) && Number(row.activeFlag) !== 0)
    .map((row) => ({ iinno: String(row.iinno), bankName: String(row.bankName ?? '').trim() }));

let settlementBanks = null;
let settlementBanksAt = 0;

/**
 * GET /settlement-banks — bank names for the registration form. The AEPS bank
 * list needs an outlet, which a retailer has only after registering, so this
 * reads the cash-deposit list, which needs none. It is not every bank in
 * India, so the form still takes a typed name.
 */
export const getSettlementBanks = async (req, res) => {
  try {
    if (!settlementBanks || Date.now() - settlementBanksAt > 24 * 3600 * 1000) {
      const data = await icchhamatiPost('/api/v2/cash-deposit/bank-list', {});
      if (isOk(data) && Array.isArray(data.data)) {
        settlementBanks = [...new Set(normaliseBanks(data.data).map((b) => b.bankName).filter(Boolean))].sort(
          (a, b) => a.localeCompare(b)
        );
        settlementBanksAt = Date.now();
      }
    }
    return res.status(200).json({ success: true, data: settlementBanks || [] });
  } catch (error) {
    console.error('Icchhamati settlement banks error:', error?.message);
    return res.status(200).json({ success: true, data: settlementBanks || [] });
  }
};

export const getStates = async (req, res) => {
  try {
    const data = await icchhamatiGet('/api/v2/aeps/state-list');
    if (!isOk(data)) {
      return res
        .status(502)
        .json({ success: false, message: providerMessage(data, 'Could not load states.') });
    }
    return res.status(200).json({ success: true, data: normaliseStates(data.data) });
  } catch (error) {
    return fail(res, 'states', error);
  }
};

/**
 * POST /register — creates the provider draft. Identity (name, PAN, Aadhaar,
 * phone, email) comes from the retailer's KYC'd profile; the request supplies
 * only the shop location and the settlement bank account.
 */
export const register = async (req, res) => {
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer) return;
    const b = req.body || {};
    const required = [
      'latitude',
      'longitude',
      'shop_pin_code',
      'state_id',
      'account_number',
      'ifsc_code',
      'bank_name',
      'bank_branch',
    ];
    const missing = required.filter((k) => !String(b[k] ?? '').trim());
    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing: ${missing.join(', ')}` });
    }
    if (!/^\d{6}$/.test(String(b.shop_pin_code))) {
      return res.status(400).json({ success: false, message: 'Pincode must be 6 digits.' });
    }
    if (!/^\d{9,18}$/.test(String(b.account_number))) {
      return res
        .status(400)
        .json({ success: false, message: 'Account number must be 9 to 18 digits.' });
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(b.ifsc_code).toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Enter a valid IFSC code.' });
    }

    const data = await icchhamatiPost('/api/v2/aeps/draft', {
      latitude: String(b.latitude),
      longitude: String(b.longitude),
      shop_name: retailer.businessName,
      shop_address: b.shop_address || retailer.businessAddress,
      shop_city: b.shop_city || retailer.address?.city,
      shop_district: b.shop_district || retailer.address?.district,
      state_id: String(b.state_id),
      shop_pin_code: String(b.shop_pin_code),
      full_name: retailer.name,
      phone: retailer.contactNumber,
      email: retailer.email,
      pan_no: retailer.panNumber,
      aadhaar_number: retailer.aadhaarNumber,
      account_number: String(b.account_number),
      ifsc_code: String(b.ifsc_code).toUpperCase(),
      bank_name: String(b.bank_name),
      bank_branch: String(b.bank_branch),
    });
    if (!isOk(data)) {
      return res
        .status(400)
        .json({ success: false, message: providerMessage(data, 'AEPS registration failed.') });
    }

    const outletId = data.data?.outletId || data.data?.mid;
    if (!outletId) {
      console.error('Icchhamati AEPS draft returned no outlet id:', JSON.stringify(data));
      return res.status(502).json({
        success: false,
        message: 'The provider did not return a merchant id. Please try again.',
      });
    }
    retailer.icchhamatiAeps.outletId = String(outletId);
    retailer.icchhamatiAeps.draftId = data.data?.id ?? null;
    await retailer.save();
    return res.status(200).json({
      success: true,
      message: providerMessage(data, 'Registration saved'),
      data: { outletId },
    });
  } catch (error) {
    return fail(res, 'register', error);
  }
};

/**
 * PAN-keyed verification steps. Each maps a route to a provider path and the
 * request fields it may carry through; pan_no is always the retailer's.
 */
const VERIFY_STEPS = {
  'pan/verify': { path: '/api/v2/aeps/verify-pan', fields: [], ok: 'PAN verified' },
  'bank/verify': {
    path: '/api/v2/aeps/verify-bank-account',
    fields: [],
    ok: 'Bank account verified',
  },
  'mobile/send-otp': { path: '/api/v2/aeps/send-mobile-otp', fields: [], ok: 'OTP sent' },
  'mobile/verify-otp': {
    path: '/api/v2/aeps/verify-mobile-otp',
    fields: ['otp'],
    ok: 'Mobile verified',
  },
  'email/send-otp': { path: '/api/v2/aeps/send-email-otp', fields: [], ok: 'OTP sent' },
  'email/verify-otp': {
    path: '/api/v2/aeps/verify-email-otp',
    fields: ['otp'],
    ok: 'Email verified',
  },
  'aadhaar/send-otp': { path: '/api/v2/aeps/send-aadhaar-otp', fields: [], ok: 'OTP sent' },
  'aadhaar/verify-otp': {
    path: '/api/v2/aeps/verify-aadhaar-otp',
    fields: ['otp', 'txnid'],
    ok: 'Aadhaar verified',
  },
};

export const VERIFY_STEP_ROUTES = Object.keys(VERIFY_STEPS);

export const verifyStep = (route) => async (req, res) => {
  const step = VERIFY_STEPS[route];
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer || needOutlet(retailer, res)) return;
    const body = merchantKeys(retailer);
    for (const field of step.fields) {
      if (!String(req.body?.[field] ?? '').trim()) {
        return res.status(400).json({ success: false, message: `${field} is required` });
      }
      body[field] = String(req.body[field]).trim();
    }
    if (route === 'aadhaar/send-otp') body.aadhaar = retailer.aadhaarNumber;

    const data = await icchhamatiPost(step.path, body);
    // Aadhaar's OTP reference arrives at the top level, not under data.
    if (isOk(data) && data.txnid) {
      return res.status(200).json({
        success: true,
        message: providerMessage(data, step.ok),
        data: { txnid: data.txnid },
      });
    }
    return relay(res, data, step.ok, 'Verification failed.');
  } catch (error) {
    return fail(res, route, error);
  }
};

export const SHOP_IMAGE_TYPES = ['shop_inner', 'shop_outer'];

/** POST /shop-image (multipart `image`, `image_type` shop_inner | shop_outer). */
export const uploadShopImage = async (req, res) => {
  const filePath = req.file?.path;
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer || needOutlet(retailer, res)) return;
    const { latitude, longitude, image_type: imageType } = req.body || {};
    if (!filePath)
      return res.status(400).json({ success: false, message: 'Take the shop photo first.' });
    if (!SHOP_IMAGE_TYPES.includes(imageType)) {
      return res
        .status(400)
        .json({ success: false, message: 'image_type must be shop_inner or shop_outer.' });
    }
    if (!latitude || !longitude)
      return res.status(400).json({ success: false, message: 'Location is required.' });
    if (!req.file.mimetype?.startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'The shop photo must be an image.' });
    }
    // The provider takes JPG/PNG up to 500 KB; a phone photo is several MB.
    const photo = await sharp(filePath)
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer()
      .catch(() => null);
    if (!photo) {
      return res
        .status(400)
        .json({ success: false, message: 'Could not read the photo. Take it again as a JPG.' });
    }
    if (photo.length > 500 * 1024) {
      return res
        .status(400)
        .json({ success: false, message: 'The photo is too detailed to send. Please retake it.' });
    }

    const form = new FormData();
    for (const [key, value] of Object.entries({
      ...merchantKeys(retailer),
      image_type: imageType,
      latitude,
      longitude,
    })) {
      form.append(key, String(value));
    }
    form.append('image', new Blob([photo], { type: 'image/jpeg' }), `${imageType}.jpg`);
    const data = await icchhamatiPostForm('/api/v2/aeps/upload-shop-image', form);
    return relay(res, data, 'Shop photo uploaded', 'The shop photo could not be uploaded.');
  } catch (error) {
    return fail(res, 'shop image', error);
  } finally {
    if (filePath) fs.unlink(filePath).catch(() => {});
  }
};

/** The largest video Icchhamati takes as a file on upload-video-kyc. */
const ICCHHAMATI_VIDEO_FILE_LIMIT = 20 * 1024 * 1024;

/** Uploads to Icchhamati's Bunny Stream slot; null when they hand out none or the upload fails. */
const uploadToProviderSlot = async (retailer, filePath) => {
  const slot = await icchhamatiPost('/api/v2/aeps/generate-upload-token', {
    ...merchantKeys(retailer),
  });
  const {
    library_id: libraryId,
    video_id: videoId,
    api_key: apiKey,
    video_url: videoUrl,
  } = slot?.data && typeof slot.data === 'object' ? slot.data : {};
  if (!isOk(slot) || !libraryId || !videoId || !apiKey || !videoUrl) {
    console.warn(
      'Icchhamati video slot unavailable, using our storage:',
      providerMessage(slot, 'no slot')
    );
    return null;
  }
  const upload = await axios.put(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
    await fs.readFile(filePath),
    {
      headers: { AccessKey: apiKey, 'Content-Type': 'application/octet-stream' },
      maxBodyLength: Infinity,
      timeout: 120000,
      validateStatus: () => true,
    }
  );
  if (upload.status >= 300) {
    console.error(
      'Icchhamati video KYC upload failed, using our storage:',
      upload.status,
      upload.data
    );
    return null;
  }
  return videoUrl;
};

/**
 * POST /video-kyc (multipart `video`). The video is sent to Icchhamati as a
 * file, as their docs describe; if they refuse it, it is hosted (their Bunny
 * Stream slot, else our R2) and the URL is registered instead. Either way the
 * upload goes from here, so no provider key ever reaches a browser.
 */
export const uploadVideoKyc = async (req, res) => {
  const filePath = req.file?.path;
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer || needOutlet(retailer, res)) return;
    if (!filePath)
      return res.status(400).json({ success: false, message: 'Record the KYC video first.' });
    const { latitude, longitude } = req.body || {};
    if (!latitude || !longitude)
      return res.status(400).json({ success: false, message: 'Location is required.' });

    const place = {
      ...merchantKeys(retailer),
      latitude: String(latitude),
      longitude: String(longitude),
    };

    // The documented way: the video itself, as the multipart field video_url,
    // which Icchhamati hosts and answers with its own URL. They take 20 MB that
    // way; a larger clip (any Android phone) goes straight to the URL route.
    const type = req.file.mimetype || 'video/mp4';
    let data = null;
    if (req.file.size <= ICCHHAMATI_VIDEO_FILE_LIMIT) {
      const form = new FormData();
      for (const [key, value] of Object.entries(place)) form.append(key, value);
      form.append(
        'video_url',
        new Blob([await fs.readFile(filePath)], { type }),
        `video-kyc${type === 'video/quicktime' ? '.mov' : '.mp4'}`
      );
      data = await icchhamatiPostForm('/api/v2/aeps/upload-video-kyc', form);
    }

    if (!isOk(data)) {
      // What their portal does instead: host the video and register its URL.
      // Their Bunny Stream slot first; it is not set up for every partner
      // ("Video upload service not configured"), so then our own storage.
      if (data) {
        console.warn(
          'Icchhamati video KYC file upload refused, registering a URL:',
          providerMessage(data, 'no message')
        );
      }
      let videoUrl = await uploadToProviderSlot(retailer, filePath);
      if (!videoUrl) {
        const stored = await uploadOnR2(filePath, type);
        if (!stored?.url) {
          return res.status(502).json({
            success: false,
            message: 'The video could not be uploaded. Please try again.',
          });
        }
        videoUrl = stored.url;
      }
      data = await icchhamatiPost('/api/v2/aeps/upload-video-kyc', {
        ...place,
        video_url: videoUrl,
      });
    }
    return relay(res, data, 'Video KYC submitted', 'Video KYC could not be saved.');
  } catch (error) {
    return fail(res, 'video KYC', error);
  } finally {
    if (filePath) fs.unlink(filePath).catch(() => {});
  }
};

/** POST /onboard — creates the Fingpay merchant once every check has passed. */
export const onboard = async (req, res) => {
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer || needOutlet(retailer, res)) return;
    const data = await icchhamatiPost('/api/v2/aeps/onboard', {
      aeps_draft_id: retailer.icchhamatiAeps.draftId,
      ...merchantKeys(retailer),
    });
    // pending_status 7: the provider still needs (or is still reviewing) the video.
    if (Number(data?.pending_status) === 7) {
      return res.status(409).json({
        success: false,
        code: 'VIDEO_KYC_PENDING',
        message: providerMessage(data, 'Video KYC is pending.'),
      });
    }
    return relay(res, data, 'AEPS onboarding successful', 'AEPS onboarding failed.');
  } catch (error) {
    return fail(res, 'onboard', error);
  }
};

const requireDevice = (req, res) => {
  const deviceIMEI = String(req.body?.deviceIMEI ?? '').trim();
  if (!deviceIMEI)
    res.status(400).json({ success: false, message: 'Enter the scanner serial number.' });
  return deviceIMEI;
};

/** POST /ekyc/send-otp — starts the one-time merchant biometric eKYC. */
export const ekycSendOtp = async (req, res) => {
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer || needOutlet(retailer, res)) return;
    const deviceIMEI = requireDevice(req, res);
    if (!deviceIMEI) return;
    const { latitude, longitude } = req.body || {};
    if (!latitude || !longitude)
      return res.status(400).json({ success: false, message: 'Location is required.' });
    const data = await icchhamatiPost('/api/v2/aeps/get-otp', {
      latitude: String(latitude),
      longitude: String(longitude),
      deviceIMEI,
      ...merchantKeys(retailer),
    });
    if (!isOk(data) || fingpayFailed(data)) return relay(res, data, 'OTP sent', 'Could not send the eKYC OTP.');
    // Verify-otp and the fingerprint step need both ids; without them the OTP is useless.
    const inner = data.data?.data ?? data.data ?? {};
    const primaryKeyId = inner.primaryKeyId ?? data.data?.primaryKeyId ?? data.primaryKeyId;
    const encodeFPTxnId = inner.encodeFPTxnId ?? data.data?.encodeFPTxnId ?? data.encodeFPTxnId;
    if (!primaryKeyId || !encodeFPTxnId) {
      console.error('Icchhamati eKYC OTP returned no ids:', JSON.stringify(loggableResponse(data)));
      return res.status(502).json({
        success: false,
        message: inner.message || data.data?.message || 'The provider did not start eKYC. Please try again.',
      });
    }
    return res.status(200).json({
      success: true,
      message: inner.message || data.data?.message || 'OTP sent',
      data: { primaryKeyId: String(primaryKeyId), encodeFPTxnId: String(encodeFPTxnId) },
    });
  } catch (error) {
    return fail(res, 'eKYC OTP', error);
  }
};

const fpIds = (req, res) => {
  const { primaryKeyId, encodeFPTxnId } = req.body || {};
  if (!primaryKeyId || !encodeFPTxnId) {
    res.status(400).json({ success: false, message: 'Send the eKYC OTP first.' });
    return null;
  }
  return { primaryKeyId: String(primaryKeyId), encodeFPTxnId: String(encodeFPTxnId) };
};

export const ekycVerifyOtp = async (req, res) => {
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer || needOutlet(retailer, res)) return;
    const deviceIMEI = requireDevice(req, res);
    if (!deviceIMEI) return;
    const ids = fpIds(req, res);
    if (!ids) return;
    if (!/^\d{4,8}$/.test(String(req.body?.otp ?? '')))
      return res.status(400).json({ success: false, message: 'Enter the OTP.' });
    const data = await icchhamatiPost('/api/v2/aeps/verify-otp', {
      ...merchantKeys(retailer),
      deviceIMEI,
      otp: String(req.body.otp),
      ...ids,
    });
    return relay(res, data, 'OTP verified', 'OTP verification failed.');
  } catch (error) {
    return fail(res, 'eKYC verify', error);
  }
};

export const ekycBiometric = async (req, res) => {
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer || needOutlet(retailer, res)) return;
    const deviceIMEI = requireDevice(req, res);
    if (!deviceIMEI) return;
    const ids = fpIds(req, res);
    if (!ids) return;
    if (!req.body?.xml)
      return res.status(400).json({ success: false, message: 'Capture the fingerprint first.' });
    const data = await icchhamatiPost('/api/v2/aeps/biometric-ekyc', {
      ...merchantKeys(retailer),
      deviceIMEI,
      xml: String(req.body.xml),
      ...ids,
    });
    return relay(res, data, 'eKYC completed', 'Biometric eKYC failed.');
  } catch (error) {
    return fail(res, 'eKYC biometric', error);
  }
};

/** POST /2fa — the merchant's daily fingerprint login, separately for AEPS and Aadhaar Pay. */
export const twoFactor = async (req, res) => {
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer || needOutlet(retailer, res)) return;
    const deviceIMEI = requireDevice(req, res);
    if (!deviceIMEI) return;
    if (!req.body?.xml)
      return res.status(400).json({ success: false, message: 'Capture the fingerprint first.' });
    const data = await icchhamatiPost('/api/v2/aeps/2fa', {
      ...merchantKeys(retailer),
      deviceIMEI,
      deviceType: req.body.deviceType,
      xml: String(req.body.xml),
      primaryKeyId: req.body.primaryKeyId,
      encodeFPTxnId: req.body.encodeFPTxnId,
      serviceType: req.body.serviceType === 'AP' ? 'AP' : 'AEPS',
    });
    return relay(res, data, 'Daily authentication complete', 'Daily authentication failed.');
  } catch (error) {
    return fail(res, '2FA', error);
  }
};

/** POST /device — registers the scanner the merchant authenticates with. */
export const changeDevice = async (req, res) => {
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer || needOutlet(retailer, res)) return;
    const deviceIMEI = requireDevice(req, res);
    if (!deviceIMEI) return;
    const deviceName = String(req.body?.deviceName ?? '').trim();
    if (!deviceName)
      return res.status(400).json({ success: false, message: 'Select the scanner model.' });
    const data = await icchhamatiPost('/api/v2/aeps/change-device', {
      ...merchantKeys(retailer),
      deviceIMEI,
      deviceName,
    });
    if (isOk(data)) {
      retailer.icchhamatiAeps.deviceIMEI = deviceIMEI;
      retailer.icchhamatiAeps.deviceName = deviceName;
      await retailer.save();
    }
    return relay(res, data, 'Device updated', 'Could not update the device.');
  } catch (error) {
    return fail(res, 'device', error);
  }
};

// --- Transactions ----------------------------------------------------------

let cachedBanks = null;
let banksCachedAt = 0;

/** GET /banks — [{ iinno, bankName }], cached for a day. */
export const getBanks = async (req, res) => {
  try {
    if (cachedBanks && Date.now() - banksCachedAt < 24 * 3600 * 1000) {
      return res.status(200).json({ success: true, data: cachedBanks });
    }
    // The list is the same for every outlet, but an API partner must name one.
    const retailer = await loadRetailer(req, res);
    if (!retailer || needOutlet(retailer, res)) return;
    const data = await icchhamatiPost('/api/v2/aeps/bank-list', { outletId: outletOf(retailer) });
    if (isOk(data) && Array.isArray(data.data)) {
      cachedBanks = normaliseBanks(data.data);
      banksCachedAt = Date.now();
      return res.status(200).json({ success: true, data: cachedBanks });
    }
    if (cachedBanks) return res.status(200).json({ success: true, data: cachedBanks });
    return res
      .status(502)
      .json({ success: false, message: providerMessage(data, 'Could not load banks.') });
  } catch (error) {
    if (cachedBanks) return res.status(200).json({ success: true, data: cachedBanks });
    return fail(res, 'banks', error);
  }
};

const AEPS_TYPES = ['CW', 'BE', 'MS', 'M'];
const MONEY_TYPES = ['CW', 'M'];

/** Request validation shared by the OTP and the transaction itself. */
const readTxnRequest = (body = {}) => {
  const aepsType = String(body.aepsType || '').toUpperCase();
  const aadhaarNumber = String(body.aadhaarNumber ?? '').replace(/\D/g, '');
  const customerMobile = String(body.customerMobile ?? '').replace(/\D/g, '');
  const bankID = String(body.bankID ?? '').trim();
  const amount = Number(body.amount);
  if (!AEPS_TYPES.includes(aepsType)) return { error: 'Choose a transaction type.' };
  if (!/^\d{12}$/.test(aadhaarNumber)) return { error: 'Aadhaar number must be 12 digits.' };
  if (!/^[6-9]\d{9}$/.test(customerMobile))
    return { error: 'Enter the customer’s 10-digit mobile number.' };
  if (!bankID) return { error: 'Select the customer’s bank.' };
  if (MONEY_TYPES.includes(aepsType)) {
    if (!Number.isFinite(amount) || amount < 1) return { error: 'Enter an amount.' };
    if (amount > AEPS_MAX_AMOUNT)
      return { error: `Amount cannot exceed ₹${AEPS_MAX_AMOUNT} per transaction.` };
  }
  return {
    aepsType,
    aadhaarNumber,
    customerMobile,
    bankID,
    amount: MONEY_TYPES.includes(aepsType) ? amount : undefined,
  };
};

/** POST /txn-otp — customer OTP, required for CW and Aadhaar Pay above ₹5,000. */
export const sendTxnOtp = async (req, res) => {
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer || needOutlet(retailer, res)) return;
    const txn = readTxnRequest(req.body);
    if (txn.error) return res.status(400).json({ success: false, message: txn.error });
    if (!MONEY_TYPES.includes(txn.aepsType))
      return res
        .status(400)
        .json({ success: false, message: 'OTP applies to withdrawals and Aadhaar Pay only.' });
    const data = await icchhamatiPost('/api/v2/aeps/send-aeps-otp', {
      outletId: outletOf(retailer),
      customerMobile: txn.customerMobile,
      aadhaarNumber: txn.aadhaarNumber,
      bankID: txn.bankID,
      aepsType: txn.aepsType,
      amount: txn.amount,
      deviceIMEI: retailer.icchhamatiAeps?.deviceIMEI || undefined,
    });
    const txnOtpRequestId =
      data?.txnOtpRequestId || data?.fpTransactionId || data?.data?.fpTransactionId;
    if (isOk(data) && txnOtpRequestId) {
      return res.status(200).json({
        success: true,
        message: providerMessage(data, 'OTP sent'),
        data: { txnOtpRequestId },
      });
    }
    return res
      .status(400)
      .json({ success: false, message: providerMessage(data, 'Could not send the OTP.') });
  } catch (error) {
    return fail(res, 'transaction OTP', error);
  }
};

/** Credits an Aadhaar Pay once, like PaySprint's: the full amount to the AEPS wallet. */
const applyAadhaarPaySuccess = async ({ transactionId, userId, amount, providerRef, message }) => {
  const session = await mongoose.startSession();
  try {
    let claimed = null;
    await session.withTransaction(async () => {
      claimed = await Transaction.findOneAndUpdate(
        { _id: transactionId, status: { $in: ['PENDING', 'PROCESSING'] } },
        {
          $set: {
            status: 'SUCCESS',
            'metadata.providerRef': providerRef,
            'metadata.gatewayMessage': message,
          },
        },
        { session, new: true }
      );
      if (!claimed) return;
      await AepsWallet.findOneAndUpdate(
        { userId, userModel: 'Retailer' },
        { $inc: { balance: Number(amount) } },
        { upsert: true, session }
      );
    });
    return claimed;
  } finally {
    session.endSession();
  }
};

/**
 * POST /transaction — CW, BE, MS or Aadhaar Pay (M). Withdrawals and Aadhaar
 * Pay are recorded before the provider is called, so a crash mid-call leaves a
 * PROCESSING row for an admin rather than money with no trace.
 */
export const doTransaction = async (req, res) => {
  let record = null;
  try {
    const retailer = await loadRetailer(req, res);
    if (!retailer || needOutlet(retailer, res)) return;
    const txn = readTxnRequest(req.body);
    if (txn.error) return res.status(400).json({ success: false, message: txn.error });
    const { xml, bankName, deviceType, otp, txnOtpRequestId } = req.body;
    if (!xml)
      return res
        .status(400)
        .json({ success: false, message: 'Capture the customer’s fingerprint first.' });
    if (
      MONEY_TYPES.includes(txn.aepsType) &&
      txn.amount > AEPS_OTP_THRESHOLD &&
      (!otp || !txnOtpRequestId)
    ) {
      return res.status(400).json({
        success: false,
        message: `Customer OTP is required above ₹${AEPS_OTP_THRESHOLD}.`,
      });
    }

    if (MONEY_TYPES.includes(txn.aepsType)) {
      record = await Transaction.create({
        transactionId: makeReferenceId(txn.aepsType === 'M' ? 'IAP' : 'ICW'),
        userId: retailer._id,
        type: txn.aepsType === 'M' ? 'AADHAAR_PAY' : 'AEPS_WITHDRAWAL',
        amount: txn.amount,
        status: 'PENDING',
        metadata: {
          provider: 'icchhamati',
          outletId: outletOf(retailer),
          aadhaar: maskAadhaar(txn.aadhaarNumber),
          bankIIN: txn.bankID,
          bankName,
          mobile: txn.customerMobile,
        },
      });
    }

    let data;
    try {
      data = await icchhamatiPost('/api/v2/aeps/doAeps', {
        outletId: outletOf(retailer),
        customerMobile: txn.customerMobile,
        aadhaarNumber: txn.aadhaarNumber,
        bankID: txn.bankID,
        bankName: bankName || '',
        deviceType: deviceType || retailer.icchhamatiAeps?.deviceName || '',
        aepsType: txn.aepsType,
        amount: txn.amount ?? '',
        xml: String(xml),
        deviceIMEI: retailer.icchhamatiAeps?.deviceIMEI || undefined,
        otp: otp || undefined,
        txnOtpRequestId: txnOtpRequestId || undefined,
      });
    } catch (error) {
      // A timeout says nothing about whether the bank debited the customer.
      console.error('Icchhamati doAeps request error:', error.message);
      data = null;
    }

    const outcome = transactionOutcome(data);
    const result = data?.data || {};
    const message = providerMessage(
      data,
      outcome === 'SUCCESS' ? 'Transaction successful' : 'Transaction failed'
    );
    const receipt = {
      ...result,
      aepsType: txn.aepsType,
      bankName,
      aadhaar: maskAadhaar(txn.aadhaarNumber),
      customerMobile: txn.customerMobile,
      shopName: data?.shop_name || retailer.businessName,
      referenceNo: record?.transactionId,
    };

    if (!record) {
      // Balance enquiry and mini statement move no money; just relay.
      return outcome === 'SUCCESS'
        ? res.status(200).json({ success: true, message, data: receipt })
        : res.status(400).json({ success: false, message, data: receipt });
    }

    const providerRef = result.fpTransactionId || result.bankRRN || undefined;
    if (result.balanceAmount !== undefined && Number.isFinite(Number(result.balanceAmount))) {
      record.metadata = { ...record.metadata, bankBalance: Number(result.balanceAmount) };
    }
    record.metadata = {
      ...record.metadata,
      bankRRN: result.bankRRN,
      fpTransactionId: result.fpTransactionId,
    };
    await record.save();

    if (outcome === 'SUCCESS') {
      const credited =
        txn.aepsType === 'M'
          ? await applyAadhaarPaySuccess({
              transactionId: record._id,
              userId: retailer._id,
              amount: txn.amount,
              providerRef,
              message,
            })
          : await applyAepsWithdrawalSuccess({
              transactionId: record._id,
              userId: retailer._id,
              amount: txn.amount,
              paysprintRef: providerRef,
              message,
            });
      if (!credited)
        return res
          .status(409)
          .json({ success: false, message: 'Transaction was already resolved.', data: receipt });
      return res.status(200).json({ success: true, message, data: receipt });
    }

    record.status = outcome;
    record.metadata = {
      ...record.metadata,
      gatewayMessage: message,
      needsReconciliation: outcome === 'PROCESSING' || undefined,
    };
    await record.save();
    if (outcome === 'PROCESSING') {
      return res.status(202).json({
        success: false,
        message:
          'The bank has not confirmed this transaction yet. Do not retry — it will be checked and settled.',
        data: { ...receipt, verification: 'PENDING' },
      });
    }
    return res.status(400).json({ success: false, message, data: receipt });
  } catch (error) {
    console.error('Icchhamati AEPS transaction error:', error.message);
    if (record && record.status === 'PENDING') {
      await Transaction.updateOne(
        { _id: record._id, status: 'PENDING' },
        { $set: { status: 'PROCESSING', 'metadata.needsReconciliation': true } }
      ).catch(() => {});
    }
    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Check the transaction report before retrying.',
    });
  }
};
