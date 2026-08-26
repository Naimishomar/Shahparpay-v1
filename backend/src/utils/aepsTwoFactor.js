/**
 * AEPS Two-Factor (daily auth) — per-pipe endpoints and response semantics.
 *
 * PaySprint exposes a DIFFERENT 2FA endpoint per bank pipe. Sending a bank5
 * merchant to bank2's URL does not fail loudly; it comes back as a generic
 * partner error, which is why this table exists instead of an inline ternary.
 *
 * Sources (pay-sprint.readme.io):
 *   bank2  /service/aeps/kyc/Twofactorkyc/authentication  + /registration
 *   bank3  /service/aeps/kyc/Twofactorkyc/auth_login      + /register_agent
 *   bank5  /service/aeps/kyc/v5/authentication            (no registration step)
 *   bank6  /service/aeps/kyc/v6/authentication            (no registration step)
 *   bank4  no 2FA endpoint is published (City Union onboards web-only)
 */
export const TWO_FACTOR_ENDPOINTS = {
  bank2: {
    auth: '/service/aeps/kyc/Twofactorkyc/authentication',
    register: '/service/aeps/kyc/Twofactorkyc/registration',
  },
  bank3: {
    auth: '/service/aeps/kyc/Twofactorkyc/auth_login',
    register: '/service/aeps/kyc/Twofactorkyc/register_agent',
  },
  bank5: { auth: '/service/aeps/kyc/v5/authentication', register: null },
  bank6: { auth: '/service/aeps/kyc/v6/authentication', register: null },
  bank4: null,
};

export const getTwoFactorEndpoints = (pipe) =>
  TWO_FACTOR_ENDPOINTS[String(pipe || '').toLowerCase()] ?? null;

/**
 * What a 2FA response actually means. PaySprint reuses `response_code` across
 * the auth and registration endpoints with different meanings per code, and
 * several of them are terminal for the CURRENT pipe but fine on another one —
 * so the caller needs to know whether to retry, fall back, or stop.
 *
 * `nextPipe: true` marks a pipe-level dead end (the partner account has no
 * entitlement, or that bank's service is down) where another approved pipe is
 * worth trying. `terminal: true` marks a state no retry can fix.
 */
export const classifyTwoFactorResponse = (data, { stage = 'auth' } = {}) => {
  if (!data) {
    return { outcome: 'failed', message: 'No response from the AEPS provider.', retryable: true };
  }

  const code = Number(data.response_code);
  const text = String(data.message || '').toLowerCase();

  // Registration answers 1 for both "registered" and "already registered"; the
  // distinction lives in errorcode, and either way the next step is auth.
  if (code === 1) {
    if (stage === 'register') {
      return { outcome: 'registered', message: data.message || 'Merchant registered.' };
    }
    return { outcome: 'success', message: data.message || 'Authentication successful.' };
  }

  // Documented on the auth endpoint as "Authentication Already Completed".
  // It is a success for the day, NOT a prompt to register again.
  if (code === 2 && stage === 'auth') {
    return { outcome: 'already_done', message: 'Daily authentication is already complete today.' };
  }

  if (
    code === 24 ||
    text.includes('onboarding is pending') ||
    text.includes('onboading is pending')
  ) {
    return {
      outcome: 'needs_web_onboarding',
      message: 'Merchant onboarding is still pending on this pipe. Complete Web KYC first.',
    };
  }

  if (code === 13 || text.includes('pipe is not activated')) {
    return {
      outcome: 'pipe_not_activated',
      nextPipe: true,
      message:
        'This bank pipe is not activated on the Shahparpay partner account. Ask PaySprint to enable it.',
    };
  }

  if (code === 12 || text.includes('service is down')) {
    return {
      outcome: 'service_down',
      nextPipe: true,
      retryable: true,
      message: "This bank's AEPS service is temporarily down. Try again shortly.",
    };
  }

  if (code === 15 || code === 10 || code === 11 || text.includes('invalid partner')) {
    return {
      outcome: 'partner_error',
      terminal: true,
      message: 'The AEPS provider rejected our partner credentials. Please contact support.',
    };
  }

  if (code === 23 || text.includes('blocked at npci')) {
    return {
      outcome: 'merchant_blocked',
      terminal: true,
      message: 'This merchant is blocked at NPCI. The bank must clear it before AEPS will work.',
    };
  }

  // 26, or 27 with a mapping message: the scanner belongs to another merchant.
  if (
    code === 26 ||
    text.includes('already mapped') ||
    text.includes('mapped with other merchant')
  ) {
    return {
      outcome: 'device_mapped',
      terminal: true,
      message:
        'This scanner is already mapped to another merchant on this pipe. Ask your provider to unbind it, or use a different scanner.',
    };
  }

  if (code === 27 || text.includes('capture failed') || text.includes('replug')) {
    return {
      outcome: 'capture_failed',
      retryable: true,
      message: 'The fingerprint capture was rejected. Replug the scanner and scan again.',
    };
  }

  if (code === 20 || text.includes('decry')) {
    return {
      outcome: 'partner_error',
      terminal: true,
      message: 'The AEPS provider could not read our request. Please contact support.',
    };
  }

  if (text.includes('aadhar data mismatch') || text.includes('merchant data mismatch')) {
    return {
      outcome: 'data_mismatch',
      terminal: true,
      message:
        'The Aadhaar details do not match the merchant record at the bank. Correct the KYC details first.',
    };
  }

  // Registration reports "registration is pending"/"not registered" on the auth
  // endpoint; that is the one case where auto-registration is the right move.
  if (text.includes('registration is pending') || text.includes('not registered')) {
    return { outcome: 'needs_registration', message: data.message || 'Registration pending.' };
  }

  return {
    outcome: 'failed',
    retryable: true,
    message: data.message || 'Daily authentication failed.',
  };
};

export default { TWO_FACTOR_ENDPOINTS, getTwoFactorEndpoints, classifyTwoFactorResponse };
