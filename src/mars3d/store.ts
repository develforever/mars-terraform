import { create } from "zustand";
import { devtools } from 'zustand/middleware'

export type ResourceKey = "o2" | "power" | "water" | "biomass";

export interface Def {
  id: string; name: string; color?: string;
  cost?: Partial<Record<ResourceKey, number>>;
  prod?: Partial<Record<ResourceKey, number>>;       // produkcja/zużycie na sekundę
  tags?: string[];                                   // np. ["dayScaled"]
  provides?: Partial<{ cap_power: number; cap_water: number; cap_biomass: number }>;
  glbPath?: null | string;
}

export interface Placed { id: string; defId: string; x: number; z: number; y: number; }

export interface MarsState {
  // zasoby i limity
  o2: number; power: number; water: number; biomass: number;
  cap: { power: number; water: number; biomass: number };
  // meta
  sun: number;               // 0..1 – mnożnik dnia (0 noc, 1 południe)
  alive: boolean;            // game over flag
  // kontent
  defs: Record<string, Def>;
  placed: Placed[];
  // budowa
  buildDefId: string | null;
  hover: { x: number; z: number } | null;
  buildMode: 'place' | 'demolish' | null;
  occupied: Record<string, string>;

  setBuildDef(id: string | null): void;
  setHover(cell: { x: number; z: number } | null): void;

  setSun(f: number): void;
  canAfford(defId: string): boolean;
  placeAt(cell: { x: number; z: number }, heightY?: number): boolean;

  toggleBuildPlace(): void;
  toggleDemolish(): void;
  cancelBuild(): void;

  demolishAt(cell: { x: number; z: number }): boolean;
}

const SEED: Def[] = [
  { id: "hab", name: "Kapsuła", color: "#93c5fd", cost: { power: 5, water: 1 }, prod: { o2: +0.10 }, glbPath: "/models/habitat.glb" },
  { id: "greenhouse", name: "Szklarnia", color: "#86efac", cost: { power: 2, water: 2 }, prod: { o2: +0.20, biomass: +0.10, power: -0.05, water: -0.05 }, glbPath: "/models/greenhouse.glb" },
  { id: "solar", name: "Panel", color: "#fde68a", cost: { biomass: 0.5 }, prod: { power: +0.30 }, tags: ["dayScaled"], glbPath: "/models/solar_panel.glb" },
  { id: "ice", name: "Kolektor lodu", color: "#a5f3fc", cost: { power: 1 }, prod: { water: +0.20, power: -0.05 } },
  { id: "battery", name: "Magazyn energii", color: "#fbbf24", cost: { biomass: 0.5, water: 0.5 }, provides: { cap_power: 20 }, glbPath: "/models/energy_station.glb" },
  { id: "watertank", name: "Zbiornik wody", color: "#60a5fa", cost: { power: 1, biomass: 0.2 }, provides: { cap_water: 20 } },
  { id: "silo", name: "Silos biomasy", color: "#a3e635", cost: { power: 1, water: 0.5 }, provides: { cap_biomass: 15 }, glbPath: "/models/biomass_silo.glb" },
  { id: "recycler", name: "Recykler wody", color: "#34d399", cost: { power: 2, biomass: 1 }, prod: { water: +0.08, power: -0.10 } },
  { id: "rtg", name: "RTG", color: "#f472b6", cost: { biomass: 3, water: 1 }, prod: { power: +0.25 } },
];

function keyFromCell(x: number, z: number) {
  // zaokrąglenie i normalizacja -0 → 0
  const ix = Math.round(x) || 0;
  const iz = Math.round(z) || 0;
  return `${ix},${iz}`;
}


export const useMars = create<MarsState>()(
  devtools((set, get) => ({
    // start
    o2: 5, power: 5, water: 3, biomass: 1,
    cap: { power: 10, water: 10, biomass: 10 },
    sun: 1, alive: true,
    defs: Object.fromEntries(SEED.map(d => [d.id, d])),
    placed: [],
    buildDefId: "hab",
    hover: null,
    buildMode: null,
    occupied: {},

    setBuildDef: (id) => set({ buildDefId: id }),
    setHover: (cell) => set({ hover: cell }),
    setSun: (f) => set({ sun: Math.max(0, Math.min(1, f)) }),

    canAfford: (defId) => {
      const def = get().defs[defId]; if (!def?.cost) return true;
      return Object.entries(def.cost).every(([k, v]) => (get()[k as ResourceKey] as number) >= (v ?? 0));
    },

    toggleBuildPlace: () => {
      const m = get().buildMode;
      set({ buildMode: m === 'place' ? null : 'place' });
    },
    toggleDemolish: () => {
      const m = get().buildMode;
      set({ buildMode: m === 'demolish' ? null : 'demolish' });
    },
    cancelBuild: () => set({ buildMode: null }),

    demolishAt: (cell) => {
      if (!get().alive || get().buildMode !== 'demolish') return false;

      const keyFromCell = (x: number, z: number) => `${Math.round(x) || 0},${Math.round(z) || 0}`;
      const key = keyFromCell(cell.x, cell.z);

      return set((s) => {
        // znajdź budynek po occupied albo „blisko”
        let bid = s.occupied[key];
        if (!bid) {
          const cx = Math.round(cell.x), cz = Math.round(cell.z);
          const near = s.placed.find(p => Math.abs(p.x - cx) < 0.51 && Math.abs(p.z - cz) < 0.51);
          if (near) bid = near.id;
        }
        if (!bid) return {}; // nic do zrobienia

        const idx = s.placed.findIndex(p => p.id === bid);
        if (idx === -1) return {};

        const b = s.placed[idx];
        const def = s.defs[b.defId];

        // nowy stan: usuń z placed, z occupied (po kluczu i po id), skoryguj limity/zwroty
        const placed = s.placed.slice(0, idx).concat(s.placed.slice(idx + 1));
        const occupied = { ...s.occupied };
        // usuń wpis pozycji
        delete occupied[keyFromCell(b.x, b.z)];
        // oraz każdy ewentualny wpis wskazujący na ten sam id (ostrożnie)
        for (const k of Object.keys(occupied)) if (occupied[k] === bid) delete occupied[k];

        const cap = { ...s.cap };
        if (def?.provides) {
          cap.power -= def.provides.cap_power ?? 0;
          cap.water -= def.provides.cap_water ?? 0;
          cap.biomass -= def.provides.cap_biomass ?? 0;
        }

        // opcjonalny zwrot 50% kosztów
        const delta: Partial<MarsState> = {};
        if (def?.cost) {
          for (const [rk, val] of Object.entries(def.cost)) {
            const k = rk as ResourceKey;
            (delta as any)[k] = (s as any)[k] + (val ?? 0) * 0.5;
          }
        }

        return { placed, occupied, cap, ...delta };
      }, false, "demolishAt");
    },


    placeAt: (cell, heightY = 0) => {
      if (!get().alive) return false;
      const defId = get().buildDefId;
      if (!defId || !get().canAfford(defId)) return false;

      const key = keyFromCell(cell.x, cell.z);
      if (get().occupied[key]) return false; // zajęte

      // zapłać koszt
      const def = get().defs[defId];
      if (def?.cost) {
        const deltas: Partial<MarsState> = {};
        for (const [rk, val] of Object.entries(def.cost)) {
          const keyR = rk as ResourceKey;
          (deltas as any)[keyR] = (get()[keyR] as number) - (val ?? 0);
        }
        set(deltas as any);
      }

      // zastosuj stałe provide (limity)
      if (def?.provides) {
        set(s => ({
          cap: {
            power: s.cap.power + (def.provides!.cap_power ?? 0),
            water: s.cap.water + (def.provides!.cap_water ?? 0),
            biomass: s.cap.biomass + (def.provides!.cap_biomass ?? 0),
          }
        }));
      }

      // dodaj budynek i zaznacz zajętość
      set(s => ({
        placed: s.placed.concat({ id: crypto.randomUUID(), defId, x: cell.x, z: cell.z, y: heightY }),
        occupied: { ...s.occupied, [key]: true }
      }));

      return true;
    }
  }), { name: "MarsStore", enabled: true, })  // <- nazwa w DevTools
);

/** Clamp do limitów + game-over */
function clampAndCheck() {
  const s = useMars.getState();
  const next: Partial<MarsState> = {};
  // clamp
  (["power", "water", "biomass"] as const).forEach(k => {
    const cap = s.cap[k];
    if (s[k] > cap) (next as any)[k] = cap;
    if (s[k] < 0) (next as any)[k] = 0;
  });
  if (s.o2 < 0) next.o2 = 0;
  // game over
  if (s.alive && (s.o2 <= 0)) next.alive = false;
  if (Object.keys(next).length) useMars.setState(next as any);
}

/** Ekonomia – tick co 1s: produkcja/zużycie + konsumpcja załogi + skalowanie słońcem */
const globalResFn = () => {
  clearTimeout(globalResInt);
  const s = useMars.getState();
  if (!s.alive) return;

  const delta: Partial<MarsState> = {};
  const sun = s.sun; // 0..1
  // budynki
  for (const b of s.placed) {
    const def = s.defs[b.defId];
    if (!def?.prod) continue;
    for (const [rk, val] of Object.entries(def.prod)) {
      let vv = val ?? 0;
      if (def.tags?.includes("dayScaled") && rk === "power") vv *= sun;
      const key = rk as ResourceKey;
      (delta as any)[key] = ((delta as any)[key] ?? s[key]) + vv;
    }
  }
  // konsumpcja O2 przez załogę (MVP: 1 astronauta)
  delta.o2 = (delta.o2 ?? s.o2) - 0.05;

  if (Object.keys(delta).length) useMars.setState(delta as any);
  clampAndCheck();
  globalResInt = setTimeout(globalResFn, 1000);
}
let globalResInt = setTimeout(globalResFn, 1000);
