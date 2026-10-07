import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';
import { RouterModule } from '@angular/router';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { applicationOutcome } from '../../../core/utils/outcome.util';
import { STATUS_LABELS } from '../../../shared/pipes/status-label.pipe';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicationService } from '../../../core/services/application.service';
import { Application } from '../../../models/application.model';

type StepState = 'completed' | 'active' | 'pending';

interface Step {
  title: string;
  icon: string;
  state: StepState;
  note: string;
}

@Component({
  selector: 'app-applicant-dashboard',
  standalone: true,
  imports: [CommonModule, StatusLabelPipe, SkeletonComponent, RouterModule],
  templateUrl: './applicant-dashboard.component.html',
  styleUrls: ['./applicant-dashboard.component.css']
})
export class ApplicantDashboardComponent implements OnInit {
  // Signals: state set in HTTP callbacks must notify OnPush/zoneless change detection (Angular 22)
  readonly application = signal<Application | null>(null);
  readonly loading = signal(true);
  readonly steps = signal<Step[]>([]);
  readonly outcome = computed(() => applicationOutcome(this.application()));

  constructor(
    public authService: AuthService,
    private applicationService: ApplicationService
  ) {}

  ngOnInit(): void {
    this.applicationService.getMyApplication().subscribe({
      next: (res) => {
        this.application.set(res.application);
        this.steps.set(this.buildSteps());
        this.loading.set(false);
      },
      error: () => {
        this.steps.set(this.buildSteps());
        this.loading.set(false);
      }
    });
  }

  get statusClass(): string {
    const app = this.application();
    return app ? 'status-' + app.status.toLowerCase().replace(' ', '-') : 'status-review';
  }

  get verifiedCount(): number {
    return (this.application()?.documents || []).filter((d) => d.verification.status === 'Verified').length;
  }

  /** The one thing the applicant should do next */
  get nextAction(): { label: string; link: string } {
    const status = this.application()?.status;
    if (!status) return { label: 'Fill Application Form', link: '/applicant/apply' };
    if (status === 'Payment Pending') return { label: 'Pay Application Fee', link: '/applicant/payment' };
    if (status === 'Correction Requested' || this.outcome()?.issues.length) return { label: 'Upload Documents Again', link: '/applicant/status' };
    return { label: 'Track Application', link: '/applicant/status' };
  }

  private buildSteps(): Step[] {
    const s = this.application()?.status;
    const paid = !!s && s !== 'Payment Pending';
    const decided = s === 'Selected' || s === 'Rejected';
    const inScrutiny = s === 'Review' || s === 'On Hold' || s === 'Correction Requested';
    const needsUpload = !!this.outcome()?.issues.length;
    return [
      { title: 'Registration', icon: 'fa-solid fa-check', state: 'completed', note: 'Account created' },
      { title: 'Form & Documents', icon: 'fa-solid fa-file-arrow-up', state: s ? 'completed' : 'active', note: s ? 'Submitted' : 'Pending' },
      { title: 'Application Fee', icon: 'fa-solid fa-indian-rupee-sign', state: paid ? 'completed' : s ? 'active' : 'pending', note: paid ? 'Paid' : 'Pending' },
      {
        title: 'Scrutiny',
        icon: 'fa-solid fa-magnifying-glass',
        state: decided ? 'completed' : inScrutiny || s === 'Submitted' ? 'active' : 'pending',
        note: s === 'Correction Requested' || (needsUpload && !decided) ? 'Upload needed' : s === 'On Hold' ? 'On hold' : decided ? 'Done' : s === 'Review' ? 'In progress' : 'Queued'
      },
      { title: 'Decision', icon: 'fa-solid fa-award', state: decided ? 'completed' : 'pending', note: decided ? STATUS_LABELS[s!] : 'Pending' }
    ];
  }
}
