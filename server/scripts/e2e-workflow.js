/* eslint-disable no-console */
/**
 * End-to-end test of the full admission workflow against the real server process.
 *
 *   Applicant: register -> submit form + documents -> pay (failure, then success) -> application ID + emails + slip
 *   Admin:     login -> stats/list/detail -> verify/reject documents -> request correction
 *   Applicant: replace rejected document -> resubmit
 *   Admin:     verify all -> select -> CSV report -> audit trail
 *
 * Data isolation:
 *   - MongoDB: uses a separate database (<db>_e2e) on the configured cluster, dropped at the end.
 *   - PostgreSQL: uses the configured database; test users (e2e-*@example.com) are deleted at the end.
 *
 * Run: npm run test:e2e   (from /server)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const mongoose = require('mongoose');

const PORT = 5099;
const BASE = `http://127.0.0.1:${PORT}/api`;
const RUN = Date.now();
const UPLOAD_DIR = path.join(os.tmpdir(), `iem-e2e-uploads-${RUN}`);

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not set in server/.env');
  process.exit(1);
}
// Point the same cluster at a separate <db>_e2e database. String-based: WHATWG URL cannot parse
// multi-host mongodb:// strings, and its errors would print the credentials.
const uriMatch = process.env.MONGO_URI.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/?([^?]*)(\?.*)?$/);
if (!uriMatch) {
  console.error('MONGO_URI is not a valid MongoDB connection string.');
  process.exit(1);
}
const baseDb = uriMatch[2] || 'iem_admission_portal';
const E2E_MONGO_URI = `${uriMatch[1]}/${baseDb}_e2e${uriMatch[3] || ''}`;

let passed = 0;
let failed = 0;
const check = (name, condition, extra = '') => {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
};

const api = async (method, url, { token, json, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(`${BASE}${url}`, { method, headers, body });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, type };
};

const pdf = (label) => new Blob([Buffer.from(`%PDF-1.4\n% ${label}\n%%EOF`)], { type: 'application/pdf' });

const applicationBody = (overrides = {}) => ({
  fullName: 'Riya Banerjee',
  email: overrides.email,
  phone: '9830012345',
  dob: '2007-03-15',
  gender: 'Female',
  category: 'General',
  nationality: 'Indian',
  address: '22 Lake Road, Ballygunge',
  city: 'Kolkata',
  state: 'West Bengal',
  pincode: '700019',
  program: 'B.Tech',
  streamPreferences: ['Computer Science & Engineering', 'Information Technology'],
  declaration: true,
  parents: { fatherName: 'Amit Banerjee', fatherPhone: '9830098765', motherName: 'Sunita Banerjee' },
  classX: { board: 'CBSE', school: 'South Point School', passingYear: 2023, percentage: '92.4' },
  classXII: { board: 'CBSE', school: 'South Point School', stream: 'Science (PCM)', passingYear: 2025, percentage: '90.2', pcmPercentage: '93' },
  competitiveExams: [
    { exam: 'WBJEE', rollNumber: 'WB2025123', year: 2025, rank: 1520, score: '-12.25' },
    { exam: 'JEE_MAIN', rollNumber: '250310123456', year: 2025, rank: 45210, score: 180 }
  ],
  documents: overrides.documents
});

/** Uploads one file through the local storage driver and returns its upload ID. */
const uploadFile = async (token, label, name) => {
  const fd = new FormData();
  fd.append('file', pdf(label), name);
  const res = await api('POST', '/uploads', { token, form: fd });
  if (res.status !== 201) throw new Error(`upload failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data.upload.uploadId;
};

const uploadAll = async (token) => ({
  classXMarksheet: await uploadFile(token, 'x', 'class-x.pdf'),
  classXIIMarksheet: await uploadFile(token, 'xii', 'class-xii.pdf'),
  scorecard_WBJEE: await uploadFile(token, 'wbjee', 'wbjee.pdf'),
  scorecard_JEE_MAIN: await uploadFile(token, 'jee', 'jee.pdf')
});

const startServer = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      // E2E_USE_SMTP=1 sends through the configured SMTP server; otherwise emails use the mock transport.
      // BLOB_READ_WRITE_TOKEN is cleared so uploads use the local driver.
      env: { ...process.env, PORT: String(PORT), MONGO_URI: E2E_MONGO_URI, UPLOAD_DIR, BLOB_READ_WRITE_TOKEN: '', SMTP_HOST: process.env.E2E_USE_SMTP ? process.env.SMTP_HOST : '' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let log = '';
    const onData = (d) => {
      log += d.toString();
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`Server exited early (${code}):\n${log}`)));
    const started = Date.now();
    const poll = async () => {
      try {
        const res = await fetch(`${BASE}/health`);
        if (res.ok) return resolve({ child, getLog: () => log });
      } catch {
        /* not up yet */
      }
      if (Date.now() - started > 30000) return reject(new Error(`Server did not start:\n${log}`));
      setTimeout(poll, 300);
    };
    poll();
  });

const register = async (email, extra = {}) =>
  api('POST', '/auth/register', { json: { name: 'Riya Banerjee', email, password: 'Test@12345', phone: '9830012345', ...extra } });

(async () => {
  // Same pool settings as the app (verified TLS, sized for the environment)
  const { pool } = require('../config/postgres');
  await mongoose.connect(E2E_MONGO_URI);
  const db = mongoose.connection.db;
  await db.dropDatabase(); // start from a clean e2e database

  let server;
  try {
    server = await startServer();
    console.log(`Server up on :${PORT} (Mongo db: ${baseDb}_e2e)\n`);

    // ---------------- Auth (PostgreSQL) ----------------
    console.log('Auth');
    const emailA = `e2e-a-${RUN}@example.com`;
    const emailB = `e2e-b-${RUN}@example.com`;
    const regA = await register(emailA, { role: 'admin' });
    check('applicant registers', regA.status === 201 || regA.status === 200, JSON.stringify(regA.data));
    check('self-registration cannot grant admin role', regA.data.user && regA.data.user.role === 'applicant', JSON.stringify(regA.data.user));
    const tokenA = regA.data.token;
    const pgRow = await pool.query('SELECT role FROM users WHERE email = $1', [emailA]);
    check('applicant persisted in PostgreSQL', pgRow.rows.length === 1 && pgRow.rows[0].role === 'applicant');
    const loginA = await api('POST', '/auth/login', { json: { email: emailA, password: 'Test@12345', role: 'applicant' } });
    check('applicant logs in', loginA.status === 200 && !!loginA.data.token);
    const claims = JSON.parse(Buffer.from(loginA.data.token.split('.')[1], 'base64url').toString());
    check('session token expires after 1 day', claims.exp - claims.iat === 86400, `${claims.exp - claims.iat}s`);
    const regB = await register(emailB);
    const tokenB = regB.data.token;

    const adminLogin = await api('POST', '/auth/login', { json: { email: 'admin@iem.edu.in', password: 'adminpassword123', role: 'admin' } });
    check('admin logs in', adminLogin.status === 200 && adminLogin.data.user?.role === 'admin', JSON.stringify(adminLogin.data));
    const tokenAdmin = adminLogin.data.token;

    // ---------------- Applicant: submit ----------------
    console.log('\nApplicant: form + documents');
    check('no application before submitting', (await api('GET', '/applications/my-application', { token: tokenA })).data.application === null);
    // Draft: save, reload, ownership of referenced files
    check('no draft initially', (await api('GET', '/applications/my-draft', { token: tokenA })).data.draft === null);
    const draftFile = await uploadFile(tokenA, 'draft-x', 'draft-x.pdf');
    const foreignFile = await uploadFile(tokenB, 'foreign', 'foreign.pdf');
    const saved = await api('PUT', '/applications/my-draft', {
      token: tokenA,
      json: {
        data: { fullName: 'Riya Banerjee', program: 'B.Tech', declaration: true },
        documents: { classXMarksheet: { uploadId: draftFile }, classXIIMarksheet: { uploadId: foreignFile }, 'bad slot': { uploadId: draftFile } },
        step: 'classX'
      }
    });
    check('draft saved', saved.status === 200);
    const loaded = (await api('GET', '/applications/my-draft', { token: tokenA })).data.draft;
    check('draft returns values, step and own documents only', loaded.data.fullName === 'Riya Banerjee' && loaded.step === 'classX' && loaded.documents.classXMarksheet?.name === 'draft-x.pdf' && !loaded.documents.classXIIMarksheet && Object.keys(loaded.documents).length === 1);
    check('declaration is not kept in a draft', loaded.data.declaration === undefined);
    check('draft file can be read back by its owner', (await api('GET', `/uploads/${draftFile}/content`, { token: tokenA })).status === 200);
    check("another user's staged file cannot be read", (await api('GET', `/uploads/${foreignFile}/content`, { token: tokenA })).status === 404);

    const cfg = await api('GET', '/uploads/config', { token: tokenA });
    check('upload config reports local driver (no Blob token in test env)', cfg.data.driver === 'local' && cfg.data.maxBytes === 5242880);
    const docsA = await uploadAll(tokenA);
    const badType = new FormData();
    badType.append('file', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
    check('non-PDF/image upload rejected', (await api('POST', '/uploads', { token: tokenA, form: badType })).status === 400);
    const invalid = await api('POST', '/applications', { token: tokenA, json: applicationBody({ email: emailA, documents: { ...docsA, classXMarksheet: undefined } }) });
    check('missing document -> 400', invalid.status === 400 && /Class X marksheet upload is required/.test(invalid.data.message));
    const otherUser = await uploadFile(tokenB, 'b', 'b.pdf');
    const stolen = await api('POST', '/applications', { token: tokenA, json: applicationBody({ email: emailA, documents: { ...docsA, classXMarksheet: otherUser } }) });
    check("cannot attach another user's upload", stolen.status === 400);
    const samePhone = await api('POST', '/applications', { token: tokenA, json: { ...applicationBody({ email: emailA, documents: docsA }), alternatePhone: '9830012345' } });
    check('alternate mobile equal to mobile -> 400', samePhone.status === 400 && /different from the mobile/.test(samePhone.data.message));
    const badAppNo = applicationBody({ email: emailA, documents: docsA });
    badAppNo.competitiveExams = [{ ...badAppNo.competitiveExams[1], rollNumber: 'JEE2025123' }, badAppNo.competitiveExams[0]];
    check('JEE Main application number must be 12 digits', (await api('POST', '/applications', { token: tokenA, json: badAppNo })).status === 400);
    const sub = await api('POST', '/applications', { token: tokenA, json: applicationBody({ email: emailA, documents: docsA }) });
    check('uploads released after failed attempt; submit -> 201', sub.status === 201, JSON.stringify(sub.data).slice(0, 300));
    const app = sub.data.application || {};
    check('status is Payment Pending, no ID yet', app.status === 'Payment Pending' && !app.applicationId);
    check('4 documents listed, all Pending', app.documents?.length === 4 && app.documents.every((d) => d.verification.status === 'Pending'));
    check('no public file URLs stored', app.documents?.every((d) => !d.filePath));
    check('draft deleted after submission', (await api('GET', '/applications/my-draft', { token: tokenA })).data.draft === null);
    check('second submission -> 409', (await api('POST', '/applications', { token: tokenA, json: applicationBody({ email: emailA, documents: docsA }) })).status === 409);
    const reuse = await api('PUT', '/applications/my-application/documents/classXMarksheet', { token: tokenA, json: { uploadId: docsA.classXMarksheet } });
    check('consumed upload cannot be reused', reuse.status === 400);
    check('applicant cannot call admin API -> 403', (await api('GET', '/admin/stats', { token: tokenA })).status === 403);
    check('slip before payment -> 400', (await api('GET', `/applications/${app._id}/slip`, { token: tokenA })).status === 400);

    const docOwner = await api('GET', `/applications/${app._id}/documents/classXMarksheet`, { token: tokenA });
    check('owner can view own document', docOwner.status === 200 && docOwner.type.includes('pdf') && docOwner.data.toString().startsWith('%PDF'));
    check('other applicant cannot view document -> 403', (await api('GET', `/applications/${app._id}/documents/classXMarksheet`, { token: tokenB })).status === 403);
    check('anonymous cannot view document -> 401', (await api('GET', `/applications/${app._id}/documents/classXMarksheet`)).status === 401);
    const uploadsServed = await fetch(`http://127.0.0.1:${PORT}/uploads/${fs.readdirSync(UPLOAD_DIR)[0]}`);
    check('uploaded files are not publicly served', uploadsServed.status === 404);

    // ---------------- Payment ----------------
    console.log('\nPayment (Razorpay mock)');
    const order = await api('POST', '/payments/order', { token: tokenA });
    check('order created for Rs. 1,000', order.status === 200 && order.data.order.amount === 100000, JSON.stringify(order.data));
    const orderId = order.data.order.orderId;
    const fail = await api('POST', '/payments/mock-checkout', { token: tokenA, json: { orderId, method: 'UPI', outcome: 'failure' } });
    check('declined payment -> 402', fail.status === 402);
    check('still Payment Pending after failure', (await api('GET', '/applications/my-application', { token: tokenA })).data.application.status === 'Payment Pending');
    const order2 = await api('POST', '/payments/order', { token: tokenA });
    check('retry reuses the same order', order2.data.order.orderId === orderId);
    const ok = await api('POST', '/payments/mock-checkout', { token: tokenA, json: { orderId, method: 'Card', outcome: 'success' } });
    check('checkout returns payment id + signature', ok.status === 200 && ok.data.razorpay_signature);
    const tampered = await api('POST', '/payments/verify', { token: tokenA, json: { ...ok.data, razorpay_signature: 'ab'.repeat(32), method: 'Card' } });
    check('tampered signature rejected -> 400', tampered.status === 400);
    const verify = await api('POST', '/payments/verify', { token: tokenA, json: { ...ok.data, method: 'Card' } });
    const paidApp = verify.data.application || {};
    check('verified payment -> Submitted', verify.status === 200 && paidApp.status === 'Submitted', JSON.stringify(verify.data).slice(0, 300));
    const mailFlags = verify.data.emails || {};
    check('payment response reports email delivery', process.env.E2E_USE_SMTP ? mailFlags.applicationId === true && mailFlags.admissionSlip === true : mailFlags.applicationId === false && mailFlags.admissionSlip === false, JSON.stringify(verify.data.emails));
    check('application ID issued (IEM-YYYY-BT-NNNNNN)', /^IEM-\d{4}-BT-\d{6}$/.test(paidApp.applicationId || ''), paidApp.applicationId);
    check('payment summary stored', paidApp.payment?.status === 'Paid' && paidApp.payment.amount === 1000 && paidApp.payment.method === 'Card');
    const replay = await api('POST', '/payments/verify', { token: tokenA, json: { ...ok.data, method: 'Card' } });
    check('replayed verification is idempotent', replay.status === 200 && replay.data.application.applicationId === paidApp.applicationId);
    check('order after payment -> 409', (await api('POST', '/payments/order', { token: tokenA })).status === 409);

    const mails = await db.collection('notifications').find({ application: new mongoose.Types.ObjectId(app._id) }).toArray();
    const idMail = mails.find((m) => m.type === 'APPLICATION_ID');
    const slipMail = mails.find((m) => m.type === 'ADMISSION_SLIP');
    check('application ID email sent to applicant', idMail?.status === 'Sent' && idMail.to === emailA && idMail.body.includes(paidApp.applicationId), JSON.stringify(idMail && { status: idMail.status, err: idMail.lastError }));
    check(`emails used ${process.env.E2E_USE_SMTP ? 'real SMTP' : 'mock'} transport`, idMail?.transport === (process.env.E2E_USE_SMTP ? 'smtp' : 'mock'));
    check('admission slip email sent with PDF attachment', slipMail?.status === 'Sent' && slipMail.attachments[0]?.size > 1000);
    check('exactly 2 emails despite replay', mails.length === 2, `got ${mails.length}`);
    const slip = await api('GET', `/applications/${app._id}/slip`, { token: tokenA });
    check('applicant downloads admission slip PDF', slip.status === 200 && slip.data.toString().startsWith('%PDF'));

    // Concurrency: two simultaneous verifications must issue exactly one ID
    const subB = await api('POST', '/applications', { token: tokenB, json: applicationBody({ email: emailB, documents: await uploadAll(tokenB) }) });
    const orderB = (await api('POST', '/payments/order', { token: tokenB })).data.order.orderId;
    const payB = (await api('POST', '/payments/mock-checkout', { token: tokenB, json: { orderId: orderB, method: 'UPI', outcome: 'success' } })).data;
    const [v1, v2] = await Promise.all([
      api('POST', '/payments/verify', { token: tokenB, json: { ...payB, method: 'UPI' } }),
      api('POST', '/payments/verify', { token: tokenB, json: { ...payB, method: 'UPI' } })
    ]);
    check('concurrent verifications: same single application ID', v1.status === 200 && v2.status === 200 && v1.data.application.applicationId === v2.data.application.applicationId);
    const mailsB = await db.collection('notifications').countDocuments({ application: new mongoose.Types.ObjectId(subB.data.application._id) });
    check('concurrent verifications: emails sent once', mailsB === 2, `got ${mailsB}`);

    // ---------------- Admin ----------------
    console.log('\nAdmin: dashboard + scrutiny');
    const stats = await api('GET', '/admin/stats', { token: tokenAdmin });
    const submittedCount = stats.data.stats?.byStatus.find((s) => s._id === 'Submitted')?.count;
    check('stats: 2 applications, 2 submitted, Rs. 2,000 collected', stats.data.stats?.total === 2 && submittedCount === 2 && stats.data.stats.feesCollected === 2000, JSON.stringify(stats.data.stats));
    const list = await api('GET', `/admin/applications?search=${encodeURIComponent(paidApp.applicationId)}`, { token: tokenAdmin });
    check('search by application ID', list.data.total === 1 && list.data.applications[0].applicationId === paidApp.applicationId);
    const regexProbe = await api('GET', '/admin/applications?search=(a+)+$', { token: tokenAdmin });
    check('search input is regex-escaped', regexProbe.status === 200);
    const paged = await api('GET', '/admin/applications?limit=1&page=2', { token: tokenAdmin });
    check('pagination', paged.data.applications.length === 1 && paged.data.pages === 2);

    let detail = (await api('GET', `/admin/applications/${app._id}`, { token: tokenAdmin })).data;
    check('detail: full application + documents + payments + emails + audit', detail.application.documents.length === 4 && detail.payments.length === 1 && detail.notifications.length === 2 && detail.auditLog.length >= 3);
    check('detail: allowed transitions from Submitted = [Review]', JSON.stringify(detail.application.allowedTransitions) === '["Review"]');
    check('admin can view any document', (await api('GET', `/applications/${app._id}/documents/scorecard_WBJEE`, { token: tokenAdmin })).status === 200);

    const sel1 = await api('PATCH', `/admin/applications/${app._id}/status`, { token: tokenAdmin, json: { status: 'Selected' } });
    check('cannot jump Submitted -> Selected', sel1.status === 400);
    const v = detail.application.__v;
    const verX = await api('PATCH', `/admin/applications/${app._id}/documents/classXMarksheet`, { token: tokenAdmin, json: { status: 'Verified', version: v } });
    check('verify Class X marksheet; application moves to Review', verX.status === 200 && verX.data.application.status === 'Review', JSON.stringify(verX.data).slice(0, 200));
    const stale = await api('PATCH', `/admin/applications/${app._id}/documents/classXIIMarksheet`, { token: tokenAdmin, json: { status: 'Verified', version: v } });
    check('stale version rejected -> 409 (optimistic concurrency)', stale.status === 409);
    const noReason = await api('PATCH', `/admin/applications/${app._id}/documents/scorecard_JEE_MAIN`, { token: tokenAdmin, json: { status: 'Rejected' } });
    check('reject without reason -> 400', noReason.status === 400);
    await api('PATCH', `/admin/applications/${app._id}/documents/classXIIMarksheet`, { token: tokenAdmin, json: { status: 'Verified' } });
    await api('PATCH', `/admin/applications/${app._id}/documents/scorecard_WBJEE`, { token: tokenAdmin, json: { status: 'Verified' } });
    const rej = await api('PATCH', `/admin/applications/${app._id}/documents/scorecard_JEE_MAIN`, { token: tokenAdmin, json: { status: 'Rejected', remarks: 'Scorecard is blurred' } });
    check('reject JEE Main scorecard with reason', rej.status === 200);
    const sel2 = await api('PATCH', `/admin/applications/${app._id}/status`, { token: tokenAdmin, json: { status: 'Selected' } });
    check('cannot select while a document is rejected', sel2.status === 400);
    const corrNoRemarks = await api('PATCH', `/admin/applications/${app._id}/status`, { token: tokenAdmin, json: { status: 'Correction Requested' } });
    check('correction request needs remarks', corrNoRemarks.status === 400);
    const corr = await api('PATCH', `/admin/applications/${app._id}/status`, { token: tokenAdmin, json: { status: 'Correction Requested', remarks: 'Upload a clear JEE Main scorecard' } });
    check('request correction', corr.status === 200 && corr.data.application.status === 'Correction Requested');

    // ---------------- Applicant: correction ----------------
    console.log('\nApplicant: correction + resubmit');
    check('resubmit before replacing -> 400', (await api('POST', '/applications/my-application/resubmit', { token: tokenA })).status === 400);
    const x2 = await uploadFile(tokenA, 'x2', 'x2.pdf');
    check('cannot replace a verified document', (await api('PUT', '/applications/my-application/documents/classXMarksheet', { token: tokenA, json: { uploadId: x2 } })).status === 400);
    check('discard an unused upload', (await api('DELETE', `/uploads/${x2}`, { token: tokenA })).status === 200);
    const fix = await uploadFile(tokenA, 'jee-clear', 'jee-clear.pdf');
    const replaced = await api('PUT', '/applications/my-application/documents/scorecard_JEE_MAIN', { token: tokenA, json: { uploadId: fix } });
    const jeeDoc = replaced.data.application?.documents.find((d) => d.key === 'scorecard_JEE_MAIN');
    check('replace rejected document -> Pending again', replaced.status === 200 && jeeDoc.verification.status === 'Pending' && jeeDoc.originalName === 'jee-clear.pdf');
    const resub = await api('POST', '/applications/my-application/resubmit', { token: tokenA });
    check('resubmit -> Review', resub.status === 200 && resub.data.application.status === 'Review');

    // ---------------- Admin: decision ----------------
    console.log('\nAdmin: decision + reports');
    const verJee = await api('PATCH', `/admin/applications/${app._id}/documents/scorecard_JEE_MAIN`, { token: tokenAdmin, json: { status: 'Verified' } });
    check('verify replaced scorecard', verJee.status === 200);
    const hold = await api('PATCH', `/admin/applications/${app._id}/status`, { token: tokenAdmin, json: { status: 'On Hold', remarks: 'Waiting for counselling round' } });
    check('put on hold', hold.status === 200 && hold.data.application.status === 'On Hold');
    const select = await api('PATCH', `/admin/applications/${app._id}/status`, { token: tokenAdmin, json: { status: 'Selected', remarks: 'All criteria met' } });
    check('select applicant', select.status === 200 && select.data.application.status === 'Selected');
    check('Selected is terminal', (await api('PATCH', `/admin/applications/${app._id}/status`, { token: tokenAdmin, json: { status: 'Rejected', remarks: 'x' } })).status === 400);
    const mine = (await api('GET', '/applications/my-application', { token: tokenA })).data.application;
    check('applicant sees Selected status', mine.status === 'Selected');

    const csv = await api('GET', '/admin/report.csv', { token: tokenAdmin });
    const csvText = csv.data.toString();
    check('CSV report includes both applications', csv.status === 200 && csvText.includes(paidApp.applicationId) && csvText.split('\n').length === 3);

    detail = (await api('GET', `/admin/applications/${app._id}`, { token: tokenAdmin })).data;
    const actions = detail.auditLog.map((a) => a.action).reverse();
    const expected = ['APPLICATION_CREATED', 'PAYMENT_FAILED', 'PAYMENT_SUCCESS', 'DOCUMENT_VERIFIED', 'DOCUMENT_REJECTED', 'DOCUMENT_REPLACED'];
    check('audit trail records the full journey', expected.every((a) => actions.includes(a)), actions.join(','));
    const statusMails = detail.notifications.filter((n) => n.type === 'STATUS_UPDATE').map((n) => n.subject);
    check('status emails: correction, on hold, selected', statusMails.length === 3 && detail.notifications.every((n) => n.status === 'Sent'), statusMails.join(' | '));
    const history = detail.application.statusHistory.map((h) => h.toStatus).join(' > ');
    check('status history', history === 'Payment Pending > Submitted > Review > Correction Requested > Review > On Hold > Selected', history);

    check('status email subject says Approved', statusMails.some((m) => /: Approved$/.test(m)), statusMails.join(' | '));
    check('applicant sees default remarks when the admin wrote none', (await api('GET', '/applications/my-application', { token: tokenB })).data.application.adminRemarks === 'Application submitted. Waiting for document scrutiny.');

    // ---------------- Missing stored file ----------------
    console.log('\nMissing document file');
    const idB = subB.data.application._id;
    const rawB = await db.collection('applications').findOne({ _id: new mongoose.Types.ObjectId(idB) });
    fs.rmSync(path.join(UPLOAD_DIR, rawB.classX.marksheet.fileName), { force: true });
    const viewB = (await api('GET', `/admin/applications/${idB}`, { token: tokenAdmin })).data.application;
    const lostDoc = viewB.documents.find((d) => d.key === 'classXMarksheet');
    check('admin detail flags the missing file', lostDoc.available === false && viewB.documents.filter((d) => d.available).length === 3);
    check('applicant also sees it as missing', (await api('GET', '/applications/my-application', { token: tokenB })).data.application.documents.find((d) => d.key === 'classXMarksheet').available === false);
    const approveLost = await api('PATCH', `/admin/applications/${idB}/documents/classXMarksheet`, { token: tokenAdmin, json: { status: 'Verified' } });
    check('cannot approve a missing file -> 400', approveLost.status === 400 && /missing/.test(approveLost.data.message));
    const askAgain = await api('PATCH', `/admin/applications/${idB}/documents/classXMarksheet`, { token: tokenAdmin, json: { status: 'Rejected', remarks: 'The file was not received. Please upload it again.' } });
    check('admin asks for re-upload (reject with reason)', askAgain.status === 200 && /rejected/.test(askAgain.data.message));
    const okDocReplace = await uploadFile(tokenB, 'x-ok', 'x-ok.pdf');
    check('applicant cannot replace a file that still exists', (await api('PUT', '/applications/my-application/documents/classXIIMarksheet', { token: tokenB, json: { uploadId: okDocReplace } })).status === 400);
    const again = await uploadFile(tokenB, 'x-again', 'x-again.pdf');
    const reup = await api('PUT', '/applications/my-application/documents/classXMarksheet', { token: tokenB, json: { uploadId: again } });
    const reupDoc = reup.data.application?.documents.find((d) => d.key === 'classXMarksheet');
    check('applicant uploads the missing file again -> available, Pending review', reup.status === 200 && reupDoc.available === true && reupDoc.verification.status === 'Pending', JSON.stringify(reup.data).slice(0, 200));
    const reupAudit = await db.collection('auditlogs').findOne({ application: new mongoose.Types.ObjectId(idB), action: 'DOCUMENT_REUPLOADED' });
    check('re-upload is audited', !!reupAudit);

    // ---------------- Delete record ----------------
    console.log('\nAdmin: delete record');
    const delId = subB.data.application._id;
    const delApp = (await api('GET', `/admin/applications/${delId}`, { token: tokenAdmin })).data.application;
    const delKey = delApp.applicationId;
    check('applicant cannot delete -> 403', (await api('DELETE', `/admin/applications/${delId}`, { token: tokenB, json: { confirm: delKey, reason: 'test' } })).status === 403);
    check('wrong confirmation -> 400', (await api('DELETE', `/admin/applications/${delId}`, { token: tokenAdmin, json: { confirm: 'nope', reason: 'Duplicate test record' } })).status === 400);
    check('missing reason -> 400', (await api('DELETE', `/admin/applications/${delId}`, { token: tokenAdmin, json: { confirm: delKey, reason: '' } })).status === 400);
    const filesBefore = fs.readdirSync(UPLOAD_DIR).length;
    const del = await api('DELETE', `/admin/applications/${delId}`, { token: tokenAdmin, json: { confirm: delKey, reason: 'Duplicate test record' } });
    check('delete with confirmation -> 200', del.status === 200, JSON.stringify(del.data));
    check('deleted application is gone', (await api('GET', `/admin/applications/${delId}`, { token: tokenAdmin })).status === 404);
    check('applicant B has no application any more', (await api('GET', '/applications/my-application', { token: tokenB })).data.application === null);
    check("deleted application's documents removed from storage", fs.readdirSync(UPLOAD_DIR).length <= filesBefore - 4);
    const oid = new mongoose.Types.ObjectId(delId);
    check('payment record kept for accounting', (await db.collection('payments').countDocuments({ application: oid })) === 1);
    check('emails removed with the application', (await db.collection('notifications').countDocuments({ application: oid })) === 0);
    const delAudit = await db.collection('auditlogs').findOne({ application: oid, action: 'APPLICATION_DELETED' });
    check('audit log records who deleted it and why', !!delAudit && delAudit.details.includes('Duplicate test record') && delAudit.actorRole === 'admin');
    const statsAfter = (await api('GET', '/admin/stats', { token: tokenAdmin })).data.stats;
    check('stats reflect the deletion', statsAfter.total === 1);
  } catch (err) {
    failed++;
    console.error('\nUnexpected error:', err.message);
  } finally {
    if (server) server.child.kill();
    await db.dropDatabase().catch(() => {});
    await mongoose.disconnect();
    const del = await pool.query("DELETE FROM users WHERE email LIKE 'e2e-%@example.com'").catch((e) => ({ rowCount: `error: ${e.message}` }));
    await pool.end();
    fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
    console.log(`\nCleanup: e2e Mongo database dropped, ${del.rowCount} PostgreSQL test user(s) deleted, uploads removed.`);
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  }
})();
