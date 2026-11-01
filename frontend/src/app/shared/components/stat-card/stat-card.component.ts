import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

export type StatCardTone = 'primary' | 'tertiary' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-stat-card',
  imports: [MatIconModule, RouterLink],
  template: `
    <a
      class="stat-card"
      [class]="'stat-card--' + tone()"
      [class.stat-card--link]="!!link()"
      [routerLink]="link() ?? null"
      [attr.tabindex]="link() ? 0 : -1"
    >
      <div class="stat-card__icon">
        <mat-icon>{{ icon() }}</mat-icon>
      </div>
      <div class="stat-card__text">
        <span class="stat-card__value">{{ value() }}</span>
        <span class="stat-card__label">{{ label() }}</span>
      </div>
    </a>
  `,
  styles: [
    `
      .stat-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1.25rem;
        border-radius: 14px;
        background: var(--mat-sys-surface-container, light-dark(#fff, #1e2024));
        border: 1px solid light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08));
        text-decoration: none;
        color: inherit;
        transition:
          transform 0.15s ease,
          box-shadow 0.15s ease;
      }

      .stat-card--link {
        cursor: pointer;
      }

      .stat-card--link:hover,
      .stat-card--link:focus-visible {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px light-dark(rgba(23, 33, 74, 0.1), rgba(0, 0, 0, 0.45));
      }

      .stat-card__icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .stat-card__icon mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      .stat-card--primary .stat-card__icon {
        background: light-dark(#d4e3ff, #16325c);
        color: light-dark(#0b3a8a, #a8c7ff);
      }
      .stat-card--tertiary .stat-card__icon {
        background: light-dark(#ffd8e4, #5a1d33);
        color: light-dark(#8c1850, #ffb0cb);
      }
      .stat-card--success .stat-card__icon {
        background: light-dark(#e6f4ea, #103f1e);
        color: light-dark(#1e7e34, #81c995);
      }
      .stat-card--warning .stat-card__icon {
        background: light-dark(#fff4e5, #4a3100);
        color: light-dark(#b26a00, #ffcc80);
      }
      .stat-card--danger .stat-card__icon {
        background: light-dark(#fdecea, #4a1512);
        color: light-dark(#c62828, #ef9a9a);
      }

      .stat-card__text {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .stat-card__value {
        font-size: 1.75rem;
        font-weight: 700;
        line-height: 1.1;
      }

      .stat-card__label {
        font-size: 0.8rem;
        color: var(--mat-sys-on-surface-variant, #5f6368);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class StatCardComponent {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly value = input.required<number | string>();
  readonly tone = input<StatCardTone>('primary');
  readonly link = input<string | undefined>();
}
