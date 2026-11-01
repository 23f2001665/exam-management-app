import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Booking, CreateBookingRequest, RescheduleBookingRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly baseUrl = `${environment.apiUrl}/bookings`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Booking[]> {
    return this.http
      .get<{ bookings: Booking[] }>(`${this.baseUrl}/all`)
      .pipe(map((res) => res.bookings));
  }

  getForExamination(examinationId: number): Observable<Booking[]> {
    return this.http
      .get<{ bookings: Booking[] }>(`${this.baseUrl}/examination/${examinationId}`)
      .pipe(map((res) => res.bookings));
  }

  getById(bookingId: number): Observable<Booking> {
    return this.http
      .get<{ booking_info: Booking }>(`${this.baseUrl}/${bookingId}`)
      .pipe(map((res) => res.booking_info));
  }

  create(payload: CreateBookingRequest): Observable<Booking> {
    return this.http
      .post<{ booking_info: Booking }>(`${this.baseUrl}/create`, payload)
      .pipe(map((res) => res.booking_info));
  }

  cancel(bookingId: number): Observable<Booking> {
    return this.http
      .patch<{ booking_info: Booking }>(`${this.baseUrl}/${bookingId}`, { status: 'cancelled' })
      .pipe(map((res) => res.booking_info));
  }

  reschedule(bookingId: number, payload: RescheduleBookingRequest): Observable<Booking> {
    return this.http
      .post<{ booking_info: Booking }>(`${this.baseUrl}/${bookingId}/reschedule`, payload)
      .pipe(map((res) => res.booking_info));
  }
}
