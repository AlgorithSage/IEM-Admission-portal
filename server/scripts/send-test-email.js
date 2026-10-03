/* eslint-disable no-console */
/**
 * Sends one test email with the SMTP settings from server/.env (or the shell).
 * Usage: npm run test:email -- you@example.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const nodemailer = require('nodemailer');

const to = process.argv[2];
if (!to) {
  console.error('Usage: npm run test:email -- you@example.com');
  process.exit(1);
}
const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing settings: ${missing.join(', ')}. Add them to server/.env.`);
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE) === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

(async () => {
  try {
    await transporter.verify();
    console.log(`SMTP login OK (${process.env.SMTP_HOST} as ${process.env.SMTP_USER})`);
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject: 'IEM Admission Portal - test email',
      text: 'If you received this, the portal can send application IDs, admission slips and status updates.'
    });
    console.log(`Sent to ${to} (message id ${info.messageId})`);
  } catch (err) {
    console.error('Email test failed:', err.message);
    process.exit(1);
  }
})();
