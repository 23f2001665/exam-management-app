import { HttpInterceptorFn } from '@angular/common/http';

/**
 * The backend authenticates via a Flask session cookie, so every request
 * (including preflighted cross-origin ones) must carry credentials.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ withCredentials: true }));
};
