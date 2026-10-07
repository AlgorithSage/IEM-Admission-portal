import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { guestGuard } from './core/guards/guest.guard';
import { ShellNavItem } from './shared/components/app-shell/app-shell.component';

const loadShell = () => import('./shared/components/app-shell/app-shell.component').then((m) => m.AppShellComponent);

const APPLICANT_NAV: ShellNavItem[] = [
  { label: 'Dashboard', icon: 'fa-solid fa-table-cells-large', link: '/applicant/dashboard' },
  { label: 'Application Form', icon: 'fa-solid fa-pen-to-square', link: '/applicant/apply' },
  { label: 'Payment', icon: 'fa-solid fa-credit-card', link: '/applicant/payment' },
  { label: 'My Application', icon: 'fa-solid fa-file-lines', link: '/applicant/status' }
];

const ADMIN_NAV: ShellNavItem[] = [
  { label: 'Dashboard', icon: 'fa-solid fa-table-cells-large', link: '/admin/dashboard' },
  { label: 'Applications', icon: 'fa-solid fa-folder-open', link: '/admin/applications' },
  { label: 'Review Queue', icon: 'fa-solid fa-list-check', link: '/admin/review-queue', badge: 'reviewQueue' },
  { label: 'Audit Log', icon: 'fa-solid fa-clock-rotate-left', link: '/admin/audit' }
];

const loadApplicationList = () =>
  import('./features/admin/application-list/application-list.component').then((m) => m.ApplicationListComponent);

// Feature pages are lazy-loaded so the landing page ships only what it needs.
// Guards are UX only; every API call is authorised on the server.
export const routes: Routes = [
  { path: '', component: LandingComponent },

  // Applicant
  {
    path: 'applicant/login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/applicant-login/applicant-login.component').then((m) => m.ApplicantLoginComponent)
  },
  {
    path: 'applicant',
    canActivate: [authGuard],
    loadComponent: loadShell,
    data: { nav: APPLICANT_NAV, navLabel: 'Applicant navigation' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/applicant/applicant-dashboard/applicant-dashboard.component').then((m) => m.ApplicantDashboardComponent)
      },
      {
        path: 'apply',
        loadComponent: () => import('./features/applicant/application-form/application-form.component').then((m) => m.ApplicationFormComponent)
      },
      {
        path: 'payment',
        loadComponent: () => import('./features/applicant/payment/payment.component').then((m) => m.PaymentComponent)
      },
      {
        path: 'status',
        loadComponent: () => import('./features/applicant/status-tracker/status-tracker.component').then((m) => m.StatusTrackerComponent)
      }
    ]
  },

  // Administrator
  {
    path: 'admin/login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/admin-login/admin-login.component').then((m) => m.AdminLoginComponent)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: loadShell,
    data: { nav: ADMIN_NAV, navLabel: 'Admin navigation' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/admin-overview/admin-overview.component').then((m) => m.AdminOverviewComponent)
      },
      { path: 'applications', loadComponent: loadApplicationList, data: { title: 'Applications' } },
      {
        path: 'applications/:id',
        loadComponent: () => import('./features/admin/application-detail/application-detail.component').then((m) => m.ApplicationDetailComponent)
      },
      // Same list, preset to applications waiting for scrutiny
      { path: 'review-queue', loadComponent: loadApplicationList, data: { title: 'Review Queue', presetStatus: 'Submitted' } },
      {
        path: 'audit',
        loadComponent: () => import('./features/admin/audit-log/audit-log.component').then((m) => m.AuditLogComponent)
      }
    ]
  },

  { path: '**', redirectTo: '' }
];
