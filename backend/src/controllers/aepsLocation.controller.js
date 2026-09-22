import Retailer from '../models/users/retailer.model.js';
import { updateMerchantLocation } from '../utils/paysprint.util.js';

// PaySprint's documented cap. Past it the API keeps answering "success" without
// applying anything, so the only way to give a retailer an honest answer is to
// count the successful changes ourselves.
const MAX_UPDATES_PER_YEAR = 3;

// A shop is a fixed place. Coordinates outside India's bounding box are a
// device with a broken GPS fix, not a relocation, and spending one of three
// yearly updates on them would strand the retailer at the wrong location.
const IN_BOUNDS = { minLat: 6, maxLat: 37.5, minLong: 68, maxLong: 97.5 };

const quotaFor = (retailer) => {
  const year = new Date().getFullYear();
  const stored = retailer.aepsBaseLocation || {};
  const used = stored.countYear === year ? stored.countThisYear || 0 : 0;
  return { year, used, remaining: Math.max(0, MAX_UPDATES_PER_YEAR - used) };
};

/** What the retailer's registered base location is, and how many changes are left. */
export const getBaseLocation = async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.user.id).select('aepsBaseLocation');
    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found.' });

    const { year, used, remaining } = quotaFor(retailer);
    const stored = retailer.aepsBaseLocation || {};
    return res.status(200).json({
      success: true,
      data: {
        lat: stored.lat ?? null,
        long: stored.long ?? null,
        updatedAt: stored.updatedAt ?? null,
        usedThisYear: used,
        remainingThisYear: remaining,
        maxPerYear: MAX_UPDATES_PER_YEAR,
        year,
      },
    });
  } catch (error) {
    console.error('[AEPS Location] getBaseLocation failed:', error);
    return res.status(500).json({ success: false, message: 'Could not load your shop location.' });
  }
};

/**
 * Re-registers the retailer's shop coordinates with PaySprint.
 *
 * This is the manual counterpart to the automatic recovery in
 * postAepsTransactionWithGeoRecovery: that one fires on a geo-fence decline
 * mid-transaction, this one lets a retailer fix the location deliberately —
 * after moving shop, or when declines keep happening.
 */
export const updateBaseLocation = async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const long = Number(req.body?.long);

    if (!Number.isFinite(lat) || !Number.isFinite(long)) {
      return res
        .status(400)
        .json({ success: false, message: 'Your location could not be read. Please try again.' });
    }
    if (
      lat < IN_BOUNDS.minLat || lat > IN_BOUNDS.maxLat ||
      long < IN_BOUNDS.minLong || long > IN_BOUNDS.maxLong
    ) {
      return res.status(400).json({
        success: false,
        message:
          'That location does not look like your shop. Please allow precise location and try again from the shop.',
      });
    }

    const retailer = await Retailer.findById(req.user.id).select(
      'retailerId contactNumber activeAepsPipes aepsBaseLocation'
    );
    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found.' });

    const { year, used, remaining } = quotaFor(retailer);
    if (remaining <= 0) {
      return res.status(429).json({
        success: false,
        message: `You have used all ${MAX_UPDATES_PER_YEAR} location updates allowed for ${year}. Please contact support.`,
        data: { usedThisYear: used, remainingThisYear: 0, maxPerYear: MAX_UPDATES_PER_YEAR, year },
      });
    }

    // The pipe the retailer is actually onboarded on. PaySprint only supports
    // bank2, bank5 and bank6 here; anything else is left off so the provider
    // applies it to the default pipe rather than rejecting the call.
    const supported = ['bank2', 'bank5', 'bank6'];
    const pipe = (retailer.activeAepsPipes || []).find((p) => supported.includes(String(p).toLowerCase()));

    const result = await updateMerchantLocation({
      merchantcode: retailer.retailerId,
      mobile: retailer.contactNumber,
      lat,
      long,
      pipe,
      accessmode: String(req.body?.accessmode || 'SITE').toUpperCase() === 'APP' ? 'APP' : 'SITE',
    });

    const ok =
      result && (result.status === true || String(result.response_code) === '1');
    if (!ok) {
      console.error('[AEPS Location] provider refused the update:', JSON.stringify(result || 'no response'));
      return res.status(502).json({
        success: false,
        message: result?.message || 'The provider could not update your location. Please try again.',
      });
    }

    // Counted only after the provider accepted it, so a failed call never costs
    // the retailer one of their three.
    retailer.aepsBaseLocation = {
      lat,
      long,
      updatedAt: new Date(),
      countYear: year,
      countThisYear: used + 1,
    };
    await retailer.save();

    return res.status(200).json({
      success: true,
      message: 'Your shop location has been updated. Try the transaction again.',
      data: {
        lat,
        long,
        usedThisYear: used + 1,
        remainingThisYear: remaining - 1,
        maxPerYear: MAX_UPDATES_PER_YEAR,
        year,
      },
    });
  } catch (error) {
    console.error('[AEPS Location] updateBaseLocation failed:', error);
    return res.status(500).json({ success: false, message: 'Could not update your shop location.' });
  }
};
