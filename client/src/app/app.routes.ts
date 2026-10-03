import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

// Feature pages are lazy-loaded so the landing page ships only what it needs.
// Guards are UX only; every API call is authorised on the server.
export const routes: Routes = [
  { path: '', component: LandingComponent },

  // Applicant
  {
    path: 'applicant/login',
    loadComponent: () => import('./features/auth/applicant-login/applicant-login.component').then((m) => m.ApplicantLoginComponent)
  },
  {
    path: 'applicant/dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/applicant/applicant-dashboard/applicant-dashboard.component').then((m) => m.ApplicantDashboardComponent)
  },
  {
    path: 'applicant/apply',
    canActivate: [authGuard],
    loadComponent: () => import('./features/applicant/application-form/application-form.component').then((m) => m.ApplicationFormComponent)
  },
  {
    path: 'applicant/payment',
    canActivate: [authGuard],
    loadComponent: () => import('./features/applicant/payment/payment.component').then((m) => m.PaymentComponent)
  },
  {
    path: 'applicant/status',
    canActivate: [authGuard],
    loadComponent: () => import('./features/applicant/status-tracker/status-tracker.component').then((m) => m.StatusTrackerComponent)
  },

  // Administrator
  {
    path: 'admin/login',
    loadComponent: () => import('./features/auth/admin-login/admin-login.component').then((m) => m.AdminLoginComponent)
  },
  {
    path: 'admin/dashboard',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent)
  },
  {
    path: 'admin/applications/:id',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/application-detail/application-detail.component').then((m) => m.ApplicationDetailComponent)
  },

  { path: '**', redirectTo: '' }
];
