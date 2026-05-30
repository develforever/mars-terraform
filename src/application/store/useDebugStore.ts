import { create } from "zustand";
import type { WeatherType } from "../../domain/services/WeatherService";

export interface DebugState {
  enabled: boolean;
  showBuildingInfo: boolean;
  showFPS: boolean;
  showWeatherInfo: boolean;
  forcedWeather: WeatherType | null;
  toggleDebug: () => void;
  setForcedWeather: (w: WeatherType | null) => void;
  toggleBuildingInfo: () => void;
}

export const useDebugStore = create<DebugState>()((set) => ({
  enabled: false,
  showBuildingInfo: true,
  showFPS: true,
  showWeatherInfo: true,
  forcedWeather: null,

  toggleDebug: () => set((s) => ({ enabled: !s.enabled })),
  setForcedWeather: (w) => set({ forcedWeather: w }),
  toggleBuildingInfo: () => set((s) => ({ showBuildingInfo: !s.showBuildingInfo })),
}));
