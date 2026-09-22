import nodemailer from 'nodemailer';

// Built once, not per send. Creating the transport inside sendEmailOTP meant a
// fresh DNS + TCP + TLS + SMTP AUTH handshake to Gmail on every login, which is
// why POST /api/auth/login measured ~2.7s. `pool` keeps the authenticated
// connection open so later sends reuse it.
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

export const sendEmailOTP = async (toEmail, toName, otp) => {
  try {
    const transporter = getTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_SENDER_NAME || 'ShahparPay'}" <${process.env.ETHEREAL_USERNAME}>`,
      to: toEmail,
      subject: 'Your ShahparPay Verification Code',
      html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
                    <h2 style="color: #333; text-align: center;">ShahparPay Verification</h2>
                    <p style="color: #555; font-size: 16px;">Hello ${toName || 'User'},</p>
                    <p style="color: #555; font-size: 16px;">Your verification code is:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #000; background-color: #f4f4f4; padding: 15px 30px; border-radius: 8px;">${otp}</span>
                    </div>
                    <p style="color: #555; font-size: 16px;">This code will expire in 5 minutes. Do not share this code with anyone.</p>
                    <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
                    <p style="color: #888; font-size: 12px; text-align: center;">If you didn't request this code, you can safely ignore this email.</p>
                </div>
            `,
    };

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
