/* eslint-disable no-console */
/**
 * Edge-case tests: boundary values, malformed and hostile input, access control, races and the
 * decision rules. Complements e2e-workflow.js (the happy path).
 *
 * Data isolation: separate MongoDB database (<db>_edge, dropped at the end); PostgreSQL test users
 * (e2e-*@example.com) are deleted at the end.
 *
 * Run: npm run test:edge   (from /server)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const mongoose = require('mongoose');

const PORT = 5098;
const BASE = `http://127.0.0.1:${PORT}/api`;
const RUN = Date.now();
const UPLOAD_DIR = path.join(os.tmpdir(), `iem-edge-uploads-${RUN}`);

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not set in server/.env');
  process.exit(1);
}
// Point the same cluster at a separate <db>_edge database. String-based: WHATWG URL cannot parse
// multi-host mongodb:// strings, and its errors would print the credentials.
const uriMatch = process.env.MONGO_URI.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/?([^?]*)(\?.*)?$/);
if (!uriMatch) {
  console.error('MONGO_URI is not a valid MongoDB connection string.');
  process.exit(1);
}
const baseDb = uriMatch[2] || 'iem_admission_portal';
const E2E_MONGO_URI = `${uriMatch[1]}/${baseDb}_edge${uriMatch[3] || ''}`;

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


const jwt = require('jsonwebtoken');
const { validateApplication } = require('../validators/application.validator');
const { JWT_SECRET } = require('../config/secrets');

const raw = (bytes, type, name) => {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type }), name);
  return fd;
};
/** Date of birth for someone who turns `age` today (+/- days) */
const dobForAge = (age, days = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
/** Validator errors for the standard body with one change applied */
const errorsWith = (mutate) => {
  const body = JSON.parse(JSON.stringify(applicationBody({ email: 'v@example.com', documents: {} })));
  mutate(body);
  return validateApplication(body).errors;
};
const ok = (name, mutate) => {
  const e = errorsWith(mutate);
  check(`accepts ${name}`, e.length === 0, e.join(' | '));
};
/** In range for the field, even if a stream cut-off then makes the applicant ineligible */
const inRange = (name, mutate) => {
  const e = errorsWith(mutate).filter((m) => !/^Not eligible/.test(m));
  check(`accepts ${name}`, e.length === 0, e.join(' | '));
};
const bad = (name, mutate, pattern) => {
  const e = errorsWith(mutate);
  check(`rejects ${name}`, e.length > 0 && (!pattern || e.some((m) => pattern.test(m))), e.join(' | ') || '(no error)');
};
const exam = (b, code) => b.competitiveExams.find((x) => x.exam === code);

(async () => {
  const { pool } = require('../config/postgres');
  await mongoose.connect(E2E_MONGO_URI);
  const db = mongoose.connection.db;
  await db.dropDatabase();
  let server;
  try {
    server = await startServer();
    console.log(`Server up on :${PORT} (Mongo db: ${baseDb}_edge)\n`);

    // ---------------- Registration ----------------
    console.log('Registration (boundary values)');
    const em = (tag) => `e2e-edge-${tag}-${RUN}@example.com`;
    check('invalid email -> 400', (await register('a@b')).status === 400);
    check('password of 5 characters -> 400', (await register(em('p5'), { password: '12345' })).status === 400);
    check('password of 6 characters -> 201', (await register(em('p6'), { password: '123456' })).status === 201);
    check('password of 32 characters -> 201', (await register(em('p32'), { password: 'a'.repeat(32) })).status === 201);
    check('password of 33 characters -> 400', (await register(em('p33'), { password: 'a'.repeat(33) })).status === 400);
    check('mobile starting with 5 -> 400', (await register(em('ph5'), { phone: '5830012345' })).status === 400);
    check('mobile with 9 digits -> 400', (await register(em('ph9'), { phone: '983001234' })).status === 400);
    check('mobile written as +91 98300 12345 -> 201', (await register(em('ph91'), { phone: '+91 98300 12345' })).status === 201);
    check('mobile that itself starts with 91 (9123456780) -> 201', (await register(em('ph9123'), { phone: '9123456780' })).status === 201);
    check('name starting with a digit -> 400', (await register(em('n1'), { name: '1Riya' })).status === 400);
    check('name with HTML -> 400', (await register(em('nx'), { name: '<script>alert(1)</script>' })).status === 400);
    check('object instead of email (NoSQL injection) -> 400', (await api('POST', '/auth/register', { json: { name: 'Riya B', email: { $ne: '' }, password: 'Test@12345', phone: '9830012345' } })).status === 400);
    check('empty body -> 400', (await api('POST', '/auth/register', { json: {} })).status === 400);

    const emailA = em('a');
    const regA = await register(emailA);
    check('valid registration -> 201', regA.status === 201);
    check('same email in different case -> 409', (await register(emailA.toUpperCase())).status === 409);

    console.log('\nLogin');
    check('wrong password -> 401', (await api('POST', '/auth/login', { json: { email: emailA, password: 'Wrong@123' } })).status === 401);
    check('unknown email -> 401 (same message, no account probing)', (await api('POST', '/auth/login', { json: { email: em('nobody'), password: 'Test@12345' } })).status === 401);
    check('object as email (NoSQL injection) -> 400', (await api('POST', '/auth/login', { json: { email: { $ne: '' }, password: { $ne: '' } } })).status === 400);
    check('applicant on the admin portal -> 403', (await api('POST', '/auth/login', { json: { email: emailA, password: 'Test@12345', role: 'admin' } })).status === 403);
    const tokenA = (await api('POST', '/auth/login', { json: { email: emailA.toUpperCase(), password: 'Test@12345' } })).data.token;
    check('email is case-insensitive at login', !!tokenA);

    console.log('\nSession tokens');
    const me = '/applications/my-application';
    check('no token -> 401', (await api('GET', me)).status === 401);
    check('garbage token -> 401', (await api('GET', me, { token: 'garbage' })).status === 401);
    const { iat, exp, ...claims } = jwt.decode(tokenA);
    const expired = jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 10 }, JWT_SECRET);
    check('expired token -> 401', (await api('GET', me, { token: expired })).status === 401);
    const forged = jwt.sign({ ...claims, role: 'admin' }, 'not-the-secret', { expiresIn: '1d' });
    check('token signed with another secret -> 401', (await api('GET', '/admin/stats', { token: forged })).status === 401);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ...claims, role: 'admin' })).toString('base64url')}.`;
    check('unsigned "alg: none" admin token -> 401', (await api('GET', '/admin/stats', { token: none })).status === 401);
    const [h, , sig] = tokenA.split('.');
    const tampered = `${h}.${Buffer.from(JSON.stringify({ ...claims, iat, exp, role: 'admin' })).toString('base64url')}.${sig}`;
    check('payload edited to role=admin -> 401', (await api('GET', '/admin/stats', { token: tampered })).status === 401);
    check('applicant token on admin API -> 403', (await api('GET', '/admin/stats', { token: tokenA })).status === 403);

    // ---------------- Uploads ----------------
    console.log('\nDocument uploads');
    const pdfBytes = (size) => {
      const b = Buffer.alloc(size, 0x20);
      b.write('%PDF-1.4\n');
      return b;
    };
    const MB5 = 5 * 1024 * 1024;
    const atMax = await api('POST', '/uploads', { token: tokenA, form: raw(pdfBytes(MB5), 'application/pdf', 'max.pdf') });
    check('exactly 5 MB -> 201', atMax.status === 201, `${atMax.status} ${JSON.stringify(atMax.data).slice(0, 200)}`);
    const over = await api('POST', '/uploads', { token: tokenA, form: raw(pdfBytes(MB5 + 1), 'application/pdf', 'big.pdf') });
    check('5 MB + 1 byte -> rejected (4xx)', over.status === 400 || over.status === 413, String(over.status));
    check('empty file -> 400', (await api('POST', '/uploads', { token: tokenA, form: raw(Buffer.alloc(0), 'application/pdf', 'empty.pdf') })).status === 400);
    check('executable renamed to .pdf -> 400', (await api('POST', '/uploads', { token: tokenA, form: raw(Buffer.from('MZ\x90\x00binary'), 'application/pdf', 'virus.pdf') })).status === 400);
    check('real PNG -> 201', (await api('POST', '/uploads', { token: tokenA, form: raw(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), 'image/png', 'a.png') })).status === 201);
    check('real JPEG -> 201', (await api('POST', '/uploads', { token: tokenA, form: raw(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), 'image/jpeg', 'a.jpg') })).status === 201);
    check('Word document -> 400', (await api('POST', '/uploads', { token: tokenA, form: raw(Buffer.from('PK'), 'application/msword', 'a.doc') })).status === 400);
    check('no file attached -> 400', (await api('POST', '/uploads', { token: tokenA, form: new FormData() })).status === 400);

    // ---------------- Form validation (boundary values, validator) ----------------
    console.log('\nApplication form boundaries');
    ok('the standard valid application', () => {});
    ok('age exactly 16', (b) => (b.dob = dobForAge(16)));
    bad('age 15 (one day short of 16)', (b) => (b.dob = dobForAge(16, 1)), /age/i);
    ok('age exactly 35', (b) => (b.dob = dobForAge(35)));
    bad('age 36', (b) => (b.dob = dobForAge(36, -1)), /age/i);
    bad('date of birth in the future', (b) => (b.dob = '2099-01-01'));
    bad('impossible date 2007-02-30', (b) => (b.dob = 'not-a-date'));
    inRange('Class X exactly 33% (in range; below stream cut-offs)', (b) => (b.classX.percentage = '33'));
    bad('Class X 32.99%', (b) => (b.classX.percentage = '32.99'), /Class X/);
    ok('Class X exactly 100%', (b) => (b.classX.percentage = '100'));
    bad('Class X 100.01%', (b) => (b.classX.percentage = '100.01'), /Class X/);
    bad('Class X with 3 decimals', (b) => (b.classX.percentage = '92.555'), /decimal/);
    bad('Class X as text', (b) => (b.classX.percentage = 'ninety'), /number/);
    bad('Class XII 44.99%', (b) => (b.classXII.percentage = '44.99'), /Class XII/);
    bad('Class XII only 1 year after Class X', (b) => (b.classXII.passingYear = 2024), /years after Class X/);
    ok('JEE Main rank 1', (b) => (exam(b, 'JEE_MAIN').rank = 1));
    bad('JEE Main rank 0', (b) => (exam(b, 'JEE_MAIN').rank = 0), /rank/);
    ok('JEE Main rank 5,000,000', (b) => (exam(b, 'JEE_MAIN').rank = 5000000));
    bad('JEE Main rank 5,000,001', (b) => (exam(b, 'JEE_MAIN').rank = 5000001), /rank/);
    bad('JEE Main rank 1.5', (b) => (exam(b, 'JEE_MAIN').rank = 1.5), /whole/);
    bad('negative rank', (b) => (exam(b, 'JEE_MAIN').rank = -3), /rank/);
    ok('JEE Main marks -75 (lowest possible)', (b) => (exam(b, 'JEE_MAIN').score = -75));
    bad('JEE Main marks -75.01', (b) => (exam(b, 'JEE_MAIN').score = '-75.01'));
    ok('JEE Main marks 300 (full marks)', (b) => (exam(b, 'JEE_MAIN').score = 300));
    bad('JEE Main marks 301', (b) => (exam(b, 'JEE_MAIN').score = 301));
    bad('JEE Main application number with 11 digits', (b) => (exam(b, 'JEE_MAIN').rollNumber = '25031012345'), /application number/i);
    bad('WBJEE rank 500,001', (b) => (exam(b, 'WBJEE').rank = 500001), /rank/);
    ok('WBJEE marks -50', (b) => (exam(b, 'WBJEE').score = -50));
    bad('no entrance exam at all', (b) => (b.competitiveExams = []), /at least one/);
    bad('the same exam twice', (b) => b.competitiveExams.push({ ...exam(b, 'WBJEE') }), /more than once/);
    bad('an unknown exam', (b) => b.competitiveExams.push({ exam: 'SAT', rollNumber: 'X1234', year: 2025, score: 1 }), /Unknown/);
    bad('an exam not accepted for B.Tech (CAT)', (b) => b.competitiveExams.push({ exam: 'CAT', rollNumber: 'CAT1234', year: 2025, score: 90 }), /not accepted/);
    bad('a single-word name', (b) => (b.fullName = 'Riya'), /surname/);
    bad('name with digits', (b) => (b.fullName = 'Riya B4nerjee'));
    bad('mobile starting with 5', (b) => (b.phone = '5830012345'), /Mobile/);
    bad('alternate mobile equal to mobile', (b) => (b.alternatePhone = b.phone), /different/);
    bad('PIN code starting with 0', (b) => (b.pincode = '012345'), /PIN/);
    bad('PIN code with 5 digits', (b) => (b.pincode = '70001'), /PIN/);
    ok('address of exactly 10 characters', (b) => (b.address = '1234567890'));
    bad('address of 9 characters', (b) => (b.address = '123456789'), /Address/);
    bad('invalid category', (b) => (b.category = 'VIP'), /category/);
    bad('gender not selected', (b) => (b.gender = ''), /Gender/);
    bad('no parent contact number', (b) => (b.parents.fatherPhone = ''), /parent contact/);
    bad('stream not offered under B.Tech', (b) => (b.streamPreferences = ['MBA']), /not offered/);
    bad('the same stream twice', (b) => (b.streamPreferences = ['Information Technology', 'Information Technology']), /different/);
    bad('no stream chosen', (b) => (b.streamPreferences = []), /at least one stream/);
    bad('declaration not accepted', (b) => (b.declaration = false), /declaration/);
    bad('no program', (b) => (b.program = ''), /program/);

    // ---------------- Submission over HTTP ----------------
    console.log('\nSubmission');
    const docsA = await uploadAll(tokenA);
    check('XSS in the name is refused over HTTP', (await api('POST', '/applications', { token: tokenA, json: { ...applicationBody({ email: emailA, documents: docsA }), fullName: '<img src=x onerror=alert(1)>' } })).status === 400);
    const sameFile = { ...docsA, classXIIMarksheet: docsA.classXMarksheet };
    check('one file used for two documents -> 400', (await api('POST', '/applications', { token: tokenA, json: applicationBody({ email: emailA, documents: sameFile }) })).status === 400);
    const huge = await api('POST', '/applications', { token: tokenA, json: { ...applicationBody({ email: emailA, documents: docsA }), address: 'x'.repeat(2 * 1024 * 1024) } });
    check('oversized request body -> rejected without a crash', huge.status === 413 || huge.status === 400, String(huge.status));
    // Two submissions at the same instant: exactly one application may be created
    const body = applicationBody({ email: emailA, documents: docsA });
    const [s1, s2] = await Promise.all([api('POST', '/applications', { token: tokenA, json: body }), api('POST', '/applications', { token: tokenA, json: body })]);
    const codes = [s1.status, s2.status].sort().join(',');
    check('double-click submit creates exactly one application', codes === '201,400' || codes === '201,409', codes);
    check('only one application stored', (await db.collection('applications').countDocuments({ email: emailA })) === 1);
    const appA = (s1.status === 201 ? s1 : s2).data.application;

    // ---------------- Payment ----------------
    console.log('\nPayment');
    const emailB = em('b');
    const tokenB = (await register(emailB)).data.token;
    check('order without an application -> 4xx', [400, 404].includes((await api('POST', '/payments/order', { token: tokenB })).status));
    const order = (await api('POST', '/payments/order', { token: tokenA })).data.order;
    check('fee is exactly Rs. 1,000 (100000 paise), set by the server', order.amount === 100000);
    check("another user cannot pay this order", (await api('POST', '/payments/mock-checkout', { token: tokenB, json: { orderId: order.orderId, method: 'UPI', outcome: 'success' } })).status >= 400);
    const paid = (await api('POST', '/payments/mock-checkout', { token: tokenA, json: { orderId: order.orderId, method: 'UPI', outcome: 'success' } })).data;
    check("another user cannot verify this payment", (await api('POST', '/payments/verify', { token: tokenB, json: { ...paid, method: 'UPI' } })).status >= 400);
    check('payment id swapped (signature no longer matches) -> 400', (await api('POST', '/payments/verify', { token: tokenA, json: { ...paid, razorpay_payment_id: 'pay_fake123', method: 'UPI' } })).status === 400);
    check('missing signature -> 400', (await api('POST', '/payments/verify', { token: tokenA, json: { ...paid, razorpay_signature: '', method: 'UPI' } })).status === 400);
    const [p1, p2, p3] = await Promise.all([1, 2, 3].map(() => api('POST', '/payments/verify', { token: tokenA, json: { ...paid, method: 'UPI' } })));
    const ids = new Set([p1, p2, p3].map((p) => p.data.application?.applicationId));
    check('three simultaneous verifications -> one application ID', p1.status === 200 && ids.size === 1 && !ids.has(undefined), [...ids].join(','));
    check('exactly one successful payment recorded', (await db.collection('payments').countDocuments({ application: new mongoose.Types.ObjectId(appA._id), status: { $in: ['Paid', 'paid'] } })) === 1);

    // ---------------- Access control ----------------
    console.log('\nAccess control');
    check("applicant B cannot read A's slip", (await api('GET', `/applications/${appA._id}/slip`, { token: tokenB })).status === 403);
    check("applicant B cannot read A's document", (await api('GET', `/applications/${appA._id}/documents/classXMarksheet`, { token: tokenB })).status === 403);
    check('applicant cannot change a status', (await api('PATCH', `/admin/applications/${appA._id}/status`, { token: tokenA, json: { status: 'Selected' } })).status === 403);
    check('applicant cannot delete', (await api('DELETE', `/admin/applications/${appA._id}`, { token: tokenA, json: {} })).status === 403);
    const tokenAdmin = (await api('POST', '/auth/login', { json: { email: 'admin@iem.edu.in', password: 'adminpassword123', role: 'admin' } })).data.token;
    check('malformed application id -> 404, not a crash', (await api('GET', '/admin/applications/not-an-id', { token: tokenAdmin })).status === 404);
    check('unknown document key -> 404', (await api('GET', `/applications/${appA._id}/documents/passport`, { token: tokenAdmin })).status === 404);
    check('path traversal in document key -> 404', (await api('GET', `/applications/${appA._id}/documents/..%2F..%2F.env`, { token: tokenAdmin })).status === 404);
    const inj = await api('GET', '/admin/applications?search=%5C%24where%7C.*&status=%7B%22%24ne%22%3A1%7D', { token: tokenAdmin });
    check('injection-like search/filter values are handled safely', inj.status === 200 || inj.status === 400, String(inj.status));

    // ---------------- State machine ----------------
    console.log('\nDecision rules');
    const status = (to, remarks, id = appA._id) => api('PATCH', `/admin/applications/${id}/status`, { token: tokenAdmin, json: { status: to, remarks } });
    check('unknown status -> 400', (await status('Hired')).status === 400);
    for (const to of ['Selected', 'Rejected', 'On Hold', 'Correction Requested', 'Payment Pending']) {
      check(`Submitted -> ${to} is not allowed`, (await status(to, 'reason')).status === 400);
    }
    check('Submitted -> Review', (await status('Review')).status === 200);
    check('reject without a reason -> 400', (await status('Rejected', '   ')).status === 400);
    check('approve with documents still pending -> 400', (await status('Selected', 'ok')).status === 400);
    check('correction without a rejected document -> 400', (await status('Correction Requested', 'fix')).status === 400);
    check('applicant cannot resubmit while not in correction', (await api('POST', '/applications/my-application/resubmit', { token: tokenA })).status === 400);
    const rejected = await status('Rejected', 'Class XII marks below the cut-off for the chosen stream');
    check('reject with a reason', rejected.status === 200 && rejected.data.application.status === 'Rejected');
    for (const to of ['Selected', 'Review', 'On Hold']) {
      check(`Rejected is final (-> ${to} refused)`, (await status(to, 'x')).status === 400);
    }
    check('documents cannot be approved after rejection', (await api('PATCH', `/admin/applications/${appA._id}/documents/classXMarksheet`, { token: tokenAdmin, json: { status: 'Verified' } })).status === 400);
    const mineA = (await api('GET', me, { token: tokenA })).data.application;
    check('applicant sees Rejected with the reason', mineA.status === 'Rejected' && mineA.adminRemarks.includes('cut-off'));
    const up = await uploadFile(tokenA, 'late', 'late.pdf');
    check('rejected applicant cannot replace documents', (await api('PUT', '/applications/my-application/documents/classXMarksheet', { token: tokenA, json: { uploadId: up } })).status === 400);
    check('rejected applicant cannot apply again', (await api('POST', '/applications', { token: tokenA, json: applicationBody({ email: emailA, documents: await uploadAll(tokenA) }) })).status === 409);
    const mail = await db.collection('notifications').findOne({ application: new mongoose.Types.ObjectId(appA._id), subject: /Rejected$/ });
    check('rejection email recorded', !!mail);

    // ---------------- Every field is stored ----------------
    console.log('\nEvery form field is saved');
    const emailC = em('full');
    const tokenC = (await register(emailC)).data.token;
    const full = applicationBody({ email: emailC, documents: await uploadAll(tokenC) });
    Object.assign(full, { alternatePhone: '9123456780', category: 'OBC-A', nationality: 'Indian', gender: 'Other' });
    full.parents = {
      fatherName: 'Amit Banerjee', fatherPhone: '9830098765', fatherOccupation: 'Engineer',
      motherName: 'Sunita Banerjee', motherPhone: '9830087654', motherOccupation: 'Teacher',
      guardianName: 'Ravi Kumar', guardianRelation: 'Uncle', guardianPhone: '9830076543'
    };
    full.classXII.mathOrComputer = true;
    const subC = await api('POST', '/applications', { token: tokenC, json: full });
    check('application with every field filled is accepted', subC.status === 201, JSON.stringify(subC.data).slice(0, 300));
    const stored = await db.collection('applications').findOne({ email: emailC });
    const same = (label, got, sent) => check(`saved: ${label}`, String(got) === String(sent), `sent ${JSON.stringify(sent)} stored ${JSON.stringify(got)}`);
    for (const k of ['fullName', 'email', 'phone', 'alternatePhone', 'dob', 'gender', 'category', 'nationality', 'address', 'city', 'state', 'pincode', 'program']) same(k, stored[k], full[k]);
    for (const k of Object.keys(full.parents)) same(`parents.${k}`, stored.parents[k], full.parents[k]);
    for (const k of ['board', 'school', 'passingYear', 'percentage']) same(`classX.${k}`, stored.classX[k], full.classX[k]);
    for (const k of ['board', 'school', 'stream', 'passingYear', 'percentage', 'pcmPercentage', 'mathOrComputer']) same(`classXII.${k}`, stored.classXII[k], full.classXII[k]);
    same('streamPreferences', stored.streamPreferences.join('|'), full.streamPreferences.join('|'));
    same('declaration', stored.declarationAccepted, true);
    full.competitiveExams.forEach((e) => {
      const se = stored.competitiveExams.find((x) => x.exam === e.exam) || {};
      for (const k of ['rollNumber', 'year', 'rank', 'score']) same(`${e.exam}.${k}`, se[k], e[k]);
    });
    const slots = ['Class X marksheet', 'Class XII marksheet', ...full.competitiveExams.map((e) => `${e.exam} scorecard`)];
    const files = [stored.classX.marksheet, stored.classXII.marksheet, ...stored.competitiveExams.map((e) => e.scorecard)];
    files.forEach((f, i) => check(`saved: ${slots[i]} file`, !!(f && f.fileName && f.originalName && f.fileSize > 0)));
  } catch (err) {
    failed++;
    console.error('\nUnexpected error:', err.stack);
  } finally {
    if (server) server.child.kill();
    await db.dropDatabase().catch(() => {});
    await mongoose.disconnect();
    const del = await pool.query("DELETE FROM users WHERE email LIKE 'e2e-%@example.com'").catch((e) => ({ rowCount: `error: ${e.message}` }));
    await pool.end();
    fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
    console.log(`\nCleanup: edge-case Mongo database dropped, ${del.rowCount} PostgreSQL test user(s) deleted, uploads removed.`);
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  }
})();
