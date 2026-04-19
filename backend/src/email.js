const { Resend } = require('resend');

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.EMAIL_FROM || 'noreply@myinstitute.com';
const BRAND_COLOR = '#065f46';

async function sendVerificationEmail({ to, name, verificationUrl }) {
  const resend = getResend();

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
      <h2 style="color: ${BRAND_COLOR};">Verify your email</h2>
      <p>Hi ${name},</p>
      <p>Thanks for registering with My Institute. Click the button below to verify your email address.</p>
      <p style="margin: 32px 0;">
        <a href="${verificationUrl}" style="background: ${BRAND_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Verify Email</a>
      </p>
      <p style="color: #555; font-size: 14px;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
    </div>
  `;

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Verify your My Institute account',
    html,
  });
}

async function sendContactNotification({ to, firstName, lastName, email, phone, subject, message }) {
  const resend = getResend();

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
      <h2 style="color: ${BRAND_COLOR};">New Contact Message</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 6px 0; color: #555; width: 140px;">Name</td><td style="padding: 6px 0; font-weight: bold;">${firstName} ${lastName}</td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Email</td><td style="padding: 6px 0;">${email}</td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Phone</td><td style="padding: 6px 0;">${phone || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Subject</td><td style="padding: 6px 0;">${subject || '—'}</td></tr>
      </table>
      <p style="background: #f5f5f5; padding: 12px; border-radius: 6px;">${message}</p>
    </div>
  `;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Contact: ${firstName} ${lastName}`,
    html,
  });
}

module.exports = { sendVerificationEmail, sendContactNotification };
