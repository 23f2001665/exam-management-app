import { UserRole } from './enums';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string | null;
  role: UserRole;
  department: string | null;
  is_active?: boolean;
  full_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name?: string;
}

export interface CreateExaminerRequest {
  email: string;
  password: string;
  first_name: string;
  last_name?: string;
  department?: string;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
}
