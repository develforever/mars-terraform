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
| F9-T1 | Deterministyczny RNG (`src/domain/random/Rng.ts`, mulberry32) wstrzyknięty do `WeatherService`, `AlienService` (domyślnie `Math.random`, solo bez zmian); id encji z `rng` | — | DONE(9cba849) |
| F9-T2 | Wydzielenie `stepSimulation` (`src/domain/simulation/GameSimulation.ts`) z `applyEconomyTick`; store woła rdzeń; test złoty z ziarnem | T1 | DONE(2eade90) |
| F9-T3 | Model komend gracza + walidacja (zod) | T2 | TODO |
| F9-T4 | Serwer: WebSocket (`ws`), pokoje w pamięci, pętla ticka, snapshoty, limity | T3 | TODO |
| F9-T5 | Klient: tryb sieciowy (utwórz/dołącz kod, lobby, snapshoty, komendy, reconnect) | T4 | TODO |
| F9-T6 | Prywatność i bezpieczeństwo: `/privacy`, CSP `connect-src wss://...`, logi bez danych, test obciążenia | T4 | TODO |
| F9-T7 | Wdrożenie serwera + smoke test 2 przeglądarek | T5, T6 | TODO |

## Dziennik

- 2026-10-01T15:13Z · nadzorca · — · Użytkownik: zgoda na rekomendacje planu (D1–D7). Start F9-T1. · —
- 2026-10-01T15:13Z · nadzorca · F9-T1 · RNG z ziarnem w pogodzie i obcych; domyślnie `Math.random` (solo bez zmian). Gate: lint 0, tsc OK, front 640, build OK. · 9cba849
- 2026-10-01T15:17Z · nadzorca · F9-T1 · Korekta wpisu: po F9-T1 front miał 642 testy (nie 640). · —
- 2026-10-01T15:17Z · nadzorca · F9-T2 · Test złoty (300 ticków, exploration i survival z falą obcych, losowość z ziarnem, zamrożony czas) zacommitowany PRZED refaktorem (668fc10); po wydzieleniu `stepSimulation` snapshot identyczny. Store −164 linie. Gate: lint 0, tsc OK, front 648, back 79, build OK. Następne: F9-T3 (model komend) - wymaga decyzji o zakresie komend w kooperacji. · 2eade90
- 2026-10-01T15:20Z · człowiek · F9-T1, F9-T2 · PR #15 scalony (`9616bc4`), CI 6/6. Czeka: decyzja o prawach graczy w kooperacji (rekomendacja: równe prawa) przed F9-T3. · 9616bc4
