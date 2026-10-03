const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');
const { audit } = require('../models/AuditLog');

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 300;

// Real SMTP when configured; otherwise a mock transport that renders the message without sending it
const useSmtp = !!process.env.SMTP_HOST;
const transporter = useSmtp
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE) === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000
    })
  : nodemailer.createTransport({ jsonTransport: true });

const FROM = process.env.MAIL_FROM || 'IEM Admissions <admissions@iem.edu.in>';

// Surface SMTP misconfiguration at start-up instead of on the first applicant's payment
if (useSmtp) {
  transporter
    .verify()
    .then(() => console.log(`[Email] SMTP ready (${process.env.SMTP_HOST})`))
    .catch((err) => console.error(`[Email] SMTP login failed: ${err.message}. Emails will be logged as Failed.`));
} else {
  console.log('[Email] SMTP_HOST not set: emails are recorded but not delivered.');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends an email with retries and records the outcome in the notification log.
 * Never throws: a delivery failure must not roll back the business operation that triggered it.
 * Messages that exhaust their retries are marked Failed and flagged in the audit log for admins.
 */
const sendEmail = async ({ application, type, to, subject, text, attachments = [] }) => {
  let log;
  try {
    log = await Notification.create({
      application: application ? application._id : undefined,
      channel: 'email',
      type,
      to,
      subject,
      body: text,
      attachments: attachments.map((a) => ({ filename: a.filename, size: a.content ? a.content.length : 0 })),
      transport: useSmtp ? 'smtp' : 'mock'
    });
  } catch (err) {
    console.error('[Notification] Could not create log entry:', err.message);
  }

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const info = await transporter.sendMail({ from: FROM, to, subject, text, attachments });
      if (log) {
        log.set({ status: 'Sent', attempts: attempt, sentAt: new Date(), providerMessageId: info.messageId || '', lastError: '' });
        await log.save().catch(() => {});
      }
      return { delivered: true, attempts: attempt };
    } catch (err) {
      lastError = err.message;
      if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS * attempt);
    }
  }

  if (log) {
    log.set({ status: 'Failed', attempts: MAX_ATTEMPTS, lastError });
    await log.save().catch(() => {});
  }
  await audit({
    application: application ? application._id : undefined,
    actorRole: 'system',
    action: 'NOTIFICATION_FAILED',
    details: `${type} email to ${to} failed after ${MAX_ATTEMPTS} attempts: ${lastError}`
  });
  console.error(`[Notification] ${type} to ${to} failed after ${MAX_ATTEMPTS} attempts:`, lastError);
  return { delivered: false, attempts: MAX_ATTEMPTS, error: lastError };
};

module.exports = { sendEmail, MAX_ATTEMPTS };
