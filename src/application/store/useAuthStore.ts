import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { authClient, type User } from "../service/authService";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      isAuthenticated: authClient.isAuthenticated(),
      isLoading: false,

      setUser: (user: User | null) =>
        set({ user, isAuthenticated: !!user }),

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          await authClient.login({ email, password });
          const user = await authClient.me();
          set({ user, isAuthenticated: true });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true });
        try {
          await authClient.register({ email, password, name });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        authClient.logout();
        set({ user: null, isAuthenticated: false });
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
