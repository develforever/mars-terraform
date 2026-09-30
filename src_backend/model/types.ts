/** Profil konta (T13): bez e-maila i imienia. */
export interface UserResponse {
  id: number;
  nickname: string | null;
  totpEnabled: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface AuthResponse {
  token: string;
}

/** Odpowiedź rejestracji: numer konta pokazywany JEDEN raz (serwer trzyma tylko hash). */
export interface RegisterResponse {
  accountNumber: string;
  token: string;
}

export interface LoginRequest {
  /**
   * Numer konta, np. `7KQ2-M9XA-4TRE-01ZC-8HNP` (myślniki i spacje opcjonalne).
   * @maxLength 64
   */
  accountNumber: string;
  /**
   * Kod z aplikacji authenticator (6 cyfr), wymagany tylko przy włączonym TOTP.
   * @maxLength 12
   */
  totpCode?: string;
}

export interface TotpCodeRequest {
  /** @maxLength 12 */
  code: string;
}

export interface TotpSetupResponse {
  /** Sekret base32 do wpisania ręcznie w aplikacji authenticator. */
  secret: string;
  /** Link `otpauth://totp/...` (dla aplikacji obsługujących linki lub do wygenerowania QR). */
  otpauthUri: string;
}

/** T13: tylko pseudonim (opcjonalny, widoczny dla innych graczy w przyszłym trybie sieciowym). */
export interface UserUpdateRequest {
  /**
   * @minLength 1
   * @maxLength 32
   */
  nickname: string;
}

/** T12: eksport danych użytkownika (`GET /api/users/me/export`), RODO art. 15 i 20. */
export interface UserDataExport {
  formatVersion: number;
  exportedAt: string;
  profile: {
    id: number;
    nickname: string | null;
    totpEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
  };
  groups: { name: string; description: string | null }[];
  maps: {
    id: number;
    name: string;
    description: string | null;
    players: number;
    version: string;
    /** Treść mapy (JSON v2.0) jako obiekt; surowy tekst, jeśli nie jest poprawnym JSON. */
    data: unknown;
    createdAt: Date;
    updatedAt: Date;
  }[];
  colonies: {
    id: number;
    name: string;
    /** Stan gry jako obiekt; surowy tekst, jeśli nie jest poprawnym JSON. */
    state: unknown;
    createdAt: Date;
    updatedAt: Date;
  }[];
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
