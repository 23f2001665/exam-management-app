import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CreateEvaluationRequest, Evaluation } from '../../../../../core/models';
import { EvaluationService } from '../../../../../core/services/evaluation.service';
import { NotifyService } from '../../../../../shared/services';

export interface GradeDialogData {
  evaluation: Evaluation;
  studentLabel: string;
  maxMarks?: number;
}

@Component({
  selector: 'app-grade-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Grade {{ data.studentLabel }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content class="dialog-content">
        <mat-form-field appearance="outline">
          <mat-label>Total marks</mat-label>
          <input matInput type="number" min="0" [max]="data.maxMarks ?? null" formControlName="totalMarks" required />
          @if (data.maxMarks != null) {
            <mat-hint>Out of {{ data.maxMarks }}</mat-hint>
          }
          @if (form.controls.totalMarks.hasError('required')) {
            <mat-error>Total marks is required</mat-error>
          }
          @if (form.controls.totalMarks.hasError('min')) {
            <mat-error>Marks cannot be negative</mat-error>
          }
          @if (form.controls.totalMarks.hasError('max')) {
            <mat-error>Marks cannot exceed {{ data.maxMarks }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Remarks (optional)</mat-label>
          <textarea matInput rows="3" formControlName="remarks"></textarea>
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
            Submit Grade
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

      mat-form-field {
        width: 100%;
      }
    `,
  ],
})
export class GradeDialogComponent {
  readonly dialogRef = inject(MatDialogRef<GradeDialogComponent>);
  readonly data: GradeDialogData = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly evaluationService = inject(EvaluationService);
  private readonly notify = inject(NotifyService);

  readonly submitting = signal(false);

  readonly form = this.fb.group({
    totalMarks: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
      ...(this.data.maxMarks != null ? [Validators.max(this.data.maxMarks)] : []),
    ]),
    remarks: this.fb.control(''),
  });

  submit(): void {
    if (this.form.invalid) return;
    const { totalMarks, remarks } = this.form.getRawValue();
    if (totalMarks == null) return;

    const payload: CreateEvaluationRequest = {
      booking_id: this.data.evaluation.booking_id,
      total_marks: totalMarks,
      remarks: remarks || undefined,
    };

    this.submitting.set(true);
    this.evaluationService.create(payload).subscribe({
      next: (evaluation) => {
        this.submitting.set(false);
        this.dialogRef.close(evaluation);
      },
      error: (err) => {
        this.submitting.set(false);
        this.notify.errorFrom(err, 'Failed to submit evaluation.');
      },
    });
  }
}
