/**
 * The backend parses these with Python's `strptime` using exact formats
 * ('%Y-%m-%d %H:%M', '%Y-%m-%d', '%H:%M') - no timezone, no seconds, no
 * ISO 'T' separator. These helpers convert local Date/form values to the
 * exact strings the API expects.
 */

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Date -> 'YYYY-MM-DD HH:MM' (examination slot_creation_* / slot_booking_* fields). */
export function toBackendDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d} ${h}:${min}`;
}

/** Date -> 'YYYY-MM-DD' (examination slot date field). */
export function toBackendDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Date -> 'HH:MM' (examination slot start_time/end_time fields). */
export function toBackendTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Combines a date-only Date with a separate 'HH:MM' string into one Date. */
export function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}
