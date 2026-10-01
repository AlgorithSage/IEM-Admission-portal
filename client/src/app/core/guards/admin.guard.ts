import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() && authService.isAdmin()) {
    return true;
  }

  // Route Guard in Angular is strictly for client-side UX navigation.
  // Real security is enforced server-side by Express middleware.
  return router.createUrlTree(['/admin/login'], {
    queryParams: { returnUrl: state.url, unauthorized: true }
  });
};
