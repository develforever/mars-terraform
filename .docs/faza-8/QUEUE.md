# Faza 8 — Kolejka wykonawcza

> Jedyne źródło prawdy o postępie. Nadzorca aktualizuje ten plik i commituje go
> **po każdej zmianie statusu** (commit + push), żeby przerwana sesja nie gubiła stanu.

**STATUS KOLEJKI: AKTYWNA** (wznowiona 2026-09-26T06:20Z)

Branch roboczy: `claude/compassionate-hawking-nc14kk` (bazuje na `main` @ `f119afb`)
Baseline (zmierzony 2026-09-24T16:46Z, HEAD `0b7499c`, Node v22.22.2): **573 front / 33 back / 606 razem**, lint 0, tsc 0, build OK.

## Statusy

`TODO` · `READY` (zależności spełnione) · `IN_PROGRESS(<session>, <UTC ISO>)` · `REVIEW` (gate zielony, czeka na review nadzorcy) ·
`DONE(<sha>)` · `BLOCKED(<powód lub Dx>)` · `HUMAN` (akcja człowieka) · `SKIPPED(<powód>)`

Wpis `IN_PROGRESS` starszy niż 2 h bez commita = porzucony. Nadzorca sprawdza `git log`/`git status`,
zapisuje ustalenia w dzienniku i ustawia z powrotem `READY` (albo `REVIEW`, jeśli praca jest kompletna).

## Kolejka

| ID | Zadanie | Zależy od | Decyzja | Agent | Pliki (zakres wyłączny) | Status |
|----|---------|-----------|---------|-------|--------------------------|--------|
| T0a | Untrack `.env` + `.env.example` | — | — | general-purpose | `.env`, `.env.example`, `.gitignore` | DONE(17c32ee) |
| T0b | Rotacja `turso_token`, `jwt_secret` (bez przepisywania historii, D4) | T0a | D4 ✔ | **człowiek** | — | DONE(człowiek, 2026-09-26: stare tokeny Turso unieważnione, nowy token i nowy `jwt_secret` w lokalnym `.env`) |
| T1 | Resolver `VITE_API_URL` + podmiana fetchy | — | — | general-purpose | `src/application/config/apiConfig.ts`, `src/vite-env.d.ts`, `mapApiService.ts`, `authService.ts`, `useGameStore.ts`, `LoadGameModal.tsx`, `ColonyNameModal.tsx` | DONE(fee17c2) |
| T2 | `createApp()` + CORS middleware | — | — | general-purpose | `src_backend/app.ts`, `src_backend/index.ts`, `src_backend/config.ts`, `src_backend/middleware/corsMiddleware.ts` | DONE(a90013f) |
| T3 | Tryb API-only + health z DB + `Vary: Origin` zawsze | T2 | — | general-purpose | `src_backend/app.ts`, `src_backend/config.ts`, `src_backend/middleware/corsMiddleware.ts` (+ testy) | DONE(06cc25c) |
| T3b | Błędy biznesowe → 4xx (`HttpError`), bez 500 dla złego hasła itp. | T3 | — | general-purpose | `src_backend/errors/HttpError.ts` (nowy), `src_backend/service/{MapService,authService,emailService,oauthService}.ts`, `src_backend/controller/{Users,Auth,Groups}Controller.ts` + testy | DONE(75eb09e) |
| T3c | Anty-enumeracja kont: login (hasło przed „Email not verified”), `resend-verification` zawsze 200, stały czas (dummy bcrypt) | T3b | D12 ✔ | general-purpose | `src_backend/service/authService.ts` (+ test), `src_backend/app.test.ts`, `src/application/service/authService.ts` tylko jeśli frontend zależy od 404/409 | DONE(e2f92ff) |
| T4 | `Dockerfile.api` | T3 | — | general-purpose | `Dockerfile.api`, `*.dockerignore`, `Dockerfile` (komentarz) | DONE(c69dfd8; obraz zweryfikowany w CI run #1 36224020817) |
| T4b | Odchudzenie prod deps: paczki tylko frontendowe → `devDependencies` | T4 | zgoda ✔ | general-purpose | `package.json` (sekcje deps), `package-lock.json` | DONE(cf5d07b) |
| T4c | `tsoa` → `@tsoa/runtime` w prod (importy kontrolerów), usunięcie `@tursodatabase/database` | T3b, T7b, T3c | D6 ✔, D7 ✔ | general-purpose | `package.json`, `package-lock.json`, `src_backend/controller/*.ts`, `src_backend/middleware/*.ts` | DONE(39832c4) |
| T4d | Regeneracja `routes.ts`/`swagger.json` (brak `minerals` → 400 przy zapisie kolonii przez `throw-on-extras`) + krok CI wykrywający nieaktualne trasy TSOA + test zapisu kolonii | T4c | — | general-purpose | `src_backend/routes/routes.ts`, `src_backend/api/swagger.json`, `.github/workflows/ci.yml`, test backendu | DONE(b858704) |
| T4e | Zapis kolonii działa end-to-end: kontrakt `state` vs realny payload `useGameStore.saveGame` (19 nadmiarowych pól) + limit rozmiaru body (`express.json` domyślnie 100 kB); odwrócić `it.fails` w `src_backend/test/colony.test.ts` | T4d | D13 | general-purpose | `src_backend/model/types.ts`, `src_backend/controller/ColonyController.ts`, `routes.ts`/`swagger.json` (tsoa:gen), `src_backend/app.ts` (limit), testy | DONE(48ade4e) |
| T4f | Lekka lista kolonii: `GET /api/colony` → `{id,name,createdAt,updatedAt}[]` (SELECT tylko tych kolumn); `GET /api/colony/{name}` bez zmian; `encodeURIComponent` w `useGameStore.loadGame` | T4e | D14 ✔ | general-purpose | `src_backend/model/types.ts`, `src_backend/controller/ColonyController.ts`, `src_backend/service/ColonyService.ts`, `routes.ts`/`swagger.json` (tsoa:gen), `src_backend/test/colony.test.ts`, `src/presentation/components/game/LoadGameModal.tsx` (typ), `src/application/store/useGameStore.ts` (URL) | DONE(b1a5462) |
| T5 | `vercel.json` + test konfiguracji (bez proxy `/api`, D3 = CORS) | T1 | D3 ✔ | general-purpose | `vercel.json`, `src/test/vercelConfig.test.ts` | DONE(33999eb) |
| T6 | Manifest Fly.io (`fly.toml`, bez wolumenu, D2 = Turso) | T4 | D1 ✔, D2 ✔ | general-purpose | `fly.toml` | DONE(40a4822) |
| T7 | Skrypt migracji produkcyjnych (Turso) | T4, T4b | D2 ✔ | general-purpose | `src_backend/db/migrate.ts`, `vite.config.backend.ts`, `package.json` (scripts) | DONE(b75b526) |
| T7b | Naprawa rozjazdu migracji: brak `maps` w migracjach, `0001_colonies.sql` poza journalem; test: wszystkie tabele `schema.ts` po migracji | T7 | D10, D11 | general-purpose | `drizzle/**`, `src_backend/db/migrate.test.ts`, (D10) `package.json`/`package-lock.json` (drizzle-kit) | DONE(bf8fc77) |
| T8 | CI GitHub Actions | T4 | D5 ✔ | general-purpose | `.github/workflows/ci.yml` | DONE(fea5646; CI run #1 zielony: verify + docker-api) |
| T9 | Runbook + ROADMAP/CLAUDE.md + wdrożenie | T0b–T8, T3b, T3c, T4c, T4d, T4e, T7b | — | general-purpose + **człowiek** | `.docs/faza-8/DEPLOYMENT.md`, `ROADMAP.md`, `CLAUDE.md` | IN_PROGRESS(session_01GsESbnJeEL2Fsy6vdhAQNk, 2026-09-26T07:04Z; część dokumentacyjna; wdrożenie = człowiek) |

### Równoległość (macierz konfliktów)

- Fala 1 (równolegle, rozłączne pliki): **T0a ∥ T1 ∥ T2**
- Fala 2: **T3** (po T2) ∥ **T5** (po T1)
- Fala 3: **T4 ∥ T3b** (po T3, rozłączne pliki)
- Fala 4 (równolegle): **T4b ∥ T6 ∥ T8** (T4 w REVIEW, bo obraz weryfikuje CI z T8). Potem **T7** (po T4b, wspólny `package.json`). T8 nie dotyka `package.json`.
- Fala 4b: **T4c** (po T3b i T7: wspólne pliki kontrolerów i `package.json`)
- Fala 4c: **T3c ∥ T8** (rozłączne pliki), potem **T4c** (po T3c: możliwe wspólne pliki auth)
- Fala 5: **T9**

Zadania ze wspólnym plikiem NIGDY nie idą równolegle. Równoległe subagenty pracują w `isolation: "worktree"`,
a nadzorca scala ich commity na branch roboczy po kolei i po każdym scaleniu uruchamia gate.

## Decyzje

| ID | Odpowiedź | Data | Kto |
|----|-----------|------|-----|
| D1 | Fly.io | 2026-09-24 | użytkownik |
| D2 | Turso (bez wolumenu) | 2026-09-24 | użytkownik |
| D3 | Bezpośrednio `VITE_API_URL` + CORS (bez proxy na Vercel) | 2026-09-24 | użytkownik |
| D4 | Tylko rotacja sekretów, bez przepisywania historii gita | 2026-09-24 | użytkownik |
| D5 | Tak, CI w GitHub Actions (T8) | 2026-09-24 | użytkownik |
| D6 | Tak: `@tsoa/runtime` jako zależność prod zamiast `tsoa` (tsoa → dev) | 2026-09-24 | użytkownik |
| D7 | Usunąć nieużywany `@tursodatabase/database` | 2026-09-24 | użytkownik |
| D8 | Fly: region `fra`, `min_machines_running = 0` | 2026-09-24 | użytkownik |
| D9 | Weryfikacja obrazu API w CI (job `docker-api`, T8) zamiast w sesji | 2026-09-24 | użytkownik |
| D10 | Tak: aktualizacja `drizzle-kit` 0.18.1 → 0.31.x | 2026-09-24 | użytkownik |
| D12 | Tak: T3c, poprawki anty-enumeracji (zmiana zachowania API) | 2026-09-26 | użytkownik |
| D13 | (c) `state` kolonii jako otwarty obiekt JSON z limitem rozmiaru; walidacja stanu po stronie frontendu przy wczytaniu | 2026-09-26 | użytkownik („cc” odczytane jako c) |
| D14 | Tak: lekka lista kolonii bez `state` (zmiana kontraktu API; jedyny konsument w repo, `LoadGameModal`, nie używa `state`) | 2026-09-26 | użytkownik |
| D11 | Produkcyjna baza Turso powstała przez `drizzle-kit push` (brak `__drizzle_migrations`), więc baseline wymagany przed 1. deployem (runbook T9). Obecność `maps`/`colonies` do sprawdzenia `.tables` | 2026-09-24 | użytkownik |

## Dziennik

Format: `YYYY-MM-DD HH:MM UTC · <session/agent> · <ID> · <zdarzenie> · <sha/uwagi>`

- 2026-09-24 · plan · — · Utworzono PLAN.md / QUEUE.md / SUPERVISOR_PROMPT.md. Odkryto śledzony `.env` z sekretami (P0 → T0). · 2cba36c
- 2026-09-24 · plan · — · Użytkownik podjął decyzje D1–D5; T5–T8 odblokowane (TODO, czekają tylko na zależności). · 0b7499c
- 2026-09-24T16:46Z · nadzorca · — · Baseline gate zielony (606 testów). Start fali 1: T0a ∥ T1 ∥ T2 (worktree). · —
- 2026-09-24T16:54Z · nadzorca · T0a · Scalono (cherry-pick z worktree). Gate: 573/33, lint/tsc/build OK. `.env` zostaje lokalnie, ignorowany. · 17c32ee
- 2026-09-24T16:54Z · nadzorca · T1 · Scalono. Gate: 591 front (+18) / 33 back, lint/tsc/build OK. Odstępstwo: sprawdzenie grep zastąpione typem `ApiPath` (uzasadnione). · fee17c2
- 2026-09-24T16:54Z · nadzorca · T5 · Start (zależność T1 DONE). Uwaga: worktree agentów bazują na `main` (f119afb), więc scalanie przez cherry-pick. · —
- 2026-09-24T16:57Z · nadzorca · T2 · Scalono. Gate: 591 front / 55 back (+22), lint/tsc(app+backend)/build OK, smoke CORS OK. Zakres T3 rozszerzony o `Vary: Origin` na wszystkich odpowiedziach przy niepustej allowliście (poprawność cache CDN). · a90013f
- 2026-09-24T16:57Z · nadzorca · T3 · Start. Worktree resetowany do HEAD brancha roboczego (wymaga T2). · —
- 2026-09-24T17:01Z · nadzorca · T5 · Scalono. Gate: 601 front (+10) / 55 back, lint/tsc/build OK, `tsc -b && vite build` OK. Odstępstwa zaakceptowane: catch-all `/(.*)` z `no-cache` (reguły nagłówków dopasowują się przed rewrite), `connect-src` + `blob: data:` (GLTFLoader). Semantyka „ostatnia reguła wygrywa” NIEZWERYFIKOWANA (vercel.com zablokowane w sieci sesji), więc sprawdzenie w T9. · 33999eb
- 2026-09-24T17:06Z · nadzorca · T3 · Scalono. Gate: 601 / 102 back (+47), lint/tsc/build OK; smoke: API-only 404 JSON, health 200/503, 5xx w prod bez szczegółów. Odstępstwa zaakceptowane (`/api` → 404 JSON, `statusCode`, `headersSent`, opcja timeoutu). · 06cc25c
- 2026-09-24T17:06Z · nadzorca · T3b · NOWE zadanie: serwisy rzucają zwykły `Error` (np. „Invalid credentials”), więc 500, a po T3 w prod „Internal Server Error”. Regresja UX logowania przed wdrożeniem. Blokuje T9. · —
- 2026-09-24T17:06Z · nadzorca · T4, T3b · Start równoległy (worktree resetowane do HEAD brancha). · —
- 2026-09-24T17:15Z · nadzorca · T4 · Scalono. Gate: 601 / 102, lint/tsc/build OK. `docker build/run` NIEZWERYFIKOWANE (subagent: brak daemona; build nadzorcy przerwany przez użytkownika). Czeka na wybór: build w kontenerze sesji albo lokalnie na Docker Desktop. Otwarte: rozmiar obrazu (frontendowe paczki w `dependencies`, zmiana `package.json` wymaga zgody), brak handlera SIGTERM w `index.ts` (jest tini). · c69dfd8
- 2026-09-24T17:17Z · nadzorca · T4 · Próba `docker build` w sesji (lokalny dockerd): `apk` → HTTP 403 dla `dl-cdn.alpinelinux.org` (polityka sieci środowiska). Obejścia nie stosowano. Użytkownik może dodać domenę w ustawieniach środowiska. Weryfikacja obrazu przeniesiona do joba CI w T8. · —
- 2026-09-24T17:17Z · nadzorca · T4b · NOWE zadanie (zgoda użytkownika na zmianę `package.json`). · —
- 2026-09-24T17:17Z · nadzorca · T4b, T6, T8 · Start równoległy. · —
- 2026-09-24T17:32Z · nadzorca · T6 · Scalono. Gate: 613 (+12) / 102, lint/tsc/build OK. `fly config validate` NIEZWERYFIKOWANE (brak flyctl). Region `fra` (pewność co do `waw` niska), `ignorefile` do weryfikacji przy 1. deployu, `release_command` zakomentowany do T7. · 40a4822
- 2026-09-24T17:32Z · nadzorca · T4b · Scalono. Prod `node_modules` 437 → 93 MB, smoke prod deps OK (health, register/bcrypt, JWT 401). Gate po `npm ci`: 613 / 102, OK. · cf5d07b
- 2026-09-24T17:32Z · nadzorca · T4 · Użytkownik odblokował `dl-cdn.alpinelinux.org` (200). Docker Hub 429 (limit anonimowy w chmurze). Decyzja użytkownika: weryfikacja obrazu w CI (T8). · —
- 2026-09-24T17:32Z · nadzorca · — · Czeka na zgodę użytkownika: (1) `tsoa` → `@tsoa/runtime` w prod (93 → 54 MB, zmiana importów kontrolerów po T3b); (2) usunięcie nieużywanego `@tursodatabase/database`. · —
- 2026-09-24T17:36Z · nadzorca · — · Decyzje D6–D9 zapisane; nowe zadanie T4c (po T3b, T7). · —
- 2026-09-24T17:41Z · nadzorca · T7 · Scalono. Gate: 613 / 108 back (+6), lint/tsc/build OK. `dist_backend/{index,migrate}.js` + wspólny chunk. `release_command` aktywny w `fly.toml`. Migracja wymaga `jwt_secret` (config), do rozważenia po T3b. · b75b526
- 2026-09-24T17:41Z · nadzorca · T7b · BLOKER WDROŻENIA (zweryfikowany przez nadzorcę): journal zawiera tylko `0000` (6 tabel); `maps` bez migracji; `0001_colonies.sql` poza journalem, więc ignorowany. Świeża baza nie ma `maps`/`colonies`. Nowe zadanie T7b; czeka na D10, D11. · —
- 2026-09-24T17:42Z · nadzorca · T7b · D10 = tak, D11 = push. Start T7b (drizzle-kit 0.31.x + migracja 0001 z `maps`, `colonies`). · —
- 2026-09-24T17:45Z · nadzorca · — · PAUZA na polecenie użytkownika. Nowe zadania nie są uruchamiane, a wyniki nie są scalane. W toku (commity tylko lokalnie w worktree agentów, NIE na zdalnym branchu): T3b, T8, T7b. Przy wznowieniu w nowej sesji worktree nie będą dostępne, więc te 3 zadania trzeba uruchomić od nowa (ustawić READY). · —
- 2026-09-25T14:55Z · nadzorca · — · Wznowiono na polecenie użytkownika. · —
- 2026-09-25T14:55Z · nadzorca · T7b · Scalono. Gate po `npm ci`: 613 / 113 back (+5), lint/tsc/build OK, `drizzle-kit check`: OK. drizzle-kit 0.31.11. Runbook baseline: `.docs/faza-8/MIGRATIONS_BASELINE.md`. · bf8fc77
- 2026-09-25T14:55Z · nadzorca · T3b · Scalono (raport agenta nie dotarł; diff przejrzany przez nadzorcę). Gate: 613 / 132 back (+19), OK. Znalezione (istniejące wcześniej, nie z T3b): enumeracja kont: (1) login sprawdza „Email not verified” PRZED hasłem, (2) `resend-verification` zwraca 404/409 zależnie od konta, (3) brak stałego czasu (brak bcrypt dla nieistniejącego użytkownika). Propozycja: zadanie T3c, wymaga zgody (zmiana zachowania API). · 75eb09e
- 2026-09-25T14:55Z · nadzorca · — · PAUZA na polecenie użytkownika. · —
- 2026-09-26T06:20Z · nadzorca · — · Wznowiono. D12 = T3c tak. Brak aktywnych subagentów (ListAgents pusty); agent T8 nie żyje, szkic `ci.yml` (niezacommitowany) w `.claude/worktrees/agent-a057bcf42a98b50ec/.github/workflows/ci.yml`. Dodano procedurę handover (SUPERVISOR_PROMPT.md) i HANDOVER.md. · —
- 2026-09-26T06:20Z · nadzorca · T3c, T8 · Start równoległy. · —
- 2026-09-26T06:31Z · nadzorca · T8 · Scalono (restart ze szkicem). Gate: 613 / 132, OK; lokalnie `verify` bez `.env` + `drizzle-kit check` OK. `docker-api` NIEZWERYFIKOWANY lokalnie; 1. run po pushu zamknie T4 (D9). · fea5646
- 2026-09-26T06:31Z · nadzorca · T3c · Scalono. Gate: 613 / 142 back (+10). Login: hasło przed weryfikacją, dummy bcrypt; resend zawsze 200; forgot/resend: błąd SMTP → log + ten sam 200. Pozostałe ryzyka (follow-up): timing resend/forgot (await wysyłki tylko dla istniejących kont), rejestracja 409. · e2f92ff
- 2026-09-26T06:31Z · nadzorca · T4c · Start. · —
- 2026-09-26T06:40Z · nadzorca · T4, T8 · CI run #1 (https://github.com/develforever/mars-terraform/actions/runs/36224020817) zielony: verify + docker-api (build obrazu, migracja, health, 404 JSON, brak .env/src/public, non-root, stop < 5 s). T4 DONE. · 105ec1e
- 2026-09-26T06:40Z · nadzorca · T4c · Scalono po `npm ci`. Gate: 613 / 142, OK. Prod `node_modules` 93 → 54 MB (bez tsoa/@tsoa/cli/typescript). `tsoa:gen` działa z `@tsoa/runtime`. · 39832c4
- 2026-09-26T06:40Z · nadzorca · T4d · NOWE: `routes.ts` nieaktualny względem `model/types.ts` (brak `minerals` w `SavedResources`/`SavedCapacity`), a przy `noImplicitAdditionalProperties: throw-on-extras` frontend wysyła `resources`/`capacity` z `minerals`, więc zapis kolonii prawdopodobnie daje 400 (błąd sprzed Fazy 8). Start. · —
- 2026-09-26T06:48Z · nadzorca · T4d · Scalono. Gate: 613 / 144 + 1 `it.fails` (znany błąd zapisu, udokumentowany), `tsoa:gen` bez rozjazdu. Hipoteza potwierdzona (400 na `minerals`), ale pełny payload gry dalej daje 400: 19 pól spoza `SavedGameState` (`mapSeed`, `units`, `currentMapData`, `unlockedTechs`… oraz `placed[].level`, `weather.trajectories`). Zapis kolonii NIE działa (błąd sprzed Fazy 8). Nowe T4e, czeka na D13. · b858704
- 2026-09-26T06:54Z · nadzorca · T4e · D13 = c. Start. · —
- 2026-09-26T07:04Z · nadzorca · T4e · Scalono. Gate: 613 / 152 back, 0 `it.fails`, tsoa bez rozjazdu. `state` = `Record<string, unknown>` (tsoa odrzuca tablicę/null/prymityw → 400), round-trip deep-equal OK. Payload typowej gry ~146 kB (> domyślnych 100 kB express), najgorszy przypadek ~0.9 MB, więc limit 2 MB, 413 JSON. Zapis kolonii działa end-to-end. · 48ade4e
- 2026-09-26T07:04Z · nadzorca · T0b · Użytkownik: nowy token utworzony przez panel Turso i dodany do `.env`. · —
- 2026-09-26T07:04Z · nadzorca · T9 · Start (dokumentacja + runbook). · —
- 2026-09-26T07:06Z · nadzorca · T0b · Użytkownik potwierdził: stare tokeny Turso unieważnione, nowy token + nowy `jwt_secret` w `.env`. T0b DONE. · —
- 2026-09-26T07:07Z · nadzorca · T4f · D14 = tak. Start równolegle z T9 (rozłączne pliki). · —
- 2026-09-26T07:15Z · nadzorca · T4f · Scalono. Gate: 619 front (+6) / 166 back (+14), tsoa bez rozjazdu. Lista: `{id,name,createdAt,updatedAt}` (SELECT bez `state`), sortowanie `updatedAt` DESC, `id` DESC (nowe, zaakceptowane). Nazwy ze spacją, `/`, `?`, `#`, `%`, polskimi znakami: round-trip 200 (Express 5 dekoduje `%2F`). · b1a5462

## Follow-upy (poza zakresem Fazy 8)

- Token JWT przekazywany w query string po OAuth (`AuthController.ts` → `/?token=`), do zmiany na fragment albo wymianę jednorazowego kodu.
- Wersjonowanie nazw assetów w `public/` (umożliwi `immutable` cache).
- Hardcodowane hosty ngrok w `vite.config.ts` `server.allowedHosts`.
- Rozjazd wersji Node: `.nvmrc` v25, `Dockerfile` node 24, backend target node22.
- Walidacja `VITE_API_URL` przy starcie aplikacji (dziś błędna wartość wychodzi dopiero przy pierwszym żądaniu).
- `.dockerignore` monolitu nie wyklucza `.env` / `local.db*` (T4 obejmie obraz API).
- `res.sendFile` w SPA fallbacku ignoruje dotfiles w ścieżce absolutnej (np. deploy w katalogu z `.` w nazwie → 404). Rozważyć `{ dotfiles: "allow" }` albo `root` w opcjach.
- CSP: dodać `report-to` przed trybem enforce; zawęzić `connect-src https:` do domeny API po jej ustaleniu; uwzględnić `vercel.live` na preview.
- HSTS `includeSubDomains`: potwierdzić przed podpięciem domeny własnej.
- Graceful shutdown: handler SIGTERM/SIGINT w `src_backend/index.ts` (`server.close()`, zamknięcie klienta libsql).
- Odchudzenie obrazu API: paczki tylko frontendowe z `dependencies` do `devDependencies` (wymaga zgody, bo zmienia `package.json`).
- Monolit (`Dockerfile`) nie dostaje już `.env` w obrazie (`.dockerignore`), więc sekrety tylko przez zmienne środowiskowe.
- `/api/health` zależy od DB: awaria Turso → Fly oznacza maszyny jako unhealthy. Rozważyć rozdział liveness (proces) / readiness (DB).
- Limity concurrency Fly (100/150) oszacowane, nie zmierzone.
- Migracja z `file:` w produkcji tylko ostrzega (celowo, dla smoke testów kontenera).
- Timing resend/forgot-password zdradza istnienie konta (wysyłka awaitowana tylko dla istniejących); opcja: wysyłka w tle z logiem. Rejestracja: 409 przy zajętym e-mailu, 500 przy awarii SMTP po utworzeniu konta.
- Limit body 2 MB jest globalny (także `/api/maps`).
- `resumeLocalGame` bez try/catch.
- Brak walidacji nazwy kolonii przy zapisie (długość, znaki kontrolne).
