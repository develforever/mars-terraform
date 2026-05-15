import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type BuildMode = "place" | "demolish" | null;

export interface UIState {
  // Building selection
  selectedBuildingId: string | null;
  
  // Build mode
  buildMode: BuildMode;
  
  // Hover state for placement
  hoverCell: { x: number; z: number } | null;
  
  // Actions
  setSelectedBuilding: (id: string | null) => void;
  setHoverCell: (cell: { x: number; z: number } | null) => void;
  toggleBuildMode: () => void;
  toggleDemolishMode: () => void;
  cancelBuild: () => void;
  resetUI: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set, get) => ({
      selectedBuildingId: "hab",
      buildMode: null,
      hoverCell: null,

      setSelectedBuilding: (id) => set({ selectedBuildingId: id }),
      
      setHoverCell: (cell) => set({ hoverCell: cell }),

      toggleBuildMode: () => {
        const current = get().buildMode;
        set({ buildMode: current === "place" ? null : "place" });
      },

      toggleDemolishMode: () => {
        const current = get().buildMode;
        set({ buildMode: current === "demolish" ? null : "demolish" });
      },

      cancelBuild: () => set({ buildMode: null }),

      resetUI: () =>
        set({
          buildMode: null,
          selectedBuildingId: "hab",
          hoverCell: null,
        }),
    }),
    { name: "UIStore", enabled: true }
  )
);
