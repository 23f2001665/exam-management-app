import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Sends '/' to the signed-in user's dashboard, or to login if anonymous. */
export const homeRedirectGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const role = authService.role();
  if (!role) {
    return router.createUrlTree(['/login']);
  }

  return router.createUrlTree([`/${role}/dashboard`]);
};
