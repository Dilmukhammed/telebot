export interface TestOut {
  id: number;
  subject_name: string;
  datetime: string;
  max_capacity: number;
  format: 'online' | 'offline';
  duration_minutes: number;
  registered_count: number;
  has_capacity: boolean;
  is_active: boolean;
}

export interface TestCreate {
  subject_name: string;
  datetime: string;
  max_capacity: number;
  format: 'online' | 'offline';
  duration_minutes: number;
}

export interface TestUpdate {
  subject_name?: string;
  datetime?: string;
  max_capacity?: number;
  format?: 'online' | 'offline';
  duration_minutes?: number;
  is_active?: boolean;
}

export interface RegistrationOut {
  id: number;
  test_id: number;
  test_subject: string;
  test_datetime: string;
  status: string;
  registered_at: string;
}

export interface RegistrationCreate {}

export interface ResultOut {
  id: number;
  registration_id: number;
  test_subject: string;
  test_datetime: string;
  score: number;
  max_score: number;
  comment?: string;
  created_at: string;
}

export interface ResultCreate {
  registration_id: number;
  score: number;
  max_score: number;
  comment?: string;
}

export interface ResultUpdate {
  score?: number;
  max_score?: number;
  comment?: string;
}

export interface AdminLogin {
  username: string;
  password: string;
}

export interface AdminToken {
  access_token: string;
  token_type: string;
}

export interface ApiResponse<T> {
  data?: T;
  message: string;
}