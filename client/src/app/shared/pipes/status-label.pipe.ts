import { Pipe, PipeTransform } from '@angular/core';

// What people read. Stored values (Selected, Verified, ...) stay unchanged on the server.
// Mirrors STATUS_LABELS in server/config/status.rules.js.
export const STATUS_LABELS: Record<string, string> = {
  'Payment Pending': 'Payment Pending',
  Submitted: 'Submitted',
  Review: 'Under Review',
  'On Hold': 'On Hold',
  'Correction Requested': 'Correction Requested',
  Selected: 'Approved',
  Rejected: 'Rejected'
};

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  Pending: 'Pending review',
  Verified: 'Approved',
  Rejected: 'Rejected'
};

const ACTION_LABELS: Record<string, string> = {
  APPLICATION_CREATED: 'Application created',
  APPLICATION_DELETED: 'Application deleted',
  PAYMENT_SUCCESS: 'Payment received',
  PAYMENT_FAILED: 'Payment failed',
  PAYMENT_SIGNATURE_INVALID: 'Payment could not be verified',
  DUPLICATE_PAYMENT: 'Duplicate payment',
  STATUS_CHANGED: 'Status changed',
  DOCUMENT_VERIFIED: 'Document approved',
  DOCUMENT_REJECTED: 'Document rejected',
  DOCUMENT_REPLACED: 'Document replaced',
  DOCUMENT_REUPLOADED: 'Missing document uploaded again',
  NOTIFICATION_FAILED: 'Email failed',
  REPORT_EXPORTED: 'Report exported'
};

/**
 * {{ app.status | statusLabel }}            -> "Approved"
 * {{ doc.verification.status | statusLabel:'doc' }} -> "Approved"
 * {{ entry.action | statusLabel:'action' }} -> "Document approved"
 */
@Pipe({ name: 'statusLabel', standalone: true })
export class StatusLabelPipe implements PipeTransform {
  transform(value: string | null | undefined, kind: 'app' | 'doc' | 'action' = 'app'): string {
    if (!value) return '';
    if (kind === 'doc') return DOCUMENT_STATUS_LABELS[value] || value;
    if (kind === 'action') {
      return ACTION_LABELS[value] || value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
    }
    return STATUS_LABELS[value] || value;
  }
}
