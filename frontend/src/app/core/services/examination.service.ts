import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateExaminationRequest,
  Examination,
  ExaminationStatus,
  UpdateExaminationRequest,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ExaminationService {
  private readonly baseUrl = `${environment.apiUrl}/examinations`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Examination[]> {
    return this.http
      .get<{ examinations: Examination[] }>(`${this.baseUrl}/all`)
      .pipe(map((res) => res.examinations));
  }

  getById(examinationId: number): Observable<Examination> {
    return this.http
      .get<{ examination_info: Examination }>(`${this.baseUrl}/${examinationId}`)
      .pipe(map((res) => res.examination_info));
  }

  create(payload: CreateExaminationRequest): Observable<Examination> {
    return this.http
      .post<{ examination_info: Examination }>(`${this.baseUrl}/create`, payload)
      .pipe(map((res) => res.examination_info));
  }

  update(examinationId: number, payload: UpdateExaminationRequest): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${examinationId}`, payload);
  }

  delete(examinationId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${examinationId}`);
  }

  updateStatus(examinationId: number, status: ExaminationStatus): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${examinationId}/status`, { status });
  }

  assignExaminer(examinationId: number, examinerId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${examinationId}/assign_examiner`, {
      examiner_id: examinerId,
    });
  }

  publishResults(examinationId: number): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${examinationId}/publish_results`, {});
  }
}
