import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { authClient, type User } from "../service/authService";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  /** T13: logowanie numerem konta (+ kod z authenticatora, jeśli włączony). */
  login: (accountNumber: string, totpCode?: string) => Promise<void>;
  /** T13: nowe konto; zwraca numer konta do pokazania graczowi (jedyny raz). */
  register: () => Promise<string>;
  logout: () => void;
  /** T12: trwałe usunięcie konta; po sukcesie użytkownik jest wylogowany. */
  deleteAccount: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      isAuthenticated: authClient.isAuthenticated(),
      isLoading: false,

      setUser: (user: User | null) => set({ user, isAuthenticated: !!user }),

      login: async (accountNumber: string, totpCode?: string) => {
        set({ isLoading: true });
        try {
          await authClient.login(accountNumber, totpCode);
          const user = await authClient.me();
          set({ user, isAuthenticated: true });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async () => {
        set({ isLoading: true });
        try {
          const { accountNumber } = await authClient.register();
          const user = await authClient.me();
          set({ user, isAuthenticated: true });
          return accountNumber;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        authClient.logout();
        set({ user: null, isAuthenticated: false });
      },

      deleteAccount: async () => {
        set({ isLoading: true });
        try {
          await authClient.deleteAccount();
          set({ user: null, isAuthenticated: false });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchUser: async () => {
        if (!authClient.isAuthenticated()) return;
        set({ isLoading: true });
        try {
          const user = await authClient.me();
          set({ user, isAuthenticated: true });
        } catch {
          authClient.logout();
          set({ user: null, isAuthenticated: false });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    { name: "AuthStore", enabled: true }
  )
);
