import type { Role } from "@camppulse/constants";

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: Role;
  camp_id?: string;
  zone?: string;
  kyc_status?: "pending" | "verified" | "rejected";
}

export interface UserProfile extends User {
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface RegisterResponse {
  user: Pick<User, "id" | "email" | "full_name" | "role" | "kyc_status">;
  tokens: AuthTokens;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}
