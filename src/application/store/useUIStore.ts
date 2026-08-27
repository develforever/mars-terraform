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
  
  // Inspection state
  inspectedInstanceId: string | null;
  
  // HUD panel visibility
  isHUDVisible: boolean;

  // Debug overlay visibility
  debugOverlayVisible: boolean;

  // Launch transition
  isLaunching: boolean;

  // RTS Unit Selection & Control Groups
  selectedUnitIds: string[];
  controlGroups: Record<number, string[]>;

  // Actions
  setSelectedBuilding: (id: string | null) => void;
  setHoverCell: (cell: { x: number; z: number } | null) => void;
  toggleBuildMode: () => void;
  toggleDemolishMode: () => void;
  cancelBuild: () => void;
  setInspectedInstance: (id: string | null) => void;
  toggleHUD: () => void;
  toggleDebugOverlay: () => void;
  setLaunching: (value: boolean) => void;
  selectUnits: (ids: string[]) => void;
  toggleSelectUnit: (id: string) => void;
  clearUnitSelection: () => void;
  setControlGroup: (groupNumber: number, unitIds: string[]) => void;
  selectControlGroup: (groupNumber: number) => void;
  resetUI: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set, get) => ({
      selectedBuildingId: "hab",
      buildMode: null,
      hoverCell: null,
      inspectedInstanceId: null,
      isHUDVisible: false,
      debugOverlayVisible: false,
      isLaunching: false,
      selectedUnitIds: [],
      controlGroups: {},

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

      setInspectedInstance: (id) => set({ inspectedInstanceId: id }),

      toggleHUD: () => set({ isHUDVisible: !get().isHUDVisible }),

      toggleDebugOverlay: () => set({ debugOverlayVisible: !get().debugOverlayVisible }),

      setLaunching: (value) => set({ isLaunching: value }),

      selectUnits: (ids) => set({ selectedUnitIds: Array.from(new Set(ids)) }),

      toggleSelectUnit: (id) => {
        const current = get().selectedUnitIds;
        if (current.includes(id)) {
          set({ selectedUnitIds: current.filter((uId) => uId !== id) });
        } else {
          set({ selectedUnitIds: [...current, id] });
        }
      },

      clearUnitSelection: () => set({ selectedUnitIds: [] }),

      setControlGroup: (groupNumber, unitIds) => {
        set((state) => ({
          controlGroups: {
            ...state.controlGroups,
            [groupNumber]: [...unitIds],
          },
        }));
      },

      selectControlGroup: (groupNumber) => {
        const group = get().controlGroups[groupNumber];
        if (group && group.length > 0) {
          set({ selectedUnitIds: [...group] });
        }
      },

      resetUI: () =>
        set({
          buildMode: null,
          selectedBuildingId: "hab",
          hoverCell: null,
          inspectedInstanceId: null,
          selectedUnitIds: [],
          controlGroups: {},
        }),
    }),
    { name: "UIStore", enabled: true }
  )
);

if (typeof window !== "undefined") {
  (window as unknown as { useUIStore: typeof useUIStore }).useUIStore = useUIStore;
}




