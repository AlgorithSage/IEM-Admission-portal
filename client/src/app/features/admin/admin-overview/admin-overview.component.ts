import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApplicationService } from '../../../core/services/application.service';
import { AuthService } from '../../../core/services/auth.service';
import { NavBadgeService } from '../../../core/services/nav-badge.service';
import { AdminOverview, AdminStats, APPLICATION_STATUSES, ApplicationStatus } from '../../../models/application.model';
import { apiError } from '../../../core/utils/file.util';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Chart geometry in SVG units (the SVG scales to its container) */
const W = 720;
const H = 240;
const PAD = { left: 40, right: 16, top: 16, bottom: 28 };

interface Tile {
  label: string;
  value: string;
  note: string;
  link: string;
  query?: Record<string, string>;
}

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-overview.component.html',
  styleUrls: ['./admin-overview.component.css']
})
export class AdminOverviewComponent implements OnInit {
  readonly stats = signal<AdminStats | null>(null);
  readonly overview = signal<AdminOverview | null>(null);
  readonly error = signal('');
  readonly hovered = signal<number | null>(null);
  year = new Date().getFullYear();
  search = '';

  readonly months = MONTHS;
  readonly W = W;
  readonly H = H;
  readonly PAD = PAD;

  constructor(
    private applicationService: ApplicationService,
    public authService: AuthService,
    private badges: NavBadgeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.applicationService.getAdminStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.badges.set('reviewQueue', this.count(stats, 'Submitted'));
      },
      error: (err) => this.error.set(apiError(err, 'Could not load statistics.'))
    });
    this.loadOverview();
  }

  loadOverview(): void {
    this.applicationService.getAdminOverview(this.year).subscribe({
      next: (o) => this.overview.set(o),
      error: (err) => this.error.set(apiError(err, 'Could not load the overview.'))
    });
  }

  private count(stats: AdminStats, status: ApplicationStatus): number {
    return stats.byStatus.find((s) => s._id === status)?.count || 0;
  }

  /** Headline numbers; each opens the matching list */
  readonly tiles = computed<Tile[]>(() => {
    const st = this.stats();
    if (!st) return [];
    const c = (s: ApplicationStatus) => this.count(st, s);
    const inScrutiny = c('Review') + c('On Hold') + c('Correction Requested');
    return [
      { label: 'Total Applications', value: String(st.total), note: `${c('Payment Pending')} awaiting payment`, link: '/admin/applications' },
      { label: 'Review Queue', value: String(c('Submitted')), note: 'New, not yet reviewed', link: '/admin/review-queue' },
      { label: 'In Scrutiny', value: String(inScrutiny), note: `${c('Correction Requested')} need correction`, link: '/admin/applications', query: { status: 'Review' } },
      { label: 'Selected', value: String(c('Selected')), note: `${c('Rejected')} rejected`, link: '/admin/applications', query: { status: 'Selected' } },
      { label: 'Fees Collected', value: `Rs. ${st.feesCollected.toLocaleString('en-IN')}`, note: `${st.paidCount} paid applications`, link: '/admin/applications' }
    ];
  });

  /** Status breakdown as ranked bars (share of all applications) */
  readonly statusBars = computed(() => {
    const st = this.stats();
    if (!st || !st.total) return [];
    return APPLICATION_STATUSES.map((s) => {
      const n = this.count(st, s);
      return { status: s, count: n, pct: Math.round((n / st.total) * 1000) / 10 };
    }).sort((a, b) => b.count - a.count);
  });

  readonly maxBar = computed(() => Math.max(1, ...this.statusBars().map((b) => b.count)));

  // ---------- Applications over time (area chart) ----------

  /** Round tick step (1, 2 or 5 x 10^n) so the axis reads 0, 2, 4, 6, 8 rather than 0, 2, 4, 5, 7 */
  private readonly yStep = computed(() => {
    const max = Math.max(0, ...(this.overview()?.monthly || []));
    const raw = Math.max(1, max / 4);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const unit = raw / pow;
    return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * pow;
  });

  readonly yMax = computed(() => this.yStep() * 4);

  readonly yTicks = computed(() => [0, 1, 2, 3, 4].map((i) => i * this.yStep()));

  x(i: number): number {
    return PAD.left + (i * (W - PAD.left - PAD.right)) / 11;
  }

  y(v: number): number {
    return H - PAD.bottom - (v / this.yMax()) * (H - PAD.top - PAD.bottom);
  }

  readonly linePath = computed(() => {
    const m = this.overview()?.monthly || [];
    return m.map((v, i) => `${i ? 'L' : 'M'}${this.x(i).toFixed(1)},${this.y(v).toFixed(1)}`).join(' ');
  });

  readonly areaPath = computed(() => {
    const m = this.overview()?.monthly || [];
    if (!m.length) return '';
    const base = this.y(0).toFixed(1);
    return `${this.linePath()} L${this.x(m.length - 1).toFixed(1)},${base} L${this.x(0).toFixed(1)},${base} Z`;
  });

  readonly yearTotal = computed(() => (this.overview()?.monthly || []).reduce((a, b) => a + b, 0));

  /** Tooltip position as a percentage of the chart width (the SVG scales responsively) */
  tipLeft(i: number): number {
    return (this.x(i) / W) * 100;
  }

  statusClass(status: string): string {
    return 'status-' + status.toLowerCase().replace(' ', '-');
  }

  goSearch(): void {
    const q = this.search.trim();
    this.router.navigate(['/admin/applications'], { queryParams: q ? { search: q } : {} });
  }
}
