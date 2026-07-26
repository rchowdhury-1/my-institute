const { Resend } = require('resend');
const { shouldSendEmail } = require('./lib/email-guard');

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = 'MY Institute <noreply@my-institute.com>';
const BRAND_COLOR = '#065f46';

function renderEmailLayout({ title, bodyHtml }) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
      <h2 style="color: ${BRAND_COLOR};">${title}</h2>
      ${bodyHtml}
    </div>
  `;
}

function renderCtaButton({ href, label, bold = false }) {
  const boldStyle = bold ? ' font-weight: bold;' : '';
  return `
      <p style="margin: 32px 0;">
        <a href="${href}" style="background: ${BRAND_COLOR}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;${boldStyle}">${label}</a>
      </p>`;
}

async function sendVerificationEmail({ to, name, verificationUrl }) {
  const guard = shouldSendEmail(to);
  if (!guard.allowed) return { email_sent: false, email_status: 'suppressed_test', email_error: null };

  const resend = getResend();
  if (!resend) {
    console.warn('sendVerificationEmail: RESEND_API_KEY not set — email skipped.');
    return { email_sent: false, email_status: 'disabled', email_error: null };
  }

  const html = renderEmailLayout({
    title: 'Verify your email',
    bodyHtml: `
      <p>Hi ${name},</p>
      <p>Thanks for registering with My Institute. Click the button below to verify your email address.</p>
      ${renderCtaButton({ href: verificationUrl, label: 'Verify Email' })}
      <p style="color: #555; font-size: 14px;">Please verify soon. If you didn't create an account, you can ignore this email.</p>
    `,
  });

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Verify your My Institute account',
      html,
    });
    return { email_sent: true, email_status: 'sent', email_error: null };
  } catch (err) {
    console.error('sendVerificationEmail error:', err);
    return { email_sent: false, email_status: 'failed', email_error: err.message };
  }
}

async function sendContactNotification({ to, firstName, lastName, email, phone, subject, message }) {
  const guard = shouldSendEmail(to);
  if (!guard.allowed) return { email_sent: false, email_status: 'suppressed_test', email_error: null };

  const resend = getResend();
  if (!resend) {
    console.warn('sendContactNotification: RESEND_API_KEY not set — email skipped.');
    return { email_sent: false, email_status: 'disabled', email_error: null };
  }

  const html = renderEmailLayout({
    title: 'New Contact Message',
    bodyHtml: `
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 6px 0; color: #555; width: 140px;">Name</td><td style="padding: 6px 0; font-weight: bold;">${firstName} ${lastName}</td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Email</td><td style="padding: 6px 0;">${email}</td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Phone</td><td style="padding: 6px 0;">${phone || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #555;">Subject</td><td style="padding: 6px 0;">${subject || '—'}</td></tr>
      </table>
      <p style="background: #f5f5f5; padding: 12px; border-radius: 6px;">${message}</p>
    `,
  });

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Contact: ${firstName} ${lastName}`,
      html,
    });
    return { email_sent: true, email_status: 'sent', email_error: null };
  } catch (err) {
    console.error('sendContactNotification error:', err);
    return { email_sent: false, email_status: 'failed', email_error: err.message };
  }
}

/**
 * Sends a welcome email to an admin-provisioned teacher or student.
 * Contains their login email, temporary password, and a link to the login page.
 * Fire-and-forget: errors are logged but never thrown — user creation succeeds regardless.
 * No-ops silently when RESEND_API_KEY is not configured.
 */
async function sendWelcomeEmail({ to, name, email, tempPassword, role }) {
  const guard = shouldSendEmail(to);
  if (!guard.allowed) return { email_sent: false, email_status: 'suppressed_test', email_error: null };

  const resend = getResend();
  if (!resend) {
    console.error('sendWelcomeEmail: RESEND_API_KEY not set — email skipped.');
    return { email_sent: false, email_status: 'no_api_key', email_error: 'Email service not configured' };
  }

  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
  const roleLabel = role === 'teacher' ? 'teacher' : 'student';

  const html = renderEmailLayout({
    title: 'Welcome to My Institute',
    bodyHtml: `
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
      ${renderCtaButton({ href: loginUrl, label: 'Log in to My Institute', bold: true })}
      <p style="color: #555; font-size: 14px;">You will be asked to set a new password when you first log in.</p>
      <p style="color: #555; font-size: 14px;">If you have any trouble, contact the institute directly.</p>
    `,
  });

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Welcome to My Institute — your login details',
      html,
    });
    return { email_sent: true, email_status: 'sent', email_error: null };
  } catch (err) {
    console.error('sendWelcomeEmail error:', err.message);
    return { email_sent: false, email_status: 'failed', email_error: err.message };
  }
}

module.exports = { sendVerificationEmail, sendContactNotification, sendWelcomeEmail };
