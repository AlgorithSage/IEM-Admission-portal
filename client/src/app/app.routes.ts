import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { ApplicantLoginComponent } from './features/auth/applicant-login/applicant-login.component';
import { ApplicantDashboardComponent } from './features/applicant/applicant-dashboard/applicant-dashboard.component';
import { ApplicationFormComponent } from './features/applicant/application-form/application-form.component';
import { StatusTrackerComponent } from './features/applicant/status-tracker/status-tracker.component';
import { AdminLoginComponent } from './features/auth/admin-login/admin-login.component';
import { AdminDashboardComponent } from './features/admin/admin-dashboard/admin-dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  // 1. Public Landing Page (Matches landing page.png)
  { 
    path: '', 
    component: LandingComponent 
  },

  // 2. Applicant Module
  { 
    path: 'applicant/login', 
    component: ApplicantLoginComponent 
  },
  { 
    path: 'applicant/dashboard', 
    component: ApplicantDashboardComponent, 
    canActivate: [authGuard] 
  },
  { 
    path: 'applicant/apply', 
    component: ApplicationFormComponent, 
    canActivate: [authGuard] 
  },
  { 
    path: 'applicant/status', 
    component: StatusTrackerComponent, 
    canActivate: [authGuard] 
  },

  // 3. Administrator Module (Protected by adminGuard for UX; server enforced via Express)
  { 
    path: 'admin/login', 
    component: AdminLoginComponent 
  },
  { 
    path: 'admin/dashboard', 
    component: AdminDashboardComponent, 
    canActivate: [adminGuard] 
  },

  // Fallback
  { 
    path: '**', 
    redirectTo: '' 
  }
];
