
import nodemailer from 'nodemailer';

// Built once, not per send. Creating the transport inside sendEmailOTP meant a
// fresh DNS + TCP + TLS + SMTP AUTH handshake to Gmail on every login, which is
// why POST /api/auth/login measured ~2.7s. `pool` keeps the authenticated
// connection open so later sends reuse it.
// Every mail goes out from ETHEREAL_USERNAME (a Gmail account + App Password).
// Env is read at container start: after changing .env, recreate the container
// (`docker compose up -d --force-recreate backend-api`); a plain restart keeps the old values.
let transporter;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      pool: true,
      maxConnections: 3,
      auth: {
        user: process.env.ETHEREAL_USERNAME,
        pass: process.env.ETHEREAL_PASSWORD,
      },
    });
  }
  return transporter;
};

// Mail clients can't load local files or SVGs, so images come from the live site
// (frontend/public/email-hero.png: dark banner with the logo baked in).
// Fixed URL, not FRONTEND_URL: that is localhost in dev.
const SITE_URL = 'https://www.shahparpay.in';
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

// Tables + inline styles because Gmail/Outlook ignore <style> blocks and flexbox.
// Shared frame for every mail: hero banner, `body` rows, dashed divider, footer.
// Callers pass already-escaped values.
const emailShell = (title, preheader, body) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#F4F4F5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F4F5;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#090816;"><a href="${SITE_URL}"><img src="${SITE_URL}/email-hero.png" width="600" alt="ShahparPay" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>
    ${body}
    <tr><td style="padding:32px 48px 0;"><div style="border-top:1px dashed #DCDCE0;height:0;line-height:0;font-size:0;">&nbsp;</div></td></tr>
    <tr><td align="center" style="padding:28px 48px 36px;font-family:${FONT};">
      <a href="${SITE_URL}" style="font-size:13px;color:#6B6B76;text-decoration:underline;">shahparpay.in</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

const headingRow = (heading, text) => `<tr><td align="center" style="padding:24px 48px 0;font-family:${FONT};">
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.35;font-weight:600;color:#111111;">${heading}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#6B6B76;">${text}</p>
    </td></tr>`;

// Label/value list for the admin mails. Escapes values; empty ones are skipped.
const detailsRow = (pairs) => `<tr><td style="padding:28px 48px 0;font-family:${FONT};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFAFB;border-radius:12px;">
        ${pairs.filter(([, value]) => value).map(([label, value], i) => `<tr>
          <td style="padding:12px 20px;${i ? 'border-top:1px solid #EEEEF1;' : ''}font-size:13px;color:#8A8A94;width:110px;">${label}</td>
          <td style="padding:12px 20px;${i ? 'border-top:1px solid #EEEEF1;' : ''}font-size:14px;color:#111111;font-weight:500;">${escapeHtml(value)}</td></tr>`).join('')}
      </table>
    </td></tr>`;

const otpEmailHtml = (name, otp) => emailShell('Your ShahparPay verification code', `Your code is ${otp}. It expires in 5 minutes.`, `
    ${headingRow('Your verification code', `Hi ${name}, use this code to sign in to ShahparPay.<br>It expires in 5 minutes.`)}
    <tr><td align="center" style="padding:32px 48px;">
      <div style="display:inline-block;padding:16px 28px;background:#F4F2FF;border-radius:12px;font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:32px;line-height:1;font-weight:600;letter-spacing:10px;color:#4B2BD6;">${otp}</div>
    </td></tr>
    <tr><td align="center" style="padding:0 48px;font-family:${FONT};">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#8A8A94;">Never share this code. ShahparPay will never ask for it by call, SMS or WhatsApp. Didn't request it? Ignore this email.</p>
    </td></tr>`);

export const sendEmailOTP = async (toEmail, toName, otp) => {
  try {
    const transporter = getTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_SENDER_NAME || 'ShahparPay'}" <${process.env.ETHEREAL_USERNAME}>`,
      to: toEmail,
      subject: `${otp} is your ShahparPay verification code`,
      text: `Hello ${toName || 'User'},\n\nYour ShahparPay verification code is ${otp}. It expires in 5 minutes.\n\nNever share this code with anyone. ShahparPay will never ask for it by call, SMS or WhatsApp.\n\nIf you didn't request this code, you can ignore this email.\n\n${SITE_URL}`,
      html: otpEmailHtml(escapeHtml(toName || 'User'), escapeHtml(otp)),
    };

    // Intentional: the operator reads OTPs from the server logs.
    console.log(`\n🔑 OTP GENERATED: [ ${otp} ]`);
    console.log(`✉️  SENT TO: ${toEmail}\n`);

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email OTP:', error);
    return false;
  }
};

/**
 * Forwards a public contact-form enquiry to whoever answers them.
 *
 * `replyTo` is the enquirer, so hitting reply in the inbox answers the person
 * rather than the app's own mailbox. The send is best-effort: the enquiry is
 * already stored before this runs, so a mail outage loses the notification but
 * never the enquiry itself.
 */
// The enquiry is whatever a stranger typed into a public form, so it is escaped
// before going anywhere near the notification's markup.
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const sendContactEnquiryEmail = async (enquiry) => {
  try {
    const to = process.env.CONTACT_RECIPIENT_EMAIL || process.env.ETHEREAL_USERNAME;
    if (!to) {
      console.error('[Contact] No CONTACT_RECIPIENT_EMAIL or ETHEREAL_USERNAME set — not notifying.');
      return false;
    }

    await getTransporter().sendMail({
      from: `"${process.env.EMAIL_SENDER_NAME || 'ShahparPay'}" <${process.env.ETHEREAL_USERNAME}>`,
      to,
      replyTo: enquiry.email || undefined,
      // Newlines in a header are how header injection starts; the name is a
      // free-text field, so it is flattened to a single line first.
      subject: `New enquiry from ${String(enquiry.name).replace(/[\r\n]+/g, ' ').slice(0, 80)}`,
      html: emailShell('New contact enquiry', `${escapeHtml(enquiry.name)} sent an enquiry from the website.`, `
        ${headingRow('New contact enquiry', 'Someone reached out from the website. Reply to this email to answer them directly.')}
        ${detailsRow([['Name', enquiry.name], ['Mobile', enquiry.mobile], ['Email', enquiry.email], ['City', enquiry.city]])}
        <tr><td style="padding:20px 48px 0;font-family:${FONT};">
          <p style="margin:0 0 8px;font-size:13px;color:#8A8A94;">Message</p>
          <div style="white-space:pre-wrap;padding:16px 20px;background:#FAFAFB;border-radius:12px;font-size:15px;line-height:1.6;color:#111111;">${escapeHtml(enquiry.message)}</div>
        </td></tr>`),
    });
    return true;
  } catch (error) {
    console.error('[Contact] Could not send enquiry notification:', error.message);
    return false;
  }
};

/**
 * Tells the admins a self-signed-up account is waiting for approval.
 * Best-effort: the account is already saved, so a mail failure only loses the alert.
 */
export const sendSignupAlertEmail = async (role, user) => {
  try {
    const to = process.env.SIGNUP_ALERT_EMAILS || 'shahparpay@gmail.com,naimishomar@gmail.com';
    await getTransporter().sendMail({
      from: `"${process.env.EMAIL_SENDER_NAME || 'ShahparPay'}" <${process.env.ETHEREAL_USERNAME}>`,
      to,
      subject: `New ${role} signup: ${String(user.name).replace(/[\r\n]+/g, ' ').slice(0, 80)} — approval pending`,
      html: emailShell(`New ${escapeHtml(role)} signup`, `${escapeHtml(user.name)} is waiting for approval.`, `
        ${headingRow(`New ${escapeHtml(role)} signed up`, 'This account is waiting for your approval.')}
        ${detailsRow([['ID', user.id], ['Name', user.name], ['Business', user.businessName], ['Mobile', user.contactNumber], ['Email', user.email]])}
        <tr><td align="center" style="padding:32px 48px 0;font-family:${FONT};">
          <a href="${SITE_URL}/admin" style="display:inline-block;padding:14px 32px;background:#4B2BD6;border-radius:10px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Review in admin panel</a>
        </td></tr>`),
    });
    return true;
  } catch (error) {
    console.error('[Signup] Could not send signup alert:', error.message);
    return false;
  }
};

/**
 * Tells a retailer the admin approved their account and they can sign in.
 * Best-effort: the approval is already saved, so a mail failure only loses the note.
 */
export const sendAccountApprovedEmail = async (user) => {
  if (!user?.email) return false;
  try {
    const name = escapeHtml(user.name || 'there');
    await getTransporter().sendMail({
      from: `"${process.env.EMAIL_SENDER_NAME || 'ShahparPay'}" <${process.env.ETHEREAL_USERNAME}>`,
      to: user.email,
      subject: 'Your ShahparPay account is approved',
      text: `Hello ${user.name || 'there'},\n\nYour ShahparPay account${user.id ? ` (ID ${user.id})` : ''} has been approved. Sign in with your Retailer ID, registered email or mobile number and your password to start working.\n\n${SITE_URL}/login`,
      html: emailShell('Your account is approved', 'Your ShahparPay account is approved. Sign in to start working.', `
        ${headingRow('Your account is approved', `Hi ${name}, your ShahparPay account has been approved.<br>Sign in with your Retailer ID, registered email or mobile number and your password to start working.`)}
        ${detailsRow([['Retailer ID', user.id], ['Name', user.name]])}
        <tr><td align="center" style="padding:32px 48px 0;font-family:${FONT};">
          <a href="${SITE_URL}/login" style="display:inline-block;padding:14px 32px;background:#4B2BD6;border-radius:10px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">Sign in to ShahparPay</a>
        </td></tr>`),
    });
    return true;
  } catch (error) {
    console.error('[Approval] Could not send approval email:', error.message);
    return false;
  }
};

/**
 * Notices the admin sends a retailer or distributor by picking a reason
 * (admin console "Send email"). Each is one template; the admin may add a note.
 * `cta` is a path on the site; the body is plain text, escaped when rendered.
 */
export const USER_NOTICE_REASONS = {
  registration_incomplete: {
    label: 'Registration incomplete',
    subject: 'Complete your ShahparPay registration',
    heading: 'Your registration is not complete',
    body: 'We could not finish setting up your ShahparPay account because some registration details are missing. Sign in and complete your profile so we can activate your services.',
    cta: ['Complete registration', '/profile'],
  },
  kyc_pending: {
    label: 'KYC pending',
    subject: 'Your ShahparPay KYC is pending',
    heading: 'Your KYC is still pending',
    body: 'AEPS and cash services stay locked until your KYC is complete. Sign in, open AEPS and finish the KYC steps (shop details, bank and biometric eKYC). It takes only a few minutes.',
    cta: ['Complete KYC', '/aeps'],
  },
  documents_required: {
    label: 'Documents required',
    subject: 'Documents needed for your ShahparPay account',
    heading: 'We need your documents',
    body: 'Some of your documents are missing or could not be verified. Please upload a clear photo of your Aadhaar and PAN from your profile so we can continue.',
    cta: ['Upload documents', '/profile'],
  },
  settlement_bank: {
    label: 'Add settlement bank',
    subject: 'Add your settlement bank account',
    heading: 'Add a settlement bank account',
    body: 'To withdraw your Trade Wallet balance to your bank, add and verify a settlement bank account from the Settlement page.',
    cta: ['Add bank account', '/aeps-settlement'],
  },
  account_inactive: {
    label: 'Account inactive',
    subject: 'Your ShahparPay account is inactive',
    heading: 'Your account is inactive',
    body: 'Your ShahparPay account is currently inactive, so you cannot use services right now. Please contact our support team to know the reason and get it reactivated.',
    cta: ['Contact support', '/contact'],
  },
  start_transacting: {
    label: 'No activity yet',
    subject: 'Start earning with ShahparPay',
    heading: 'Your account is ready to use',
    body: 'Your ShahparPay account is active but we have not seen any transactions yet. Sign in to start AEPS, money transfer, recharge and bill payments and earn commission on every transaction.',
    cta: ['Sign in to ShahparPay', '/login'],
  },
};

export const sendUserNoticeEmail = async (user, reasonKey, note) => {
  const r = USER_NOTICE_REASONS[reasonKey];
  if (!r || !user?.email) return false;
  const name = user.name || 'there';
  const extra = note ? `\n\nNote from our team: ${note}` : '';
  try {
    await getTransporter().sendMail({
      from: `"${process.env.EMAIL_SENDER_NAME || 'ShahparPay'}" <${process.env.ETHEREAL_USERNAME}>`,
      to: user.email,
      subject: r.subject,
      text: `Hello ${name},\n\n${r.body}${extra}\n\n${SITE_URL}${r.cta[1]}`,
      html: emailShell(r.heading, r.body, `
        ${headingRow(r.heading, `Hi ${escapeHtml(name)},<br>${escapeHtml(r.body)}`)}
        ${note ? `<tr><td style="padding:20px 48px 0;font-family:${FONT};"><div style="padding:14px 16px;background:#F4F1FF;border-radius:10px;font-size:14px;line-height:21px;color:#3B3B4F;"><b>Note from our team:</b> ${escapeHtml(note)}</div></td></tr>` : ''}
        ${detailsRow([[user.idLabel, user.id], ['Name', user.name]])}
        <tr><td align="center" style="padding:32px 48px 0;font-family:${FONT};">
          <a href="${SITE_URL}${r.cta[1]}" style="display:inline-block;padding:14px 32px;background:#4B2BD6;border-radius:10px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">${r.cta[0]}</a>
        </td></tr>`),
    });
    return true;
  } catch (error) {
    console.error('[Notice] Could not send notice email:', error.message);
    return false;
  }
};
