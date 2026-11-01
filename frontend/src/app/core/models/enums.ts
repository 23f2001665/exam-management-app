export type UserRole = 'admin' | 'examiner' | 'student';

export type CourseStatus = 'active' | 'inactive';

export type ExaminationStatus =
  | 'draft'
  | 'slot_creation'
  | 'booking_open'
  | 'closed'
  | 'completed';

export type ExaminationType = 'viva' | 'practical' | 'project_demo' | 'assessment';

export type SlotStatus = 'available' | 'full' | 'cancelled' | 'completed';

export type BookingStatus = 'booked' | 'cancelled' | 'completed';

export type EvaluationStatus = 'pending' | 'submitted';

export const EXAMINATION_STATUS_LABELS: Record<ExaminationStatus, string> = {
  draft: 'Draft',
  slot_creation: 'Slot Creation',
  booking_open: 'Booking Open',
  closed: 'Closed',
  completed: 'Completed',
};

export const EXAMINATION_TYPE_LABELS: Record<ExaminationType, string> = {
  viva: 'Viva',
  practical: 'Practical',
  project_demo: 'Project Demo',
  assessment: 'Assessment',
};

export const SLOT_STATUS_LABELS: Record<SlotStatus, string> = {
  available: 'Available',
  full: 'Full',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  booked: 'Booked',
  cancelled: 'Cancelled',
  completed: 'Completed',
};
