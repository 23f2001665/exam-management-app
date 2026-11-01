import { Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { finalize } from 'rxjs';
import { PageHeaderComponent, StatCardComponent, StatCardTone } from '../../../shared/components';
import { SummaryService } from '../../../core/services/summary.service';
import { DashboardSummary, ExaminationsSummary, UserSummary } from '../../../core/models';
import { NotifyService } from '../../../shared/services';

interface StatCard {
  label: string;
  value: number;
  icon: string;
  link: string;
  tone: StatCardTone;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [PageHeaderComponent, StatCardComponent, MatCardModule, MatProgressBarModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private readonly summaryService = inject(SummaryService);
  private readonly notify = inject(NotifyService);

  readonly loading = signal(true);
  readonly dashboard = signal<DashboardSummary | null>(null);
  readonly userSummary = signal<UserSummary | null>(null);
  readonly examinationsSummary = signal<ExaminationsSummary | null>(null);

  readonly statCards = signal<StatCard[]>([]);

  ngOnInit(): void {
    this.loadDashboard();
    this.loadBreakdowns();
  }

  private loadDashboard(): void {
    this.loading.set(true);
    this.summaryService
      .getDashboard()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (dashboard) => {
          this.dashboard.set(dashboard);
          this.statCards.set([
            { label: 'Courses', value: dashboard.total_courses, icon: 'menu_book', link: '/admin/courses', tone: 'primary' },
            {
              label: 'Examinations',
              value: dashboard.total_examinations,
              icon: 'fact_check',
              link: '/admin/examinations',
              tone: 'tertiary',
            },
            { label: 'Students', value: dashboard.total_students, icon: 'school', link: '/admin/users', tone: 'success' },
            { label: 'Examiners', value: dashboard.total_examiners, icon: 'badge', link: '/admin/users', tone: 'warning' },
            { label: 'Slots', value: dashboard.total_slots, icon: 'event', link: '/admin/examinations', tone: 'primary' },
            { label: 'Bookings', value: dashboard.total_bookings, icon: 'event_available', link: '/admin/examinations', tone: 'tertiary' },
          ]);
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to load dashboard summary.'),
      });
  }

  private loadBreakdowns(): void {
    this.summaryService.getUserSummary().subscribe({
      next: (summary) => this.userSummary.set(summary),
      error: () => undefined,
    });
    this.summaryService.getExaminationsSummary().subscribe({
      next: (summary) => this.examinationsSummary.set(summary),
      error: () => undefined,
    });
  }
}
