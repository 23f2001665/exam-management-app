import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 4000, panelClass: 'notify-success' });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 6000, panelClass: 'notify-error' });
  }

  /** Extracts the backend's {"error": "..."} / {"message": "..."} body, falling back to a default. */
  errorFrom(err: unknown, fallback = 'Something went wrong. Please try again.'): void {
    const message =
      (err as { error?: { error?: string; message?: string } })?.error?.error ??
      (err as { error?: { error?: string; message?: string } })?.error?.message ??
      fallback;
    this.error(message);
  }
}
