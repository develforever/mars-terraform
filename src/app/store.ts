import { create } from "zustand";
import { devtools } from 'zustand/middleware'

export interface AppState {
  [key: string]: any;
}


export const useAppStore = create<AppState>()(
  devtools((set, get) => ({

  }), { name: "AppStore", enabled: true, })
);

