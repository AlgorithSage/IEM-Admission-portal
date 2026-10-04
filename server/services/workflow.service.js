const Application = require('../models/Application');
const Payment = require('../models/Payment');
const { audit } = require('../models/AuditLog');
const { nextSequence } = require('../models/Counter');
const { ADMISSION_YEAR } = require('../config/admission.rules');
const { ADMIN_TRANSITIONS, SYSTEM_TRANSITIONS, REMARKS_REQUIRED } = require('../config/status.rules');
const { documentSlots } = require('./documents.service');
const { sendEmail, EMAIL_ENABLED } = require('./notification.service');
const { generateAdmissionSlip } = require('./slip.service');

const httpError = (status, message) => Object.assign(new Error(message), { status });

const DEPARTMENT_CODES = {
  'B.Tech': 'BT', 'M.Tech': 'MT', MBA: 'MBA', MCA: 'MCA', BBA: 'BBA', BCA: 'BCA', BHM: 'BHM', 'BBA LLB': 'LLB'
};

/** e.g. IEM-2026-BT-000042 — sequence is global per admission year, so IDs never collide across programs */
const issueApplicationId = async (department) => {
  const seq = await nextSequence(`application-${ADMISSION_YEAR}`);
  return `IEM-${ADMISSION_YEAR}-${DEPARTMENT_CODES[department] || 'GEN'}-${String(seq).padStart(6, '0')}`;
};

/** Finds the logged-in applicant's application (supports ids stored as ObjectId, string or legacy shapes). */
const findApplicationForUser = (user) => {
  const email = user.email ? String(user.email).toLowerCase().trim() : '';
  return Application.findOne({
    $or: [{ applicant: user.id }, { applicant: String(user.id) }, { 'applicant._id': String(user.id) }, ...(email ? [{ email }] : [])]
  });
};

const isOwner = (app, user) =>
  String(app.applicant) === String(user.id) ||
  String(app.applicant && app.applicant._id) === String(user.id) ||
  (!!user.email && app.email === String(user.email).toLowerCase());

const allowedTransitionsFor = (status) => ADMIN_TRANSITIONS[status] || [];

const STATUS_MESSAGES = {
  Review: 'Your application is now under review by the admission committee.',
  'On Hold': 'Your application has been put on hold.',
  'Correction Requested': 'Some of your documents need correction. Please log in, replace the rejected documents and resubmit.',
  Selected: 'Congratulations! You have been provisionally selected. Please report for document verification and admission formalities.',
  Rejected: 'We regret to inform you that your application has not been accepted.'
};

const notifyStatusChange = (app, remarks) =>
  sendEmail({
    application: app,
    type: 'STATUS_UPDATE',
    to: app.email,
    subject: `Application ${app.applicationId || ''} status: ${app.status}`,
    text:
      `Dear ${app.fullName},\n\n${STATUS_MESSAGES[app.status] || `Your application status is now ${app.status}.`}\n` +
      (remarks ? `\nRemarks: ${remarks}\n` : '') +
      `\nApplication ID: ${app.applicationId || '-'}\n\nIEM Admissions`
  });

/**
 * Moves an application to a new status, enforcing the state machine and business guards.
 * actor: { id, role: 'admin' | 'system' }
 */
const transitionStatus = async (app, toStatus, actor, remarks = '') => {
  const from = app.status;
  const allowed = actor.role === 'admin' ? ADMIN_TRANSITIONS[from] || [] : SYSTEM_TRANSITIONS[from] || [];
  if (!allowed.includes(toStatus)) {
    throw httpError(400, `Cannot change status from '${from}' to '${toStatus}'. Allowed: ${allowed.join(', ') || 'none'}.`);
  }
  const cleanRemarks = String(remarks || '').trim();
  if (actor.role === 'admin' && REMARKS_REQUIRED.includes(toStatus) && !cleanRemarks) {
    throw httpError(400, `Remarks are required when moving an application to '${toStatus}'.`);
  }

  const docs = documentSlots(app);
  if (toStatus === 'Selected' && docs.some((d) => d.get().verification?.status !== 'Verified')) {
    throw httpError(400, 'All documents must be verified before the applicant can be selected.');
  }
  if (toStatus === 'Correction Requested' && !docs.some((d) => d.get().verification?.status === 'Rejected')) {
    throw httpError(400, 'Mark at least one document as Rejected (with remarks) before requesting a correction.');
  }

  app.status = toStatus;
  app.statusHistory.push({ fromStatus: from, toStatus, changedAt: new Date(), changedBy: actor.id, remarks: cleanRemarks });
  if (cleanRemarks) app.adminRemarks = cleanRemarks;
  await app.save();

  await audit({
    application: app._id,
    actorId: actor.id,
    actorRole: actor.role,
    action: 'STATUS_CHANGED',
    fromStatus: from,
    toStatus,
    details: cleanRemarks
  });
  if (actor.role === 'admin' && toStatus !== 'Review') {
    await notifyStatusChange(app, cleanRemarks);
  }
  return app;
};

/**
 * Emails the application ID, then the admission slip PDF. Delivery failures are logged, never thrown.
 * Returns which emails actually reached the mail server (false when no mail server is configured).
 */
const sendSubmissionEmails = async (app) => {
  const idMail = await sendEmail({
    application: app,
    type: 'APPLICATION_ID',
    to: app.email,
    subject: `Your IEM Application ID: ${app.applicationId}`,
    text:
      `Dear ${app.fullName},\n\nWe have received your application and fee payment.\n\n` +
      `Application ID: ${app.applicationId}\nProgram: ${app.program || app.department}\n` +
      `Payment ID: ${app.payment.paymentId}\n\nUse this ID for all future communication.\n\nIEM Admissions`
  });

  let pdf;
  try {
    pdf = await generateAdmissionSlip(app);
  } catch (err) {
    console.error('[Slip] Generation failed:', err.message);
  }
  const slipMail = await sendEmail({
    application: app,
    type: 'ADMISSION_SLIP',
    to: app.email,
    subject: `Admission Slip - ${app.applicationId}`,
    text: `Dear ${app.fullName},\n\nPlease find your admission slip attached. Keep it for document verification.\n\nIEM Admissions`,
    attachments: pdf ? [{ filename: `Admission-Slip-${app.applicationId}.pdf`, content: pdf, contentType: 'application/pdf' }] : []
  });
  return {
    applicationId: EMAIL_ENABLED && idMail.delivered,
    admissionSlip: EMAIL_ENABLED && slipMail.delivered && !!pdf
  };
};

/**
 * Records a verified payment and submits the application. Idempotent and race-safe:
 * the conditional status update (Payment Pending -> Submitted) is the single gate, so concurrent
 * or replayed verifications issue exactly one application ID and send the emails once.
 */
const completePayment = async ({ app, order, paymentId, signature, method, actorId }) => {
  const now = new Date();
  // Recording the gateway outcome is idempotent and safe to repeat
  const paid = await Payment.findOneAndUpdate(
    { orderId: order.orderId },
    { $set: { status: 'paid', paymentId, signature, method, paidAt: order.paidAt || now, failureReason: '' } },
    { new: true }
  );

  const applicationId = await issueApplicationId(app.department);
  const updated = await Application.findOneAndUpdate(
    { _id: app._id, status: 'Payment Pending' },
    {
      $set: {
        status: 'Submitted',
        applicationId,
        submittedAt: now,
        adminRemarks: 'Application submitted. Awaiting scrutiny.',
        payment: { status: 'Paid', amount: paid.amount / 100, currency: paid.currency, orderId: paid.orderId, paymentId, method, paidAt: now }
      },
      $push: { statusHistory: { fromStatus: 'Payment Pending', toStatus: 'Submitted', changedAt: now, changedBy: 'system', remarks: `Fee paid (${paymentId})` } },
      $inc: { __v: 1 }
    },
    { new: true }
  );

  if (!updated) {
    // Lost the race or replayed: the application is already submitted (the unused sequence number is a harmless gap)
    const current = await Application.findById(app._id);
    if (current.payment && current.payment.orderId !== order.orderId) {
      await audit({ application: app._id, actorRole: 'system', action: 'DUPLICATE_PAYMENT', details: `Order ${order.orderId} paid after application was already submitted; refund required` });
    }
    return { application: current, alreadyProcessed: true };
  }

  await audit({ application: app._id, actorId, actorRole: 'applicant', action: 'PAYMENT_SUCCESS', details: `${paymentId} via ${method}, Rs. ${paid.amount / 100}` });
  await audit({ application: app._id, actorRole: 'system', action: 'STATUS_CHANGED', fromStatus: 'Payment Pending', toStatus: 'Submitted', details: `Application ID ${applicationId} issued` });
  const emails = await sendSubmissionEmails(updated);
  return { application: updated, alreadyProcessed: false, emails };
};

/**
 * Permanently deletes an application and the applicant's personal files.
 * Payments (accounting) and the audit trail are kept; a deletion entry records who did it and why.
 */
const deleteApplication = async (app, actor, reason) => {
  const Notification = require('../models/Notification');
  const Draft = require('../models/Draft');
  const Upload = require('../models/Upload');
  const storage = require('./storage.service');

  const owner = String(app.applicant && app.applicant._id ? app.applicant._id : app.applicant);
  const files = documentSlots(app).map((slot) => slot.get());
  const staged = await Upload.find({ owner, consumedAt: null });

  await Application.deleteOne({ _id: app._id });
  await Promise.all([
    Notification.deleteMany({ application: app._id }),
    Draft.deleteOne({ owner }),
    Upload.deleteMany({ owner })
  ]);
  // Storage clean-up is best effort and never blocks the deletion
  await Promise.all([...files.map((ref) => storage.remove(ref)), ...staged.map((u) => storage.remove(u))]);

  await audit({
    application: app._id,
    actorId: actor.id,
    actorRole: 'admin',
    action: 'APPLICATION_DELETED',
    fromStatus: app.status,
    details: `${app.applicationId || 'No ID'} (${app.fullName}, ${app.email}) deleted. Reason: ${reason}`
  });
};

module.exports = {
  httpError,
  findApplicationForUser,
  isOwner,
  allowedTransitionsFor,
  transitionStatus,
  completePayment,
  sendSubmissionEmails,
  deleteApplication
};
