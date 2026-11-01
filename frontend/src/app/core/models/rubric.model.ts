export interface Rubric {
  id: number;
  examination_id: number;
  criterion_name: string;
  max_marks: number;
  weightage: number;
  description: string | null;
}

export interface CreateRubricRequest {
  examination_id: number;
  criterion_name: string;
  max_marks: number;
  weightage?: number;
  description?: string;
}

export interface UpdateRubricRequest {
  criterion_name?: string;
  max_marks?: number;
  weightage?: number;
  description?: string;
}
