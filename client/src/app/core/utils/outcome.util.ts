import { Application } from '../../models/application.model';

export type OutcomeTone = 'success' | 'error' | 'warning' | 'info';

export interface Outcome {
  tone: OutcomeTone;
  icon: string;
  title: string;
  text: string;
  /** Problems the applicant must know about (rejected or missing documents) */
  issues: string[];
}

/**
 * What the applicant should be told about their application right now.
 * Shared by the dashboard notification and the status page so both always say the same thing.
 */
export function applicationOutcome(app: Application | null): Outcome | null {
  if (!app) return null;

  const issues: string[] = [];
  for (const d of app.documents || []) {
    if (d.available === false) {
      issues.push(`${d.label}: the file was not received. Upload it again.`);
    } else if (d.verification.status === 'Rejected') {
      issues.push(`${d.label}: ${d.verification.remarks || 'rejected'}. Upload a corrected file.`);
    }
  }
  const remarks = app.adminRemarks || '';

  switch (app.status) {
    case 'Selected':
      return { tone: 'success', icon: 'fa-circle-check', title: 'Your application has been approved', text: remarks || 'Congratulations. The admission office will contact you with the next steps.', issues };
    case 'Rejected':
      return { tone: 'error', icon: 'fa-circle-xmark', title: 'Your application has been rejected', text: remarks ? `Reason: ${remarks}` : 'Contact the admission office for details.', issues: [] };
    case 'Correction Requested':
      return { tone: 'warning', icon: 'fa-triangle-exclamation', title: 'Action needed: correct your documents', text: remarks, issues };
    case 'On Hold':
      return { tone: 'warning', icon: 'fa-pause', title: 'Your application is on hold', text: remarks, issues };
    case 'Payment Pending':
      return { tone: 'info', icon: 'fa-indian-rupee-sign', title: 'Pay the application fee to submit', text: 'Your form and documents are saved.', issues };
    case 'Review':
      return { tone: issues.length ? 'warning' : 'info', icon: 'fa-magnifying-glass', title: 'Your application is under review', text: remarks, issues };
    default:
      return { tone: issues.length ? 'warning' : 'info', icon: 'fa-clock', title: 'Application submitted', text: 'Waiting for document scrutiny.', issues };
  }
}
