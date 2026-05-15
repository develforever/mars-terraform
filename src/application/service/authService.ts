const API_BASE = "/api";

export interface User {
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

const getToken = (): string | null => localStorage.getItem("token");

const setToken = (token: string): void => {
  localStorage.setItem("token", token);
};

const clearToken = (): void => {
  localStorage.removeItem("token");
};

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const register = async (data: RegisterRequest): Promise<{ message: string; userId: number; email: string }> => {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await handleResponse<AuthResponse>(response);
  setToken(result.token);
  return result;
};

const logout = (): void => {
  clearToken();
};

const me = async (): Promise<User> => {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  return handleResponse(response);
};

const changePassword = async (oldPassword: string, newPassword: string): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  return handleResponse(response);
};

const forgotPassword = async (data: ForgotPasswordRequest): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

const resetPassword = async (data: ResetPasswordRequest): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

const verifyEmail = async (data: VerifyEmailRequest): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

const resendVerification = async (data: ResendVerificationRequest): Promise<{ message: string }> => {
  const response = await fetch(`${API_BASE}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

const getGoogleAuthUrl = async (): Promise<string> => {
  const response = await fetch(`${API_BASE}/auth/google`);
  const result = await handleResponse<{ url: string }>(response);
  return result.url;
};

const getGithubAuthUrl = async (): Promise<string> => {
  const response = await fetch(`${API_BASE}/auth/github`);
  const result = await handleResponse<{ url: string }>(response);
  return result.url;
};

const isAuthenticated = (): boolean => !!getToken();

export const authClient = {
  getToken,
  setToken,
  clearToken,
  register,
  login,
  logout,
  me,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  getGoogleAuthUrl,
  getGithubAuthUrl,
  isAuthenticated,
};
