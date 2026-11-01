import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { finalize, switchMap } from 'rxjs';
import {
  EmptyStateComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../../shared/components';
import { ConfirmService, NotifyService } from '../../../shared/services';
import { BookingService } from '../../../core/services/booking.service';
import { ExaminationService } from '../../../core/services/examination.service';
import { SlotService } from '../../../core/services/slot.service';
import { Booking } from '../../../core/models';
import { enrichBookings } from '../shared/enrich-bookings.util';

interface BookingRow {
  booking: Booking;
  examinationName: string;
  slotDate: string;
  slotTime: string;
}

@Component({
  selector: 'app-bookings',
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
  ],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss',
})
export class BookingsComponent implements OnInit {
  private readonly bookingService = inject(BookingService);
  private readonly examinationService = inject(ExaminationService);
  private readonly slotService = inject(SlotService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotifyService);

  readonly loading = signal(true);
  readonly rows = signal<BookingRow[]>([]);
  readonly cancellingId = signal<number | null>(null);

  readonly isEmpty = computed(() => !this.loading() && this.rows().length === 0);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.bookingService
      .getAll()
      .pipe(
        switchMap((bookings) =>
          enrichBookings(bookings, this.examinationService, this.slotService),
        ),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (enriched) => {
          const rows = enriched
            .map(({ booking, examination, slot }) => ({
              booking,
              examinationName: examination?.name ?? `Examination #${booking.examination_id}`,
              slotDate: slot?.date ?? '',
              slotTime: slot ? `${slot.start_time} - ${slot.end_time}` : '',
            }))
            .sort((a, b) => b.booking.booking_date.localeCompare(a.booking.booking_date));

          this.rows.set(rows);
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to load your bookings.'),
      });
  }

  cancel(row: BookingRow): void {
    this.confirm
      .ask({
        title: 'Cancel Booking',
        message: `Cancel your booking for "${row.examinationName}"? This cannot be undone and you will not be able to book this examination again.`,
        confirmLabel: 'Cancel Booking',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.cancellingId.set(row.booking.id);
        this.bookingService
          .cancel(row.booking.id)
          .pipe(finalize(() => this.cancellingId.set(null)))
          .subscribe({
            next: (updated) => {
              this.notify.success('Booking cancelled.');
              this.rows.update((rows) =>
                rows.map((r) => (r.booking.id === updated.id ? { ...r, booking: updated } : r)),
              );
            },
            error: (err) => this.notify.errorFrom(err, 'Failed to cancel this booking.'),
          });
      });
  }
}
