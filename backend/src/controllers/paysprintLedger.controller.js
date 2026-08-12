import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const demoDataPath = path.join(__dirname, '../data/paysprintCreditLedger.demo.json');

const PORTAL_BASE_URL = 'https://api.paysprint.in/api/v1';
const GET_CREDIT_RECORDS_PATH = '/statement-new/transactioncashdeposite/getRecords';
const DOWNLOAD_CREDIT_PATH = '/statement-new/transactioncashdeposite/download';

const loadDemoData = () => {
  try {
    return JSON.parse(fs.readFileSync(demoDataPath, 'utf8'));
  } catch (e) {
    console.error('Failed to load paysprint credit ledger demo data:', e);
    return [];
  }
};

const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const normalizeLedgerRow = (row) => ({
  SNO: String(row.SNO ?? row.sno ?? row.id ?? ''),
  USERNAME: String(row.USERNAME ?? row.username ?? row.merchant_code ?? ''),
  OPENING: toNumber(row.OPENING ?? row.opening ?? row.openingBalance),
  AMOUNT: toNumber(row.AMOUNT ?? row.amount),
  COMMISSION: toNumber(row.COMMISSION ?? row.commission),
  TDS: toNumber(row.TDS ?? row.tds),
  GST: toNumber(row.GST ?? row.gst),
  CLOSING: toNumber(row.CLOSING ?? row.closing ?? row.closingBalance),
  TYPE: String(row.TYPE ?? row.type ?? 'credit').toLowerCase(),
  NARRATION: String(row.NARRATION ?? row.narration ?? ''),
  remarks: String(row.remarks ?? row.Remarks ?? ''),
  TXNTYPE: String(row.TXNTYPE ?? row.txntype ?? row.txnType ?? ''),
  DATE: String(row.DATE ?? row.date ?? row.datetime ?? ''),
});

const normalizeResponseRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r === 'object')
    .map(normalizeLedgerRow)
    .sort((a, b) => (a.DATE < b.DATE ? 1 : a.DATE > b.DATE ? -1 : 0));
};

const getPortalCredentials = () => ({
  token: process.env.PAYSPRINT_PORTAL_TOKEN || '',
  authkey: process.env.PAYSPRINT_PORTAL_AUTHKEY || '',
  email: process.env.PAYSPRINT_PORTAL_EMAIL || '',
  password: process.env.PAYSPRINT_PORTAL_PASSWORD || '',
});

const hasPortalCredentials = (creds) => Boolean(creds.token || (creds.email && creds.password));

const loginToPortal = async () => {
  const creds = getPortalCredentials();
  if (!creds.token && !(creds.email && creds.password)) {
    return null;
  }

  // If a portal token is already provided, use it directly.
  if (creds.token) {
    return { token: creds.token, authkey: creds.authkey };
  }

  try {
    const response = await axios.post(
      `${PORTAL_BASE_URL}/login/login`,
      new URLSearchParams({
        username: creds.email,
        password: creds.password,
        latitude: '28.6139',
        longitude: '77.2090',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 }
    );

    const data = response.data;
    if (data?.status === true && data?.authtoken) {
      return { token: data.authtoken, authkey: creds.authkey };
    }
    console.warn(
      'Paysprint portal login failed:',
      data?.message || data?.statuscode || 'unknown error'
    );
    return null;
  } catch (error) {
    console.warn('Paysprint portal login error:', error?.response?.data || error.message);
    return null;
  }
};

export const getPaysprintCreditLedger = async (req, res) => {
  const { startDate, endDate, limit = 500, source } = req.query;
  const creds = getPortalCredentials();

  // Explicit demo source, or no portal credentials configured -> serve demo data.
  const useDemo = source === 'demo' || !hasPortalCredentials(creds);

  if (useDemo) {
    let rows = loadDemoData();
    if (startDate && endDate) {
      rows = rows.filter((r) => {
        const d = r.DATE || '';
        return d >= startDate && d <= endDate;
      });
    }
    return res.status(200).json({
      success: true,
      source: 'demo',
      message:
        'Demo data from the last-week credit ledger export. Configure PAYSPRINT_PORTAL_TOKEN/AUTHKEY in backend/.env for live data.',
      total: rows.length,
      data: rows.slice(0, Number(limit) || 500),
    });
  }

  try {
    const session = await loginToPortal();
    if (!session || !session.token) {
      return res.status(200).json({
        success: true,
        source: 'demo',
        message:
          'Paysprint portal login failed — showing demo data. Check PAYSPRINT_PORTAL_EMAIL/PASSWORD or PAYSPRINT_PORTAL_TOKEN in backend/.env.',
        total: 0,
        data: [],
      });
    }

    const today = new Date();
    const defaultEnd = today.toISOString().slice(0, 10);
    const defaultStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const formData = new URLSearchParams({
      token: session.token,
      Authkey: session.authkey,
      length: String(Number(limit) || 500),
      search: '',
      start: '0',
      orderby: '',
      dir: '',
      startdate: startDate || defaultStart,
      enddate: endDate || defaultEnd,
      searchby: '',
      status: '',
      bankid: '',
      type: '',
      is_exceptional: '',
    });

    const response = await axios.post(`${PORTAL_BASE_URL}${GET_CREDIT_RECORDS_PATH}`, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000,
    });

    const data = response.data;
    if (data?.status === false && data?.statuscode === 2001) {
      return res.status(200).json({
        success: true,
        source: 'demo',
        message:
          'Paysprint portal token does not have permission for the credit ledger — showing demo data. Provide a valid PAYSPRINT_PORTAL_TOKEN.',
        total: 0,
        data: [],
      });
    }

    if (!data?.data || !Array.isArray(data.data)) {
      return res.status(502).json({
        success: false,
        message: 'Unexpected response from Paysprint ledger API',
        response: data,
      });
    }

    const rows = normalizeResponseRows(data.data);
    return res.status(200).json({ success: true, source: 'live', total: rows.length, data: rows });
  } catch (error) {
    console.error('Paysprint credit ledger fetch error:', error?.response?.data || error.message);
    return res.status(502).json({
      success: false,
      message: 'Failed to fetch Paysprint credit ledger',
      error: error?.response?.data || error.message,
    });
  }
};

export const downloadPaysprintCreditLedger = async (req, res) => {
  const { startDate, endDate, limit = 500, source } = req.query;

  if (source === 'demo' || !hasPortalCredentials(getPortalCredentials())) {
    let rows = loadDemoData();
    if (startDate && endDate) {
      rows = rows.filter((r) => {
        const d = r.DATE || '';
        return d >= startDate && d <= endDate;
      });
    }
    rows = rows.slice(0, Number(limit) || 500);
    return res.status(200).json({ success: true, source: 'demo', total: rows.length, data: rows });
  }

  try {
    const session = await loginToPortal();
    if (!session || !session.token) {
      return res.status(502).json({ success: false, message: 'Paysprint portal login failed' });
    }

    const today = new Date();
    const defaultEnd = today.toISOString().slice(0, 10);
    const defaultStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const formData = new URLSearchParams({
      token: session.token,
      Authkey: session.authkey,
      length: String(Number(limit) || 500),
      search: '',
      start: '0',
      orderby: '',
      dir: '',
      startdate: startDate || defaultStart,
      enddate: endDate || defaultEnd,
      searchby: '',
      status: '',
      bankid: '',
      type: '',
      is_exceptional: '',
    });

    const response = await axios.post(`${PORTAL_BASE_URL}${DOWNLOAD_CREDIT_PATH}`, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000,
    });

    const data = response.data;
    if (!data?.data || !Array.isArray(data.data)) {
      return res.status(502).json({
        success: false,
        message: 'Unexpected response from Paysprint ledger download',
        response: data,
      });
    }

    const rows = normalizeResponseRows(data.data);
    return res.status(200).json({ success: true, source: 'live', total: rows.length, data: rows });
  } catch (error) {
    console.error(
      'Paysprint credit ledger download error:',
      error?.response?.data || error.message
    );
    return res.status(502).json({
      success: false,
      message: 'Failed to download Paysprint credit ledger',
      error: error?.response?.data || error.message,
    });
  }
};
