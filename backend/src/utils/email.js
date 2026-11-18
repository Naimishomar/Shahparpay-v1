
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
// Callers pass already-escaped name and otp.
const otpEmailHtml = (name, otp) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Your ShahparPay verification code</title></head>
<body style="margin:0;padding:0;background:#F4F4F5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your code is ${otp}. It expires in 5 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F4F5;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#090816;"><a href="${SITE_URL}"><img src="${SITE_URL}/email-hero.png" width="600" alt="ShahparPay" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>

    <tr><td align="center" style="padding:24px 48px 0;font-family:${FONT};">
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.35;font-weight:600;color:#111111;">Your verification code</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#6B6B76;">Hi ${name}, use this code to sign in to ShahparPay.<br>It expires in 5 minutes.</p>
    </td></tr>

    <tr><td align="center" style="padding:32px 48px;">
      <div style="display:inline-block;padding:16px 28px;background:#F4F2FF;border-radius:12px;font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:32px;line-height:1;font-weight:600;letter-spacing:10px;color:#4B2BD6;">${otp}</div>
    </td></tr>

    <tr><td align="center" style="padding:0 48px;font-family:${FONT};">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#8A8A94;">Never share this code. ShahparPay will never ask for it by call, SMS or WhatsApp. Didn't request it? Ignore this email.</p>
    </td></tr>

    <tr><td style="padding:32px 48px 0;"><div style="border-top:1px dashed #DCDCE0;height:0;line-height:0;font-size:0;">&nbsp;</div></td></tr>

    <tr><td align="center" style="padding:28px 48px 36px;font-family:${FONT};">
      <a href="${SITE_URL}" style="font-size:13px;color:#6B6B76;text-decoration:underline;">shahparpay.in</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

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

    const row = (label, value) =>
      value
        ? `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:14px;">${label}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(value)}</td></tr>`
        : '';

    await getTransporter().sendMail({
      from: `"${process.env.EMAIL_SENDER_NAME || 'ShahparPay'}" <${process.env.ETHEREAL_USERNAME}>`,
      to,
      replyTo: enquiry.email || undefined,
      // Newlines in a header are how header injection starts; the name is a
      // free-text field, so it is flattened to a single line first.
      subject: `New enquiry from ${String(enquiry.name).replace(/[\r\n]+/g, ' ').slice(0, 80)}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px;">
          <h2 style="color:#0f172a;margin:0 0 16px;">New contact enquiry</h2>
          <table style="border-collapse:collapse;width:100%;">
            ${row('Name', enquiry.name)}
            ${row('Mobile', enquiry.mobile)}
            ${row('Email', enquiry.email)}
            ${row('City', enquiry.city)}
          </table>
          <p style="color:#64748b;font-size:14px;margin:20px 0 6px;">Message</p>
          <div style="white-space:pre-wrap;color:#0f172a;font-size:15px;line-height:1.6;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">${escapeHtml(enquiry.message)}</div>
        </div>
      `,
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
    const row = (label, value) =>
      value
        ? `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:14px;">${label}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(value)}</td></tr>`
        : '';

    await getTransporter().sendMail({
      from: `"${process.env.EMAIL_SENDER_NAME || 'ShahparPay'}" <${process.env.ETHEREAL_USERNAME}>`,
      to,
      subject: `New ${role} signup: ${String(user.name).replace(/[\r\n]+/g, ' ').slice(0, 80)} — approval pending`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px;">
          <h2 style="color:#0f172a;margin:0 0 16px;">New ${escapeHtml(role)} signed up</h2>
          <table style="border-collapse:collapse;width:100%;">
            ${row('ID', user.id)}
            ${row('Name', user.name)}
            ${row('Business', user.businessName)}
            ${row('Mobile', user.contactNumber)}
            ${row('Email', user.email)}
          </table>
          <p style="color:#0f172a;font-size:15px;margin-top:20px;">Please review and approve this ID from the admin panel.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('[Signup] Could not send signup alert:', error.message);
    return false;
  }
};
