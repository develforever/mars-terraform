# Faza 8 — Infrastruktura produkcyjna i hosting (plan wykonawczy)

> Plan jest trwały: żyje w repo, a stan wykonania w `QUEUE.md`. Każda nowa sesja
> (nadzorca albo człowiek) zaczyna od przeczytania tych dwóch plików. Nie trzymaj
> stanu w pamięci sesji. Jeśli czegoś nie ma w `QUEUE.md`, to się nie wydarzyło.

Pliki sterujące:

```
.docs/faza-8/
├── PLAN.md               # ten plik: cel, architektura, decyzje, opis zadań (rzadko się zmienia)
├── QUEUE.md              # kolejka: statusy, zależności, dziennik (zmienia się po każdym zadaniu)
└── SUPERVISOR_PROMPT.md  # prompt startowy nadzorcy + szablon promptu dla subagenta
```

---

## 1. Cel

Rozdzielenie monolitu (Express serwujący `dist/` + `/api`) na dwie niezależne części:

1. **Frontend**: statyczny build Vite na Vercel (SPA rewrites, cache dla `/models`, `/textures`, `/icons`, `/assets`).
2. **Backend API**: sam Node.js/TSOA w kontenerze na osobnej platformie, CORS, konfiguracja przez env.

Monolit musi dalej działać (lokalny dev i obecny `Dockerfile`). Zmiany są addytywne i sterowane zmiennymi środowiskowymi.

## 2. Stan wyjściowy (zweryfikowany 2026-09-24, commit `f119afb`)

| Obszar | Fakt | Konsekwencja |
|---|---|---|
| Frontend → API | Ścieżki względne `/api/...`, rozsiane po 5 plikach: `application/service/mapApiService.ts`, `application/service/authService.ts`, `application/store/useGameStore.ts` (2×), `presentation/components/game/LoadGameModal.tsx` (2×), `presentation/components/game/ColonyNameModal.tsx` | Potrzebny jeden resolver bazowego URL (`VITE_API_URL`) |
| Auth | JWT jako `Authorization: Bearer`, token w `localStorage`, bez cookies | CORS bez `credentials`, bez CSRF na cookies, prosty allowlist originów |
| Backend entry | `src_backend/index.ts`: `app.listen()` na poziomie modułu, static `../dist` + SPA fallback zawsze włączone | Trzeba wydzielić `createApp()` (testowalność) i flagę serwowania frontendu |
| CORS | Brak (nie ma paczki `cors` ani własnego middleware) | Własny middleware (bez nowej paczki npm, zgodnie z RULES) |
| Config | `src_backend/config.ts`: klucze snake_case (`turso_url`, `jwt_secret`, `frontend_url`, `backend_url`, `PORT`) | Nowe klucze w tej samej konwencji: `cors_origins`, `serve_frontend` |
| OAuth | Redirect na `${frontend_url}/?token=...`, callback na `${backend_url}/api/auth/*/callback` | W produkcji `frontend_url` = domena Vercel, `backend_url` = domena API |
| DB | libsql/Turso (`@libsql/client`), fallback `file:./local.db`; migracje `drizzle/0000..0001` | Z Turso trwały wolumen nie jest potrzebny (decyzja D2) |
| Docker | `Dockerfile` buduje front+back, komentarz o `fly.toml` (pliku brak w repo) | Nowy `Dockerfile.api` tylko dla backendu; stary zostaje dla monolitu |
| **Sekrety** | **`.env` jest ŚLEDZONY w gicie** (jest w `.gitignore`, ale dodany wcześniej); zawiera `turso_url`, `turso_token`, `jwt_secret` | **P0: rotacja sekretów + `git rm --cached .env`** przed jakimkolwiek wdrożeniem |
| CI | Brak `.github/workflows` | Opcjonalne (decyzja D5) |
| Assety | `public/textures` 68 MB, `public/models` 4.5 MB, nazwy bez hasha | Cache z `max-age` + `stale-while-revalidate`, nie `immutable` (poza `/assets/*` z Vite) |
| Node | `.nvmrc` = v25, Dockerfile = `node:24-alpine`, backend target `node22` | Ujednolicić do jednej wersji LTS w obrazie API (bez zmiany `.nvmrc` bez zgody) |

## 3. Decyzje (wymagają użytkownika, nadzorca NIE zgaduje)

| ID | Pytanie | Rekomendacja | Blokuje |
|---|---|---|---|
| D1 | Platforma backendu: Render / Railway / Fly.io? | **Fly.io** (Dockerfile już o niej wspomina, region `waw`/`fra`) | T6 (manifest platformy), T9 |
| D2 | Baza: zostaje Turso (zdalny libsql) czy SQLite na wolumenie? | **Turso**: brak wolumenu, backend bezstanowy, skalowanie poziome | T6, T7 |
| D3 | Routing API z Vercel: bezpośrednio `VITE_API_URL` + CORS, czy rewrite `/api/*` na Vercel (proxy, same-origin)? | **Bezpośrednio + CORS** (zgodnie z roadmapą); proxy jako fallback opisany w runbooku | T5 |
| D4 | Wyczyścić `.env` z historii gita (`git filter-repo`, force-push na `main`)? | **Rotacja wystarczy**; przepisanie historii tylko na wyraźne polecenie | T0 (część b) |
| D5 | Dodać workflow CI (lint + typecheck + testy + build) w GitHub Actions? | **Tak**, osobne zadanie T8 | T8 |

Odpowiedzi zapisuj w `QUEUE.md` → sekcja „Decyzje”. Zadanie zablokowane decyzją ma status `BLOCKED(Dx)`.

## 4. Architektura docelowa

```
Przeglądarka
  │  GET /, /generate, /mars, /models/*, /textures/*   ──►  Vercel CDN (dist/, vercel.json)
  │  fetch(apiUrl("/api/..."))  Authorization: Bearer   ──►  API (Dockerfile.api, serve_frontend=false)
  │                                                           │  CORS allowlist = cors_origins
  │                                                           ▼
  │                                                        Turso (libsql)
  └─ OAuth: API /api/auth/*/callback ──302──► ${frontend_url}/?token=...
```

Kontrakt konfiguracji:

| Zmienna | Gdzie | Domyślnie | Prod |
|---|---|---|---|
| `VITE_API_URL` | build frontendu (Vercel) | `""` (ścieżki względne → dev proxy / monolit) | `https://api.<domena>` bez końcowego `/` |
| `cors_origins` | backend | `""` = CORS wyłączony (monolit same-origin) | `https://<app>.vercel.app,https://<domena>` |
| `serve_frontend` | backend | `true` (zachowanie obecne) | `false` |
| `frontend_url` / `backend_url` | backend | jak dziś | domeny prod |
| `turso_url`, `turso_token`, `jwt_secret` | backend | jak dziś | sekrety platformy, NIGDY w repo |

## 5. Zadania (szczegóły; statusy w `QUEUE.md`)

Konwencja: każde zadanie kończy się zielonym **Gate** (sekcja 6), jednym commitem
`feat(infra): ...` / `fix(security): ...` na branchu roboczym i aktualizacją `QUEUE.md`.

### T0 — P0 Bezpieczeństwo: sekrety poza repo
- a) `git rm --cached .env`, dodać `.env.example` z KLUCZAMI bez wartości (wszystkie klucze z `src_backend/config.ts` + `VITE_API_URL`), sprawdzić, czy `.gitignore` obejmuje `.env` i `local.db`.
- b) **Człowiek**: rotacja `turso_token` (Turso dashboard) i `jwt_secret` (unieważnia sesje). Przepisanie historii tylko po decyzji D4.
- Akceptacja: `git ls-files .env` puste; `.env.example` kompletne względem `config.ts`; lokalny dev dalej czyta `.env` z dysku.
- Pliki: `.env` (untrack), `.env.example` (nowy), `.gitignore`.

### T1 — Frontend: jeden resolver URL API
- Nowy `src/application/config/apiConfig.ts`: `getApiBaseUrl(): string` (z `import.meta.env.VITE_API_URL`, trim, bez końcowego `/`, walidacja przez `URL` z czytelnym błędem) i `apiUrl(path: `/api/${string}`): string`.
- Typ `VITE_API_URL` w `src/vite-env.d.ts` (`ImportMetaEnv`).
- Podmienić WSZYSTKIE wywołania z tabeli w sekcji 2 (`grep -rn '"/api\|`/api' src` ma zwracać tylko `apiConfig.ts` i testy).
- Testy Vitest: pusty env → ścieżka względna; URL z `/` na końcu; niepoprawny URL → błąd.
- Pliki: `apiConfig.ts` (+ `.test.ts`), 5 plików konsumentów, `vite-env.d.ts`.

### T2 — Backend: `createApp()` + middleware CORS
- Rozdzielić `src_backend/index.ts` na `src_backend/app.ts` (`createApp(options): Express`, bez `listen`) i `index.ts` (tylko `listen`).
- `src_backend/middleware/corsMiddleware.ts` (bez paczki `cors`): allowlist z `config.corsOrigins: readonly string[]` (parsowane z `cors_origins`, CSV, trim, walidacja `URL.origin`); dokładne dopasowanie originu (bez wildcardów i odbijania dowolnego originu); `Vary: Origin`; preflight `OPTIONS` → 204 z `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`, `Allow-Headers: Authorization, Content-Type`, `Max-Age: 600`; BEZ `Allow-Credentials`; origin spoza listy → brak nagłówków CORS (przeglądarka blokuje), preflight → 403.
- Kolejność: CORS przed `express.json()` i `RegisterRoutes`.
- Testy `vitest.config.backend.ts`: dozwolony / niedozwolony origin, preflight, pusta lista = brak nagłówków. Bez supertest (nie instalujemy paczek): `app.listen(0)` + `fetch` z Node albo testy jednostkowe middleware na mockach `Request/Response`.
- Pliki: `app.ts` (nowy), `index.ts`, `config.ts`, `middleware/corsMiddleware.ts` (+ test).

### T3 — Backend: tryb API-only
- `config.serveFrontend: boolean` z `serve_frontend` (domyślnie `true`; parsowanie `"false"|"0"` → false).
- Gdy `false`: brak `express.static` i SPA fallbacku; nieznane ścieżki → JSON 404 `{ error: "Not Found" }`.
- `/api/health` zwraca `{ status: "ok", version }` i sprawdza DB (`select 1`, timeout; błąd → 503). Bez wycieku szczegółów błędu w produkcji.
- Error handler: w `NODE_ENV=production` dla 5xx zwraca ogólny komunikat, pełny błąd tylko w logu.
- CORS: przy niepustej allowliście `Vary: Origin` na KAŻDEJ odpowiedzi (także bez `Origin` i z niedozwolonym originem), żeby współdzielony cache nie serwował odpowiedzi z nagłówkiem CORS innemu originowi.
- Testy dla obu trybów + health (DB OK / DB error przez wstrzyknięcie zależności).
- Pliki: `app.ts`, `config.ts`, `middleware/corsMiddleware.ts`, testy.
- Zależność: T2 (ten sam plik `app.ts`).

### T3b — Backend: błędy biznesowe jako 4xx (dodane w trakcie, po T3)
- Problem: serwisy/kontrolery rzucają zwykły `Error` („Invalid credentials”, „User not found”…) → status 500; po T3 w produkcji klient dostaje „Internal Server Error” (regresja UX logowania, rejestracji, map).
- `src_backend/errors/HttpError.ts`: `class HttpError extends Error { constructor(readonly status: 400|401|403|404|409|422|429, message: string) }` + ewentualne fabryki (`badRequest`, `unauthorized`, `notFound`, `conflict`). Error handler z T3 już czyta `status`, więc nie wymaga zmian.
- Przejrzeć każdy `throw new Error` w: `service/{MapService,authService,emailService,oauthService}.ts`, `controller/{Users,Auth,Groups}Controller.ts`. Błąd wywołany przez klienta → `HttpError` z właściwym kodem. Błąd infrastruktury (brak konfiguracji SMTP, awaria providera OAuth) zostaje 5xx. Komunikaty bez zmian (frontend może je wyświetlać). Nie ujawniać, czy e-mail istnieje, tam, gdzie dziś nie jest ujawniany.
- Logowanie: zły login/hasło → 401 z tym samym komunikatem dla obu przypadków (bez enumeracji użytkowników).
- Testy: istniejące testy serwisów + asercje statusów; integracyjnie przez `createApp` (np. login ze złym hasłem → 401 w trybie `isProduction=true`).
- Zależność: T3.

### T3c — Backend: anty-enumeracja kont (po T3b, decyzja D12)
- Login: najpierw weryfikacja hasła (bcrypt), dopiero potem „Email not verified” (403). Nieistniejący użytkownik albo złe hasło → ten sam 401 „Invalid credentials”.
- Stały czas: dla nieistniejącego użytkownika / braku metody lokalnej wykonaj `bcrypt.compare` na stałym, poprawnym hashu-atrapie (wyliczonym raz przy starcie modułu, koszt jak w rejestracji).
- `resend-verification`: zawsze 200 z tym samym ogólnym komunikatem (np. „If the account exists and is unverified, a verification email has been sent.”), niezależnie od istnienia konta i stanu weryfikacji; e-mail wysyłany tylko, gdy konto istnieje i nie jest zweryfikowane.
- `forgot-password`: sprawdzić, że już nie ujawnia istnienia konta (jeśli ujawnia, to samo podejście).
- Rejestracja 409 „already exists” zostaje (akceptowane, typowe; zapisać jako znane ryzyko).
- Frontend: sprawdzić, czy `src/application/service/authService.ts` / UI zależy od 404/409 z resend; dostosować tylko, jeśli coś się psuje.
- Testy: kolejność sprawdzeń (niezweryfikowany + złe hasło → 401, niezweryfikowany + dobre hasło → 403), resend dla nieistniejącego / zweryfikowanego / niezweryfikowanego konta → 200 i ten sam body; bcrypt wywołany także dla nieistniejącego użytkownika (spy).

### T4 — Backend: obraz `Dockerfile.api`
- Multi-stage: `npm ci` → `npm run build:back` (BEZ builda frontendu) → `npm prune --omit=dev` → runtime `node:<LTS>-alpine`, `USER node`, `NODE_ENV=production`, `serve_frontend=false`, `EXPOSE 8080`, `HEALTHCHECK` na `/api/health`, `CMD ["node","dist_backend/index.js"]` (bez `npm` jako PID 1).
- `bcrypt` = natywny moduł: toolchain tylko w stage build, zgodna libc między stage'ami.
- Obraz nie może zawierać `.env`, `local.db`, `public/`, `dist/` → osobny `.dockerignore` (`Dockerfile.api.dockerignore`, BuildKit) albo weryfikacja istniejącego.
- Nie ruszać istniejącego `Dockerfile` (monolit), poza poprawką mylącego komentarza o `fly.toml`.
- Akceptacja: `docker build -f Dockerfile.api .` przechodzi (jeśli Docker jest dostępny; jeśli nie, zapisać w dzienniku jako NIEZWERYFIKOWANE); kontener startuje z `jwt_secret` + `turso_url=file:/tmp/x.db`, `/api/health` = 200.
- Zależność: T3.

### T5 — Frontend: `vercel.json`
- `buildCommand`: `tsc -b && vite build` (NIE `npm run build`, bo ten buduje też backend), `outputDirectory`: `dist`, `framework`: `vite`.
- Rewrites: SPA fallback `/(.*)` → `/index.html` (pliki statyczne mają pierwszeństwo na Vercel). Przy D3 = proxy dodatkowo `/api/(.*)` → `${API}/api/$1` przed fallbackiem.
- Headers:
  - `/assets/(.*)` → `public, max-age=31536000, immutable` (hashowane przez Vite)
  - `/(models|textures|icons)/(.*)` → `public, max-age=86400, stale-while-revalidate=604800` (nazwy bez hasha)
  - `/index.html` i `/` → `no-cache`
  - globalnie: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy`. CSP w trybie `Content-Security-Policy-Report-Only` (`connect-src 'self' <API>`), bo Three.js/shadery wymagają weryfikacji przed trybem enforce.
- Test Vitest: parsuje `vercel.json` i sprawdza kluczowe reguły (regresja konfiguracji).
- `vite.config.ts`: usunąć hardcodowane hosty ngrok z `allowedHosts` tylko jeśli użytkownik potwierdzi (zapisać pytanie w dzienniku, NIE usuwać samodzielnie).
- Zależność: T1, decyzja D3.

### T6 — Backend: manifest platformy
- Zależnie od D1: `fly.toml` / `render.yaml` / `railway.json`, wskazujący `Dockerfile.api`, health check `/api/health`, port 8080, sekrety przez panel/CLI (w manifeście tylko NAZWY). Przy D2 = SQLite: wolumen montowany pod `/data`, `turso_url=file:/data/mars.db`.
- Migracje: `release_command` / pre-deploy = `npx drizzle-kit migrate` (wymaga `drizzle-kit` w obrazie; jeśli jest devDependency, rozwiązać przez osobny stage `migrate` albo skrypt migracji na `drizzle-orm/libsql/migrator`, bez nowych paczek).
- Zależność: T4, D1, D2.

### T7 — Migracje produkcyjne (skrypt)
- `src_backend/db/migrate.ts`: `migrate(db, { migrationsFolder })` z `drizzle-orm/libsql/migrator`, obsługa błędów, exit code ≠ 0 przy błędzie; skrypt `db:migrate:prod` w `package.json` (uruchamia zbudowany plik, nie `tsx`).
- `vite.config.backend.ts`: drugi entry `migrate` albo osobny build. Folder `drizzle/` kopiowany do obrazu.
- Test: migracja na `file::memory:` / tmp-pliku tworzy tabele ze `schema.ts`.
- Zależność: T4 (obraz), D2.

### T8 — CI (GitHub Actions) — tylko przy D5 = tak
- `.github/workflows/ci.yml`: `npm ci`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run test`, `npm run build`, (opcjonalnie) `docker build -f Dockerfile.api`. Node 24 (wersja produkcyjna obrazu; `.nvmrc` v25 nie jest LTS). Bez sekretów; backend testy na `file::memory:` + testowy `jwt_secret` w env joba.
- Zależność: T4.

### T9 — Wdrożenie + dokumentacja
- `.docs/faza-8/DEPLOYMENT.md` (runbook): ustawienie sekretów, pierwsze wdrożenie API, migracje, ustawienie `VITE_API_URL` na Vercel, `cors_origins`, OAuth redirect URI w Google/GitHub, rollback, smoke test (health, rejestracja, zapis mapy, `/generate` i `/mars` z CDN).
- **Człowiek**: założenie kont, podpięcie repo do Vercel, `fly launch`/Render i ustawienie sekretów. Agent NIE wykonuje wdrożeń na zewnętrzne usługi bez wyraźnej zgody.
- Aktualizacja `ROADMAP.md` i `CLAUDE.md` (Faza 8 → zrobione, liczba testów).
- Obowiązkowa weryfikacja na pierwszym preview deployu Vercel: `curl -I` dla `/`, `/generate`, `/assets/<hash>.js`, `/textures/2k_mars.jpg`. Oczekiwane `Cache-Control`: no-cache / no-cache / immutable / SWR. Jeśli Vercel stosuje „pierwsza reguła wygrywa”, odwróć kolejność reguł w `vercel.json` i zaktualizuj test.
- Zależność: wszystkie poprzednie.

## 6. Gate (definicja „zrobione” dla każdego zadania)

```bash
npm ci                                   # tylko raz na sesję, jeśli brak node_modules
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run test:front
npm run test:back
npm run build
```

Wymagania: 0 błędów lint, 0 błędów tsc, wszystkie testy zielone i liczba testów ≥ baseline z `QUEUE.md`,
build przechodzi. Gdy gate nie przechodzi z powodu problemu istniejącego na baseline, zapisz to w dzienniku
z dowodem (ten sam błąd na `f119afb`) i nie maskuj go.

## 7. Ryzyka

| Ryzyko | Mitygacja |
|---|---|
| Wyciek sekretów z historii gita | T0 + rotacja; D4 |
| Token JWT w query string po OAuth (`/?token=`) trafia do historii przeglądarki i logów Vercel | Poza zakresem Fazy 8; zapisać jako follow-up (fragment `#token=` albo one-time code exchange) |
| `bcrypt` na alpine (musl) nie działa w runtime | Build i runtime na tej samej bazie; smoke test kontenera w T4 |
| 68 MB tekstur bez hasha a długi cache daje nieświeże assety po zmianie | `max-age=1d` + SWR; dla długiego cache: wersjonowanie nazw (follow-up) |
| Równoległe subagenty edytują te same pliki | Macierz konfliktów w `QUEUE.md`; równolegle tylko zadania o rozłącznych plikach, w worktree |
| Zmiana `index.ts` psuje dev (`tsx watch`) | Smoke: `npx tsx --tsconfig src_backend/tsconfig.json src_backend/index.ts` (bez `--tsconfig` dekoratory TSOA nie działają) + `/api/health` |
