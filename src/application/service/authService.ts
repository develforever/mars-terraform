import { apiUrl } from "../config/apiConfig";

/**
 * Klient kont bez danych osobowych (T13): numer konta + opcjonalny authenticator (TOTP).
 * Token JWT trzymany w `localStorage` (niezbędny do działania, bez cookies).
 */

export interface User {
  id: number;
  nickname: string | null;
  totpEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthResponse {
  token: string;
}

/** Odpowiedź rejestracji: numer konta pokazywany JEDEN raz (serwer ma tylko jego hash). */
export interface RegisterResponse {
  accountNumber: string;
  token: string;
}

export interface TotpSetupResponse {
  secret: string;
  otpauthUri: string;
}

/** Komunikat API, gdy konto ma włączony authenticator, a nie podano kodu. */
export const TOTP_REQUIRED_MESSAGE = "TOTP code required";

/** Błąd API z kodem HTTP (np. 401 przy braku kodu TOTP, 429 przy limicie). */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const TOKEN_KEY = "token";

const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const toApiError = async (response: Response): Promise<ApiError> => {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return new ApiError(body.error || `HTTP ${response.status}`, response.status);
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw await toApiError(response);
  return response.json() as Promise<T>;
};

const register = async (): Promise<RegisterResponse> => {
  const response = await fetch(apiUrl("/api/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const result = await handleResponse<RegisterResponse>(response);
  setToken(result.token);
  return result;
};

const login = async (accountNumber: string, totpCode?: string): Promise<AuthResponse> => {
  const response = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(totpCode ? { accountNumber, totpCode } : { accountNumber }),
  });
  const result = await handleResponse<AuthResponse>(response);
  setToken(result.token);
  return result;
};

const logout = (): void => {
  clearToken();
};

const me = async (): Promise<User> => {
  const response = await fetch(apiUrl("/api/auth/me"), { headers: authHeaders() });
  return handleResponse(response);
};

const updateNickname = async (nickname: string): Promise<User> => {
  const response = await fetch(apiUrl("/api/users/me"), {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ nickname }),
  });
  return handleResponse(response);
};

const totpSetup = async (): Promise<TotpSetupResponse> => {
  const response = await fetch(apiUrl("/api/auth/totp/setup"), { method: "POST", headers: authHeaders() });
  return handleResponse(response);
};

const totpEnable = async (code: string): Promise<{ message: string }> => {
  const response = await fetch(apiUrl("/api/auth/totp/enable"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ code }),
  });
  return handleResponse(response);
};

const totpDisable = async (code: string): Promise<{ message: string }> => {
  const response = await fetch(apiUrl("/api/auth/totp/disable"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ code }),
  });
  return handleResponse(response);
};

/** RODO art. 15 i 20: wszystkie dane konta jako plik JSON. */
const exportMyData = async (): Promise<Blob> => {
  const response = await fetch(apiUrl("/api/users/me/export"), { headers: authHeaders() });
  if (!response.ok) throw await toApiError(response);
  return response.blob();
};

/** RODO art. 17: trwałe usunięcie konta i danych; po sukcesie token jest usuwany lokalnie. */
const deleteAccount = async (): Promise<{ message: string }> => {
  const response = await fetch(apiUrl("/api/users/me"), { method: "DELETE", headers: authHeaders() });
  const result = await handleResponse<{ message: string }>(response);
  clearToken();
  return result;
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
  updateNickname,
  totpSetup,
  totpEnable,
  totpDisable,
  exportMyData,
  deleteAccount,
  isAuthenticated,
};
