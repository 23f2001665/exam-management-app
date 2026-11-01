import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateSlotRequest, Slot, UpdateSlotRequest, User } from '../models';

@Injectable({ providedIn: 'root' })
export class SlotService {
  private readonly baseUrl = `${environment.apiUrl}/slots`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<Slot[]> {
    return this.http.get<{ slots: Slot[] }>(`${this.baseUrl}/all`).pipe(map((res) => res.slots));
  }

  getForExamination(examinationId: number): Observable<Slot[]> {
    return this.http
      .get<{ slots: Slot[] }>(`${this.baseUrl}/examination/${examinationId}`)
      .pipe(map((res) => res.slots));
  }

  getBookedStudents(examinationId: number): Observable<User[]> {
    return this.http
      .get<{ students: User[] }>(`${this.baseUrl}/examination/${examinationId}/booked_students`)
      .pipe(map((res) => res.students));
  }

  create(payload: CreateSlotRequest): Observable<Slot> {
    return this.http
      .post<{ slot_info: Slot }>(`${this.baseUrl}/create`, payload)
      .pipe(map((res) => res.slot_info));
  }

  update(slotId: number, payload: UpdateSlotRequest): Observable<Slot> {
    return this.http
      .patch<{ slot_info: Slot }>(`${this.baseUrl}/${slotId}`, payload)
      .pipe(map((res) => res.slot_info));
  }

  delete(slotId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${slotId}`);
  }
}
