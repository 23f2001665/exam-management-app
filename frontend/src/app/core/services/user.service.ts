import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateExaminerRequest, UpdateUserRequest, User } from '../models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly baseUrl = `${environment.apiUrl}/users`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<User[]> {
    return this.http.get<{ users: User[] }>(`${this.baseUrl}/all`).pipe(map((res) => res.users));
  }

  getById(userId: number): Observable<User> {
    return this.http
      .get<{ user_info: User }>(`${this.baseUrl}/${userId}`)
      .pipe(map((res) => res.user_info));
  }

  update(userId: number, payload: UpdateUserRequest): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${userId}`, payload);
  }

  activate(userId: number): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${userId}/activate`, {});
  }

  deactivate(userId: number): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${userId}/deactivate`, {});
  }

  createExaminer(payload: CreateExaminerRequest): Observable<User> {
    return this.http
      .post<{ user: User }>(`${this.baseUrl}/create_examiner`, payload)
      .pipe(map((res) => res.user));
  }

  get examiners$(): Observable<User[]> {
    return this.getAll().pipe(map((users) => users.filter((u) => u.role === 'examiner')));
  }
}
