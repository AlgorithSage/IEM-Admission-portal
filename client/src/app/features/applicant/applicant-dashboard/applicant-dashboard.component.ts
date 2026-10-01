import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicationService } from '../../../core/services/application.service';
import { Application } from '../../../models/application.model';

@Component({
  selector: 'app-applicant-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './applicant-dashboard.component.html',
  styleUrls: ['./applicant-dashboard.component.css']
})
export class ApplicantDashboardComponent implements OnInit {
  application: Application | null = null;
  loading = true;

  constructor(
    public authService: AuthService,
    private applicationService: ApplicationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadApplication();
  }

  loadApplication(): void {
    this.loading = true;
    this.applicationService.getMyApplication().subscribe({
      next: (res) => {
        this.loading = false;
        this.application = res.application;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getStepState(stepIndex: number): 'completed' | 'active' | 'pending' {
    if (!this.application) {
      return stepIndex === 1 ? 'active' : 'pending';
    }

    const status = this.application.status;
    if (stepIndex === 1) return 'completed'; // Registered

    if (stepIndex === 2) { // Form Submitted
      return 'completed';
    }

    if (stepIndex === 3) { // Review
      if (status === 'Review') return 'active';
      if (status === 'Selected' || status === 'Rejected') return 'completed';
      return 'pending';
    }

    if (stepIndex === 4) { // Final Decision
      if (status === 'Selected' || status === 'Rejected') return 'completed';
      return 'pending';
    }

    return 'pending';
  }
}
