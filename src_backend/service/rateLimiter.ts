/**
 * Limit zdarzeń w oknie czasowym, TYLKO w pamięci procesu (T13). Bez adresów IP i bez zapisu na dysk:
 * klucze to identyfikatory kont albo stały klucz globalny. Wystarcza przy jednej instancji API
 * (plan Free Render); przy skalowaniu poziomym potrzebny będzie wspólny magazyn.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Czy limit dla klucza jest już wyczerpany (bez rejestrowania nowego zdarzenia). */
  isLimited(key: string, now: number = Date.now()): boolean {
    return this.recent(key, now).length >= this.limit;
  }

  /** Rejestruje zdarzenie. Zwraca `false`, gdy limit był już wyczerpany (zdarzenie nie jest liczone). */
  hit(key: string, now: number = Date.now()): boolean {
    const recent = this.recent(key, now);
    if (recent.length >= this.limit) return false;
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  /** Usuwa wygasłe wpisy wszystkich kluczy (wywoływane okresowo, żeby mapa nie rosła). */
  prune(now: number = Date.now()): void {
    for (const key of this.hits.keys()) {
      if (this.recent(key, now).length === 0) this.hits.delete(key);
    }
  }

  private recent(key: string, now: number): number[] {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length === 0) this.hits.delete(key);
    else this.hits.set(key, recent);
    return recent;
  }
}
