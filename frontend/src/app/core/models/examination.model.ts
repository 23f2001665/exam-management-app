import { ExaminationStatus, ExaminationType } from './enums';

export interface Examination {
  id: number;
  course_id: number;
  name: string;
  type: ExaminationType;
  duration: number;
  max_marks: number;
  status: ExaminationStatus;
  examiner_id: number | null;
  results_published: boolean;
  slot_creation_start?: string;
  slot_creation_end?: string;
  slot_booking_start?: string;
  slot_booking_end?: string;
}

export interface CreateExaminationRequest {
  course_id: number;
  name: string;
  type?: ExaminationType;
  duration?: number;
  max_marks?: number;
  slot_creation_start: string;
  slot_creation_end: string;
  slot_booking_start: string;
  slot_booking_end: string;
  examiner_id?: number;
}

export interface UpdateExaminationRequest {
  name?: string;
  type?: ExaminationType;
  duration?: number;
  max_marks?: number;
  slot_creation_start?: string;
  slot_creation_end?: string;
  slot_booking_start?: string;
  slot_booking_end?: string;
}
