import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import {
  EmptyStateComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../../shared/components';
import { NotifyService } from '../../../shared/services';
import { EvaluationService } from '../../../core/services/evaluation.service';
import { ExaminationService } from '../../../core/services/examination.service';
import { BookingService } from '../../../core/services/booking.service';
import { SlotService } from '../../../core/services/slot.service';
import { Booking, Evaluation, Examination, User } from '../../../core/models';
import { GradeDialogComponent } from './components/grade-dialog/grade-dialog.component';
import { displayName } from '../utils/user-display.util';

interface PendingRow {
  evaluation: Evaluation;
  examinationId: number | null;
  examinationName: string;
  maxMarks?: number;
  studentLabel: string;
}

@Component({
  selector: 'app-evaluations-list',
  imports: [
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  template: `
    <app-page-header
      title="Evaluations"
      subtitle="Pending evaluations for bookings in your assigned examinations"
    />

    @if (loading()) {
      <div class="loading">
        <mat-spinner diameter="36" />
      </div>
    } @else if (rows().length === 0) {
      <app-empty-state
        icon="rate_review"
        title="No pending evaluations"
        description="You're all caught up. New pending evaluations will show up here once students complete their slots."
      />
    } @else {
      <mat-card>
        <div class="table-scroll">
          <table mat-table [dataSource]="rows()" class="evaluation-table">
            <ng-container matColumnDef="student">
              <th mat-header-cell *matHeaderCellDef>Student</th>
              <td mat-cell *matCellDef="let row">{{ row.studentLabel }}</td>
            </ng-container>

            <ng-container matColumnDef="examination">
              <th mat-header-cell *matHeaderCellDef>Examination</th>
              <td mat-cell *matCellDef="let row">
                @if (row.examinationId) {
                  <a [routerLink]="['/examiner/examinations', row.examinationId]">{{ row.examinationName }}</a>
                } @else {
                  {{ row.examinationName }}
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <app-status-chip [status]="row.evaluation.status" />
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let row">
                <button mat-flat-button color="primary" (click)="grade(row)">Grade</button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
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

      .evaluation-table {
        width: 100%;
        min-width: 560px;
      }
    `,
  ],
})
export class EvaluationsListComponent {
  private readonly evaluationService = inject(EvaluationService);
  private readonly examinationService = inject(ExaminationService);
  private readonly bookingService = inject(BookingService);
  private readonly slotService = inject(SlotService);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotifyService);

  readonly columns = ['student', 'examination', 'status', 'actions'];

  readonly loading = signal(true);
  readonly rows = signal<PendingRow[]>([]);

  constructor() {
    this.load();
  }

  grade(row: PendingRow): void {
    this.dialog
      .open(GradeDialogComponent, {
        data: { evaluation: row.evaluation, studentLabel: row.studentLabel, maxMarks: row.maxMarks },
        width: '420px',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.notify.success('Evaluation submitted successfully.');
          this.rows.update((current) => current.filter((r) => r.evaluation.id !== row.evaluation.id));
        }
      });
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      pending: this.evaluationService.getPending(),
      examinations: this.examinationService.getAll(),
      bookings: this.bookingService.getAll(),
    }).subscribe({
      next: ({ pending, examinations, bookings }) => {
        this.enrich(pending, examinations, bookings);
      },
      error: (err) => {
        this.notify.errorFrom(err, 'Failed to load pending evaluations.');
        this.loading.set(false);
      },
    });
  }

  private enrich(pending: Evaluation[], examinations: Examination[], bookings: Booking[]): void {
    if (pending.length === 0) {
      this.rows.set([]);
      this.loading.set(false);
      return;
    }

    const examMap = new Map(examinations.map((e) => [e.id, e]));
    const bookingMap = new Map(bookings.map((b) => [b.id, b]));

    const examIdForEvaluation = (evaluation: Evaluation): number | null =>
      bookingMap.get(evaluation.booking_id)?.examination_id ?? null;

    const distinctExamIds = Array.from(
      new Set(pending.map(examIdForEvaluation).filter((id): id is number => id !== null)),
    );

    const studentRequests =
      distinctExamIds.length > 0
        ? distinctExamIds.map((id) => this.slotService.getBookedStudents(id))
        : [of<User[]>([])];

    forkJoin(studentRequests).subscribe({
      next: (studentLists) => {
        const studentMap = new Map<number, User>();
        studentLists.flat().forEach((student) => studentMap.set(student.id, student));

        const rows: PendingRow[] = pending.map((evaluation) => {
          const examinationId = examIdForEvaluation(evaluation);
          const exam = examinationId != null ? examMap.get(examinationId) : undefined;
          const student = studentMap.get(evaluation.student_id);
          return {
            evaluation,
            examinationId: examinationId,
            examinationName: exam ? exam.name : 'Unknown examination',
            maxMarks: exam?.max_marks,
            studentLabel: student ? displayName(student) || student.email : `Student #${evaluation.student_id}`,
          };
        });

        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.errorFrom(err, 'Failed to load student details for pending evaluations.');
        // Fall back to a basic listing without enrichment rather than blocking the page.
        const rows: PendingRow[] = pending.map((evaluation) => {
          const examinationId = examIdForEvaluation(evaluation);
          const exam = examinationId != null ? examMap.get(examinationId) : undefined;
          return {
            evaluation,
            examinationId,
            examinationName: exam ? exam.name : 'Unknown examination',
            maxMarks: exam?.max_marks,
            studentLabel: `Student #${evaluation.student_id}`,
          };
        });
        this.rows.set(rows);
        this.loading.set(false);
      },
    });
  }
}
