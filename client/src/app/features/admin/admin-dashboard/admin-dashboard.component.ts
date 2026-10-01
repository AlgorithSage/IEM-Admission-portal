import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApplicationService } from '../../../core/services/application.service';
import { AuthService } from '../../../core/services/auth.service';
import { Application, AdminStats, ApplicationStatus, DepartmentType } from '../../../models/application.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  applications: Application[] = [];
  stats: AdminStats | null = null;
  loading = true;
  updatingId: string | null = null;

  // Filter states
  searchQuery = '';
  selectedStatus = 'All';
  selectedDepartment = 'All';

  // State Transition Modal State
  selectedAppForTransition: Application | null = null;
  targetStatus: ApplicationStatus | null = null;
  transitionRemarks = '';
  transitionError = '';
  transitionSuccess = '';

  statusOptions: string[] = ['All', 'Submitted', 'Review', 'Selected', 'Rejected'];
  departmentOptions: string[] = ['All', 'B.Tech', 'M.Tech', 'MBA', 'MCA', 'BBA'];

  constructor(
    private applicationService: ApplicationService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.loadStats();
    this.loadApplications();
  }

  loadStats(): void {
    this.applicationService.getAdminStats().subscribe({
      next: (res) => {
        this.stats = res.stats;
      }
    });
  }

  loadApplications(): void {
    this.applicationService.getApplications({
      status: this.selectedStatus,
      department: this.selectedDepartment,
      search: this.searchQuery
    }).subscribe({
      next: (res) => {
        this.applications = res.applications;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onFilterChange(): void {
    this.loadApplications();
  }

  // POC 3: Status State Machine Transition Handler
  openTransitionModal(app: Application, nextStatus: ApplicationStatus): void {
    this.selectedAppForTransition = app;
    this.targetStatus = nextStatus;
    this.transitionRemarks = nextStatus === 'Selected' ? 'Cleared academic and document scrutiny' : (nextStatus === 'Rejected' ? 'Criteria not satisfied' : 'Under scrutiny');
    this.transitionError = '';
    this.transitionSuccess = '';
  }

  closeModal(): void {
    this.selectedAppForTransition = null;
    this.targetStatus = null;
    this.transitionRemarks = '';
    this.transitionError = '';
    this.transitionSuccess = '';
  }

  confirmTransition(): void {
    if (!this.selectedAppForTransition || !this.targetStatus) return;

    const appId = this.selectedAppForTransition._id;
    this.updatingId = appId;
    this.transitionError = '';

    this.applicationService.updateStatus(appId, this.targetStatus, this.transitionRemarks).subscribe({
      next: (res) => {
        this.updatingId = null;
        this.transitionSuccess = `Status successfully transitioned to ${this.targetStatus}!`;
        setTimeout(() => {
          this.closeModal();
          this.loadData();
        }, 1000);
      },
      error: (err) => {
        this.updatingId = null;
        this.transitionError = err.error?.message || `Server rejected transition: Illegal state change.`;
      }
    });
  }

  getStatusCount(statusName: ApplicationStatus): number {
    return this.stats?.byStatus.find(s => s._id === statusName)?.count || 0;
  }

  getDepartmentCount(deptName: DepartmentType): number {
    return this.stats?.byDepartment.find(d => d._id === deptName)?.count || 0;
  }
}
