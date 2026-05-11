export interface UserResponse {
  id: number;
  name: string;
  email: string;
  authProvider: string;
  emailVerifiedAt: Date | null;
  createdAt: Date | null;
}

export interface AuthResponse {
  token: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface UserUpdateRequest {
  name?: string;
  email?: string;
}

export interface GroupResponse {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date | null;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
}

export interface AddMemberRequest {
  userId: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}
