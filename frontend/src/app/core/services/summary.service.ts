import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BookingsSummary, DashboardSummary, ExaminationsSummary, UserSummary } from '../models';

export interface ExportTaskStatus {
  state: 'PENDING' | 'SUCCESS' | 'FAILURE' | string;
  status?: string;
  csv?: string;
}

@Injectable({ providedIn: 'root' })
export class SummaryService {
  private readonly baseUrl = `${environment.apiUrl}/summary`;

  constructor(private readonly http: HttpClient) {}

  getUserSummary(): Observable<UserSummary> {
    return this.http
      .get<{ user_summary: UserSummary }>(`${this.baseUrl}/users`)
      .pipe(map((res) => res.user_summary));
  }

  getExaminationsSummary(): Observable<ExaminationsSummary> {
    return this.http
      .get<{ examinations_summary: ExaminationsSummary }>(`${this.baseUrl}/examinations`)
      .pipe(map((res) => res.examinations_summary));
  }

  getBookingsSummary(): Observable<BookingsSummary> {
    return this.http
      .get<{ bookings_summary: BookingsSummary }>(`${this.baseUrl}/bookings`)
      .pipe(map((res) => res.bookings_summary));
  }

  getDashboard(): Observable<DashboardSummary> {
    return this.http
      .get<{ dashboard: DashboardSummary }>(`${this.baseUrl}/dashboard`)
      .pipe(map((res) => res.dashboard));
  }

  requestExport(): Observable<string> {
    return this.http
      .get<{ message: string; task_id: string }>(`${this.baseUrl}/export`)
      .pipe(map((res) => res.task_id));
  }

  /**
   * Polls for export completion. The backend returns either CSV text
   * (task succeeded) or a JSON task-status payload, both as HTTP 200,
   * distinguished only by Content-Type - so we fetch as text and sniff it.
   */
  checkExportStatus(taskId: string): Observable<ExportTaskStatus> {
    return this.http
      .get(`${this.baseUrl}/export/${taskId}`, { responseType: 'text' })
      .pipe(
        map((body) => {
          try {
            return JSON.parse(body) as ExportTaskStatus;
          } catch {
            return { state: 'SUCCESS', csv: body } satisfies ExportTaskStatus;
          }
        }),
      );
  }
}
