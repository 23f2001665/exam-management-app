import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  template: `
    <div class="empty-state">
      <mat-icon>{{ icon() }}</mat-icon>
      <p class="empty-state__title">{{ title() }}</p>
      @if (description()) {
        <p class="empty-state__description">{{ description() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: [
    `
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 3rem 1.5rem;
        color: var(--mat-sys-on-surface-variant, #5f6368);
        gap: 0.25rem;
      }

      .empty-state mat-icon {
        width: 40px;
        height: 40px;
        font-size: 40px;
        margin-bottom: 0.5rem;
        opacity: 0.6;
      }

      .empty-state__title {
        font-weight: 500;
        margin: 0;
        color: var(--mat-sys-on-surface, #1a1a1a);
      }

      .empty-state__description {
        margin: 0;
        font-size: 0.875rem;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input('Nothing here yet');
  readonly description = input<string>();
}
