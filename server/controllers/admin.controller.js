const Application = require('../models/Application');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const { AuditLog, audit } = require('../models/AuditLog');
const { DEPARTMENTS } = require('../config/admission.rules');
const { STATUSES, VERIFIABLE_STATUSES, statusLabel } = require('../config/status.rules');
const { findSlot } = require('../services/documents.service');
const { transitionStatus, httpError, deleteApplication } = require('../services/workflow.service');
const { serializeApplication, withAvailability } = require('../services/presenter');
const storage = require('../services/storage.service');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildFilter = ({ status, department, search }) => {
  const filter = {};
  if (status && status !== 'All' && STATUSES.includes(status)) filter.status = status;
  if (department && department !== 'All' && DEPARTMENTS.includes(department)) filter.department = department;
  if (search && String(search).trim()) {
    const rx = { $regex: escapeRegex(String(search).trim().slice(0, 100)), $options: 'i' };
    filter.$or = [{ fullName: rx }, { email: rx }, { applicationId: rx }, { phone: rx }, { program: rx }, { streamPreferences: rx }];
  }
  return filter;
};

const LIST_FIELDS = 'applicationId fullName email phone program department streamPreferences percentage status payment.status payment.amount submittedAt createdAt';

// @desc    Paginated application list with filters
// @route   GET /api/admin/applications?status=&department=&search=&page=&limit=
const listApplications = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = buildFilter(req.query);
    const [applications, total] = await Promise.all([
      Application.find(filter).select(LIST_FIELDS).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Application.countDocuments(filter)
    ]);
    res.status(200).json({ success: true, applications, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

// @desc    Full application with payments, notifications and audit trail
// @route   GET /api/admin/applications/:id
const getApplicationDetail = async (req, res, next) => {
  try {
    const app = await Application.findById(req.params.id).catch(() => null);
    if (!app) throw httpError(404, 'Application not found.');
    const [payments, notifications, auditLog] = await Promise.all([
      Payment.find({ application: app._id }).select('-signature').sort({ createdAt: -1 }).lean(),
      Notification.find({ application: app._id }).select('-body').sort({ createdAt: -1 }).limit(50).lean(),
      AuditLog.find({ application: app._id }).sort({ createdAt: -1 }).limit(200).lean()
    ]);
    res.status(200).json({ success: true, application: await withAvailability(serializeApplication(app, { forAdmin: true }), app), payments, notifications, auditLog });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify or reject one document
// @route   PATCH /api/admin/applications/:id/documents/:docKey   { status: 'Verified'|'Rejected', remarks, version }
const verifyDocument = async (req, res, next) => {
  try {
    const { status, remarks, version } = req.body || {};
    if (!['Verified', 'Rejected'].includes(status)) throw httpError(400, "Status must be 'Verified' or 'Rejected'.");
    const cleanRemarks = String(remarks || '').trim().slice(0, 500);
    if (status === 'Rejected' && !cleanRemarks) throw httpError(400, 'Give a reason when rejecting a document.');

    const app = await Application.findById(req.params.id).catch(() => null);
    if (!app) throw httpError(404, 'Application not found.');
    if (version !== undefined && Number(version) !== app.__v) {
      throw httpError(409, 'This application was changed by someone else. Reload and try again.');
    }
    if (!VERIFIABLE_STATUSES.includes(app.status)) {
      throw httpError(400, `Documents cannot be approved or rejected while the application is '${statusLabel(app.status)}'.`);
    }
    const slot = findSlot(app, req.params.docKey);
    if (!slot) throw httpError(404, 'Document not found on this application.');

    const ref = slot.get();
    if (status === 'Verified' && !(await storage.exists(ref))) {
      throw httpError(400, `The ${slot.label} file is missing. Reject it so the applicant uploads it again.`);
    }
    ref.verification = { status, remarks: cleanRemarks, verifiedBy: req.user.id, verifiedAt: new Date() };
    await app.save();
    await audit({ application: app._id, actorId: req.user.id, actorRole: 'admin', action: `DOCUMENT_${status.toUpperCase()}`, details: `${slot.label}${cleanRemarks ? `: ${cleanRemarks}` : ''}` });

    // Scrutiny has started: move a freshly submitted application into review automatically
    if (app.status === 'Submitted') {
      await transitionStatus(app, 'Review', { id: req.user.id, role: 'admin' }, 'Document scrutiny started');
    }
    res.status(200).json({ success: true, message: `${slot.label} ${status === 'Verified' ? 'approved' : 'rejected'}.`, application: serializeApplication(app, { forAdmin: true }) });
  } catch (error) {
    next(error);
  }
};

// @desc    Change application status through the state machine
// @route   PATCH /api/admin/applications/:id/status   { status, remarks, version }
const updateStatus = async (req, res, next) => {
  try {
    const { status, remarks, version } = req.body || {};
    const app = await Application.findById(req.params.id).catch(() => null);
    if (!app) throw httpError(404, 'Application not found.');
    if (version !== undefined && Number(version) !== app.__v) {
      throw httpError(409, 'This application was changed by someone else. Reload and try again.');
    }
    await transitionStatus(app, status, { id: req.user.id, role: 'admin' }, String(remarks || '').slice(0, 500));
    res.status(200).json({ success: true, message: `Status changed to '${statusLabel(status)}'.`, application: serializeApplication(app, { forAdmin: true }) });
  } catch (error) {
    next(error);
  }
};

// @desc    Dashboard statistics (aggregation)
// @route   GET /api/admin/stats
const getStats = async (req, res, next) => {
  try {
    const [facet] = await Application.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byDepartment: [{ $group: { _id: '$department', count: { $sum: 1 } } }],
          fees: [{ $match: { 'payment.status': 'Paid' } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$payment.amount' } } }]
        }
      }
    ]);
    const countOf = (list, key) => (list.find((x) => x._id === key) || { count: 0 }).count;
    res.status(200).json({
      success: true,
      stats: {
        total: facet.total[0]?.count || 0,
        byStatus: STATUSES.map((s) => ({ _id: s, count: countOf(facet.byStatus, s) })),
        byDepartment: DEPARTMENTS.map((d) => ({ _id: d, count: countOf(facet.byDepartment, d) })),
        feesCollected: facet.fees[0]?.amount || 0,
        paidCount: facet.fees[0]?.count || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Dashboard overview: monthly volume for a year and the latest applications
// @route   GET /api/admin/overview?year=YYYY
const getOverview = async (req, res, next) => {
  try {
    const year = Math.min(2100, Math.max(2000, parseInt(req.query.year, 10) || new Date().getFullYear()));
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));
    const [months, recent, years] = await Promise.all([
      Application.aggregate([
        { $match: { createdAt: { $gte: from, $lt: to } } },
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } }
      ]),
      Application.find({}).select('applicationId fullName program department streamPreferences status submittedAt createdAt').sort({ createdAt: -1 }).limit(6).lean(),
      Application.aggregate([{ $group: { _id: { $year: '$createdAt' } } }, { $sort: { _id: -1 } }])
    ]);
    const monthly = Array.from({ length: 12 }, (_, i) => (months.find((m) => m._id === i + 1) || { count: 0 }).count);
    res.status(200).json({
      success: true,
      overview: { year, monthly, recent, years: years.map((y) => y._id).filter(Boolean) }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Audit trail across all applications (newest first)
// @route   GET /api/admin/audit?page=&limit=&action=
const listAudit = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const filter = {};
    if (req.query.action && /^[A-Z_]{3,40}$/.test(req.query.action)) filter.action = req.query.action;
    const [items, total, actions] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('application', 'applicationId fullName')
        .lean(),
      AuditLog.countDocuments(filter),
      AuditLog.distinct('action')
    ]);
    res.status(200).json({ success: true, items, total, page, pages: Math.ceil(total / limit), actions: actions.sort() });
  } catch (error) {
    next(error);
  }
};

// @desc    Permanently delete an application (documents, emails, drafts). Payments and the audit trail are kept.
// @route   DELETE /api/admin/applications/:id   { confirm: <application ID or applicant name>, reason }
const removeApplication = async (req, res, next) => {
  try {
    const app = await Application.findById(req.params.id).catch(() => null);
    if (!app) throw httpError(404, 'Application not found.');
    const { confirm, reason } = req.body || {};
    const expected = app.applicationId || app.fullName;
    if (String(confirm || '').trim() !== expected) {
      throw httpError(400, `Type ${expected} to confirm the deletion.`);
    }
    const why = String(reason || '').trim().slice(0, 300);
    if (why.length < 5) throw httpError(400, 'Give a reason for deleting this record (at least 5 characters).');
    await deleteApplication(app, { id: req.user.id }, why);
    res.status(200).json({ success: true, message: `${expected} has been deleted.` });
  } catch (error) {
    next(error);
  }
};

const csvCell = (v) => {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// @desc    CSV report of applications matching the current filters
// @route   GET /api/admin/report.csv
const exportReport = async (req, res, next) => {
  try {
    const apps = await Application.find(buildFilter(req.query)).sort({ createdAt: -1 }).limit(10000).lean();
    const header = ['Application ID', 'Name', 'Email', 'Phone', 'Program', 'Stream Preferences', 'Category', 'Class X %', 'Class XII %', 'Graduation %', 'Status', 'Fee Status', 'Fee (Rs.)', 'Payment ID', 'Submitted On'];
    const rows = apps.map((a) => [
      a.applicationId, a.fullName, a.email, a.phone, a.program || a.department, (a.streamPreferences || []).join(' > '), a.category,
      a.classX?.percentage, a.classXII?.percentage ?? a.percentage, a.graduation?.percentage, statusLabel(a.status),
      a.payment?.status, a.payment?.amount, a.payment?.paymentId, a.submittedAt ? new Date(a.submittedAt).toISOString().slice(0, 10) : ''
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    await audit({ actorId: req.user.id, actorRole: 'admin', action: 'REPORT_EXPORTED', details: `${apps.length} rows` });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('﻿' + csv);
  } catch (error) {
    next(error);
  }
};

module.exports = { listApplications, getApplicationDetail, verifyDocument, updateStatus, removeApplication, getStats, getOverview, listAudit, exportReport };
