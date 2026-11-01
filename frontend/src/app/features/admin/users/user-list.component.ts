import { AfterViewInit, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { UserService } from '../../../core/services/user.service';
import { CreateExaminerRequest, User } from '../../../core/models';
import { EmptyStateComponent, PageHeaderComponent, StatusChipComponent } from '../../../shared/components';
import { ConfirmService, NotifyService } from '../../../shared/services';
import { CreateExaminerDialogComponent } from './create-examiner-dialog.component';

@Component({
  selector: 'app-user-list',
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    StatusChipComponent,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit, AfterViewInit {
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotifyService);

  readonly loading = signal(true);
  readonly displayedColumns = ['email', 'name', 'role', 'department', 'status', 'actions'];
  readonly dataSource = new MatTableDataSource<User>([]);

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
    this.userService
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (users) => (this.dataSource.data = users),
        error: (err) => this.notify.errorFrom(err, 'Failed to load users.'),
      });
  }

  fullName(user: User): string {
    return `${user.first_name} ${user.last_name ?? ''}`.trim();
  }

  openCreateExaminerDialog(): void {
    const ref = this.dialog.open(CreateExaminerDialogComponent, {});
    ref.afterClosed().subscribe((result?: CreateExaminerRequest) => {
      if (!result) return;
      this.userService.createExaminer(result).subscribe({
        next: () => {
          this.notify.success('Examiner created successfully.');
          this.load();
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to create examiner.'),
      });
    });
  }

  toggleActive(user: User): void {
    if (user.is_active) {
      this.confirm
        .ask({
          title: 'Deactivate User',
          message: `Are you sure you want to deactivate ${this.fullName(user)}?`,
          confirmLabel: 'Deactivate',
          destructive: true,
        })
        .subscribe((confirmed) => {
          if (!confirmed) return;
          this.userService.deactivate(user.id).subscribe({
            next: () => {
              this.notify.success('User deactivated.');
              this.load();
            },
            error: (err) => this.notify.errorFrom(err, 'Failed to deactivate user.'),
          });
        });
    } else {
      this.userService.activate(user.id).subscribe({
        next: () => {
          this.notify.success('User activated.');
          this.load();
        },
        error: (err) => this.notify.errorFrom(err, 'Failed to activate user.'),
      });
    }
  }
}
