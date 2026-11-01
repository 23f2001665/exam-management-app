import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize, forkJoin } from 'rxjs';
import {
  EmptyStateComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../../../shared/components';
import { NotifyService } from '../../../../shared/services';
import { BookingService } from '../../../../core/services/booking.service';
import { CourseService } from '../../../../core/services/course.service';
import { ExaminationService } from '../../../../core/services/examination.service';
import { SlotService } from '../../../../core/services/slot.service';
import { Booking, Course, EXAMINATION_TYPE_LABELS, Examination, Slot } from '../../../../core/models';

@Component({
  selector: 'app-examination-detail',
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './examination-detail.component.html',
  styleUrl: './examination-detail.component.scss',
})
export class ExaminationDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly examinationService = inject(ExaminationService);
  private readonly courseService = inject(CourseService);
  private readonly slotService = inject(SlotService);
  private readonly bookingService = inject(BookingService);
  private readonly notify = inject(NotifyService);

  readonly examinationId = Number(this.route.snapshot.paramMap.get('id'));

  readonly loading = signal(true);
  readonly loadFailed = signal(false);

  readonly examination = signal<Examination | null>(null);
  readonly course = signal<Course | null>(null);
  readonly slots = signal<Slot[]>([]);
  readonly existingBooking = signal<Booking | null>(null);

  readonly bookingSlotId = signal<number | null>(null);

  readonly typeLabel = computed(() => {
    const exam = this.examination();
    return exam ? (EXAMINATION_TYPE_LABELS[exam.type] ?? exam.type) : '';
  });

  readonly courseLabel = computed(() => {
    const course = this.course();
    const exam = this.examination();
    if (course) return `${course.code} - ${course.name}`;
    return exam ? `Course #${exam.course_id}` : '';
  });

  readonly sortedSlots = computed(() =>
    [...this.slots()].sort((a, b) =>
      `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`),
    ),
  );

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    if (!this.examinationId || Number.isNaN(this.examinationId)) {
      this.loadFailed.set(true);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadFailed.set(false);

    forkJoin({
      examination: this.examinationService.getById(this.examinationId),
      slots: this.slotService.getForExamination(this.examinationId),
      bookings: this.bookingService.getAll(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ examination, slots, bookings }) => {
          this.examination.set(examination);
          this.slots.set(slots);
          this.existingBooking.set(
            bookings.find((booking) => booking.examination_id === this.examinationId) ?? null,
          );
          this.loadCourse(examination.course_id);
        },
        error: (err) => {
          this.loadFailed.set(true);
          this.notify.errorFrom(err, 'Failed to load this examination.');
        },
      });
  }

  private loadCourse(courseId: number): void {
    this.courseService.getById(courseId).subscribe({
      next: (course) => this.course.set(course),
      error: () => undefined,
    });
  }

  canBook(slot: Slot): boolean {
    return (
      !this.existingBooking() &&
      slot.status === 'available' &&
      slot.available_seats > 0 &&
      this.bookingSlotId() === null
    );
  }

  book(slot: Slot): void {
    if (!this.canBook(slot)) return;

    this.bookingSlotId.set(slot.id);
    this.bookingService
      .create({ slot_id: slot.id })
      .pipe(finalize(() => this.bookingSlotId.set(null)))
      .subscribe({
        next: (booking) => {
          this.notify.success('Slot booked successfully.');
          this.existingBooking.set(booking);
          this.router.navigate(['/student/bookings']);
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to book this slot.'),
      });
  }
}
