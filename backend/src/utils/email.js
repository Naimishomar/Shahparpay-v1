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
