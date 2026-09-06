import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

// Dev-mode fallback, never crashes: with no SMTP_HOST configured, the reset
// link is just logged to the console instead of emailed — same "warn and
// continue" style already used for MONGODB_URI in config/db.js.
export async function sendPasswordResetEmail(to, resetUrl) {
  if (!process.env.SMTP_HOST) {
    console.log(`[emailService] SMTP_HOST not set — password reset link for ${to}: ${resetUrl}`);
    return;
  }
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@localhost',
    to,
    subject: 'Reset your password',
    text: `Reset your password: ${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>Reset your password by clicking the link below:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`,
  });
}
