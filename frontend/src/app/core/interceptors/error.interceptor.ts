import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Requests where a 401 is an expected outcome, not a failure to surface. */
const SILENT_401_PATHS = ['/login', '/register', '/user_info'];

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const isSilent = SILENT_401_PATHS.some((path) => req.url.endsWith(path));

        if (error.status === 401 && !isSilent) {
          authService.clearSession();
          router.navigate(['/login']);
          snackBar.open('Your session has expired. Please log in again.', 'Dismiss', {
            duration: 5000,
          });
        } else if (error.status === 0) {
          snackBar.open('Could not reach the server. Is the backend running?', 'Dismiss', {
            duration: 5000,
          });
        } else if (error.status >= 500) {
          snackBar.open('Something went wrong on the server. Please try again.', 'Dismiss', {
            duration: 5000,
          });
        }
      }
      return throwError(() => error);
    }),
  );
};
