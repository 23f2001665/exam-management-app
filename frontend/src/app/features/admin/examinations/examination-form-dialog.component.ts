import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { CourseService } from '../../../core/services/course.service';
import { UserService } from '../../../core/services/user.service';
import { Course, CreateExaminationRequest, Examination, ExaminationType, User } from '../../../core/models';
import { combineDateAndTime, toBackendDateTime } from '../../../core/utils/date-format';

export interface ExaminationFormDialogData {
  examination?: Examination;
}

function parseBackendDateTime(value?: string): Date | null {
  if (!value) return null;
  const [datePart, timePart] = value.split(' ');
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function toTimeString(date: Date | null): string {
  if (!date) return '';
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

@Component({
  selector: 'app-examination-form-dialog',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './examination-form-dialog.component.html',
  styleUrl: './examination-form-dialog.component.scss',
})
export class ExaminationFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly courseService = inject(CourseService);
  private readonly userService = inject(UserService);
  readonly dialogRef = inject(MatDialogRef<ExaminationFormDialogComponent>);
  readonly data: ExaminationFormDialogData = inject(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data?.examination;
  readonly courses$: Observable<Course[]> = this.courseService.getAll();
  readonly examiners$: Observable<User[]> = this.userService.examiners$;
  readonly formError = signal<string | null>(null);

  private readonly exam = this.data?.examination;

  readonly form = this.fb.nonNullable.group({
    course_id: [
      { value: this.exam?.course_id ?? (null as number | null), disabled: this.isEdit },
      [Validators.required],
    ],
    name: [this.exam?.name ?? '', [Validators.required, Validators.maxLength(150)]],
    type: [(this.exam?.type ?? 'assessment') as ExaminationType, [Validators.required]],
    duration: [this.exam?.duration ?? 30, [Validators.required, Validators.min(1)]],
    max_marks: [this.exam?.max_marks ?? 100, [Validators.required, Validators.min(1)]],
    examiner_id: [this.exam?.examiner_id ?? null as number | null],
    slotCreationStartDate: [parseBackendDateTime(this.exam?.slot_creation_start), [Validators.required]],
    slotCreationStartTime: [toTimeString(parseBackendDateTime(this.exam?.slot_creation_start)) || '09:00', [Validators.required]],
    slotCreationEndDate: [parseBackendDateTime(this.exam?.slot_creation_end), [Validators.required]],
    slotCreationEndTime: [toTimeString(parseBackendDateTime(this.exam?.slot_creation_end)) || '17:00', [Validators.required]],
    slotBookingStartDate: [parseBackendDateTime(this.exam?.slot_booking_start), [Validators.required]],
    slotBookingStartTime: [toTimeString(parseBackendDateTime(this.exam?.slot_booking_start)) || '09:00', [Validators.required]],
    slotBookingEndDate: [parseBackendDateTime(this.exam?.slot_booking_end), [Validators.required]],
    slotBookingEndTime: [toTimeString(parseBackendDateTime(this.exam?.slot_booking_end)) || '17:00', [Validators.required]],
  });

  submit(): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Please fill in all required fields.');
      return;
    }
    const value = this.form.getRawValue();

    const slotCreationStart = combineDateAndTime(value.slotCreationStartDate!, value.slotCreationStartTime);
    const slotCreationEnd = combineDateAndTime(value.slotCreationEndDate!, value.slotCreationEndTime);
    const slotBookingStart = combineDateAndTime(value.slotBookingStartDate!, value.slotBookingStartTime);
    const slotBookingEnd = combineDateAndTime(value.slotBookingEndDate!, value.slotBookingEndTime);

    if (slotCreationStart >= slotCreationEnd) {
      this.formError.set('Slot creation start must be before slot creation end.');
      return;
    }
    if (slotBookingStart >= slotBookingEnd) {
      this.formError.set('Slot booking start must be before slot booking end.');
      return;
    }
    if (slotCreationEnd > slotBookingStart) {
      this.formError.set('Slot creation must end before (or when) slot booking begins.');
      return;
    }

    const result: CreateExaminationRequest = {
      course_id: value.course_id!,
      name: value.name.trim(),
      type: value.type,
      duration: value.duration,
      max_marks: value.max_marks,
      slot_creation_start: toBackendDateTime(slotCreationStart),
      slot_creation_end: toBackendDateTime(slotCreationEnd),
      slot_booking_start: toBackendDateTime(slotBookingStart),
      slot_booking_end: toBackendDateTime(slotBookingEnd),
      ...(value.examiner_id ? { examiner_id: value.examiner_id } : {}),
    };

    this.dialogRef.close(result);
  }
}
