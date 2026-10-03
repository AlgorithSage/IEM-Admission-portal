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

module.exports = { STATUSES, ADMIN_TRANSITIONS, SYSTEM_TRANSITIONS, REMARKS_REQUIRED, VERIFIABLE_STATUSES };
