# Handover nadzorcy — Faza 8

> Nadpisywany przy każdym przekazaniu (procedura: `SUPERVISOR_PROMPT.md` → „Przekazanie nadzoru”).
> Opisuje TYLKO bieżący stan. Szczegóły historii są w `QUEUE.md` → Dziennik.

Data (UTC): 2026-09-26 (wersja robocza z chwili wznowienia; zostanie nadpisana przy faktycznym przekazaniu)
Branch: `claude/compassionate-hawking-nc14kk`

## Stan w skrócie
- DONE: T0a, T1, T2, T3, T3b, T4b, T5, T6, T7, T7b
- REVIEW: T4 (`Dockerfile.api`), weryfikacja obrazu w CI (job `docker-api` z T8), D9
- W toku: T3c (anty-enumeracja), T8 (CI, restart ze szkicem)
- Następne: T4c (po T3c), potem T9
- HUMAN: T0b (rotacja `turso_token`, `jwt_secret`); przed 1. deployem baseline migracji wg `MIGRATIONS_BASELINE.md`
- Gate na HEAD przed startem T3c/T8: lint/tsc OK, front 613, back 132, build OK

## Niescalone / w locie
| ID | branch worktree | sha / pliki niezacommitowane | co z tym zrobić |
|----|-----------------|------------------------------|-----------------|
| T8 (stary agent, martwy) | `worktree-agent-a057bcf42a98b50ec` | niezacommitowany `.github/workflows/ci.yml` (szkic) | przekazany nowemu agentowi T8 jako punkt startu; po scaleniu T8 do zignorowania |

## Czeka na użytkownika
- T0b: rotacja sekretów (obecne wartości są w historii gita, D4 = bez przepisywania historii).
- Przed 1. deployem: `turso db shell <db> ".tables"`, potem wariant A/B/C z `MIGRATIONS_BASELINE.md` (D11: baza z `push`).

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
1. Scalić T3c i T8 po zakończeniu (review, cherry-pick, Gate, push). Po pushu T8 sprawdzić wynik GitHub Actions (job `verify` + `docker-api`). Zielony `docker-api` oznacza T4 DONE.
2. Uruchomić T4c (`@tsoa/runtime`, usunięcie `@tursodatabase/database`).
3. Uruchomić T9 (runbook `DEPLOYMENT.md` z linkiem do `MIGRATIONS_BASELINE.md`, weryfikacja nagłówków Vercel `curl -I`, ROADMAP/CLAUDE.md).
