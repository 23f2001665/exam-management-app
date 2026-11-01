import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.AdminDashboardComponent),
  },
  {
    path: 'courses',
    loadComponent: () =>
      import('./courses/course-list.component').then((m) => m.CourseListComponent),
  },
  {
    path: 'examinations',
    loadComponent: () =>
      import('./examinations/examination-list.component').then((m) => m.ExaminationListComponent),
  },
  {
    path: 'examinations/:id',
    loadComponent: () =>
      import('./examinations/examination-detail.component').then(
        (m) => m.ExaminationDetailComponent,
      ),
  },
  {
    path: 'users',
    loadComponent: () => import('./users/user-list.component').then((m) => m.UserListComponent),
  },
];
