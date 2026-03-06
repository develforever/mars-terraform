import { create } from "zustand";
import { devtools } from 'zustand/middleware'

export interface AppState {
  [key: string]: any;
  title: string;
}


export const useAppStore = create<AppState>()(
  devtools((set) => ({
    title: "Mars Terraform - ThreeJS WebGL Game",
    setTitle: (title: string) => set({ title }),
  }), { name: "AppStore", enabled: true, })
);

