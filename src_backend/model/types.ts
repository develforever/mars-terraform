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

/**
 * Stan gry kolonii (D13 = c): otwarty obiekt JSON, dla backendu nieprzezroczysty blob.
 * Jedynym źródłem prawdy o kształcie jest frontend (`useGameStore.saveGame` / `hydrateSavedState`),
 * który odpowiada za treść przy wczytaniu. Backend (walidacja TSOA) sprawdza tylko, że to obiekt
 * (tablica, null i prymityw → 400), a rozmiar ogranicza limit body w `app.ts` (→ 413).
 */
export type ColonyState = Record<string, unknown>;

export interface ColonyData {
  name: string;
  state: ColonyState;
}

export interface ColonyResponse {
  id: number;
  userId: number;
  name: string;
  state: ColonyState;
  updatedAt: Date | null;
  createdAt: Date | null;
}

/**
 * Element lekkiej listy kolonii (`GET /api/colony`, D14): bez `state` i bez `userId`.
 * Daty w tym samym formacie co w `ColonyResponse` na drucie: ISO 8601 UTC (`Date.prototype.toISOString`).
 */
export interface ColonySummary {
  id: number;
  name: string;
  /** @format date-time */
  createdAt: string;
  /** @format date-time */
  updatedAt: string;
}
