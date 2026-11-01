import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent, StatusChipComponent } from '../../../../shared/components';
import { NotifyService } from '../../../../shared/services';
import { ExaminationService } from '../../../../core/services/examination.service';
import { Examination, EXAMINATION_TYPE_LABELS } from '../../../../core/models';

@Component({
  selector: 'app-examination-list',
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  template: `
    <app-page-header
      title="My Examinations"
      subtitle="Examinations assigned to you for slot management and evaluation"
    />

    @if (loading()) {
      <div class="loading">
        <mat-spinner diameter="36" />
      </div>
    } @else if (examinations().length === 0) {
      <app-empty-state
        icon="assignment"
        title="No examinations assigned yet"
        description="Once an admin assigns an examination to you, it will show up here."
      />
    } @else {
      <mat-card>
        <div class="table-scroll">
          <table mat-table [dataSource]="examinations()" class="examination-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Examination</th>
              <td mat-cell *matCellDef="let exam">{{ exam.name }}</td>
            </ng-container>

            <ng-container matColumnDef="course">
              <th mat-header-cell *matHeaderCellDef>Course</th>
              <td mat-cell *matCellDef="let exam">{{ courseName(exam.course_id) }}</td>
            </ng-container>

            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let exam">{{ typeLabel(exam.type) }}</td>
            </ng-container>

            <ng-container matColumnDef="duration">
              <th mat-header-cell *matHeaderCellDef>Duration</th>
              <td mat-cell *matCellDef="let exam">{{ exam.duration }} min</td>
            </ng-container>

            <ng-container matColumnDef="max_marks">
              <th mat-header-cell *matHeaderCellDef>Max Marks</th>
              <td mat-cell *matCellDef="let exam">{{ exam.max_marks }}</td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let exam"><app-status-chip [status]="exam.status" /></td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let exam">
                <button mat-button color="primary" (click)="viewExamination(exam.id)">
                  View <mat-icon iconPositionEnd>chevron_right</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr
              mat-row
              *matRowDef="let row; columns: columns"
              class="examination-row"
              (click)="viewExamination(row.id)"
            ></tr>
          </table>
        </div>
      </mat-card>
    }
  `,
  styles: [
    `
      .loading {
        display: flex;
        justify-content: center;
        padding: 3rem 0;
      }

      .table-scroll {
        overflow-x: auto;
      }

      .examination-table {
        width: 100%;
        min-width: 700px;
      }

      .examination-row {
        cursor: pointer;
      }

      .examination-row:hover {
        background: var(--mat-sys-surface-container-high, rgba(0, 0, 0, 0.04));
      }
    `,
  ],
})
export class ExaminationListComponent {
  private readonly examinationService = inject(ExaminationService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  readonly columns = ['name', 'course', 'type', 'duration', 'max_marks', 'status', 'actions'];

  readonly loading = signal(true);
  readonly examinations = signal<Examination[]>([]);

  constructor() {
    this.load();
  }

  courseName(courseId: number): string {
    // Examiners don't have access to the course catalog endpoint, so we
    // surface the course identifier instead of a resolved name.
    return `Course #${courseId}`;
  }

  typeLabel(type: Examination['type']): string {
    return EXAMINATION_TYPE_LABELS[type] ?? type;
  }

  viewExamination(id: number): void {
    this.router.navigate(['/examiner/examinations', id]);
  }

  private load(): void {
    this.loading.set(true);
    this.examinationService.getAll().subscribe({
      next: (examinations) => {
        this.examinations.set(examinations);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.errorFrom(err, 'Failed to load your examinations.');
        this.loading.set(false);
      },
    });
  }
}
