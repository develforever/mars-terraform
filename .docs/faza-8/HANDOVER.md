# Handover nadzorcy — Faza 8

> Nadpisywany przy każdym przekazaniu (procedura: `SUPERVISOR_PROMPT.md` → „Przekazanie nadzoru”).
> Opisuje TYLKO bieżący stan. Szczegóły historii są w `QUEUE.md` → Dziennik.

Data (UTC): 2026-09-26 (stan po zakończeniu wszystkich zadań agentowych)
Branch: `claude/compassionate-hawking-nc14kk`

## Stan w skrócie
- DONE (agenci): T0a, T1, T2, T3, T3b, T3c, T4, T4b, T4c, T4d, T4e, T4f, T5, T6, T7, T7b, T8, T9 (dokumentacja)
- DONE (człowiek): T0b (stare tokeny Turso unieważnione, nowy token działa, nowy `jwt_secret`; sekrety w `.env.local`)
- W toku: brak. Aktywnych subagentów: brak.
- Pozostaje: wdrożenie produkcyjne przez człowieka wg `.docs/faza-8/DEPLOYMENT.md` (sekcje 2–6); nadzorca wspiera krok po kroku.
- Gate na HEAD: lint/tsc OK, front 619, back 166, build OK; CI run #1 zielony (verify + docker-api).

## Niescalone / w locie
Brak. Stare worktree `.claude/worktrees/agent-*` są już scalone (do usunięcia przy sprzątaniu).

## Czeka na użytkownika
- DEPLOYMENT.md §2: `db-inspect.mjs`, a potem wynik (lista tabel + stan `__drizzle_migrations`) wkleić nadzorcy; wybór wariantu A/B/C baseline.
- Scalenie brancha do `main` (PR) przed wdrożeniem (DEPLOYMENT.md §0).
- Otwarte pytanie: osobny `jwt_secret` dla produkcji i dla lokalnego dev (rekomendacja: tak).

## Pułapki środowiska (lekcje z sesji 1)
- **Worktree subagentów startują z `main` (f119afb), nie z HEAD brancha.** W prompcie subagenta zawsze KROK 0: `git fetch origin <branch> && git reset --hard FETCH_HEAD`. Wymaga wcześniejszego push stanu.
- **Cherry-pick commita, który robi `git rm --cached .env`, kasuje `.env` z dysku.** Przed takim scaleniem zrób kopię i ją przywróć (tak zrobiono dla T0a).
- **Po zmianie `package-lock.json` zrób `npm ci` w głównym checkoucie przed Gate.**
- **Odrzucenie wywołania narzędzia przez użytkownika nie zawsze cofa efekt.** Dwa razy cherry-pick wykonał się mimo „rejected”. Po każdym przerwaniu sprawdź `git log origin/<branch>..HEAD` i `git status` i nie zakładaj, że nic się nie stało.
- **Raport subagenta może nie dotrzeć** (T3b). Źródło prawdy to commit w worktree: `git log worktree-agent-*`, diff przeglądany samodzielnie.
- **Sieć sesji:** `vercel.com` zablokowane (brak dostępu do dokumentacji Vercel). `dl-cdn.alpinelinux.org` odblokowane przez użytkownika. Docker Hub zwraca 429 (limit anonimowy). `docker build` w kontenerze wymaga dodatkowo CA proxy (`/root/.ccr/ca-bundle.crt`) w obrazie bazowym, więc obraz API weryfikuje CI, nie sesja (D9).
- **`dockerd` nie startuje sam.** Można go uruchomić w tle (`dockerd &`), ale pull i tak ogranicza 429.
- **`tsx` backendu wymaga `--tsconfig src_backend/tsconfig.json`** (dekoratory TSOA).
- Node w sesji: v22.22.2; obraz API: node 24 (`ARG NODE_VERSION`); `.nvmrc` = v25 (nie zmieniać bez zgody).
- Zasada projektu: brak nowych paczek npm bez zgody użytkownika (RULES.md).

## Najbliższe kroki (kolejność)
1. Użytkownik: DEPLOYMENT.md §2 krok 1 (`db-inspect.mjs`). Nadzorca: dobór wariantu baseline na podstawie wyniku.
2. PR `claude/compassionate-hawking-nc14kk` → `main` (na prośbę użytkownika), zielone CI na PR.
3. Użytkownik: §3 Fly.io → §4 Vercel (w tym obowiązkowy `curl -I` nagłówków) → §5 CORS/OAuth → §6 smoke test.
4. Po wdrożeniu: follow-upy z QUEUE.md (CSP `connect-src`, timing resend/forgot, walidacja nazwy kolonii, graceful shutdown, liveness/readiness).
