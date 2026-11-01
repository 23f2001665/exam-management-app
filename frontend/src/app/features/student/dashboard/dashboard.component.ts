import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { finalize, switchMap } from 'rxjs';
import {
  EmptyStateComponent,
  PageHeaderComponent,
  StatCardComponent,
  StatCardTone,
} from '../../../shared/components';
import { NotifyService } from '../../../shared/services';
import { BookingService } from '../../../core/services/booking.service';
import { ExaminationService } from '../../../core/services/examination.service';
import { SlotService } from '../../../core/services/slot.service';
import { SummaryService } from '../../../core/services/summary.service';
import { enrichBookings } from '../shared/enrich-bookings.util';

interface StatCard {
  label: string;
  value: number;
  icon: string;
  tone: StatCardTone;
}

interface UpcomingExam {
  bookingId: number;
  examinationName: string;
  date: string;
  startTime: string;
  endTime: string;
}

@Component({
  selector: 'app-student-dashboard',
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    StatCardComponent,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    RouterLink,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class StudentDashboardComponent implements OnInit {
  private readonly bookingService = inject(BookingService);
  private readonly examinationService = inject(ExaminationService);
  private readonly slotService = inject(SlotService);
  private readonly summaryService = inject(SummaryService);
  private readonly notify = inject(NotifyService);

  readonly loading = signal(true);
  readonly statCards = signal<StatCard[]>([]);
  readonly upcoming = signal<UpcomingExam[]>([]);

  ngOnInit(): void {
    this.loadSummary();
    this.loadUpcoming();
  }

  private loadSummary(): void {
    this.summaryService.getBookingsSummary().subscribe({
      next: (summary) => {
        this.statCards.set([
          { label: 'Total Bookings', value: summary.total_bookings, icon: 'event_note', tone: 'primary' },
          { label: 'Booked', value: summary.booked_bookings, icon: 'event_available', tone: 'success' },
          { label: 'Completed', value: summary.completed_bookings, icon: 'task_alt', tone: 'tertiary' },
          { label: 'Cancelled', value: summary.cancelled_bookings, icon: 'event_busy', tone: 'danger' },
        ]);
      },
      error: (err) => this.notify.errorFrom(err, 'Failed to load bookings summary.'),
    });
  }

  private loadUpcoming(): void {
    this.loading.set(true);
    this.bookingService
      .getAll()
      .pipe(
        switchMap((bookings) => {
          const booked = bookings.filter((booking) => booking.status === 'booked');
          return enrichBookings(booked, this.examinationService, this.slotService);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (enriched) => {
          const upcoming = enriched
            .map(({ booking, examination, slot }) => ({
              bookingId: booking.id,
              examinationName: examination?.name ?? `Examination #${booking.examination_id}`,
              date: slot?.date ?? '',
              startTime: slot?.start_time ?? '',
              endTime: slot?.end_time ?? '',
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 5);

          this.upcoming.set(upcoming);
        },
        // Non-fatal: the dashboard can still show stat cards without the
        // upcoming-exams list, so avoid a disruptive error toast here.
        error: () => this.upcoming.set([]),
      });
  }
}
