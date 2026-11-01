import { Routes } from '@angular/router';

export const STUDENT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.StudentDashboardComponent),
  },
  {
    path: 'examinations',
    loadComponent: () =>
      import('./examinations/examination-list/examination-list.component').then(
        (m) => m.ExaminationListComponent,
      ),
  },
  {
    path: 'examinations/:id',
    loadComponent: () =>
      import('./examinations/examination-detail/examination-detail.component').then(
        (m) => m.ExaminationDetailComponent,
      ),
  },
  {
    path: 'bookings',
    loadComponent: () => import('./bookings/bookings.component').then((m) => m.BookingsComponent),
  },
  {
    path: 'results',
    loadComponent: () => import('./results/results.component').then((m) => m.ResultsComponent),
  },
];
