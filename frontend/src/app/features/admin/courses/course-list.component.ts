import { AfterViewInit, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { CourseService } from '../../../core/services/course.service';
import { Course } from '../../../core/models';
import { EmptyStateComponent, PageHeaderComponent, StatusChipComponent } from '../../../shared/components';
import { ConfirmService, NotifyService } from '../../../shared/services';
import { CourseFormDialogComponent, CourseFormResult } from './course-form-dialog.component';

@Component({
  selector: 'app-course-list',
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
  templateUrl: './course-list.component.html',
  styleUrl: './course-list.component.scss',
})
export class CourseListComponent implements OnInit, AfterViewInit {
  private readonly courseService = inject(CourseService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotifyService);

  readonly loading = signal(true);
  readonly displayedColumns = ['code', 'name', 'description', 'status', 'actions'];
  readonly dataSource = new MatTableDataSource<Course>([]);

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
    this.courseService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (courses) => (this.dataSource.data = courses),
        error: (err) => this.notify.errorFrom(err, 'Failed to load courses.'),
      });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(CourseFormDialogComponent, { data: {} });
    ref.afterClosed().subscribe((result?: CourseFormResult) => {
      if (!result) return;
      this.courseService.create(result).subscribe({
        next: () => {
          this.notify.success('Course created successfully.');
          this.load();
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to create course.'),
      });
    });
  }

  openEditDialog(course: Course): void {
    const ref = this.dialog.open(CourseFormDialogComponent, { data: { course } });
    ref.afterClosed().subscribe((result?: CourseFormResult) => {
      if (!result) return;
      this.courseService.update(course.id, result).subscribe({
        next: () => {
          this.notify.success('Course updated successfully.');
          this.load();
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to update course.'),
      });
    });
  }

  deleteCourse(course: Course): void {
    this.confirm
      .ask({
        title: 'Delete Course',
        message: `Are you sure you want to delete "${course.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.courseService.delete(course.id).subscribe({
          next: () => {
            this.notify.success('Course deleted.');
            this.load();
          },
          error: (err) => this.notify.errorFrom(err, 'Failed to delete course.'),
        });
      });
  }
}
