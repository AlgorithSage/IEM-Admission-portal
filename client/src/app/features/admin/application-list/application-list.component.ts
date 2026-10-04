import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NavBadgeService } from '../../../core/services/nav-badge.service';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { ApplicationService, ListFilter } from '../../../core/services/application.service';
import { AuthService } from '../../../core/services/auth.service';
import { APPLICATION_STATUSES, ApplicationListItem } from '../../../models/application.model';
import { DEPARTMENTS } from '../../../models/admission-rules';
import { apiError, downloadBlob, errorMessage } from '../../../core/utils/file.util';

@Component({
  selector: 'app-application-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './application-list.component.html',
  styleUrls: ['./application-list.component.css']
})
export class ApplicationListComponent implements OnInit, OnDestroy {
  // Signals: state set in HTTP callbacks must notify OnPush/zoneless change detection (Angular 22)
  readonly applications = signal<ApplicationListItem[]>([]);
  readonly total = signal(0);
  readonly pages = signal(1);
  readonly loading = signal(true);
  readonly exporting = signal(false);
  readonly error = signal('');

  search = '';
  status = 'All';
  department = 'All';
  page = 1;
  readonly limit = 20;

  readonly statuses = APPLICATION_STATUSES;
  readonly departments = DEPARTMENTS;

  private search$ = new Subject<void>();
  private searchSub?: Subscription;

  /** Page title and fixed status filter come from the route (Applications / Review Queue) */
  readonly title: string;
  readonly presetStatus: string | null;

  constructor(
    private applicationService: ApplicationService,
    public authService: AuthService,
    private badges: NavBadgeService,
    route: ActivatedRoute
  ) {
    const data = route.snapshot.data;
    this.title = data['title'] || 'Applications';
    this.presetStatus = data['presetStatus'] || null;
    if (this.presetStatus) this.status = this.presetStatus;
    const q = route.snapshot.queryParamMap;
    if (q.get('search')) this.search = q.get('search')!;
    if (!this.presetStatus && q.get('status')) this.status = q.get('status')!;
  }

  ngOnInit(): void {
    this.searchSub = this.search$.pipe(debounceTime(350)).subscribe(() => {
      this.page = 1;
      this.loadApplications();
    });
    this.refresh();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  private get filter(): ListFilter {
    return { search: this.search.trim(), status: this.status, department: this.department, page: this.page, limit: this.limit };
  }

  refresh(): void {
    this.applicationService.getAdminStats().subscribe({
      next: (stats) => this.badges.set('reviewQueue', stats.byStatus.find((s) => s._id === 'Submitted')?.count || 0)
    });
    this.loadApplications();
  }

  loadApplications(): void {
    this.loading.set(true);
    this.error.set('');
    this.applicationService.getApplications(this.filter).subscribe({
      next: (res) => {
        this.applications.set(res.applications);
        this.total.set(res.total);
        this.pages.set(Math.max(1, res.pages));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiError(err, 'Could not load applications.'));
      }
    });
  }

  onSearchInput(): void {
    this.search$.next();
  }

  onFilterChange(): void {
    this.page = 1;
    this.loadApplications();
  }


  goTo(page: number): void {
    if (page < 1 || page > this.pages()) return;
    this.page = page;
    this.loadApplications();
  }


  trackById(_: number, item: ApplicationListItem): string {
    return item._id;
  }

  statusClass(status: string): string {
    return 'status-' + status.toLowerCase().replace(' ', '-');
  }

  exportCsv(): void {
    this.exporting.set(true);
    const { page, limit, ...filter } = this.filter;
    this.applicationService.exportReport(filter).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        downloadBlob(blob, `applications-${new Date().toISOString().slice(0, 10)}.csv`);
      },
      error: async (err) => {
        this.exporting.set(false);
        this.error.set(await errorMessage(err, 'Could not export the report.'));
      }
    });
  }
}
