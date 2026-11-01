import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, RegisterRequest, UpdateUserRequest, User } from '../models';

interface AuthResponse {
  message: string;
  user_info: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = environment.apiUrl;

  private readonly currentUserSignal = signal<User | null>(null);
  /** Becomes true once the initial /user_info hydration check has resolved. */
  private readonly readySignal = signal(false);

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly ready = this.readySignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly role = computed(() => this.currentUserSignal()?.role ?? null);

  constructor(private readonly http: HttpClient) {}

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, credentials)
      .pipe(tap((res) => this.currentUserSignal.set(res.user_info)));
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, payload);
  }

  logout(): Observable<unknown> {
    return this.http
      .post(`${this.baseUrl}/logout`, {})
      .pipe(tap(() => this.currentUserSignal.set(null)));
  }

  updateProfile(payload: UpdateUserRequest): Observable<AuthResponse> {
    return this.http
      .patch<AuthResponse>(`${this.baseUrl}/user_info`, payload)
      .pipe(tap((res) => this.currentUserSignal.set(res.user_info)));
  }

  /** Restores session state from the server cookie on app bootstrap. */
  hydrate(): Observable<User | null> {
    return this.http.get<{ user_info: User }>(`${this.baseUrl}/user_info`).pipe(
      tap((res) => this.currentUserSignal.set(res.user_info)),
      map((res) => res.user_info),
      catchError(() => {
        this.currentUserSignal.set(null);
        return of(null);
      }),
      finalize(() => this.readySignal.set(true)),
    );
  }

  clearSession(): void {
    this.currentUserSignal.set(null);
  }
}
