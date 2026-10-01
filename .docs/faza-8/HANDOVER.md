# Handover nadzorcy — Faza 8

> Nadpisywany przy każdym przekazaniu (procedura: `SUPERVISOR_PROMPT.md` → „Przekazanie nadzoru”).
> Opisuje TYLKO bieżący stan. Szczegóły historii są w `QUEUE.md` → Dziennik.

Data (UTC): 2026-09-27 (po zmianie hostingu API na Render, D15)
Branch: `claude/compassionate-hawking-nc14kk` (sesja lokalna na Windows pracuje w worktree
`.claude/worktrees/faza-8-db-inspect-baseline-1b07a4` i pushuje `HEAD:claude/compassionate-hawking-nc14kk`)

## Stan w skrócie
- DONE (agenci/nadzorca): T0a, T1, T2, T3, T3b, T3c, T4, T4b, T4c, T4d, T4e, T4f, T5, T6, T7, T7b, T8, T9 (dokumentacja), T10 (Render, `6f8300f`).
- DONE (człowiek): T0b (sekrety zrotowane, w `.env.local`); DEPLOYMENT.md §2 **tylko dla bazy DEV** (`.env.local` = dev; baza prod NIESPRAWDZONA): baza dev była w stanie C (brak `maps`, pusta
  `__drizzle_migrations` po nieudanym migratorze), naprawa `db-repair-c.mjs` (poza repo, `$HOME\mars-ops`) + baseline A;
  `__drizzle_migrations` = 2 wiersze. Backup przed zmianami w `$HOME\mars-terraform-backups`.
- D15: API na **Render** (plan Free, Frankfurt), migracje przy starcie kontenera. Fly.io porzucone (trial zakończony, wymaga karty);
  aplikacja `mars-terraform-api` na Fly istnieje bez maszyn (0 $), usunięcie = człowiek (`fly apps destroy`).
- PR #7 (T10) scalony: `b1086ac`. Render Blueprint utworzony z danymi bazy **prod**.
- **API działa na Render** (`https://mars-terraform-api.onrender.com`): baza prod była pusta, migrator zastosował 2 migracje, health 200. Aktywnych subagentów: brak.
- Gate na HEAD (lokalnie, Windows): lint/tsc OK, front 617, back 159/166 (7× `EPERM` w `migrate.test.ts`, problem Windows,
  identyczny bez zmian; CI Linux ma być zielone), build OK. Obraz API weryfikuje CI `docker-api`.

## Niescalone / w locie
- Branch roboczy przed `main` o commity dokumentacji + T10. Po scaleniu PR → deploy przez Render Blueprint.

## Czeka na użytkownika
- §4 Vercel ZROBIONE: `https://mars-terraform.vercel.app`, nagłówki zweryfikowane. §5 CORS ZROBIONE (204/403). §6 smoke test ZALICZONY. **Wdrożenie Fazy 8 zakończone.**
- T11 (IDOR) na produkcji od 2026-09-27 (PR #8, `e8682bd`), zweryfikowane (404 dla `/api/users`, `/users/{id}`). Prawdziwy e-mail można włączać.
- T12 (RODO) na produkcji od 2026-09-27 (PR #9, `54148ae`), zweryfikowane z zewnątrz.
- T13 (konta na numer) wdrożony i ZASTĄPIONY przez D18 (gra bez kont). Bazy Turso usunięte przez użytkownika.
- T14 (frontend bez kont, zapisy w przeglądarce, informacja dla gracza) DONE `c2e9a87`, PR do `main`. Po scaleniu Vercel wdroży frontend, który nie woła API.
- T15 (backend bez bazy, minimalny serwer, zależności) DONE `01d0ccd`. T16 (trwałość zapisów, przypomnienie o kopii, CSP enforce) DONE `354afb6`. Następne: plan fazy gry sieciowej.
- DEPLOYMENT.md §3 (Render): Blueprint z `render.yaml`, zmienne `jwt_secret` (nowy, 48 bajtów), `turso_url`, `turso_token`, deploy.
- Kopie testowe z danymi użytkowników w `$HOME\mars-terraform-backups\test-repair` do usunięcia po wdrożeniu.
- Opcjonalnie: `fly apps destroy mars-terraform-api` (i ewentualnie usunięcie karty z Fly).

## Pułapki środowiska (lekcje)
- **Worktree subagentów startują z `main`, nie z HEAD brancha.** W prompcie subagenta zawsze KROK 0: `git fetch origin <branch> && git reset --hard FETCH_HEAD`. Wymaga wcześniejszego push stanu.
- **Hook sesji blokuje edycję głównego checkoutu** (`C:\Users\robert\code\mars-terraform`), gdzie jest wyciągnięty branch roboczy. Pracuj w worktree sesji (branch zresetowany do `origin/claude/compassionate-hawking-nc14kk`), push `git push origin HEAD:claude/compassionate-hawking-nc14kk`. Główny checkout potem `git pull`.
- **Cherry-pick commita, który robi `git rm --cached .env`, kasuje `.env` z dysku.** Przed takim scaleniem zrób kopię.
- **Po zmianie `package-lock.json` zrób `npm ci` przed Gate.** Worktree sesji ma własne `node_modules`.
- **Odrzucenie wywołania narzędzia nie zawsze cofa efekt.** Po przerwaniu sprawdź `git log origin/<branch>..HEAD` i `git status`.
- **Raport subagenta może nie dotrzeć.** Źródło prawdy to commit w worktree.
- **Brak Dockera lokalnie.** Obraz API weryfikuje CI (D9). CMD obrazu można zasymulować: `sh -c "node dist_backend/migrate.js && exec node dist_backend/index.js"` z `turso_url=file:...` w worktree bez plików `.env*`.
- **Turso ma dwie bazy: dev i prod.** `.env.local` w głównym checkoucie = **dev**. Operacje na prod: zmienne sesji PowerShella (`$env:turso_url`, `$env:turso_token` przez `Read-Host -MaskInput`), mają pierwszeństwo przed plikami `--env-file`. Zawsze sprawdź linię `Baza:` w wyniku skryptu. Worktree sesji nie ma `.env*`.
- **Tryb auto blokuje agentowi odczyt i zapis produkcji** (np. dry-run na Turso). Komendy na produkcji uruchamia użytkownik i wkleja wynik.
- **Lokalny checkout Windows ma ok. 209 plików z CRLF** mimo `eol=lf`. `drizzle/` odtworzone z LF; hashe plików liczone z dysku mogą się różnić od gita.
- **`migrate.test.ts` pada na Windows** (`EPERM`), niezależnie od zmian. Gate lokalny: 159/166 back to stan oczekiwany.
- **Python w heredoc:** `\t`, `\m` w ścieżkach Windows w zwykłych stringach psuje tekst. Używaj raw stringów albo `/`.
- **`tsx` backendu wymaga `--tsconfig src_backend/tsconfig.json`** (dekoratory TSOA).
- Node lokalnie: v24.15.0; obraz API: node 24; `.nvmrc` = v25 (nie zmieniać bez zgody).
- Zasada projektu: brak nowych paczek npm bez zgody użytkownika (RULES.md).

## Najbliższe kroki (kolejność)
1. (zrobione) Baza prod: pusta, migracje zastosowane przy 1. starcie; API live.
2. Użytkownik: DEPLOYMENT.md §3 Render → §4 Vercel (`VITE_API_URL = https://mars-terraform-api.onrender.com`, obowiązkowy `curl -I` nagłówków) → §5 CORS/OAuth (zmienne w panelu Render) → §6 smoke test.
3. Po wdrożeniu: follow-upy z QUEUE.md (CSP `connect-src`, timing resend/forgot, walidacja nazwy kolonii, graceful shutdown, liveness/readiness, `EPERM` na Windows).
