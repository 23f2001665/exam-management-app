import { CourseStatus } from './enums';

export interface Course {
  id: number;
  code: string;
  name: string;
  description: string | null;
  status: CourseStatus;
}

export interface CreateCourseRequest {
  code: string;
  name: string;
  description?: string;
  status?: CourseStatus;
}

export interface UpdateCourseRequest {
  code?: string;
  name?: string;
  description?: string;
  status?: CourseStatus;
}
