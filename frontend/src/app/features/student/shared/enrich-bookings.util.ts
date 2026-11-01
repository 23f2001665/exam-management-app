import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Booking, Examination, Slot } from '../../../core/models';
import { ExaminationService } from '../../../core/services/examination.service';
import { SlotService } from '../../../core/services/slot.service';

export interface EnrichedBooking {
  booking: Booking;
  examination: Examination | null;
  slot: Slot | null;
}

/**
 * Cross-references bookings with their examination and slot details.
 *
 * Students have no `GET /slots/all` access and `GET /examinations/all` only
 * ever returns examinations currently open for booking, so there is no
 * single enriched endpoint - each distinct examination referenced by a
 * booking is fetched individually (by id, and its own slot list) instead.
 */
export function enrichBookings(
  bookings: Booking[],
  examinationService: ExaminationService,
  slotService: SlotService,
): Observable<EnrichedBooking[]> {
  const examIds = [...new Set(bookings.map((booking) => booking.examination_id))];

  if (examIds.length === 0) {
    return of([]);
  }

  const perExamination$ = examIds.map((examId) =>
    forkJoin({
      examination: examinationService.getById(examId).pipe(catchError(() => of(null))),
      slots: slotService.getForExamination(examId).pipe(catchError(() => of([] as Slot[]))),
    }).pipe(map((result) => ({ examId, ...result }))),
  );

  return forkJoin(perExamination$).pipe(
    map((results) => {
      const examinationMap = new Map(results.map((result) => [result.examId, result.examination]));
      const slotMap = new Map<number, Slot>();
      for (const result of results) {
        for (const slot of result.slots) {
          slotMap.set(slot.id, slot);
        }
      }

      return bookings.map((booking) => ({
        booking,
        examination: examinationMap.get(booking.examination_id) ?? null,
        slot: slotMap.get(booking.slot_id) ?? null,
      }));
    }),
  );
}
