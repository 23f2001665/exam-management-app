import { AfterViewInit, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, forkJoin } from 'rxjs';
import { ExaminationService } from '../../../core/services/examination.service';
import { CourseService } from '../../../core/services/course.service';
import { UserService } from '../../../core/services/user.service';
import { CreateExaminationRequest, Examination, EXAMINATION_TYPE_LABELS } from '../../../core/models';
import { EmptyStateComponent, PageHeaderComponent, StatusChipComponent } from '../../../shared/components';
import { ConfirmService, NotifyService } from '../../../shared/services';
import { ExaminationFormDialogComponent } from './examination-form-dialog.component';

interface ExaminationRow extends Examination {
  courseLabel: string;
  examinerLabel: string;
  typeLabel: string;
}

@Component({
  selector: 'app-examination-list',
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './examination-list.component.html',
  styleUrl: './examination-list.component.scss',
})
export class ExaminationListComponent implements OnInit, AfterViewInit {
  private readonly examinationService = inject(ExaminationService);
  private readonly courseService = inject(CourseService);
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly displayedColumns = ['name', 'course', 'type', 'examiner', 'status', 'actions'];
  readonly dataSource = new MatTableDataSource<ExaminationRow>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.load();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      examinations: this.examinationService.getAll(),
      courses: this.courseService.getAll(),
      users: this.userService.getAll(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ examinations, courses, users }) => {
          const courseMap = new Map(courses.map((c) => [c.id, c]));
          const userMap = new Map(users.map((u) => [u.id, u]));
          const rows: ExaminationRow[] = examinations.map((exam) => {
            const course = courseMap.get(exam.course_id);
            const examiner = exam.examiner_id ? userMap.get(exam.examiner_id) : undefined;
            return {
              ...exam,
              courseLabel: course ? `${course.code} — ${course.name}` : `#${exam.course_id}`,
              examinerLabel: examiner ? `${examiner.first_name} ${examiner.last_name ?? ''}`.trim() : 'Unassigned',
              typeLabel: EXAMINATION_TYPE_LABELS[exam.type],
            };
          });
          this.dataSource.data = rows;
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to load examinations.'),
      });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(ExaminationFormDialogComponent, { data: {} });
    ref.afterClosed().subscribe((result?: CreateExaminationRequest) => {
      if (!result) return;
      this.examinationService.create(result).subscribe({
        next: () => {
          this.notify.success('Examination created successfully.');
          this.load();
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to create examination.'),
      });
    });
  }

  viewDetail(exam: Examination): void {
    this.router.navigate(['/admin/examinations', exam.id]);
  }

  deleteExamination(exam: Examination): void {
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
            this.load();
          },
          error: (err) => this.notify.errorFrom(err, 'Failed to delete examination.'),
        });
      });
  }
}
