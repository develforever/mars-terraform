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

export interface SavedResources {
  o2: number;
  power: number;
  water: number;
  biomass: number;
}

export interface SavedCapacity {
  power: number;
  water: number;
  biomass: number;
}

export interface SavedBuilding {
  id: string;
  definitionId: string;
  position: { x: number; y: number; z: number };
  condition: number;
}

export interface SavedWeather {
  type: string;
  intensity: number;
  remainingTicks: number;
  cooldownTicks: number;
  impactZones?: { x: number; z: number }[];
}

export interface SavedGameState {
  resources: SavedResources;
  capacity: SavedCapacity;
  placed: SavedBuilding[];
  occupied: Record<string, string>;
  weather: SavedWeather;
  terraforming: number;
  o2Accumulated: number;
  difficulty: "easy" | "normal" | "hard";
  gameMode: "exploration" | "survival";
}

export interface ColonyData {
  name: string;
  state: SavedGameState;
}

export interface ColonyResponse {
  id: number;
  userId: number;
  name: string;
  state: SavedGameState;
  updatedAt: Date | null;
  createdAt: Date | null;
}
