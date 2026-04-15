export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  id: string;
  email: string;
  full_name: string;
  role: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  type: string;
}
