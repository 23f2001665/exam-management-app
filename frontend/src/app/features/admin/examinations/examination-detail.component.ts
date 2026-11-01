import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, forkJoin, of, switchMap } from 'rxjs';
import { ExaminationService } from '../../../core/services/examination.service';
import { CourseService } from '../../../core/services/course.service';
import { UserService } from '../../../core/services/user.service';
import { RubricService } from '../../../core/services/rubric.service';
import { SlotService } from '../../../core/services/slot.service';
import { BookingService } from '../../../core/services/booking.service';
import {
  Booking,
  Course,
  CreateExaminationRequest,
  EXAMINATION_STATUS_LABELS,
  EXAMINATION_TYPE_LABELS,
  Examination,
  ExaminationStatus,
  Rubric,
  Slot,
  User,
} from '../../../core/models';
import { EmptyStateComponent, PageHeaderComponent, StatusChipComponent } from '../../../shared/components';
import { ConfirmService, NotifyService } from '../../../shared/services';
import { ExaminationFormDialogComponent } from './examination-form-dialog.component';
import { RubricFormDialogComponent, RubricFormResult } from './rubric-form-dialog.component';

const STATUS_SEQUENCE: ExaminationStatus[] = [
  'draft',
  'slot_creation',
  'booking_open',
  'closed',
  'completed',
];

@Component({
  selector: 'app-examination-detail',
  imports: [
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  templateUrl: './examination-detail.component.html',
  styleUrl: './examination-detail.component.scss',
})
export class ExaminationDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly examinationService = inject(ExaminationService);
  private readonly courseService = inject(CourseService);
  private readonly userService = inject(UserService);
  private readonly rubricService = inject(RubricService);
  private readonly slotService = inject(SlotService);
  private readonly bookingService = inject(BookingService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotifyService);

  readonly statusLabels = EXAMINATION_STATUS_LABELS;
  readonly typeLabels = EXAMINATION_TYPE_LABELS;

  readonly loading = signal(true);
  readonly examination = signal<Examination | null>(null);
  readonly course = signal<Course | null>(null);
  readonly examiners = signal<User[]>([]);
  readonly users = signal<User[]>([]);
  readonly rubrics = signal<Rubric[]>([]);
  readonly slots = signal<Slot[]>([]);
  readonly bookings = signal<Booking[]>([]);

  readonly selectedExaminerId = signal<number | null>(null);
  readonly assigning = signal(false);
  readonly advancing = signal(false);
  readonly publishing = signal(false);

  readonly slotColumns = ['date', 'time', 'capacity', 'available', 'status', 'meeting'];
  readonly bookingColumns = ['student', 'slot', 'date', 'status'];
  readonly rubricColumns = ['criterion_name', 'max_marks', 'weightage', 'description', 'actions'];

  readonly nextStatus = computed<ExaminationStatus | null>(() => {
    const exam = this.examination();
    if (!exam) return null;
    const idx = STATUS_SEQUENCE.indexOf(exam.status);
    if (idx === -1 || idx === STATUS_SEQUENCE.length - 1) return null;
    return STATUS_SEQUENCE[idx + 1];
  });

  readonly canPublishResults = computed(() => {
    const exam = this.examination();
    return !!exam && exam.status === 'completed' && !exam.results_published;
  });

  private examinationId!: number;

  ngOnInit(): void {
    this.examinationId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.examinationService
      .getById(this.examinationId)
      .pipe(
        switchMap((exam) =>
          forkJoin({
            exam: of(exam),
            course: this.courseService.getById(exam.course_id),
            examiners: this.userService.examiners$,
            users: this.userService.getAll(),
            rubrics: this.rubricService.getForExamination(this.examinationId),
            slots: this.slotService.getForExamination(this.examinationId),
            bookings: this.bookingService.getForExamination(this.examinationId),
          }),
        ),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ exam, course, examiners, users, rubrics, slots, bookings }) => {
          this.examination.set(exam);
          this.course.set(course);
          this.examiners.set(examiners);
          this.users.set(users);
          this.rubrics.set(rubrics);
          this.slots.set(slots);
          this.bookings.set(bookings);
          this.selectedExaminerId.set(exam.examiner_id);
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to load examination.'),
      });
  }

  studentLabel(studentId: number): string {
    const user = this.users().find((u) => u.id === studentId);
    return user ? `${user.first_name} ${user.last_name ?? ''}`.trim() : `#${studentId}`;
  }

  editExamination(): void {
    const exam = this.examination();
    if (!exam) return;
    const ref = this.dialog.open(ExaminationFormDialogComponent, { data: { examination: exam } });
    ref.afterClosed().subscribe((result?: CreateExaminationRequest) => {
      if (!result) return;
      const { course_id, ...updatePayload } = result;
      this.examinationService.update(exam.id, updatePayload).subscribe({
        next: () => {
          this.notify.success('Examination updated successfully.');
          this.load();
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to update examination.'),
      });
    });
  }

  deleteExamination(): void {
    const exam = this.examination();
    if (!exam) return;
    this.confirm
      .ask({
        title: 'Delete Examination',
        message: `Are you sure you want to delete "${exam.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.examinationService.delete(exam.id).subscribe({
          next: () => {
            this.notify.success('Examination deleted.');
            this.router.navigate(['/admin/examinations']);
          },
          error: (err) => this.notify.errorFrom(err, 'Failed to delete examination.'),
        });
      });
  }

  advanceStatus(): void {
    const exam = this.examination();
    const next = this.nextStatus();
    if (!exam || !next) return;
    this.confirm
      .ask({
        title: 'Advance Examination Status',
        message: `Move "${exam.name}" from ${this.statusLabels[exam.status]} to ${this.statusLabels[next]}? This cannot be reversed.`,
        confirmLabel: 'Advance',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.advancing.set(true);
        this.examinationService
          .updateStatus(exam.id, next)
          .pipe(finalize(() => this.advancing.set(false)))
          .subscribe({
            next: () => {
              this.notify.success(`Status updated to ${this.statusLabels[next]}.`);
              this.load();
            },
            error: (err) => this.notify.errorFrom(err, 'Failed to update status.'),
          });
      });
  }

  assignExaminer(): void {
    const exam = this.examination();
    const examinerId = this.selectedExaminerId();
    if (!exam || !examinerId) return;
    this.assigning.set(true);
    this.examinationService
      .assignExaminer(exam.id, examinerId)
      .pipe(finalize(() => this.assigning.set(false)))
      .subscribe({
        next: () => {
          this.notify.success('Examiner assigned successfully.');
          this.load();
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to assign examiner.'),
      });
  }

  publishResults(): void {
    const exam = this.examination();
    if (!exam) return;
    this.confirm
      .ask({
        title: 'Publish Results',
        message: `Publish results for "${exam.name}"? Students will be able to view their evaluations.`,
        confirmLabel: 'Publish',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.publishing.set(true);
        this.examinationService
          .publishResults(exam.id)
          .pipe(finalize(() => this.publishing.set(false)))
          .subscribe({
            next: () => {
              this.notify.success('Results published.');
              this.load();
            },
            error: (err) => this.notify.errorFrom(err, 'Failed to publish results.'),
          });
      });
  }

  openCreateRubricDialog(): void {
    const exam = this.examination();
    if (!exam) return;
    const ref = this.dialog.open(RubricFormDialogComponent, { data: {} });
    ref.afterClosed().subscribe((result?: RubricFormResult) => {
      if (!result) return;
      this.rubricService.create({ examination_id: exam.id, ...result }).subscribe({
        next: () => {
          this.notify.success('Rubric added.');
          this.load();
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to add rubric.'),
      });
    });
  }

  openEditRubricDialog(rubric: Rubric): void {
    const ref = this.dialog.open(RubricFormDialogComponent, { data: { rubric } });
    ref.afterClosed().subscribe((result?: RubricFormResult) => {
      if (!result) return;
      this.rubricService.update(rubric.id, result).subscribe({
        next: () => {
          this.notify.success('Rubric updated.');
          this.load();
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to update rubric.'),
      });
    });
  }

  deleteRubric(rubric: Rubric): void {
    this.confirm
      .ask({
        title: 'Delete Rubric',
        message: `Delete rubric "${rubric.criterion_name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.rubricService.delete(rubric.id).subscribe({
          next: () => {
            this.notify.success('Rubric deleted.');
            this.load();
          },
          error: (err) => this.notify.errorFrom(err, 'Failed to delete rubric.'),
        });
      });
  }
}
