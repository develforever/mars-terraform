import { create } from "zustand";

export interface SelectionBoxRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
}

interface SelectionBoxStore {
  rect: SelectionBoxRect;
  setBox: (box: Partial<SelectionBoxRect>) => void;
  resetBox: () => void;
}

export const useSelectionBoxStore = create<SelectionBoxStore>((set) => ({
  rect: { startX: 0, startY: 0, currentX: 0, currentY: 0, active: false },
  setBox: (box) => set((state) => ({ rect: { ...state.rect, ...box } })),
  resetBox: () =>
    set({ rect: { startX: 0, startY: 0, currentX: 0, currentY: 0, active: false } }),
}));

if (typeof window !== "undefined") {
  (window as unknown as { useSelectionBoxStore: typeof useSelectionBoxStore }).useSelectionBoxStore = useSelectionBoxStore;
}

