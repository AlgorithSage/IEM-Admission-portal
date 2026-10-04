const Application = require('../models/Application');
const Draft = require('../models/Draft');
const { audit } = require('../models/AuditLog');
const { validateApplication } = require('../validators/application.validator');
const { COMPETITIVE_EXAMS } = require('../config/admission.rules');
const { findSlot, documentSlots } = require('../services/documents.service');
const storage = require('../services/storage.service');
const { claimUploads, releaseUploads, refFromUpload } = require('../services/uploads.service');
const { findApplicationForUser, isOwner, transitionStatus, httpError } = require('../services/workflow.service');
const { generateAdmissionSlip } = require('../services/slip.service');
const { serializeApplication } = require('../services/presenter');

// @desc    Create an application from form data and previously uploaded files
//          (body.documents maps document slots to upload IDs). Stays 'Payment Pending' until the fee is paid.
// @route   POST /api/applications   (JSON)
// @access  Private (Applicant)
const submitApplication = async (req, res, next) => {
  let claimed = null;
  try {
    const existingApp = await findApplicationForUser(req.user);
    if (existingApp) {
      return res.status(409).json({
        success: false,
        message: 'You already have an application. Open the status page to continue.',
        application: serializeApplication(existingApp)
      });
    }

    const { errors, data } = validateApplication(req.body);

    // Every required document slot must reference an upload
    const docIds = req.body.documents && typeof req.body.documents === 'object' ? req.body.documents : {};
    const required = { classXMarksheet: 'Class X marksheet', classXIIMarksheet: 'Class XII marksheet' };
    if (data.graduation) required.graduationMarksheet = 'Graduation marksheet';
    data.competitiveExams.forEach((e) => {
      required[`scorecard_${e.exam}`] = `${COMPETITIVE_EXAMS[e.exam].label} scorecard`;
    });
    Object.entries(required).forEach(([slot, label]) => {
      if (!docIds[slot]) errors.push(`${label} upload is required.`);
    });

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: `Please correct the following: ${errors.join(' ')}`, errors });
    }

    const wanted = Object.fromEntries(Object.keys(required).map((slot) => [slot, docIds[slot]]));
    claimed = await claimUploads(req.user.id, wanted);
    const ref = (slot) => refFromUpload(claimed[slot]);

    const app = await new Application({
      applicant: req.user.id,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      alternatePhone: data.alternatePhone,
      dob: data.dob,
      gender: data.gender,
      category: data.category,
      nationality: data.nationality,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      parents: data.parents,
      classX: { ...data.classX, marksheet: ref('classXMarksheet') },
      classXII: { ...data.classXII, marksheet: ref('classXIIMarksheet') },
      graduation: data.graduation ? { ...data.graduation, marksheet: ref('graduationMarksheet') } : undefined,
      competitiveExams: data.competitiveExams.map((e) => ({ ...e, scorecard: ref(`scorecard_${e.exam}`) })),
      declarationAccepted: data.declaration,
      program: data.program,
      streamPreferences: data.streamPreferences,
      department: data.department,
      // v1 summary fields derived from Class XII
      qualifyingExam: `Class XII (${data.classXII.board})`,
      passingYear: data.classXII.passingYear,
      percentage: data.classXII.percentage,
      document: ref('classXIIMarksheet'),
      status: 'Payment Pending',
      adminRemarks: 'Documents received. Pay the application fee to complete submission.',
      statusHistory: [{ fromStatus: 'Payment Pending', toStatus: 'Payment Pending', changedAt: new Date(), changedBy: req.user.id, remarks: 'Form and documents submitted' }]
    }).save();

    claimed = null;
    await Draft.deleteOne({ owner: String(req.user.id) }).catch(() => {});
    await audit({ application: app._id, actorId: req.user.id, actorRole: 'applicant', action: 'APPLICATION_CREATED', details: `${data.program}: ${data.streamPreferences.join(' > ')}` });

    res.status(201).json({ success: true, message: 'Form and documents saved. Proceed to payment.', application: serializeApplication(app) });
  } catch (error) {
    // The files stay with the applicant so a corrected resubmission can reuse them
    if (claimed) await releaseUploads(claimed);
    next(error);
  }
};

// @desc    Logged-in applicant's application
// @route   GET /api/applications/my-application
// @access  Private (Applicant)
const getMyApplication = async (req, res, next) => {
  try {
    const app = await findApplicationForUser(req.user);
    res.status(200).json({ success: true, application: app ? serializeApplication(app) : null });
  } catch (error) {
    next(error);
  }
};

// Loads an application the caller may access (owner or admin)
const loadAccessible = async (req) => {
  const app = await Application.findById(req.params.id).catch(() => null);
  if (!app) throw httpError(404, 'Application not found.');
  if (req.user.role !== 'admin' && !isOwner(app, req.user)) throw httpError(403, 'You do not have access to this application.');
  return app;
};

// @desc    Stream one uploaded document (never exposed as a public URL)
// @route   GET /api/applications/:id/documents/:docKey
// @access  Private (Owner or Admin)
const streamDocument = async (req, res, next) => {
  try {
    const app = await loadAccessible(req);
    const slot = findSlot(app, req.params.docKey);
    if (!slot) throw httpError(404, 'Document not found on this application.');
    const ref = slot.get();
    res.setHeader('Content-Type', ref.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(ref.originalName || ref.fileName)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    const found = await storage.streamTo(ref, res);
    if (!found) {
      res.removeHeader('Content-Disposition');
      throw httpError(410, 'The stored file is no longer available. Ask the applicant to upload it again.');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Download the admission slip PDF (available once the fee is paid)
// @route   GET /api/applications/:id/slip
// @access  Private (Owner or Admin)
const downloadSlip = async (req, res, next) => {
  try {
    const app = await loadAccessible(req);
    if (!app.applicationId) throw httpError(400, 'The admission slip is available after the application fee is paid.');
    const pdf = await generateAdmissionSlip(app);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Admission-Slip-${app.applicationId}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);
  } catch (error) {
    next(error);
  }
};

// @desc    Replace a rejected document while a correction is requested
// @route   PUT /api/applications/my-application/documents/:docKey   { uploadId }
// @access  Private (Applicant)
const replaceDocument = async (req, res, next) => {
  let claimed = null;
  try {
    const { uploadId } = req.body || {};
    if (!uploadId) throw httpError(400, 'Upload the replacement file first.');
    const app = await findApplicationForUser(req.user);
    if (!app) throw httpError(404, 'No application found.');
    if (app.status !== 'Correction Requested') throw httpError(400, 'Documents can only be replaced when a correction is requested.');
    const slot = findSlot(app, req.params.docKey);
    if (!slot) throw httpError(404, 'Document not found on this application.');
    if (slot.get().verification?.status !== 'Rejected') throw httpError(400, 'Only rejected documents can be replaced.');

    claimed = await claimUploads(req.user.id, { file: uploadId });
    const current = slot.get();
    const oldRef = { storage: current.storage, fileName: current.fileName, filePath: current.filePath };
    slot.set(refFromUpload(claimed.file));
    await app.save();
    claimed = null;
    await storage.remove(oldRef);

    await audit({ application: app._id, actorId: req.user.id, actorRole: 'applicant', action: 'DOCUMENT_REPLACED', details: slot.label });
    res.status(200).json({ success: true, message: `${slot.label} replaced.`, application: serializeApplication(app) });
  } catch (error) {
    if (claimed) await releaseUploads(claimed);
    next(error);
  }
};

// @desc    Resubmit after correcting all rejected documents
// @route   POST /api/applications/my-application/resubmit
// @access  Private (Applicant)
const resubmitApplication = async (req, res, next) => {
  try {
    const app = await findApplicationForUser(req.user);
    if (!app) throw httpError(404, 'No application found.');
    const pending = documentSlots(app).filter((d) => d.get().verification?.status === 'Rejected');
    if (pending.length) throw httpError(400, `Replace these documents first: ${pending.map((d) => d.label).join(', ')}.`);
    await transitionStatus(app, 'Review', { id: req.user.id, role: 'system' }, 'Corrected documents resubmitted by applicant');
    res.status(200).json({ success: true, message: 'Application resubmitted for review.', application: serializeApplication(app) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitApplication,
  getMyApplication,
  streamDocument,
  downloadSlip,
  replaceDocument,
  resubmitApplication
};
