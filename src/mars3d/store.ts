import { create } from "zustand";

export type ResourceKey = "o2" | "power" | "water" | "biomass";
export interface Def {
  id: string;
  name: string;
  color?: string;
  cost?: Partial<Record<ResourceKey, number>>;
  prod?: Partial<Record<ResourceKey, number>>;   // produkcja / zużycie na tick
}

export interface Placed { id: string; defId: string; x: number; z: number; y: number; }

export interface MarsState {
  o2: number; power: number; water: number; biomass: number;
  defs: Record<string, Def>;
  placed: Placed[];
  buildDefId: string | null;
  hover: { x: number; z: number } | null;
  occupied: Record<string, true>;   // klucz "x,z"
  setBuildDef(id: string | null): void;
  setHover(cell: { x: number; z: number } | null): void;
  canAfford(defId: string): boolean;
  placeAt(cell: { x: number; z: number }, heightY?: number): boolean;
}

const SEED: Def[] = [
  { id: "hab", name: "Kapsuła", color: "#93c5fd", cost: { power: 5, water: 1 }, prod: { o2: 0.1 } },
  { id: "greenhouse", name: "Szklarnia", color: "#86efac", cost: { power: 2, water: 2 }, prod: { o2: 0.2, biomass: 0.1 } },
  { id: "solar", name: "Panel", color: "#fde68a", cost: { biomass: 0.5 }, prod: { power: 0.3 } }
];


export const useMars = create<MarsState>((set, get) => ({
  o2: 5, power: 5, water: 3, biomass: 1,
  defs: Object.fromEntries(SEED.map(d => [d.id, d])),
  placed: [],
  buildDefId: "hab",
  hover: null,
  occupied: {},
  setBuildDef: (id) => set({ buildDefId: id }),
  setHover: (cell) => set({ hover: cell }),
  canAfford: (defId) => {
    const def = get().defs[defId]; if (!def?.cost) return true;
    return Object.entries(def.cost).every(([k, v]) => (get()[k as ResourceKey] as number) >= (v ?? 0));
  },
  placeAt: (cell, heightY = 0) => {

    const defId = get().buildDefId;
    if (!defId || !get().canAfford(defId)) return false;

    const key = `${cell.x},${cell.z}`;
    if (get().occupied[key]) return false; // już zajęte

    set(s => ({
      placed: s.placed.concat({ id: crypto.randomUUID(), defId, x: cell.x, z: cell.z, y: heightY }),
      occupied: { ...s.occupied, [key]: true }
    }));

    const def = get().defs[defId];
    if (def?.cost) {
      const deltas: Partial<MarsState> = {};
      for (const [rk, val] of Object.entries(def.cost)) (deltas as any)[rk] = (get()[rk as ResourceKey] as number) - (val ?? 0);
      set(deltas as any);
    }

    return true;
  }
}));

// tick co sekundę
setInterval(() => {
  const s = useMars.getState();
  const delta: Partial<MarsState> = {};
  for (const b of s.placed) {
    const def = s.defs[b.defId];
    if (!def?.prod) continue;
    for (const [k, v] of Object.entries(def.prod)) {
      const key = k as ResourceKey;
      delta[key] = (delta[key] ?? s[key]) + (v ?? 0);
    }
  }
  if (Object.keys(delta).length) useMars.setState(delta as any);
}, 1000);

