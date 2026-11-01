import { Component, inject, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { PageHeaderComponent, StatCardComponent, StatCardTone } from '../../../shared/components';
import { NotifyService } from '../../../shared/services';
import { ExaminationService } from '../../../core/services/examination.service';
import { EvaluationService } from '../../../core/services/evaluation.service';
import { SummaryService } from '../../../core/services/summary.service';
import { BookingsSummary } from '../../../core/models';

interface StatTile {
  label: string;
  value: number;
  icon: string;
  tone: StatCardTone;
  link?: string;
}

@Component({
  selector: 'app-examiner-dashboard',
  imports: [PageHeaderComponent, StatCardComponent, MatProgressSpinnerModule],
  template: `
    <app-page-header
      title="Examiner Dashboard"
      subtitle="A quick overview of your assigned examinations and workload"
    />

    @if (loading()) {
      <div class="loading">
        <mat-spinner diameter="36" />
      </div>
    } @else {
      <div class="stat-grid">
        @for (tile of tiles(); track tile.label) {
          <app-stat-card
            [icon]="tile.icon"
            [label]="tile.label"
            [value]="tile.value"
            [tone]="tile.tone"
            [link]="tile.link"
          />
        }
      </div>
    }
  `,
  styles: [
    `
      .loading {
        display: flex;
        justify-content: center;
        padding: 3rem 0;
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }
    `,
  ],
})
export class ExaminerDashboardComponent {
  private readonly examinationService = inject(ExaminationService);
  private readonly evaluationService = inject(EvaluationService);
  private readonly summaryService = inject(SummaryService);
  private readonly notify = inject(NotifyService);

  readonly loading = signal(true);
  readonly tiles = signal<StatTile[]>([]);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      examinations: this.examinationService.getAll(),
      pending: this.evaluationService.getPending(),
      bookings: this.summaryService.getBookingsSummary(),
    }).subscribe({
      next: ({ examinations, pending, bookings }) => {
        this.tiles.set(this.buildTiles(examinations.length, pending.length, bookings));
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.errorFrom(err, 'Failed to load dashboard summary.');
        this.loading.set(false);
      },
    });
  }

  private buildTiles(
    examinationCount: number,
    pendingCount: number,
    bookings: BookingsSummary,
  ): StatTile[] {
    return [
      {
        label: 'Assigned Examinations',
        value: examinationCount,
        icon: 'assignment',
        tone: 'primary',
        link: '/examiner/examinations',
      },
      {
        label: 'Pending Evaluations',
        value: pendingCount,
        icon: 'rate_review',
        tone: 'warning',
        link: '/examiner/evaluations',
      },
      {
        label: 'Booked Students',
        value: bookings.booked_bookings,
        icon: 'event_available',
        tone: 'tertiary',
      },
      {
        label: 'Completed Bookings',
        value: bookings.completed_bookings,
        icon: 'task_alt',
        tone: 'success',
      },
    ];
  }
}
