import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CreateExaminerRequest } from '../../../core/models';

@Component({
  selector: 'app-create-examiner-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './create-examiner-dialog.component.html',
  styleUrl: './create-examiner-dialog.component.scss',
})
export class CreateExaminerDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<CreateExaminerDialogComponent>);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    first_name: ['', [Validators.required, Validators.maxLength(80)]],
    last_name: [''],
    department: [''],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const result: CreateExaminerRequest = {
      email: value.email.trim(),
      password: value.password,
      first_name: value.first_name.trim(),
      last_name: value.last_name?.trim() || undefined,
      department: value.department?.trim() || undefined,
    };
    this.dialogRef.close(result);
  }
}
