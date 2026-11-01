import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateEvaluationRequest, Evaluation } from '../models';

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  private readonly baseUrl = `${environment.apiUrl}/evaluations`;

  constructor(private readonly http: HttpClient) {}

  getPending(): Observable<Evaluation[]> {
    return this.http
      .get<{ evaluations: Evaluation[] }>(`${this.baseUrl}/pending`)
      .pipe(map((res) => res.evaluations));
  }

  getAll(): Observable<Evaluation[]> {
    return this.http
      .get<{ evaluations: Evaluation[] }>(`${this.baseUrl}/all`)
      .pipe(map((res) => res.evaluations));
  }

  getForExamination(examinationId: number): Observable<Evaluation[]> {
    return this.http
      .get<{ evaluations: Evaluation[] }>(`${this.baseUrl}/examination/${examinationId}`)
      .pipe(map((res) => res.evaluations));
  }

  create(payload: CreateEvaluationRequest): Observable<Evaluation> {
    return this.http
      .post<{ evaluation_info: Evaluation }>(`${this.baseUrl}/create`, payload)
      .pipe(map((res) => res.evaluation_info));
  }
}
