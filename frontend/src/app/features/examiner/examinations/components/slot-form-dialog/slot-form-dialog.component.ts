import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CreateSlotRequest, Slot, UpdateSlotRequest } from '../../../../../core/models';
import { SlotService } from '../../../../../core/services/slot.service';
import { NotifyService } from '../../../../../shared/services';
import { toBackendDate } from '../../../../../core/utils/date-format';

export interface SlotFormDialogData {
  examinationId: number;
  slot?: Slot;
}

function parseBackendDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** The backend may return times with a trailing ':SS' (e.g. '09:00:00'); normalize to 'HH:MM'. */
function toHoursMinutes(value: string): string {
  return value.slice(0, 5);
}

function timeRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startTime')?.value;
  const end = group.get('endTime')?.value;
  if (start && end && start >= end) {
    return { timeRange: true };
  }
  return null;
}

@Component({
  selector: 'app-slot-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit Slot' : 'Add Slot' }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content class="dialog-content">
        <mat-form-field appearance="outline">
          <mat-label>Date</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="date" required />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
          @if (form.controls.date.hasError('required')) {
            <mat-error>Date is required</mat-error>
          }
        </mat-form-field>

        <div class="time-row">
          <mat-form-field appearance="outline">
            <mat-label>Start time</mat-label>
            <input matInput type="time" formControlName="startTime" required />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>End time</mat-label>
            <input matInput type="time" formControlName="endTime" required />
          </mat-form-field>
        </div>
        @if (form.hasError('timeRange')) {
          <p class="field-error">End time must be after the start time.</p>
        }

        <mat-form-field appearance="outline">
          <mat-label>Max capacity</mat-label>
          <input matInput type="number" min="1" formControlName="maxCapacity" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Meeting link (optional)</mat-label>
          <input matInput formControlName="meetingLink" placeholder="https://..." />
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()" [disabled]="submitting()">
          Cancel
        </button>
        <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting()">
          @if (submitting()) {
            <mat-spinner diameter="18" />
          } @else {
            {{ isEdit ? 'Save Changes' : 'Create Slot' }}
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [
    `
      .dialog-content {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 320px;
      }

      .time-row {
        display: flex;
        gap: 0.75rem;
      }

      .time-row mat-form-field {
        flex: 1;
      }

      mat-form-field {
        width: 100%;
      }

      .field-error {
        color: var(--mat-sys-error, #c62828);
        font-size: 0.75rem;
        margin: -0.5rem 0 0.5rem;
      }
    `,
  ],
})
export class SlotFormDialogComponent {
  readonly dialogRef = inject(MatDialogRef<SlotFormDialogComponent>);
  readonly data: SlotFormDialogData = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly slotService = inject(SlotService);
  private readonly notify = inject(NotifyService);

  readonly isEdit = !!this.data.slot;
  readonly submitting = signal(false);

  readonly form = this.fb.group(
    {
      date: this.fb.control<Date | null>(
        this.data.slot ? parseBackendDate(this.data.slot.date) : null,
        Validators.required,
      ),
      startTime: this.fb.control(
        this.data.slot ? toHoursMinutes(this.data.slot.start_time) : '',
        Validators.required,
      ),
      endTime: this.fb.control(
        this.data.slot ? toHoursMinutes(this.data.slot.end_time) : '',
        Validators.required,
      ),
      maxCapacity: this.fb.control<number | null>(this.data.slot?.max_capacity ?? 1, [
        Validators.required,
        Validators.min(1),
      ]),
      meetingLink: this.fb.control(this.data.slot?.meeting_link ?? ''),
    },
    { validators: timeRangeValidator },
  );

  submit(): void {
    if (this.form.invalid) return;
    const { date, startTime, endTime, maxCapacity, meetingLink } = this.form.getRawValue();
    if (!date || !startTime || !endTime) return;

    this.submitting.set(true);

    if (this.isEdit && this.data.slot) {
      const payload: UpdateSlotRequest = {
        date: toBackendDate(date),
        start_time: startTime,
        end_time: endTime,
        max_capacity: maxCapacity ?? undefined,
        meeting_link: meetingLink || undefined,
      };
      this.slotService.update(this.data.slot.id, payload).subscribe({
        next: (slot) => {
          this.submitting.set(false);
          this.dialogRef.close(slot);
        },
        error: (err) => {
          this.submitting.set(false);
          this.notify.errorFrom(err, 'Failed to update slot.');
        },
      });
    } else {
      const payload: CreateSlotRequest = {
        examination_id: this.data.examinationId,
        date: toBackendDate(date),
        start_time: startTime,
        end_time: endTime,
        max_capacity: maxCapacity ?? undefined,
        meeting_link: meetingLink || undefined,
      };
      this.slotService.create(payload).subscribe({
        next: (slot) => {
          this.submitting.set(false);
          this.dialogRef.close(slot);
        },
        error: (err) => {
          this.submitting.set(false);
          this.notify.errorFrom(err, 'Failed to create slot.');
        },
      });
    }
  }
}
