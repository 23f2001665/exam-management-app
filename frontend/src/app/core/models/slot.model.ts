import { SlotStatus } from './enums';

export interface Slot {
  id: number;
  examination_id: number;
  examiner_id: number;
  date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  available_seats: number;
  status: SlotStatus;
  meeting_link: string | null;
}

export interface CreateSlotRequest {
  examination_id: number;
  date: string;
  start_time: string;
  end_time: string;
  max_capacity?: number;
  meeting_link?: string;
}

export interface UpdateSlotRequest {
  date?: string;
  start_time?: string;
  end_time?: string;
  max_capacity?: number;
  meeting_link?: string;
}
