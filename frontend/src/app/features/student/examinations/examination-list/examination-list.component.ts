import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
import { EXAMINATION_TYPE_LABELS, Examination } from '../../../../core/models';

interface ExaminationCard {
  examination: Examination;
  courseLabel: string;
  typeLabel: string;
  alreadyBooked: boolean;
}

@Component({
  selector: 'app-examination-list',
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    RouterLink,
  ],
  templateUrl: './examination-list.component.html',
  styleUrl: './examination-list.component.scss',
})
export class ExaminationListComponent implements OnInit {
  private readonly examinationService = inject(ExaminationService);
  private readonly courseService = inject(CourseService);
  private readonly bookingService = inject(BookingService);
  private readonly notify = inject(NotifyService);

  readonly loading = signal(true);
  readonly cards = signal<ExaminationCard[]>([]);
  readonly hasError = signal(false);

  readonly isEmpty = computed(() => !this.loading() && !this.hasError() && this.cards().length === 0);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.hasError.set(false);

    forkJoin({
      examinations: this.examinationService.getAll(),
      courses: this.courseService.getAll(),
      bookings: this.bookingService.getAll(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ examinations, courses, bookings }) => {
          const courseMap = new Map(courses.map((course) => [course.id, course]));
          // A student can only ever have one booking per examination - even a
          // cancelled one blocks re-booking server-side - so any existing
          // booking row for the exam means "Book" should not be offered.
          const bookedExamIds = new Set(bookings.map((booking) => booking.examination_id));

          const cards = examinations.map((examination) => {
            const course = courseMap.get(examination.course_id);
            return {
              examination,
              courseLabel: course ? `${course.code} - ${course.name}` : `Course #${examination.course_id}`,
              typeLabel: EXAMINATION_TYPE_LABELS[examination.type] ?? examination.type,
              alreadyBooked: bookedExamIds.has(examination.id),
            };
          });

          this.cards.set(cards);
        },
        error: (err) => {
          this.hasError.set(true);
          this.notify.errorFrom(err, 'Failed to load examinations.');
        },
      });
  }
}
