import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Rubric } from '../../../core/models';

export interface RubricFormDialogData {
  rubric?: Rubric;
}

export interface RubricFormResult {
  criterion_name: string;
  max_marks: number;
  weightage?: number;
  description?: string;
}

@Component({
  selector: 'app-rubric-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './rubric-form-dialog.component.html',
  styleUrl: './rubric-form-dialog.component.scss',
})
export class RubricFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<RubricFormDialogComponent>);
  readonly data: RubricFormDialogData = inject(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data?.rubric;

  readonly form = this.fb.nonNullable.group({
    criterion_name: [this.data?.rubric?.criterion_name ?? '', [Validators.required, Validators.maxLength(150)]],
    max_marks: [this.data?.rubric?.max_marks ?? 10, [Validators.required, Validators.min(1)]],
    weightage: [this.data?.rubric?.weightage ?? 1, [Validators.min(0)]],
    description: [this.data?.rubric?.description ?? ''],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const result: RubricFormResult = {
      criterion_name: value.criterion_name.trim(),
      max_marks: value.max_marks,
      weightage: value.weightage,
      description: value.description?.trim() || undefined,
    };
    this.dialogRef.close(result);
  }
}
