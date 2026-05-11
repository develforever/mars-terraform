import { create } from "zustand";
import { devtools } from 'zustand/middleware'

export interface AppState {
  title: string;
  setTitle: (title: string) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      title: "Mars Terraform - ThreeJS WebGL Game",
      setTitle: (title: string) => set({ title }),
    }),
    { name: "AppStore", enabled: true }
  )
);

