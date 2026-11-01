import { EvaluationStatus } from './enums';

export interface Evaluation {
  id: number;
  booking_id: number;
  student_id: number;
  examiner_id: number;
  total_marks: number | null;
  remarks: string | null;
  evaluation_date: string | null;
  status: EvaluationStatus;
}

export interface CreateEvaluationRequest {
  booking_id: number;
  total_marks: number;
  remarks?: string;
}
