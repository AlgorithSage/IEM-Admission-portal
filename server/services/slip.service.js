const PDFDocument = require('pdfkit');
const { COMPETITIVE_EXAMS } = require('../config/admission.rules');
const { statusLabel } = require('../config/status.rules');

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const inr = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

/** Renders the admission (acknowledgement) slip for a paid application as a PDF buffer. */
const generateAdmissionSlip = (app) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Admission Slip ${app.applicationId}` } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).text('Institute of Engineering & Management', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text('Salt Lake Sector V, Kolkata 700091  |  www.iem.edu.in', { align: 'center' });
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(13).text('ADMISSION SLIP - Academic Year 2026-2027', { align: 'center' });
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.8);

    const row = (label, value) => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).text(label, 50, y, { width: 170 });
      doc.font('Helvetica').fontSize(10).text(String(value ?? '-'), 220, y, { width: 325 });
      doc.moveDown(0.35);
    };
    const heading = (title) => {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(11).text(title, 50);
      doc.moveDown(0.3);
    };

    heading('Application');
    row('Application ID', app.applicationId);
    row('Submitted On', fmtDate(app.submittedAt));
    row('Program', app.program || app.department);
    row('Stream Preferences', (app.streamPreferences || []).map((s, i) => `${i + 1}. ${s}`).join('   ') || '-');
    row('Status', statusLabel(app.status));

    heading('Applicant');
    row('Name', app.fullName);
    row('Date of Birth', fmtDate(app.dob));
    row('Gender / Category', `${app.gender} / ${app.category || '-'}`);
    row('Email', app.email);
    row('Mobile', app.phone);
    row('Address', [app.address, app.city, app.state, app.pincode].filter(Boolean).join(', '));
    if (app.parents) {
      row("Father's Name", app.parents.fatherName);
      row("Mother's Name", app.parents.motherName);
    }

    heading('Academics');
    if (app.classX) row('Class X', `${app.classX.board}, ${app.classX.passingYear} - ${app.classX.percentage}%`);
    if (app.classXII) row('Class XII', `${app.classXII.board}, ${app.classXII.stream}, ${app.classXII.passingYear} - ${app.classXII.percentage}%`);
    if (app.graduation) row('Graduation', `${app.graduation.degree}, ${app.graduation.university}, ${app.graduation.passingYear} - ${app.graduation.percentage}%`);
    (app.competitiveExams || []).forEach((e) => {
      const rules = COMPETITIVE_EXAMS[e.exam] || { label: e.exam, score: { label: 'Score' } };
      row(rules.label, `${e.rank ? `Rank ${e.rank.toLocaleString('en-IN')}, ` : ''}${rules.score.label} ${e.score} (Roll ${e.rollNumber})`);
    });

    heading('Payment');
    row('Amount Paid', inr(app.payment && app.payment.amount));
    if (app.payment && app.payment.description) row('Paid For', app.payment.description);
    row('Payment ID', app.payment && app.payment.paymentId);
    row('Paid On', fmtDate(app.payment && app.payment.paidAt));

    doc.moveDown(1);
    doc.font('Helvetica').fontSize(9).fillColor('#444').text(
      'This slip confirms receipt of your application and fee. Admission is subject to document verification, ' +
        'eligibility and counselling as per IEM rules. Bring this slip and original documents for verification.',
      50,
      doc.y,
      { width: 495 }
    );
    doc.end();
  });

/** Indian-system amount in words: 140000 -> "One Lakh Forty Thousand Rupees Only" */
const amountInWords = (rupees) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`);
  const three = (n) => [n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred` : '', two(n % 100)].filter(Boolean).join(' ');
  let n = Math.round(Number(rupees) || 0);
  if (n === 0) return 'Zero Rupees Only';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return `${parts.join(' ')} Rupees Only`;
};

/** Receipt number derived from the application ID (one successful payment per application) */
const receiptNumber = (app) => `RCPT-${app.applicationId}`;

/** Renders the payment receipt for a paid application as a PDF buffer. */
const generatePaymentReceipt = (app) =>
  new Promise((resolve, reject) => {
    const p = app.payment || {};
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Payment Receipt ${receiptNumber(app)}` } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).text('Institute of Engineering & Management', { align: 'center' });
    doc.font('Helvetica').fontSize(10).text('Salt Lake Sector V, Kolkata 700091  |  www.iem.edu.in', { align: 'center' });
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(13).text('PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.8);

    const row = (label, value, bold = false) => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).text(label, 50, y, { width: 170 });
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).text(String(value ?? '-'), 220, y, { width: 325 });
      doc.moveDown(0.45);
    };

    row('Receipt No.', receiptNumber(app));
    row('Date', fmtDate(p.paidAt));
    row('Received From', app.fullName);
    row('Email / Mobile', `${app.email} / ${app.phone}`);
    row('Application ID', app.applicationId);
    row('Program / Stream', `${app.program || app.department} / ${(app.streamPreferences || [])[0] || '-'}`);
    doc.moveDown(0.4);
    row('Paid For', p.description || 'Admission fee');
    row('Amount Paid', inr(p.amount), true);
    row('Amount in Words', amountInWords(p.amount));
    doc.moveDown(0.4);
    row('Payment Method', p.method || '-');
    row('Payment ID', p.paymentId);
    row('Order ID', p.orderId);
    row('Status', 'PAID');

    doc.moveDown(1.5);
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#555')
      .text('This is a computer-generated receipt and does not require a signature. Keep it for your records.', 50, doc.y, { width: 495, align: 'center' });
    doc.end();
  });

module.exports = { generateAdmissionSlip, generatePaymentReceipt, amountInWords, receiptNumber };
