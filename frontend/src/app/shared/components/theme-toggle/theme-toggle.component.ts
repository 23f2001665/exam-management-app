import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../../services/theme.service';

const ICONS = { light: 'light_mode', dark: 'dark_mode', system: 'brightness_auto' } as const;
const LABELS = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
} as const;

@Component({
  selector: 'app-theme-toggle',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <button
      mat-icon-button
      type="button"
      [matTooltip]="tooltip() + ' (click to change)'"
      (click)="theme.cycle()"
      aria-label="Toggle color theme"
    >
      <mat-icon>{{ icon() }}</mat-icon>
    </button>
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly icon = computed(() => ICONS[this.theme.mode()]);
  protected readonly tooltip = computed(() => LABELS[this.theme.mode()]);
}
