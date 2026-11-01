export interface UserSummary {
  total_users: number;
  active_users: number;
  inactive_users: number;
  active_students: number;
  inactive_students: number;
  active_examiners: number;
  inactive_examiners: number;
  admins: number;
}

export interface ExaminationsSummary {
  total_examinations: number;
  draft_examinations: number;
  slot_creation_examinations: number;
  booking_open_examinations: number;
  closed_examinations: number;
  completed_examinations: number;
}

export interface BookingsSummary {
  total_bookings: number;
  booked_bookings: number;
  cancelled_bookings: number;
  completed_bookings: number;
}

export interface DashboardSummary {
  total_courses: number;
  total_examinations: number;
  total_students: number;
  total_examiners: number;
  total_slots: number;
  total_bookings: number;
}
