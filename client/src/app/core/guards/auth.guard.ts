import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Applicant pages. Signed-out users go to the applicant login; a signed-in admin goes to the admin
 * dashboard (the applicant APIs are applicant-only, so the pages would only show 403 errors).
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return authService.isApplicant() ? true : router.createUrlTree([authService.dashboardUrl()]);
  }

  return router.createUrlTree(['/applicant/login'], {
    queryParams: { returnUrl: state.url }
  });
};
