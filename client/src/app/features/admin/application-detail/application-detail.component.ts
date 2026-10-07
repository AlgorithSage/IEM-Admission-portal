import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApplicationService } from '../../../core/services/application.service';
import { Application, ApplicationDetail, ApplicationDocument, ApplicationStatus } from '../../../models/application.model';
import { COMPETITIVE_EXAMS } from '../../../models/admission-rules';
import { apiError, downloadBlob, errorMessage, openBlobInNewTab } from '../../../core/utils/file.util';

// Mirrors server REMARKS_REQUIRED / VERIFIABLE_STATUSES (the server enforces both)
const REMARKS_REQUIRED: ApplicationStatus[] = ['Rejected', 'On Hold', 'Correction Requested'];
const VERIFIABLE: ApplicationStatus[] = ['Submitted', 'Review', 'On Hold'];

// How each decision is worded and coloured for the admin
const DECISIONS: Record<string, { label: string; tone: 'approve' | 'reject' | 'neutral'; icon: string }> = {
  Review: { label: 'Start review', tone: 'neutral', icon: 'fa-magnifying-glass' },
  Selected: { label: 'Approve application', tone: 'approve', icon: 'fa-circle-check' },
  Rejected: { label: 'Reject application', tone: 'reject', icon: 'fa-circle-xmark' },
  'On Hold': { label: 'Put on hold', tone: 'neutral', icon: 'fa-pause' },
  'Correction Requested': { label: 'Ask for corrections', tone: 'neutral', icon: 'fa-rotate-left' }
};
const REUPLOAD_REASON = 'The file was not received. Please upload it again.';

@Component({
  selector: 'app-application-detail',
  standalone: true,
  imports: [CommonModule, StatusLabelPipe, SkeletonComponent, FormsModule, RouterModule],
  templateUrl: './application-detail.component.html',
  styleUrls: ['./application-detail.component.css']
})
export class ApplicationDetailComponent implements OnInit {
  // Signals: state set in HTTP callbacks must notify OnPush/zoneless change detection (Angular 22)
  readonly detail = signal<ApplicationDetail | null>(null);
  readonly loading = signal(true);
  readonly busy = signal('');
  readonly error = signal('');
  readonly message = signal('');

  /** Reject reason being typed per document key */
  rejectReason: Record<string, string> = {};
  readonly rejectingKey = signal('');

  targetStatus: ApplicationStatus | '' = '';
  remarks = '';

  private id = '';

  /** Delete-record form */
  readonly deleteOpen = signal(false);
  deleteConfirm = '';
  deleteReason = '';

  constructor(private route: ActivatedRoute, private applicationService: ApplicationService, private router: Router) {}

  /** What the admin must type to confirm a deletion */
  get deleteKey(): string {
    return this.app?.applicationId || this.app?.fullName || '';
  }

  deleteRecord(): void {
    if (!this.app || this.deleteConfirm.trim() !== this.deleteKey || this.deleteReason.trim().length < 5) return;
    this.busy.set('delete');
    this.error.set('');
    this.applicationService.deleteApplication(this.id, this.deleteConfirm.trim(), this.deleteReason.trim()).subscribe({
      next: () => {
        this.busy.set('');
        this.router.navigate(['/admin/applications']);
      },
      error: (err) => {
        this.busy.set('');
        this.error.set(apiError(err, 'Could not delete the record.'));
      }
    });
  }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.load();
  }

  get app(): Application | null {
    return this.detail()?.application || null;
  }

  get canVerify(): boolean {
    return !!this.app && VERIFIABLE.includes(this.app.status);
  }

  get pendingOrRejectedDocs(): number {
    return (this.app?.documents || []).filter((d) => d.verification.status !== 'Verified').length;
  }

  get missingDocs(): number {
    return (this.app?.documents || []).filter((d) => d.available === false).length;
  }

  docCount(status: string): number {
    return (this.app?.documents || []).filter((d) => d.available !== false && d.verification.status === status).length;
  }

  decisionLabel(status: string): string {
    return DECISIONS[status]?.label || status;
  }

  decisionTone(status: string): string {
    return DECISIONS[status]?.tone || 'neutral';
  }

  decisionIcon(status: string): string {
    return DECISIONS[status]?.icon || 'fa-arrow-right';
  }

  choose(status: ApplicationStatus): void {
    this.targetStatus = this.targetStatus === status ? '' : status;
  }

  /** Missing file: reject it with a standard reason so the applicant is told to upload it again */
  askReupload(doc: ApplicationDocument): void {
    this.updateDocument(doc, 'Rejected', REUPLOAD_REASON);
  }

  get remarksRequired(): boolean {
    return !!this.targetStatus && REMARKS_REQUIRED.includes(this.targetStatus);
  }

  load(): void {
    this.loading.set(true);
    this.applicationService.getApplicationDetail(this.id).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err, 'Could not load the application.'));
      }
    });
  }

  examLabel(code: string): string {
    return COMPETITIVE_EXAMS.find((e) => e.code === code)?.label || code;
  }

  scoreLabel(code: string): string {
    return COMPETITIVE_EXAMS.find((e) => e.code === code)?.score.label || 'Score';
  }

  statusClass(status: string): string {
    return 'status-' + status.toLowerCase().replace(' ', '-');
  }

  viewDocument(doc: ApplicationDocument): void {
    this.error.set('');
    openBlobInNewTab(this.applicationService.getDocument(this.id, doc.key), (msg) => (this.error.set(msg)));
  }

  downloadSlip(): void {
    this.busy.set('slip');
    this.applicationService.getSlip(this.id).subscribe({
      next: (blob) => {
        this.busy.set('');
        downloadBlob(blob, `Admission-Slip-${this.app?.applicationId}.pdf`);
      },
      error: async (err) => {
        this.busy.set('');
        this.error.set(await errorMessage(err, 'Could not download the slip.'));
      }
    });
  }

  verify(doc: ApplicationDocument): void {
    this.updateDocument(doc, 'Verified', '');
  }

  startReject(doc: ApplicationDocument): void {
    this.rejectingKey.set(doc.key);
    this.rejectReason[doc.key] = this.rejectReason[doc.key] || '';
  }

  confirmReject(doc: ApplicationDocument): void {
    const reason = (this.rejectReason[doc.key] || '').trim();
    if (!reason) {
      this.error.set('Enter a reason for rejecting this document.');
      return;
    }
    this.updateDocument(doc, 'Rejected', reason);
  }

  private updateDocument(doc: ApplicationDocument, status: 'Verified' | 'Rejected', remarks: string): void {
    if (!this.app) return;
    this.busy.set(doc.key);
    this.error.set('');
    this.message.set('');
    this.applicationService.verifyDocument(this.id, doc.key, status, remarks, this.app.__v).subscribe({
      next: (res) => {
        this.busy.set('');
        this.rejectingKey.set('');
        this.message.set(res.message || '');
        this.load();
      },
      error: (err) => this.handleWriteError(err)
    });
  }

  applyStatus(): void {
    if (!this.app || !this.targetStatus) return;
    if (this.remarksRequired && !this.remarks.trim()) {
      this.error.set(`Write a message to the applicant to ${this.decisionLabel(this.targetStatus).toLowerCase()}.`);
      return;
    }
    this.busy.set('status');
    this.error.set('');
    this.message.set('');
    this.applicationService.updateStatus(this.id, this.targetStatus, this.remarks.trim(), this.app.__v).subscribe({
      next: (res) => {
        this.busy.set('');
        this.message.set(res.message || 'Status updated.');
        this.targetStatus = '';
        this.remarks = '';
        this.load();
      },
      error: (err) => this.handleWriteError(err)
    });
  }

  private handleWriteError(err: unknown): void {
    this.busy.set('');
    this.error.set(apiError(err, 'The update failed.'));
    // Someone else changed it: show the latest data so the admin decides on current facts
    if (err instanceof HttpErrorResponse && err.status === 409) this.load();
  }
}
