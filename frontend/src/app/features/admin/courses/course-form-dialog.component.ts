import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Course, CourseStatus } from '../../../core/models';

export interface CourseFormDialogData {
  course?: Course;
}

export interface CourseFormResult {
  code: string;
  name: string;
  description?: string;
  status?: CourseStatus;
}

@Component({
  selector: 'app-course-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './course-form-dialog.component.html',
  styleUrl: './course-form-dialog.component.scss',
})
export class CourseFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<CourseFormDialogComponent>);
  readonly data: CourseFormDialogData = inject(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data?.course;

  readonly form = this.fb.nonNullable.group({
    code: [this.data?.course?.code ?? '', [Validators.required, Validators.maxLength(20)]],
    name: [this.data?.course?.name ?? '', [Validators.required, Validators.maxLength(150)]],
    description: [this.data?.course?.description ?? ''],
    status: [(this.data?.course?.status ?? 'active') as CourseStatus, [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const result: CourseFormResult = {
      code: value.code.trim(),
      name: value.name.trim(),
      description: value.description?.trim() || undefined,
      status: value.status,
    };
    this.dialogRef.close(result);
  }
}
