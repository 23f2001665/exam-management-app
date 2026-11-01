import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  EmptyStateComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../../../shared/components';
import { ConfirmService, NotifyService } from '../../../../shared/services';
import { ExaminationService } from '../../../../core/services/examination.service';
import { RubricService } from '../../../../core/services/rubric.service';
import { SlotService } from '../../../../core/services/slot.service';
import { EvaluationService } from '../../../../core/services/evaluation.service';
import {
  Evaluation,
  Examination,
  EXAMINATION_TYPE_LABELS,
  Rubric,
  Slot,
  User,
} from '../../../../core/models';
import { SlotFormDialogComponent } from '../components/slot-form-dialog/slot-form-dialog.component';
import { displayName } from '../../utils/user-display.util';

@Component({
  selector: 'app-examination-detail',
  imports: [
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  template: `
    @if (loading()) {
      <div class="loading">
        <mat-spinner diameter="36" />
      </div>
    } @else if (examination(); as exam) {
      <app-page-header [title]="exam.name" [subtitle]="subtitle(exam)">
        <button mat-button routerLink="/examiner/examinations">
          <mat-icon>arrow_back</mat-icon>
          Back to list
        </button>
      </app-page-header>

      <mat-card class="info-card">
        <div class="info-grid">
          <div>
            <span class="info-label">Status</span>
            <app-status-chip [status]="exam.status" />
          </div>
          <div>
            <span class="info-label">Type</span>
            <span>{{ typeLabel(exam.type) }}</span>
          </div>
          <div>
            <span class="info-label">Duration</span>
            <span>{{ exam.duration }} min</span>
          </div>
          <div>
            <span class="info-label">Max Marks</span>
            <span>{{ exam.max_marks }}</span>
          </div>
          <div>
            <span class="info-label">Course</span>
            <span>Course #{{ exam.course_id }}</span>
          </div>
        </div>
      </mat-card>

      <mat-tab-group class="detail-tabs">
        <mat-tab label="Rubrics">
          <div class="tab-content">
            @if (rubrics().length === 0) {
              <app-empty-state
                icon="checklist"
                title="No rubrics defined"
                description="The admin hasn't added grading rubrics for this examination yet."
              />
            } @else {
              <div class="table-scroll">
                <table mat-table [dataSource]="rubrics()" class="data-table">
                  <ng-container matColumnDef="criterion_name">
                    <th mat-header-cell *matHeaderCellDef>Criterion</th>
                    <td mat-cell *matCellDef="let r">{{ r.criterion_name }}</td>
                  </ng-container>
                  <ng-container matColumnDef="max_marks">
                    <th mat-header-cell *matHeaderCellDef>Max Marks</th>
                    <td mat-cell *matCellDef="let r">{{ r.max_marks }}</td>
                  </ng-container>
                  <ng-container matColumnDef="weightage">
                    <th mat-header-cell *matHeaderCellDef>Weightage</th>
                    <td mat-cell *matCellDef="let r">{{ r.weightage }}%</td>
                  </ng-container>
                  <ng-container matColumnDef="description">
                    <th mat-header-cell *matHeaderCellDef>Description</th>
                    <td mat-cell *matCellDef="let r">{{ r.description || '—' }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="rubricColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: rubricColumns"></tr>
                </table>
              </div>
            }
          </div>
        </mat-tab>

        <mat-tab label="Slots">
          <div class="tab-content">
            <div class="tab-toolbar">
              <span class="tab-toolbar__spacer"></span>
              @if (canManageSlots()) {
                <button mat-flat-button color="primary" (click)="openAddSlot()">
                  <mat-icon>add</mat-icon>
                  Add Slot
                </button>
              } @else {
                <span class="muted-note">Slots can only be managed while the examination is in Slot Creation status.</span>
              }
            </div>

            @if (slots().length === 0) {
              <app-empty-state
                icon="event"
                title="No slots created yet"
                description="Add a slot so students can book this examination."
              />
            } @else {
              <div class="table-scroll">
                <table mat-table [dataSource]="slots()" class="data-table">
                  <ng-container matColumnDef="date">
                    <th mat-header-cell *matHeaderCellDef>Date</th>
                    <td mat-cell *matCellDef="let s">{{ s.date }}</td>
                  </ng-container>
                  <ng-container matColumnDef="time">
                    <th mat-header-cell *matHeaderCellDef>Time</th>
                    <td mat-cell *matCellDef="let s">{{ formatTime(s.start_time) }} – {{ formatTime(s.end_time) }}</td>
                  </ng-container>
                  <ng-container matColumnDef="capacity">
                    <th mat-header-cell *matHeaderCellDef>Seats</th>
                    <td mat-cell *matCellDef="let s">{{ s.available_seats }} / {{ s.max_capacity }}</td>
                  </ng-container>
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let s"><app-status-chip [status]="s.status" /></td>
                  </ng-container>
                  <ng-container matColumnDef="meeting_link">
                    <th mat-header-cell *matHeaderCellDef>Meeting Link</th>
                    <td mat-cell *matCellDef="let s">
                      @if (s.meeting_link) {
                        <a [href]="s.meeting_link" target="_blank" rel="noopener">Join link</a>
                      } @else {
                        —
                      }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let s">
                      @if (canManageSlots()) {
                        <button mat-icon-button matTooltip="Edit slot" (click)="openEditSlot(s)">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button matTooltip="Delete slot" (click)="deleteSlot(s)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      }
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="slotColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: slotColumns"></tr>
                </table>
              </div>
            }
          </div>
        </mat-tab>

        <mat-tab label="Booked Students">
          <div class="tab-content">
            @if (bookedStudents().length === 0) {
              <app-empty-state
                icon="groups"
                title="No students booked yet"
                description="Students who book a slot for this examination will appear here."
              />
            } @else {
              <div class="table-scroll">
                <table mat-table [dataSource]="bookedStudents()" class="data-table">
                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Name</th>
                    <td mat-cell *matCellDef="let s">{{ nameOf(s) }}</td>
                  </ng-container>
                  <ng-container matColumnDef="email">
                    <th mat-header-cell *matHeaderCellDef>Email</th>
                    <td mat-cell *matCellDef="let s">{{ s.email }}</td>
                  </ng-container>
                  <ng-container matColumnDef="department">
                    <th mat-header-cell *matHeaderCellDef>Department</th>
                    <td mat-cell *matCellDef="let s">{{ s.department || '—' }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="studentColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: studentColumns"></tr>
                </table>
              </div>
            }
          </div>
        </mat-tab>

        <mat-tab label="Evaluations">
          <div class="tab-content">
            @if (evaluations().length === 0) {
              <app-empty-state
                icon="rate_review"
                title="No evaluations yet"
                description="Evaluations you submit for this examination's bookings will appear here."
              />
            } @else {
              <div class="table-scroll">
                <table mat-table [dataSource]="evaluations()" class="data-table">
                  <ng-container matColumnDef="student">
                    <th mat-header-cell *matHeaderCellDef>Student</th>
                    <td mat-cell *matCellDef="let e">{{ studentLabel(e.student_id) }}</td>
                  </ng-container>
                  <ng-container matColumnDef="total_marks">
                    <th mat-header-cell *matHeaderCellDef>Marks</th>
                    <td mat-cell *matCellDef="let e">{{ e.total_marks ?? '—' }} / {{ exam.max_marks }}</td>
                  </ng-container>
                  <ng-container matColumnDef="remarks">
                    <th mat-header-cell *matHeaderCellDef>Remarks</th>
                    <td mat-cell *matCellDef="let e">{{ e.remarks || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let e"><app-status-chip [status]="e.status" /></td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="evaluationColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: evaluationColumns"></tr>
                </table>
              </div>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    } @else {
      <app-empty-state
        icon="error_outline"
        title="Examination not found"
        description="It may have been removed, or you may not have access to it."
      />
    }
  `,
  styles: [
    `
      .loading {
        display: flex;
        justify-content: center;
        padding: 3rem 0;
      }

      .info-card {
        margin-bottom: 1.5rem;
        padding: 1rem 1.25rem;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 1rem;
      }

      .info-grid > div {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .info-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--mat-sys-on-surface-variant, #5f6368);
      }

      .detail-tabs {
        display: block;
      }

      .tab-content {
        padding: 1.25rem 0.25rem;
      }

      .tab-toolbar {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .tab-toolbar__spacer {
        flex: 1;
      }

      .muted-note {
        font-size: 0.8rem;
        color: var(--mat-sys-on-surface-variant, #5f6368);
      }

      .table-scroll {
        overflow-x: auto;
      }

      .data-table {
        width: 100%;
        min-width: 600px;
      }
    `,
  ],
})
export class ExaminationDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly examinationService = inject(ExaminationService);
  private readonly rubricService = inject(RubricService);
  private readonly slotService = inject(SlotService);
  private readonly evaluationService = inject(EvaluationService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotifyService);

  private readonly examinationId = Number(this.route.snapshot.paramMap.get('id'));

  readonly rubricColumns = ['criterion_name', 'max_marks', 'weightage', 'description'];
  readonly slotColumns = ['date', 'time', 'capacity', 'status', 'meeting_link', 'actions'];
  readonly studentColumns = ['name', 'email', 'department'];
  readonly evaluationColumns = ['student', 'total_marks', 'remarks', 'status'];

  readonly loading = signal(true);
  readonly examination = signal<Examination | null>(null);
  readonly rubrics = signal<Rubric[]>([]);
  readonly slots = signal<Slot[]>([]);
  readonly bookedStudents = signal<User[]>([]);
  readonly evaluations = signal<Evaluation[]>([]);

  readonly canManageSlots = computed(() => this.examination()?.status === 'slot_creation');

  private readonly studentMap = computed(
    () => new Map(this.bookedStudents().map((s) => [s.id, s])),
  );

  constructor() {
    if (!this.examinationId || Number.isNaN(this.examinationId)) {
      this.loading.set(false);
      return;
    }
    this.load();
  }

  subtitle(exam: Examination): string {
    return `Course #${exam.course_id} · ${this.typeLabel(exam.type)}`;
  }

  typeLabel(type: Examination['type']): string {
    return EXAMINATION_TYPE_LABELS[type] ?? type;
  }

  /** The backend may return times with a trailing ':SS' (e.g. '09:00:00'); display as 'HH:MM'. */
  formatTime(value: string): string {
    return value.slice(0, 5);
  }

  nameOf(user: User): string {
    return displayName(user) || user.email;
  }

  studentLabel(studentId: number): string {
    const student = this.studentMap().get(studentId);
    return student ? this.nameOf(student) : `Student #${studentId}`;
  }

  openAddSlot(): void {
    this.dialog
      .open(SlotFormDialogComponent, { data: { examinationId: this.examinationId }, width: '420px' })
      .afterClosed()
      .subscribe((slot) => {
        if (slot) {
          this.notify.success('Slot created successfully.');
          this.reloadSlots();
        }
      });
  }

  openEditSlot(slot: Slot): void {
    this.dialog
      .open(SlotFormDialogComponent, {
        data: { examinationId: this.examinationId, slot },
        width: '420px',
      })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.notify.success('Slot updated successfully.');
          this.reloadSlots();
        }
      });
  }

  deleteSlot(slot: Slot): void {
    this.confirm
      .ask({
        title: 'Delete slot',
        message: `Delete the slot on ${slot.date} (${slot.start_time}–${slot.end_time})? This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.slotService.delete(slot.id).subscribe({
          next: () => {
            this.notify.success('Slot deleted.');
            this.reloadSlots();
          },
          error: (err) => this.notify.errorFrom(err, 'Failed to delete slot.'),
        });
      });
  }

  private reloadSlots(): void {
    this.slotService.getForExamination(this.examinationId).subscribe({
      next: (slots) => this.slots.set(slots),
      error: (err) => this.notify.errorFrom(err, 'Failed to refresh slots.'),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.examinationService.getById(this.examinationId).subscribe({
      next: (exam) => {
        this.examination.set(exam);
        forkJoin({
          rubrics: this.rubricService.getForExamination(this.examinationId),
          slots: this.slotService.getForExamination(this.examinationId),
          bookedStudents: this.slotService.getBookedStudents(this.examinationId),
          evaluations: this.evaluationService.getForExamination(this.examinationId),
        }).subscribe({
          next: ({ rubrics, slots, bookedStudents, evaluations }) => {
            this.rubrics.set(rubrics);
            this.slots.set(slots);
            this.bookedStudents.set(bookedStudents);
            this.evaluations.set(evaluations);
            this.loading.set(false);
          },
          error: (err) => {
            this.notify.errorFrom(err, 'Failed to load examination details.');
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        this.notify.errorFrom(err, 'Failed to load examination.');
        this.examination.set(null);
        this.loading.set(false);
      },
    });
  }
}
