import { create } from "zustand";

export interface TargetPing {
  id: string;
  position: [number, number, number];
  type: "move" | "attack" | "repair";
  createdAt: number;
}

interface TargetMarkerStore {
  pings: TargetPing[];
  addPing: (position: [number, number, number], type: "move" | "attack" | "repair") => void;
  removePing: (id: string) => void;
}

export const useTargetMarkerStore = create<TargetMarkerStore>((set) => ({
  pings: [],
  addPing: (position, type) => {
    const id = `ping-${Date.now()}-${Math.random()}`;
    const newPing: TargetPing = { id, position, type, createdAt: Date.now() };
    set((state) => ({ pings: [...state.pings.slice(-6), newPing] }));
    setTimeout(() => {
      set((state) => ({ pings: state.pings.filter((p) => p.id !== id) }));
    }, 1200);
  },
  removePing: (id) => set((state) => ({ pings: state.pings.filter((p) => p.id !== id) })),
}));
