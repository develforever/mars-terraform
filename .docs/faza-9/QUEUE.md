# Faza 9 — Kolejka (gra sieciowa bez kont)

> Plan: [`PLAN.md`](./PLAN.md). Źródło prawdy o postępie Fazy 9. Branch roboczy: `claude/compassionate-hawking-nc14kk`
> (sesja lokalna pracuje w worktree i pushuje `HEAD:claude/compassionate-hawking-nc14kk`). Zmiany do `main` przez PR.

## Decyzje

| ID | Odpowiedź | Data | Kto |
|----|-----------|------|-----|
| D1 | Kooperacja 2 graczy (wspólna kolonia) w pierwszej wersji | 2026-10-01 | użytkownik (zgoda na rekomendacje) |
| D2 | Transport: biblioteka `ws` (zgoda na paczkę npm przy F9-T4) | 2026-10-01 | użytkownik |
| D3 | **Self-host u gospodarza** (zastępuje Render Free z 2026-10-01, sprzeczne z D19): jeden proces Node serwuje frontend i WebSocket pod jednym originem; reszta graczy wchodzi na adres gospodarza (LAN / przekierowanie portu / tunel); statyczny frontend z hostingu = tylko solo; autor nie utrzymuje serwera i nie przetwarza IP. Szczegóły: PLAN.md §5 | 2026-10-31 | użytkownik |
| D4 | Synchronizacja: snapshot stanu co tick (bez lockstepu) na start | 2026-10-01 | użytkownik |
| D5 | Brak trwałego zapisu gry sieciowej na serwerze; gospodarz może pobrać plik zapisu | 2026-10-01 | użytkownik |
| D6 | Pseudonimy per pokój, bez zapisu, bez czatu | 2026-10-01 | użytkownik |
| D7 | Limity: max 4 graczy/pokój, limit pokoi/proces, TTL 30 min bezczynności, limit komend/s | 2026-10-01 | użytkownik |
| D8 | Kooperacja: wszyscy gracze mają RÓWNE prawa do wszystkich komend (bez ról) | 2026-10-01 | użytkownik |
| D9 | Katalog serwerów (osobny projekt, bez kont, w pamięci, weryfikacja `/api/health`, nazwy generowane): **odłożone** do decyzji po F9-T7. Gra przez internet na start = tunel u gospodarza (Cloudflare quick tunnel domyślnie, ngrok alternatywnie). Własny relay poza zakresem. Szczegóły: PLAN.md §5 | 2026-10-31 | użytkownik |

## Zadania

| ID | Zadanie | Zależy | Status |
|----|---------|--------|--------|
| F9-T1 | Deterministyczny RNG (`src/domain/random/Rng.ts`, mulberry32) wstrzyknięty do `WeatherService`, `AlienService` (domyślnie `Math.random`, solo bez zmian); id encji z `rng` | — | DONE(9cba849) |
| F9-T2 | Wydzielenie `stepSimulation` (`src/domain/simulation/GameSimulation.ts`) z `applyEconomyTick`; store woła rdzeń; test złoty z ziarnem | T1 | DONE(2eade90) |
| F9-T3 | Model komend gracza + walidacja (zod): `src/domain/simulation/PlayerCommands.ts`, store deleguje | T2 | DONE(ab5b575) |
| F9-T4 | Serwer: WebSocket (`ws`) na serwerze HTTP frontendu, kontrola `Origin`, pokoje w pamięci, pętla ticka, snapshoty, limity | T3 | DONE(fa8dc26) |
| F9-T5 | Klient: tryb sieciowy (same-origin `/ws`, tylko na serwerze gry; utwórz/dołącz kod, lobby, snapshoty, komendy, reconnect) | T4 | DONE(6fb5cf8) |
| F9-T6 | Prywatność i bezpieczeństwo: `/privacy` (serwer gospodarza), nagłówki i CSP `connect-src 'self'` z serwera gry, logi bez danych, test obciążenia | T4 | TODO |
| F9-T7 | Instrukcja dla gospodarza (start, port, LAN / przekierowanie, tunel: Cloudflare quick tunnel / ngrok, link adres + kod) + smoke test 2 przeglądarek w LAN i przez tunel | T5, T6 | TODO |

## Dziennik

- 2026-10-01T15:13Z · nadzorca · — · Użytkownik: zgoda na rekomendacje planu (D1–D7). Start F9-T1. · —
- 2026-10-01T15:13Z · nadzorca · F9-T1 · RNG z ziarnem w pogodzie i obcych; domyślnie `Math.random` (solo bez zmian). Gate: lint 0, tsc OK, front 640, build OK. · 9cba849
- 2026-10-01T15:17Z · nadzorca · F9-T1 · Korekta wpisu: po F9-T1 front miał 642 testy (nie 640). · —
- 2026-10-01T15:17Z · nadzorca · F9-T2 · Test złoty (300 ticków, exploration i survival z falą obcych, losowość z ziarnem, zamrożony czas) zacommitowany PRZED refaktorem (668fc10); po wydzieleniu `stepSimulation` snapshot identyczny. Store −164 linie. Gate: lint 0, tsc OK, front 648, back 79, build OK. Następne: F9-T3 (model komend) - wymaga decyzji o zakresie komend w kooperacji. · 2eade90
- 2026-10-01T15:20Z · człowiek · F9-T1, F9-T2 · PR #15 scalony (`9616bc4`), CI 6/6. Czeka: decyzja o prawach graczy w kooperacji (rekomendacja: równe prawa) przed F9-T3. · 9616bc4
- 2026-10-01T15:26Z · nadzorca · F9-T3 · D8 = równe prawa. 8 komend + schemat zod (limity współrzędnych, długości id, liczby jednostek). Akcje store delegują do `applyCommand`; dotychczasowe testy bez zmian. Gate: lint 0, tsc OK, front 662, back 79, build OK. Następne: F9-T4 (serwer WebSocket) - wymaga instalacji `ws` (zgoda D2) i `zod` jako zależności produkcyjnej serwera. · ab5b575
- 2026-10-31 · nadzorca · D3 · Stare D3 (Render Free) sprzeczne z D19 (Render usunięty, produkcja = statyczny frontend). Użytkownik wybrał self-host u gospodarza: frontend + WebSocket z jednego procesu Node, same-origin, CSP `connect-src 'self'` ustawiane przez serwer gry. Zaktualizowane opisy F9-T4..T7. Branch zsynchronizowany z `main` (D19). Następne: F9-T4. · —
- 2026-10-31 · nadzorca · D9, F9-T7 · Gra przez internet = tunel u gospodarza (Cloudflare quick tunnel bez konta domyślnie, ngrok alternatywnie), dopisane do D3 i F9-T7. Katalog serwerów jako osobny projekt zapisany jako D9, odłożony do decyzji po F9-T7. · —
- 2026-11-15 · nadzorca · F9-T4 · Serwer gry: `src_backend/game/gameServer.ts` (WebSocket `/ws` na serwerze HTTP, `Origin` = `Host`/`X-Forwarded-Host` albo `cors_origins`, inaczej 403; `maxPayload` 2 MB; 5 złych wiadomości = zamknięcie 1008; ping co 30 s) i `RoomManager.ts` (pokoje w pamięci, kody `MARS-XXXX` z `crypto`, max 4 graczy, max 20 pokoi, TTL 30 min bez komend/dołączeń, 5 komend/s + zapas 10, 5 nieudanych dołączeń = zamknięcie, tick 1/s, snapshot po ticku i po każdej przyjętej komendzie, błąd ticka zamyka tylko ten pokój, logi bez pseudonimów i kodów). Wspólne z klientem (F9-T5): `src/domain/network/NetworkProtocol.ts` (schematy zod wiadomości, stanu początkowego, siatki) i `RoomState.ts` (`toRoomStart`, `createRoomState`, `stepRoomState`, `applyRoomCommand`, `toSnapshot`). Stan początkowy wysyła gospodarz (`create_room`); encje sprawdzane co do kształtu i liczności (gospodarz zaufany, D3). Zależności prod: `ws` (zgoda D2), `zod` i `simplex-noise` przeniesione z dev (bundle serwera je importuje); `@types/ws` w dev. Pauza i prędkość w grze sieciowej poza zakresem (stały 1 tick/s). Gate: lint 0, tsc OK, front 656 (D19 usunął testy konfiguracji), back 109, build OK, smoke `dist_backend/index.js` (health 200, WebSocket odpowiada). Następne: F9-T5 (klient; w dev potrzebny proxy `/ws` w Vite albo `cors_origins=http://localhost:5173`). · —
- 2026-11-15 · nadzorca · F9-T5 · Klient gry sieciowej: `networkClient.ts` (`GameSocketClient`: kolejka do otwarcia, reconnect 1/2/4/8/8 s, bez ponawiania po 1008/4001; `gameSocketUrl`, `inviteLink` `/?join=KOD`, `checkGameServerAvailable` przez `/api/health`), `useNetworkStore` (utwórz/dołącz, gracze, błędy jako klucze i18n, po reconnect ponowne `join_room`), `useGameStore`: `remoteCommandSink` (komendy walidowane lokalnie i wysyłane, stan tylko ze snapshotów; bez lokalnego ticka i autozapisu), `enterNetworkGame`/`applyNetworkSnapshot`/`exitNetworkGame`. UI: `NetworkGameModal` (pseudonim, kod, „Utwórz pokój z bieżącej kolonii”), `NetworkRoomPanel` w HUD (kod, gracze, „Kopiuj link”, „Opuść”), przycisk „🌐 Zaproś” w HUD i „🌐 Gra sieciowa” na starcie - tylko gdy strona pochodzi z serwera gry; `?join=` otwiera modal. W grze sieciowej ukryta pauza/prędkość i „Wczytaj”. Po utracie połączenia gra toczy się dalej solo. Dev: proxy `/ws` w Vite. Poprawka serwera: SPA fallback przez `sendFile(..., { root })` (katalog z kropką w ścieżce dawał 404) + test. Test w przeglądarce (2 karty, `dist_backend` na :3917): utworzenie pokoju, dołączenie linkiem, zły kod = komunikat, synchronizacja zasobów i badania gościa u gospodarza, „Opuść”, restart serwera = powrót do solo; znaleziony i naprawiony nieklikalny panel (`.hud` ma `pointer-events: none`). Gate: lint 0, tsc OK, front 685, back 110, build OK. Następne: F9-T6. · —
