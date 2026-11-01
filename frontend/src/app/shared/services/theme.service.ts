import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'emp-theme-mode';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly modeSignal = signal<ThemeMode>(this.readStoredMode());

  readonly mode = this.modeSignal.asReadonly();

  constructor() {
    effect(() => {
      const mode = this.modeSignal();
      // Angular Material's M3 tokens resolve via the CSS light-dark()
      // function keyed off the computed `color-scheme`, so setting it here
      // on the root element re-themes every Material component instantly.
      document.documentElement.style.colorScheme = mode === 'system' ? 'light dark' : mode;
      localStorage.setItem(STORAGE_KEY, mode);
    });
  }

  setMode(mode: ThemeMode): void {
    this.modeSignal.set(mode);
  }

  /** Cycles light -> dark -> system -> light ... */
  cycle(): void {
    const next: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' };
    this.modeSignal.set(next[this.modeSignal()]);
  }

  private readStoredMode(): ThemeMode {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  }
}
