/**
 * Losowość symulacji (Faza 9, F9-T1). Serwisy domeny przyjmują `Rng` zamiast wołać `Math.random`,
 * żeby symulację dało się powtórzyć dla tego samego ziarna (testy „złote”, serwer gry, powtórki).
 * Domyślnie serwisy używają `Math.random`, więc gra solo działa jak dotąd.
 */

/** Funkcja zwracająca liczbę z przedziału [0, 1), jak `Math.random`. */
export type Rng = () => number;

/** Generator z ziarnem z możliwością odczytu stanu (do zapisu i odtworzenia sekwencji). */
export interface SeededRng extends Rng {
  /** Bieżący stan (uint32); `createSeededRng(rng.state())` kontynuuje tę samą sekwencję. */
  state: () => number;
}

/**
 * Deterministyczny generator mulberry32 (32-bitowy stan, okres 2^32). Wystarczający do symulacji gry;
 * nie nadaje się do celów kryptograficznych.
 */
export const createSeededRng = (seed: number): SeededRng => {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Object.assign(next, { state: (): number => a });
};

/** Identyfikator encji z danego `rng` (deterministyczny dla generatora z ziarnem), np. `ship-1f3a9c0b`. */
export const randomId = (prefix: string, rng: Rng): string =>
  `${prefix}-${Math.floor(rng() * 0x100000000).toString(16).padStart(8, "0")}`;
