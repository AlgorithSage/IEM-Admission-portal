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
    row('Application Fee', inr(app.payment && app.payment.amount));
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

module.exports = { generateAdmissionSlip };
