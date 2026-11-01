import { BookingStatus } from './enums';

export interface Booking {
  id: number;
  examination_id: number;
  slot_id: number;
  student_id: number;
  booking_date: string;
  status: BookingStatus;
}

export interface CreateBookingRequest {
  slot_id: number;
}

export interface RescheduleBookingRequest {
  slot_id: number;
}
