// Application lifecycle (state machine). Single source of truth for allowed transitions.
//
//  Payment Pending --(payment verified, system)--> Submitted --> Review
//  Review   --> Selected | Rejected | On Hold | Correction Requested
//  On Hold  --> Review | Selected | Rejected
//  Correction Requested --(applicant resubmits, system)--> Review
//  Selected, Rejected: terminal

const STATUSES = ['Payment Pending', 'Submitted', 'Review', 'On Hold', 'Correction Requested', 'Selected', 'Rejected'];

// Transitions an administrator may perform
const ADMIN_TRANSITIONS = {
  'Payment Pending': [],
  Submitted: ['Review'],
  Review: ['Selected', 'Rejected', 'On Hold', 'Correction Requested'],
  'On Hold': ['Review', 'Selected', 'Rejected'],
  'Correction Requested': [],
  Selected: [],
  Rejected: []
};

// Transitions performed by the system on behalf of the applicant
const SYSTEM_TRANSITIONS = {
  'Payment Pending': ['Submitted'],
  'Correction Requested': ['Review']
};

// Admin decisions that must carry a reason
const REMARKS_REQUIRED = ['Rejected', 'On Hold', 'Correction Requested'];

// Statuses in which an administrator can verify documents
const VERIFIABLE_STATUSES = ['Submitted', 'Review', 'On Hold'];

// What applicants and admins read. Stored values stay unchanged so existing data needs no migration.
const STATUS_LABELS = {
  'Payment Pending': 'Payment Pending',
  Submitted: 'Submitted',
  Review: 'Under Review',
  'On Hold': 'On Hold',
  'Correction Requested': 'Correction Requested',
  Selected: 'Approved',
  Rejected: 'Rejected'
};

// Remarks shown to the applicant when the admin does not write any
const DEFAULT_REMARKS = {
  'Payment Pending': 'Pay the application fee to complete your submission.',
  Submitted: 'Application submitted. Waiting for document scrutiny.',
  Review: 'Your documents are being reviewed by the admission office.',
  'On Hold': 'Your application is on hold. The admission office will contact you.',
  'Correction Requested': 'Some documents need to be uploaded again. See the details below.',
  Selected: 'Your application has been approved.',
  Rejected: 'Your application has not been approved.'
};

const statusLabel = (status) => STATUS_LABELS[status] || status;

module.exports = { STATUSES, ADMIN_TRANSITIONS, SYSTEM_TRANSITIONS, REMARKS_REQUIRED, VERIFIABLE_STATUSES, STATUS_LABELS, DEFAULT_REMARKS, statusLabel };
