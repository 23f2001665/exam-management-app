import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Course, CreateCourseRequest, UpdateCourseRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly baseUrl = `${environment.apiUrl}/courses`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Course[]> {
    return this.http
      .get<{ courses: Course[] }>(`${this.baseUrl}/all`)
      .pipe(map((res) => res.courses));
  }

  getById(courseId: number): Observable<Course> {
    return this.http
      .get<{ course_info: Course }>(`${this.baseUrl}/${courseId}`)
      .pipe(map((res) => res.course_info));
  }

  create(payload: CreateCourseRequest): Observable<Course> {
    return this.http
      .post<{ course: Course }>(`${this.baseUrl}/create`, payload)
      .pipe(map((res) => res.course));
  }

  update(courseId: number, payload: UpdateCourseRequest): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${courseId}`, payload);
  }

  delete(courseId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${courseId}`);
  }
}
