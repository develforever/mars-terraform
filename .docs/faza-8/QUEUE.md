# Faza 8 — Kolejka wykonawcza

> Jedyne źródło prawdy o postępie. Nadzorca aktualizuje ten plik i commituje go
> **po każdej zmianie statusu** (commit + push), żeby przerwana sesja nie gubiła stanu.

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
| T0b | Rotacja `turso_token`, `jwt_secret` (bez przepisywania historii, D4) | T0a | D4 ✔ | **człowiek** | — | HUMAN (odblokowane, T0a DONE) |
| T1 | Resolver `VITE_API_URL` + podmiana fetchy | — | — | general-purpose | `src/application/config/apiConfig.ts`, `src/vite-env.d.ts`, `mapApiService.ts`, `authService.ts`, `useGameStore.ts`, `LoadGameModal.tsx`, `ColonyNameModal.tsx` | DONE(fee17c2) |
| T2 | `createApp()` + CORS middleware | — | — | general-purpose | `src_backend/app.ts`, `src_backend/index.ts`, `src_backend/config.ts`, `src_backend/middleware/corsMiddleware.ts` | DONE(a90013f) |
| T3 | Tryb API-only + health z DB + `Vary: Origin` zawsze | T2 | — | general-purpose | `src_backend/app.ts`, `src_backend/config.ts`, `src_backend/middleware/corsMiddleware.ts` (+ testy) | IN_PROGRESS(session_01GsESbnJeEL2Fsy6vdhAQNk, 2026-09-24T16:57Z) |
| T4 | `Dockerfile.api` | T3 | — | general-purpose | `Dockerfile.api`, `*.dockerignore`, `Dockerfile` (komentarz) | TODO |
| T5 | `vercel.json` + test konfiguracji (bez proxy `/api`, D3 = CORS) | T1 | D3 ✔ | general-purpose | `vercel.json`, `src/test/vercelConfig.test.ts` | IN_PROGRESS(session_01GsESbnJeEL2Fsy6vdhAQNk, 2026-09-24T16:54Z) |
| T6 | Manifest Fly.io (`fly.toml`, bez wolumenu, D2 = Turso) | T4 | D1 ✔, D2 ✔ | general-purpose | `fly.toml` | TODO |
| T7 | Skrypt migracji produkcyjnych (Turso) | T4 | D2 ✔ | general-purpose | `src_backend/db/migrate.ts`, `vite.config.backend.ts`, `package.json` (scripts) | TODO |
| T8 | CI GitHub Actions | T4 | D5 ✔ | general-purpose | `.github/workflows/ci.yml` | TODO |
| T9 | Runbook + ROADMAP/CLAUDE.md + wdrożenie | T0b–T8 | — | general-purpose + **człowiek** | `.docs/faza-8/DEPLOYMENT.md`, `ROADMAP.md`, `CLAUDE.md` | TODO |

### Równoległość (macierz konfliktów)

- Fala 1 (równolegle, rozłączne pliki): **T0a ∥ T1 ∥ T2**
- Fala 2: **T3** (po T2) ∥ **T5** (po T1)
- Fala 3: **T4** (po T3)
- Fala 4 (równolegle): **T6 ∥ T7 ∥ T8** (po T4). Uwaga: T7 i T8 mogą oba dotykać `package.json`, więc T7 przed T8, jeśli T8 dodaje skrypty.
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

## Follow-upy (poza zakresem Fazy 8)

- Token JWT przekazywany w query string po OAuth (`AuthController.ts` → `/?token=`), do zmiany na fragment albo wymianę jednorazowego kodu.
- Wersjonowanie nazw assetów w `public/` (umożliwi `immutable` cache).
- Hardcodowane hosty ngrok w `vite.config.ts` `server.allowedHosts`.
- Rozjazd wersji Node: `.nvmrc` v25, `Dockerfile` node 24, backend target node22.
- `useGameStore.ts`: `/api/colony/${name}` bez `encodeURIComponent` (w `LoadGameModal.tsx` jest kodowane).
- Walidacja `VITE_API_URL` przy starcie aplikacji (dziś błędna wartość wychodzi dopiero przy pierwszym żądaniu).
- `.dockerignore` monolitu nie wyklucza `.env` / `local.db*` (T4 obejmie obraz API).
- `res.sendFile` w SPA fallbacku ignoruje dotfiles w ścieżce absolutnej (np. deploy w katalogu z `.` w nazwie → 404). Rozważyć `{ dotfiles: "allow" }` albo `root` w opcjach.
