import { Component, computed, input } from '@angular/core';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_MAP: Record<string, Tone> = {
  // examination / generic lifecycle
  draft: 'neutral',
  slot_creation: 'info',
  booking_open: 'success',
  closed: 'warning',
  completed: 'neutral',
  // slot
  available: 'success',
  full: 'warning',
  cancelled: 'danger',
  // booking
  booked: 'success',
  // evaluation
  pending: 'warning',
  submitted: 'success',
  // user
  active: 'success',
  inactive: 'danger',
};

@Component({
  selector: 'app-status-chip',
  template: `<span class="status-chip" [class]="'status-chip--' + tone()">{{ label() }}</span>`,
  styles: [
    `
      .status-chip {
        display: inline-flex;
        align-items: center;
        padding: 0.15rem 0.6rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: capitalize;
        white-space: nowrap;
      }

      .status-chip--neutral {
        background: light-dark(#eceff1, #2e3338);
        color: light-dark(#37474f, #cfd8dc);
      }
      .status-chip--info {
        background: light-dark(#e3f2fd, #0d3a66);
        color: light-dark(#1565c0, #90caf9);
      }
      .status-chip--success {
        background: light-dark(#e6f4ea, #103f1e);
        color: light-dark(#1e7e34, #81c995);
      }
      .status-chip--warning {
        background: light-dark(#fff4e5, #4a3100);
        color: light-dark(#b26a00, #ffcc80);
      }
      .status-chip--danger {
        background: light-dark(#fdecea, #4a1512);
        color: light-dark(#c62828, #ef9a9a);
      }
    `,
  ],
})
export class StatusChipComponent {
  readonly status = input.required<string>();
  readonly label = computed(() => this.status().replace(/_/g, ' '));
  readonly tone = computed<Tone>(() => TONE_MAP[this.status()] ?? 'neutral');
}
