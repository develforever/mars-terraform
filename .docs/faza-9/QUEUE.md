# Faza 9 — Kolejka (gra sieciowa bez kont)

> Plan: [`PLAN.md`](./PLAN.md). Źródło prawdy o postępie Fazy 9. Branch roboczy: `claude/compassionate-hawking-nc14kk`
> (sesja lokalna pracuje w worktree i pushuje `HEAD:claude/compassionate-hawking-nc14kk`). Zmiany do `main` przez PR.

## Decyzje

| ID | Odpowiedź | Data | Kto |
|----|-----------|------|-----|
| D1 | Kooperacja 2 graczy (wspólna kolonia) w pierwszej wersji | 2026-10-01 | użytkownik (zgoda na rekomendacje) |
| D2 | Transport: biblioteka `ws` (zgoda na paczkę npm przy F9-T4) | 2026-10-01 | użytkownik |
| D3 | Hosting: Render Free na prototyp; płatny plan przed publicznym startem | 2026-10-01 | użytkownik |
| D4 | Synchronizacja: snapshot stanu co tick (bez lockstepu) na start | 2026-10-01 | użytkownik |
| D5 | Brak trwałego zapisu gry sieciowej na serwerze; gospodarz może pobrać plik zapisu | 2026-10-01 | użytkownik |
| D6 | Pseudonimy per pokój, bez zapisu, bez czatu | 2026-10-01 | użytkownik |
| D7 | Limity: max 4 graczy/pokój, limit pokoi/proces, TTL 30 min bezczynności, limit komend/s | 2026-10-01 | użytkownik |

## Zadania

| ID | Zadanie | Zależy | Status |
|----|---------|--------|--------|
| F9-T1 | Deterministyczny RNG (`src/domain/random/Rng.ts`, mulberry32) wstrzyknięty do `WeatherService`, `AlienService` (domyślnie `Math.random`, solo bez zmian); id encji z `rng` | — | DONE (commit w dzienniku) |
| F9-T2 | Wydzielenie `GameSimulation.step` z `applyEconomyTick` (store woła rdzeń; testy „złote” z ziarnem) | T1 | TODO |
| F9-T3 | Model komend gracza + walidacja (zod) | T2 | TODO |
| F9-T4 | Serwer: WebSocket (`ws`), pokoje w pamięci, pętla ticka, snapshoty, limity | T3 | TODO |
| F9-T5 | Klient: tryb sieciowy (utwórz/dołącz kod, lobby, snapshoty, komendy, reconnect) | T4 | TODO |
| F9-T6 | Prywatność i bezpieczeństwo: `/privacy`, CSP `connect-src wss://...`, logi bez danych, test obciążenia | T4 | TODO |
| F9-T7 | Wdrożenie serwera + smoke test 2 przeglądarek | T5, T6 | TODO |

## Dziennik
