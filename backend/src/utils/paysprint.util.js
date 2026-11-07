import jwt from 'jsonwebtoken';

// PaySprint now serves only Lead Generation (see lead.controller.js).

const generatePaySprintToken = () => {
  const jwtKeyBase64 = process.env.PAYSPRINT_JWT_KEY;
  const secret = Buffer.from(jwtKeyBase64, 'base64').toString('utf8');
  const partnerId = secret.substring(0, 8);

  const currentUnixTime = Math.floor(Date.now() / 1000);
  const payload = {
    timestamp: currentUnixTime, // PaySprint requires Unix seconds
    partnerId: partnerId,
    reqid: Math.floor(Math.random() * 1000000).toString(),
    iat: currentUnixTime - 60, // Backdate by 60s to fix clock drift 'Cannot handle token prior to' errors
  };

  const token = jwt.sign(payload, jwtKeyBase64, { algorithm: 'HS256' });
  return token;
};

export const generateLeadUrl = async (payloadData) => {
  try {
    const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
    const token = generatePaySprintToken();
    const headers = {
      Token: token,
      Authorisedkey: process.env.PAYSPRINT_AUTHORISED_KEY,
      'Content-Type': 'application/json',
    };

    const response = await fetch(`${baseUrl}/service/lead/generation`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payloadData),
    });

    const data = await response.json();
    if (data.status || data.response_code === 1) {
      return { success: true, message: data.message, data: data.data };
    }
    return { success: false, message: data.message || 'Failed to generate Lead URL.' };
  } catch (error) {
    console.error('generateLeadUrl error:', error);
    return { success: false, message: 'System error while generating Lead URL.' };
  }
};

export const checkLeadStatus = async (refid) => {
  try {
    const baseUrl = process.env.PAYSPRINT_BASE_URL || 'https://api.paysprint.in/api/v1';
    const token = generatePaySprintToken();
    const headers = {
      Token: token,
      Authorisedkey: process.env.PAYSPRINT_AUTHORISED_KEY,
      'Content-Type': 'application/json',
    };

    const response = await fetch(`${baseUrl}/service/lead/generation/status_check`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refid }),
    });

    const data = await response.json();
    if (data.status || data.response_code === 1) {
      return { success: true, message: data.message, data: data.data };
    }
    return { success: false, message: data.message || 'Failed to fetch Lead Status.' };
  } catch (error) {
    console.error('checkLeadStatus error:', error);
    return { success: false, message: 'System error while fetching Lead Status.' };
  }
};
