import { Routes } from '@angular/router';

export const EXAMINER_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.ExaminerDashboardComponent),
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
    path: 'evaluations',
    loadComponent: () =>
      import('./evaluations/evaluations-list.component').then((m) => m.EvaluationsListComponent),
  },
];
