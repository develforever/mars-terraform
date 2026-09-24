# Faza 8 — Kolejka wykonawcza

> Jedyne źródło prawdy o postępie. Nadzorca aktualizuje ten plik i commituje go
> **po każdej zmianie statusu** (commit + push), żeby przerwana sesja nie gubiła stanu.

Branch roboczy: `claude/compassionate-hawking-nc14kk` (bazuje na `main` @ `f119afb`)
Baseline testów: `NIEZMIERZONY`. Nadzorca mierzy go w kroku 0 i wpisuje tutaj (front / back / razem).

## Statusy

`TODO` · `READY` (zależności spełnione) · `IN_PROGRESS(<session>, <UTC ISO>)` · `REVIEW` (gate zielony, czeka na review nadzorcy) ·
`DONE(<sha>)` · `BLOCKED(<powód lub Dx>)` · `HUMAN` (akcja człowieka) · `SKIPPED(<powód>)`

Wpis `IN_PROGRESS` starszy niż 2 h bez commita = porzucony. Nadzorca sprawdza `git log`/`git status`,
zapisuje ustalenia w dzienniku i ustawia z powrotem `READY` (albo `REVIEW`, jeśli praca jest kompletna).

## Kolejka

| ID | Zadanie | Zależy od | Decyzja | Agent | Pliki (zakres wyłączny) | Status |
|----|---------|-----------|---------|-------|--------------------------|--------|
| T0a | Untrack `.env` + `.env.example` | — | — | general-purpose | `.env`, `.env.example`, `.gitignore` | READY |
| T0b | Rotacja `turso_token`, `jwt_secret` | T0a | D4 | **człowiek** | — | HUMAN |
| T1 | Resolver `VITE_API_URL` + podmiana fetchy | — | — | general-purpose | `src/application/config/apiConfig.ts`, `src/vite-env.d.ts`, `mapApiService.ts`, `authService.ts`, `useGameStore.ts`, `LoadGameModal.tsx`, `ColonyNameModal.tsx` | READY |
| T2 | `createApp()` + CORS middleware | — | — | general-purpose | `src_backend/app.ts`, `src_backend/index.ts`, `src_backend/config.ts`, `src_backend/middleware/corsMiddleware.ts` | READY |
| T3 | Tryb API-only + health z DB | T2 | — | general-purpose | `src_backend/app.ts`, `src_backend/config.ts` | TODO |
| T4 | `Dockerfile.api` | T3 | — | general-purpose | `Dockerfile.api`, `*.dockerignore`, `Dockerfile` (komentarz) | TODO |
| T5 | `vercel.json` + test konfiguracji | T1 | D3 | general-purpose | `vercel.json`, `src/test/vercelConfig.test.ts` | BLOCKED(D3) |
| T6 | Manifest platformy API | T4 | D1, D2 | general-purpose | `fly.toml` / `render.yaml` / `railway.json` | BLOCKED(D1,D2) |
| T7 | Skrypt migracji produkcyjnych | T4 | D2 | general-purpose | `src_backend/db/migrate.ts`, `vite.config.backend.ts`, `package.json` (scripts) | BLOCKED(D2) |
| T8 | CI GitHub Actions | T4 | D5 | general-purpose | `.github/workflows/ci.yml` | BLOCKED(D5) |
| T9 | Runbook + ROADMAP/CLAUDE.md + wdrożenie | T0b–T8 | — | general-purpose + **człowiek** | `.docs/faza-8/DEPLOYMENT.md`, `ROADMAP.md`, `CLAUDE.md` | TODO |

### Równoległość (macierz konfliktów)

- Fala 1 (równolegle, rozłączne pliki): **T0a ∥ T1 ∥ T2**
- Fala 2: **T3** (po T2) ∥ **T5** (po T1 + D3)
- Fala 3: **T4** (po T3)
- Fala 4 (równolegle): **T6 ∥ T7 ∥ T8** (po T4 i decyzjach). Uwaga: T7 i T8 mogą oba dotykać `package.json`, więc T7 przed T8, jeśli T8 dodaje skrypty.
- Fala 5: **T9**

Zadania ze wspólnym plikiem NIGDY nie idą równolegle. Równoległe subagenty pracują w `isolation: "worktree"`,
a nadzorca scala ich commity na branch roboczy po kolei i po każdym scaleniu uruchamia gate.

## Decyzje

| ID | Odpowiedź | Data | Kto |
|----|-----------|------|-----|
| D1 | — | — | — |
| D2 | — | — | — |
| D3 | — | — | — |
| D4 | — | — | — |
| D5 | — | — | — |

## Dziennik

Format: `YYYY-MM-DD HH:MM UTC · <session/agent> · <ID> · <zdarzenie> · <sha/uwagi>`

- 2026-09-24 · plan · — · Utworzono PLAN.md / QUEUE.md / SUPERVISOR_PROMPT.md. Odkryto śledzony `.env` z sekretami (P0 → T0). · —

## Follow-upy (poza zakresem Fazy 8)

- Token JWT przekazywany w query string po OAuth (`AuthController.ts` → `/?token=`), do zmiany na fragment albo wymianę jednorazowego kodu.
- Wersjonowanie nazw assetów w `public/` (umożliwi `immutable` cache).
- Hardcodowane hosty ngrok w `vite.config.ts` `server.allowedHosts`.
- Rozjazd wersji Node: `.nvmrc` v25, `Dockerfile` node 24, backend target node22.
