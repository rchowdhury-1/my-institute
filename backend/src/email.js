const { Resend } = require('resend');

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
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

/**
 * Sends a welcome email to an admin-provisioned teacher or student.
 * Contains their login email, temporary password, and a link to the login page.
 * Fire-and-forget: errors are logged but never thrown — user creation succeeds regardless.
 * No-ops silently when RESEND_API_KEY is not configured.
 */
async function sendWelcomeEmail({ to, name, email, tempPassword, role }) {
  const resend = getResend();
  if (!resend) {
    console.error('sendWelcomeEmail: RESEND_API_KEY not set — email skipped. Share login details manually.');
    return;
  }

  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
  const roleLabel = role === 'teacher' ? 'teacher' : 'student';

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
      <h2 style="color: ${BRAND_COLOR};">Welcome to My Institute</h2>
      <p>Hi ${name},</p>
      <p>Your ${roleLabel} account has been set up. Use the details below to log in for the first time.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr>
          <td style="padding: 8px 0; color: #555; width: 160px; vertical-align: top;">Email address</td>
          <td style="padding: 8px 0; font-weight: bold;">${email}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #555; vertical-align: top;">Temporary password</td>
          <td style="padding: 8px 0;">
            <span style="font-family: monospace; background: #f3f4f6; padding: 6px 12px; border-radius: 4px; font-size: 16px; letter-spacing: 0.05em; display: inline-block;">${tempPassword}</span>
          </td>
        </tr>
      </table>
      <p style="margin: 32px 0;">
        <a href="${loginUrl}" style="background: ${BRAND_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">Log in to My Institute</a>
      </p>
      <p style="color: #555; font-size: 14px;">You will be asked to set a new password when you first log in.</p>
      <p style="color: #555; font-size: 14px;">If you have any trouble, contact the institute directly.</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Welcome to My Institute — your login details',
      html,
    });
  } catch (err) {
    console.error('sendWelcomeEmail error:', err.message);
  }
}

module.exports = { sendVerificationEmail, sendContactNotification, sendWelcomeEmail };
