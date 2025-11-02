import { create } from "zustand";

export type ResourceKey = "o2" | "power" | "water" | "biomass";

export interface Def {
  id: string; name: string; color?: string;
  cost?: Partial<Record<ResourceKey, number>>;
  prod?: Partial<Record<ResourceKey, number>>;       // produkcja/zużycie na sekundę
  tags?: string[];                                   // np. ["dayScaled"]
  provides?: Partial<{ cap_power: number; cap_water: number; cap_biomass: number }>;
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
  occupied: Record<string, true>;

  setBuildDef(id: string | null): void;
  setHover(cell: {x:number; z:number} | null): void;

  setSun(f: number): void;
  canAfford(defId: string): boolean;
  placeAt(cell: {x:number; z:number}, heightY?: number): boolean;
}

const SEED: Def[] = [
  { id: "hab", name: "Kapsuła", color: "#93c5fd", cost: { power: 5, water: 1 }, prod: { o2: +0.10 } },
  { id: "greenhouse", name: "Szklarnia", color: "#86efac", cost: { power: 2, water: 2 }, prod: { o2: +0.20, biomass: +0.10, power: -0.05, water: -0.05 } },
  { id: "solar", name: "Panel", color: "#fde68a", cost: { biomass: 0.5 }, prod: { power: +0.30 }, tags: ["dayScaled"] },
  { id: "ice", name: "Kolektor lodu", color: "#a5f3fc", cost: { power: 1 }, prod: { water: +0.20, power: -0.05 } },
  { id: "battery", name: "Magazyn energii", color: "#fbbf24", cost: { biomass: 0.5, water: 0.5 }, provides: { cap_power: 20 } },
  { id: "watertank", name: "Zbiornik wody", color: "#60a5fa", cost: { power: 1, biomass: 0.2 }, provides: { cap_water: 20 } },
  { id: "silo", name: "Silos biomasy", color: "#a3e635", cost: { power: 1, water: 0.5 }, provides: { cap_biomass: 15 } },
  { id: "recycler", name: "Recykler wody", color: "#34d399", cost: { power: 2, biomass: 1 }, prod: { water: +0.08, power: -0.10 } },
  { id: "rtg", name: "RTG", color: "#f472b6", cost: { biomass: 3, water: 1 }, prod: { power: +0.25 } },
];

export const useMars = create<MarsState>((set, get) => ({
  // start
  o2: 5, power: 5, water: 3, biomass: 1,
  cap: { power: 10, water: 10, biomass: 10 },
  sun: 1, alive: true,
  defs: Object.fromEntries(SEED.map(d=>[d.id,d])),
  placed: [],
  buildDefId: "hab",
  hover: null,
  occupied: {},

  setBuildDef: (id) => set({ buildDefId: id }),
  setHover: (cell) => set({ hover: cell }),
  setSun: (f) => set({ sun: Math.max(0, Math.min(1, f)) }),

  canAfford: (defId) => {
    const def = get().defs[defId]; if (!def?.cost) return true;
    return Object.entries(def.cost).every(([k, v]) => (get()[k as ResourceKey] as number) >= (v ?? 0));
  },

  placeAt: (cell, heightY = 0) => {
    if (!get().alive) return false;
    const defId = get().buildDefId;
    if (!defId || !get().canAfford(defId)) return false;

    const key = `${cell.x},${cell.z}`;
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
}));

/** Clamp do limitów + game-over */
function clampAndCheck() {
  const s = useMars.getState();
  const next: Partial<MarsState> = {};
  // clamp
  (["power","water","biomass"] as const).forEach(k => {
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
setInterval(() => {
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
}, 1000);
