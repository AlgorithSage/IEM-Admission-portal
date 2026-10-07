import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.token;
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((err) => {
      // The server no longer accepts the session (expired or revoked): send the user to log in again.
      // Login/register 401s are wrong-password errors and are shown on the form instead.
      if (err instanceof HttpErrorResponse && err.status === 401 && token && !req.url.includes('/auth/')) {
        authService.expireSession();
      }
      return throwError(() => err);
    })
  );
};
