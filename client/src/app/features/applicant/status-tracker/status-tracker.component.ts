import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';
import { RouterModule } from '@angular/router';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { applicationOutcome } from '../../../core/utils/outcome.util';
import { ApplicationService } from '../../../core/services/application.service';
import { AuthService } from '../../../core/services/auth.service';
import { Application, ApplicationDocument } from '../../../models/application.model';
import { COMPETITIVE_EXAMS } from '../../../models/admission-rules';
import { BvaValidatorService } from '../../../core/services/bva-validator.service';
import { UploadService } from '../../../core/services/upload.service';
import { apiError, downloadBlob, errorMessage, openBlobInNewTab } from '../../../core/utils/file.util';

@Component({
  selector: 'app-status-tracker',
  standalone: true,
  imports: [CommonModule, StatusLabelPipe, SkeletonComponent, RouterModule],
  templateUrl: './status-tracker.component.html',
  styleUrls: ['./status-tracker.component.css']
})
export class StatusTrackerComponent implements OnInit {
  // Signals: state set in HTTP callbacks must notify OnPush/zoneless change detection (Angular 22)
  readonly application = signal<Application | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal('');
  readonly busyKey = signal('');
  readonly resubmitting = signal(false);
  readonly outcome = computed(() => applicationOutcome(this.application()));

  constructor(
    private applicationService: ApplicationService,
    public authService: AuthService,
    private bva: BvaValidatorService,
    private uploadService: UploadService
  ) {}

  ngOnInit(): void {
    this.fetchApplication();
  }

  fetchApplication(): void {
    this.loading.set(true);
    this.applicationService.getMyApplication().subscribe({
      next: (res) => {
        this.loading.set(false);
        this.application.set(res.application);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err, 'Could not load your application.'));
      }
    });
  }

  examLabel(code: string): string {
    return COMPETITIVE_EXAMS.find((e) => e.code === code)?.label || code;
  }

  scoreLabel(code: string): string {
    return COMPETITIVE_EXAMS.find((e) => e.code === code)?.score.label || 'Score';
  }

  get rejectedDocuments(): ApplicationDocument[] {
    return (this.application()?.documents || []).filter((d) => d.verification.status === 'Rejected');
  }

  get canCorrect(): boolean {
    return this.application()?.status === 'Correction Requested';
  }

  /** Rejected during a correction, or the stored file was lost (the server enforces the same rule) */
  canReplace(doc: ApplicationDocument): boolean {
    return doc.available === false || (this.canCorrect && doc.verification.status === 'Rejected');
  }

  viewDocument(doc: ApplicationDocument): void {
    const app = this.application();
    if (!app) return;
    this.error.set('');
    openBlobInNewTab(this.applicationService.getDocument(app._id, doc.key), (msg) => this.error.set(msg));
  }

  replaceDocument(doc: ApplicationDocument, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const check = this.bva.validateFile(file);
    if (!check.isValid) {
      this.error.set(check.message);
      return;
    }
    this.busyKey.set(doc.key);
    this.error.set('');
    this.message.set('');
    this.uploadService
      .upload(file, doc.key)
      .then((staged) =>
        this.applicationService.replaceDocument(doc.key, staged.uploadId).subscribe({
          next: (res) => {
            this.busyKey.set('');
            this.application.set(res.application);
            this.message.set(res.message || 'Document replaced.');
          },
          error: (err) => {
            this.busyKey.set('');
            this.uploadService.discard(staged.uploadId);
            this.error.set(apiError(err, 'Could not replace the document.'));
          }
        })
      )
      .catch((err) => {
        this.busyKey.set('');
        this.error.set(apiError(err, 'Upload failed. Please try again.'));
      });
  }

  resubmit(): void {
    this.resubmitting.set(true);
    this.error.set('');
    this.applicationService.resubmit().subscribe({
      next: (res) => {
        this.resubmitting.set(false);
        this.application.set(res.application);
        this.message.set(res.message || 'Resubmitted for review.');
      },
      error: (err) => {
        this.resubmitting.set(false);
        this.error.set(apiError(err, 'Could not resubmit.'));
      }
    });
  }

  downloadSlip(): void {
    const app = this.application();
    if (!app) return;
    this.busyKey.set('slip');
    this.applicationService.getSlip(app._id).subscribe({
      next: (blob) => {
        this.busyKey.set('');
        downloadBlob(blob, `Admission-Slip-${app.applicationId}.pdf`);
      },
      error: async (err) => {
        this.busyKey.set('');
        this.error.set(await errorMessage(err, 'Could not download the slip.'));
      }
    });
  }
}
