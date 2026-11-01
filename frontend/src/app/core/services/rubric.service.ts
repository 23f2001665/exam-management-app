import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateRubricRequest, Rubric, UpdateRubricRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class RubricService {
  private readonly baseUrl = `${environment.apiUrl}/rubrics`;

  constructor(private readonly http: HttpClient) {}

  getForExamination(examinationId: number): Observable<Rubric[]> {
    return this.http
      .get<{ rubrics: Rubric[] }>(`${this.baseUrl}/examination/${examinationId}`)
      .pipe(map((res) => res.rubrics));
  }

  getById(rubricId: number): Observable<Rubric> {
    return this.http
      .get<{ rubric_info: Rubric }>(`${this.baseUrl}/${rubricId}`)
      .pipe(map((res) => res.rubric_info));
  }

  create(payload: CreateRubricRequest): Observable<Rubric> {
    return this.http
      .post<{ rubric_info: Rubric }>(`${this.baseUrl}/create`, payload)
      .pipe(map((res) => res.rubric_info));
  }

  update(rubricId: number, payload: UpdateRubricRequest): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${rubricId}`, payload);
  }

  delete(rubricId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${rubricId}`);
  }
}
