# Runbook wdrożenia produkcyjnego — Faza 8 (Render + Vercel + Turso)

> Dla człowieka, **Windows + PowerShell**, bez WSL i bez Turso CLI. Agent niczego nie wdraża.
> Kontekst i decyzje: `PLAN.md` (§4 architektura, §5 T9), `QUEUE.md` (D1–D13), `MIGRATIONS_BASELINE.md`.
>
> Placeholdery (nie wpisuj prawdziwych wartości do repo):
> `<app>` = nazwa usługi Render (domyślnie w `render.yaml`: `mars-terraform-api`, adres `https://<app>.onrender.com`),
> `<projekt>` = nazwa projektu Vercel (`https://<projekt>.vercel.app`),
> `<baza>` = nazwa bazy Turso, `<domena>` = ewentualna domena własna.
>
> Oznaczenie **„do potwierdzenia”** = komenda albo etykieta w panelu, której nie dało się sprawdzić
> z sesji agenta (brak dostępu do panelu Render/vercel.com/Turso i brak PowerShella). Sprawdź w oficjalnej
> dokumentacji, zanim wykonasz krok, i popraw runbook, jeśli się różni.

Architektura docelowa (PLAN §4):

```
Przeglądarka ──► Vercel CDN (dist/, vercel.json): /, /generate, /mars, /assets/*, /models/*, /textures/*, /icons/*
     │
     └─ fetch(VITE_API_URL + "/api/...")  Authorization: Bearer  ──► Render <app> (Dockerfile.api, serve_frontend=false)
                                                                      │  CORS allowlist = cors_origins
                                                                      ▼
                                                                    Turso (libsql://)
OAuth: <app>.onrender.com/api/auth/{google|github}/callback ──302──► ${frontend_url}/?token=...
```

## Spis treści

0. [Wymagania wstępne i kolejność](#0-wymagania-wstępne-i-kolejność)
1. [Sekrety (T0b)](#1-sekrety-t0b)
2. [Baza: backup i baseline migracji (D11)](#2-baza-backup-i-baseline-migracji-d11)
3. [Backend na Render (D15)](#3-backend-na-render-d15)
4. [Frontend na Vercel (D3)](#4-frontend-na-vercel-d3)
5. [Spięcie: CORS, frontend_url, OAuth](#5-spięcie-cors-frontend_url-oauth)
6. [Smoke test produkcji](#6-smoke-test-produkcji)
7. [Rollback i awarie](#7-rollback-i-awarie)
8. [Po wdrożeniu](#8-po-wdrożeniu)

### Uwagi ogólne dla PowerShella

- Fragmenty PowerShell (pętle, `Read-DotEnv`, `Select-String`) nie były uruchomione w sesji agenta (Linux, brak PowerShella):
  traktuj je jako **do potwierdzenia**. Komendy `curl`, skrypty Node i odpowiedzi API sprawdzono lokalnie.
- **`curl` w Windows PowerShell 5.1 to alias `Invoke-WebRequest`.** Wszędzie poniżej używaj `curl.exe`
  (prawdziwy curl, jest w Windows 10/11).
- Pliki `.env` / `.env.local`: backend (`dotenv-flow`) i `drizzle.config.ts` czytają oba, **`.env.local` ma pierwszeństwo**.
  Skrypty Node z tego runbooka uruchamiasz z flagami, które odtwarzają to samo pierwszeństwo:
  `node --env-file-if-exists=.env --env-file-if-exists=.env.local <skrypt>.mjs`
  (Node ≥ 22.9; ostatni plik wygrywa przy tym samym kluczu, a zmienna ustawiona w sesji PowerShella wygrywa z oboma plikami.
  Komunikat `.env not found. Continuing without it.` przy braku jednego z plików jest niegroźny.)
- **Skrypt musi mieć rozszerzenie `.mjs`, nie `.mjs.txt`.** Notatnik przy „Zapisz jako” potrafi dopisać `.txt`
  (Explorer domyślnie ukrywa rozszerzenia). Objaw: `Error: Cannot find module '...\db-inspect.mjs'`. Sprawdź:
  ```powershell
  dir $HOME\mars-ops\db-*
  ```
  Jeśli widzisz `db-inspect.mjs.txt`, zmień nazwę: `Rename-Item $HOME\mars-ops\db-inspect.mjs.txt db-inspect.mjs`.
  Najprościej tworzyć plik komendą `notepad $HOME\mars-ops\db-inspect.mjs` (Notatnik zapyta, czy utworzyć plik o dokładnie tej nazwie).

---

## 0. Wymagania wstępne i kolejność

**Cel:** mieć konta, narzędzia i scalony kod, zanim cokolwiek zmieni się na produkcji.

### Checklista wymagań

- [ ] Kod Fazy 8 scalony do `main` (PR z brancha roboczego, review), CI na `main` zielony (`verify` + `docker-api`).
      Vercel buduje Production z gałęzi produkcyjnej (domyślnie `main`), a Render wdraża API z `main` po zielonym CI.
- [ ] Lokalny checkout na `main`, `git status` czysty, `git pull` wykonany.
- [ ] Node 24 (`node -v` ≥ v22.9 wystarczy dla skryptów), `npm ci` wykonane w repo.
- [ ] Dostęp do panelu Turso: https://app.turso.tech (bez Turso CLI).
- [ ] Konto Render (plan Free, bez karty), połączone z GitHubem.
- [ ] Konto Vercel połączone z GitHubem (dostęp do repo `develforever/mars-terraform`).
- [ ] (Opcjonalnie) dostęp do Google Cloud Console i GitHub Developer Settings, jeśli OAuth ma działać od razu.
- [ ] Katalog na skrypty i backupy **poza repo**, np. `New-Item -ItemType Directory -Force $HOME\mars-ops`.

### Kolejność (każdy krok zależy od poprzedniego)

- [ ] 1. Sekrety: unieważnienie starych tokenów Turso, nowy token, nowy `jwt_secret` (sekcja 1).
- [ ] 2. Backup bazy, inwentaryzacja, baseline `__drizzle_migrations` (sekcja 2). **Bez tego pierwszy deploy padnie.**
- [ ] 3. Render: Blueprint z `render.yaml`, zmienne tajne, deploy, `/api/health` = 200 (sekcja 3).
- [ ] 4. Vercel: import repo, `VITE_API_URL`, preview, weryfikacja nagłówków `curl.exe -I` (sekcja 4).
- [ ] 5. Render: `cors_origins` + `frontend_url`, test CORS, OAuth redirect URI (sekcja 5).
- [ ] 6. Smoke test produkcji (sekcja 6).
- [ ] 7. Porządki po wdrożeniu (sekcja 8).

**Oczekiwany wynik:** wszystkie pola wymagań zaznaczone.
**Co jeśli nie wyszło:** nie zaczynaj sekcji 1–3 bez scalonego kodu. Deploy starego `main` nie ma `Dockerfile.api`, `render.yaml` ani migratora.

---

## 1. Sekrety (T0b)

**Cel:** stare wartości `turso_token` i `jwt_secret` są w historii gita (plik `.env` był śledzony, decyzja **D4**:
bez przepisywania historii). Każdy, kto ma klon repo, ma stare sekrety. Jedyna ochrona to ich unieważnienie.

> **Ostrzeżenie (D4):** `git rm --cached .env` (T0a) nie usunął wartości z historii. Stary token Turso
> i stary `jwt_secret` traktuj jako publiczne. Nie używaj ich nigdzie, nawet lokalnie.

### Kroki

1. **Unieważnij stare tokeny Turso (panel).** app.turso.tech → baza `<baza>` → ustawienia / tokeny →
   opcja unieważnienia (rotacji) wszystkich tokenów bazy. Etykieta w panelu **do potwierdzenia**
   (odpowiednik CLI: `turso db tokens invalidate <baza>`).
   - **Uwaga na kolejność:** unieważnienie dotyczy **wszystkich** tokenów bazy, także utworzonych wcześniej tego samego dnia.
     QUEUE.md odnotowuje, że nowy token został już utworzony. Jeśli unieważnisz teraz, ten token też przestanie działać,
     więc po unieważnieniu **utwórz kolejny** (krok 2).
   - Jeśli używasz tokenów na poziomie grupy / organizacji (platform API), sprawdź, czy stare też trzeba unieważnić.
2. **Utwórz nowy token bazy** (panel: baza → „Create token” / „Generate token”, **do potwierdzenia**), z uprawnieniem
   odczyt + zapis (API zapisuje dane), bez daty wygaśnięcia albo z datą, którą zapiszesz w kalendarzu.
   Skopiuj go od razu (panel pokazuje go raz).
3. **Nowy `jwt_secret`** (min. 32 bajty losowe). W PowerShellu, w katalogu repo:
   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
   ```
   Alternatywa bez Node (Windows PowerShell 5.1 i PowerShell 7):
   ```powershell
   $b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join ''
   ```
   Zmiana `jwt_secret` unieważnia wszystkie wydane tokeny JWT (użytkownicy muszą zalogować się ponownie). To zamierzone.
   Rozważ **osobny** `jwt_secret` dla produkcji i dla lokalnego dev.
4. **Zaktualizuj lokalny plik:** wpisz do `.env.local` (albo `.env`; `.env.local` ma pierwszeństwo):
   ```
   turso_url=libsql://<baza>-<org>.turso.io
   turso_token=<nowy token>
   jwt_secret=<nowa wartość>
   ```
   Wartości bez cudzysłowów i bez komentarzy w tej samej linii. Jeśli ten sam klucz jest w obu plikach, liczy się `.env.local`,
   więc usuń albo zaktualizuj starą wartość w `.env`, żeby uniknąć pomyłki.
5. Sprawdź, że pliki nie są śledzone:
   ```powershell
   git ls-files .env .env.local
   git check-ignore -v .env .env.local
   ```

### Oczekiwany wynik

- `git ls-files` nic nie wypisuje; `git check-ignore` pokazuje reguły z `.gitignore` (`.env`, `.env.*`).
- `node --env-file-if-exists=.env --env-file-if-exists=.env.local $HOME\mars-ops\db-inspect.mjs` (sekcja 2) łączy się z bazą.
- Stary token nie działa (połączenie z nim kończy się błędem autoryzacji, np. HTTP 401).

### Co jeśli nie wyszło

| Objaw | Działanie |
|---|---|
| Skrypt z sekcji 2 zwraca `401` / `Unauthorized` | Token unieważniony albo pomylony plik. Utwórz nowy token (krok 2), sprawdź, czy `.env.local` nie ma starej wartości. |
| Nie ma w panelu opcji unieważnienia tokenów | Sprawdź dokumentację Turso (tokeny bazy / grupy). W ostateczności utwórz nową bazę z backupu (sekcja 2, krok 1) i usuń starą. |
| `git ls-files .env` coś wypisuje | Plik znowu trafił do indeksu. `git rm --cached .env` i commit, zanim cokolwiek wypchniesz. |

---

## 2. Baza: backup i baseline migracji (D11)

**Cel:** produkcyjna baza Turso powstała przez `drizzle-kit push` (**D11**), więc nie ma tabeli `__drizzle_migrations`.
Migrator (`node dist_backend/migrate.js`, start kontenera API, D15) uzna ją za pustą, spróbuje wykonać `0000`
i deploy padnie na `table ... already exists`. Baseline wpisuje do `__drizzle_migrations` migracje, które baza już ma.

Pełny opis mechanizmu, checklista kolumn i SQL: **[`MIGRATIONS_BASELINE.md`](./MIGRATIONS_BASELINE.md)**. Skrót:

- `hash` = sha256 pliku `drizzle/<tag>.sql`, `created_at` = `when` z `drizzle/meta/_journal.json`.
- Migrator porównuje wyłącznie `created_at` ostatniego wiersza; hash nie jest sprawdzany.
- **Wariant A**: 8 tabel (6 z `0000` + `maps` + `colonies`) → baseline `0000` i `0001`, deploy: `No new migrations`.
- **Wariant B**: tylko 6 tabel z `0000` → baseline `0000`, deploy zastosuje `0001` (`Applied 1 migration(s)`).
- **Wariant C**: cokolwiek innego → STOP, bez baseline, ustal naprawę ręcznie.
- Bez `drizzle-kit push` na produkcji, bez edycji zastosowanych plików `drizzle/*.sql`.

`MIGRATIONS_BASELINE.md` opisuje komendy `turso db shell`. **Bez Turso CLI** używasz dwóch skryptów Node poniżej
(`@libsql/client` jest już w zależnościach repo i obsługuje `libsql://` oraz `file:`).

### Skrypty: gdzie je zapisać i jak uruchamiać

- Zapisz je **poza repo**: `$HOME\mars-ops\db-inspect.mjs` i `$HOME\mars-ops\db-baseline.mjs`. **Nie commituj ich**
  (backup zawiera dane użytkowników, a skrypty są narzędziem jednorazowym).
- Uruchamiaj **z katalogu repo** (skrypt bierze `@libsql/client` z `node_modules` repo i pliki z `drizzle/`):
  ```powershell
  cd <ścieżka do repo>
  node --env-file-if-exists=.env --env-file-if-exists=.env.local $HOME\mars-ops\db-inspect.mjs
  ```
- Oba skrypty czytają `turso_url` i `turso_token` z `.env` / `.env.local`. Nie wypisują tokenu, a z URL-a pokazują tylko host.
- Sprawdź rozszerzenie pliku (`dir $HOME\mars-ops\db-*`, patrz „Uwagi ogólne”).

### Krok 1. Inwentaryzacja + backup (`db-inspect.mjs`, tylko odczyt)

Skrypt wypisuje tabele z liczbą wierszy, stan `__drizzle_migrations`, pełne `CREATE` z `sqlite_master`
i zapisuje backup `.sql` (schemat + wszystkie wiersze jako `INSERT`, `sqlite_sequence`, indeksy) do
`$HOME\mars-terraform-backups\backup-<czas UTC>.sql` albo do pliku podanego jako argument. Nie nadpisuje istniejącego pliku.
Wykonuje wyłącznie `SELECT`.

```powershell
node --env-file-if-exists=.env --env-file-if-exists=.env.local $HOME\mars-ops\db-inspect.mjs
# albo z własną ścieżką backupu:
node --env-file-if-exists=.env --env-file-if-exists=.env.local $HOME\mars-ops\db-inspect.mjs D:\backups\mars-before-baseline.sql
```

`db-inspect.mjs` (przetestowana wersja, skopiuj w całości):

```js
// db-inspect.mjs: inwentaryzacja i backup bazy libsql/Turso. TYLKO ODCZYT.
// Mars Terraform, Faza 8 (runbook .docs/faza-8/DEPLOYMENT.md, sekcja 2).
//
// Uruchom z KATALOGU REPO (stamtąd skrypt bierze @libsql/client):
//   node --env-file-if-exists=.env --env-file-if-exists=.env.local <ścieżka>\db-inspect.mjs [plik-backupu.sql]
// Zmienne: turso_url (libsql://... albo file:...), turso_token (dla libsql://).
// Bez argumentu backup trafia do <katalog domowy>/mars-terraform-backups/ (poza repo).
// NIE commituj tego skryptu ani backupu (backup zawiera dane użytkowników).

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const fail = (message, code = 1) => {
  console.error(`BŁĄD: ${message}`);
  process.exit(code);
};

const loadLibsql = async () => {
  try {
    const require = createRequire(path.join(process.cwd(), "package.json"));
    return await import(pathToFileURL(require.resolve("@libsql/client")).href);
  } catch {
    fail("nie znaleziono @libsql/client. Uruchom skrypt z katalogu repo po `npm ci`.");
  }
};

const describeUrl = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === "file:" ? url : `${u.protocol}//${u.host}`;
  } catch {
    return "(niepoprawny URL)";
  }
};

const quoteIdent = (name) => `"${String(name).replaceAll('"', '""')}"`;

const sqlLiteral = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return `X'${Buffer.from(bytes).toString("hex")}'`;
  }
  return `'${String(value).replaceAll("'", "''")}'`;
};

// Tabele wewnętrzne SQLite / libsql / Turso (nie są danymi aplikacji).
const isInternal = (name) =>
  name.startsWith("sqlite_") || name.startsWith("_litestream") || name.startsWith("libsql_") || name.startsWith("_cf_");

const main = async () => {
  const url = process.env.turso_url;
  if (!url) fail("brak zmiennej turso_url (sprawdź .env / .env.local i flagi --env-file-if-exists).");
  const authToken = process.env.turso_token || undefined;
  if (url.startsWith("libsql:") && !authToken) console.warn("UWAGA: libsql:// bez turso_token, połączenie pewnie zostanie odrzucone.");

  const { createClient } = await loadLibsql();
  // intMode "bigint": duże liczby całkowite bez utraty precyzji w backupie.
  const client = createClient({ url, authToken, intMode: "bigint" });

  try {
    console.log(`Baza: ${describeUrl(url)}`);

    const schema = await client.execute(
      "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END, name",
    );
    const objects = schema.rows.map((r) => ({ type: String(r.type), name: String(r.name), tbl: String(r.tbl_name), sql: String(r.sql) }));
    const tables = objects.filter((o) => o.type === "table" && !isInternal(o.name));

    console.log(`\n== Tabele (${tables.length}) ==`);
    for (const t of tables) {
      const count = await client.execute(`SELECT COUNT(*) AS n FROM ${quoteIdent(t.name)}`);
      console.log(`  ${t.name.padEnd(24)} wierszy: ${count.rows[0].n}`);
    }
    const internal = objects.filter((o) => o.type === "table" && isInternal(o.name)).map((o) => o.name);
    if (internal.length > 0) console.log(`  (wewnętrzne, pominięte: ${internal.join(", ")})`);

    console.log("\n== __drizzle_migrations ==");
    if (tables.some((t) => t.name === "__drizzle_migrations")) {
      const rows = await client.execute('SELECT hash, created_at FROM "__drizzle_migrations" ORDER BY created_at');
      console.log(`  ISTNIEJE, wierszy: ${rows.rows.length}`);
      for (const r of rows.rows) console.log(`  ${r.created_at}  ${r.hash}`);
    } else {
      console.log("  brak (baza z drizzle-kit push, baseline wymagany)");
    }

    console.log("\n== Schemat (sqlite_master) ==");
    for (const o of objects.filter((x) => !isInternal(x.name) && !isInternal(x.tbl))) {
      console.log(`-- ${o.type} ${o.name}\n${o.sql};\n`);
    }

    // Backup: schemat + dane w formacie zbliżonym do `sqlite3 .dump`.
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const outPath = process.argv[2]
      ? path.resolve(process.argv[2])
      : path.join(os.homedir(), "mars-terraform-backups", `backup-${stamp}.sql`);
    if (fs.existsSync(outPath)) fail(`plik ${outPath} już istnieje, nie nadpisuję.`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const out = fs.openSync(outPath, "wx");
    const write = (line) => fs.writeSync(out, `${line}\n`);
    let totalRows = 0;
    try {
      write(`-- Mars Terraform backup ${new Date().toISOString()} (${describeUrl(url)})`);
      write("PRAGMA foreign_keys=OFF;");
      write("BEGIN TRANSACTION;");
      for (const t of tables) {
        write(`${t.sql};`);
        const info = await client.execute(`SELECT name FROM pragma_table_info(${sqlLiteral(t.name)}) ORDER BY cid`);
        const columns = info.rows.map((r) => String(r.name));
        const colList = columns.map(quoteIdent).join(", ");
        const data = await client.execute(`SELECT ${colList} FROM ${quoteIdent(t.name)}`);
        for (const row of data.rows) {
          const values = columns.map((c) => sqlLiteral(row[c])).join(", ");
          write(`INSERT INTO ${quoteIdent(t.name)} (${colList}) VALUES (${values});`);
        }
        totalRows += data.rows.length;
      }
      if (objects.some((o) => o.name === "sqlite_sequence")) {
        const seq = await client.execute("SELECT name, seq FROM sqlite_sequence");
        write("DELETE FROM sqlite_sequence;");
        for (const r of seq.rows) write(`INSERT INTO sqlite_sequence (name, seq) VALUES (${sqlLiteral(r.name)}, ${sqlLiteral(r.seq)});`);
      }
      for (const o of objects.filter((x) => x.type !== "table" && !isInternal(x.name) && !isInternal(x.tbl))) {
        write(`${o.sql};`);
      }
      write("COMMIT;");
    } finally {
      fs.closeSync(out);
    }
    const size = fs.statSync(outPath).size;
    console.log(`== Backup ==\n  ${outPath}\n  tabel: ${tables.length}, wierszy: ${totalRows}, rozmiar: ${size} B`);
    console.log("  Trzymaj poza repo (dane użytkowników).");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`zapytanie nie powiodło się: ${message}`);
  } finally {
    client.close();
  }
};

await main();
```

**Oczekiwany wynik:** lista tabel (dla D11: 6 albo 8 tabel aplikacji, bez `__drizzle_migrations`),
sekcja `== __drizzle_migrations ==` z tekstem `brak (baza z drizzle-kit push, baseline wymagany)`,
na końcu `== Backup ==` ze ścieżką, liczbą tabel, wierszy i rozmiarem pliku > 0.
Otwórz backup i sprawdź, że zawiera `CREATE TABLE` i `INSERT INTO "users"` (jeśli są użytkownicy).

**Co jeśli nie wyszło:**

| Objaw | Działanie |
|---|---|
| `Cannot find module '...db-inspect.mjs'` | Zła ścieżka albo plik `.mjs.txt` (patrz „Uwagi ogólne”). |
| `nie znaleziono @libsql/client` | Uruchamiasz spoza katalogu repo albo brak `npm ci`. |
| `brak zmiennej turso_url` | Brak klucza w `.env` / `.env.local` albo brak flag `--env-file-if-exists`. |
| `zapytanie nie powiodło się: ... 401` / `fetch failed` | Zły token / URL albo brak sieci. Sprawdź sekcję 1. |
| `__drizzle_migrations` **ISTNIEJE** | **STOP.** Migrator albo baseline już był wykonany. Nie rób baseline; ustal stan na podstawie wypisanych wierszy (`MIGRATIONS_BASELINE.md`, krok 1). |

### Krok 2. Porównanie schematu i wybór wariantu

Porównaj wypisane `CREATE TABLE` z checklistą w `MIGRATIONS_BASELINE.md` (krok 2, łącznie z `DEFAULT`)
i wybierz wariant z tabeli (krok 3 tamtego pliku). Skrypt baseline dodatkowo porównuje automatycznie kolumny, typy,
`NOT NULL`, klucze główne, indeksy unikalne i klucze obce ze snapshotem drizzle-kit i odmawia działania przy rozbieżności.
`DEFAULT`-ów nie porównuje (tylko ręcznie).

### Krok 3. Baseline (`db-baseline.mjs`)

Skrypt:

- wymaga jawnego `--variant=A` albo `--variant=B`; bez `--apply` działa jako **dry-run** (nic nie zapisuje),
- czyta `when` z `drizzle/meta/_journal.json` i liczy sha256 plików `drizzle/<tag>.sql` tak samo jak drizzle-orm (bez wartości na sztywno),
- przerywa (exit 2), jeśli `__drizzle_migrations` już istnieje,
- przerywa (exit 3), jeśli zestaw tabel nie pasuje do wariantu albo struktura różni się od snapshotu (wariant C),
- z `--apply` wykonuje `CREATE TABLE IF NOT EXISTS` + `INSERT`-y w **jednej transakcji** (`client.batch(..., "write")`),
  potem wypisuje zawartość tabeli i to, co zastosuje migrator przy deployu.

```powershell
# 1) dry-run (zawsze najpierw)
node --env-file-if-exists=.env --env-file-if-exists=.env.local $HOME\mars-ops\db-baseline.mjs --variant=A
# 2) zapis, dopiero gdy dry-run pokazał zgodną strukturę i oczekiwany SQL
node --env-file-if-exists=.env --env-file-if-exists=.env.local $HOME\mars-ops\db-baseline.mjs --variant=A --apply
```

(Dla wariantu B zamień `A` na `B`.)

`db-baseline.mjs` (przetestowana wersja, skopiuj w całości):

```js
// db-baseline.mjs: baseline tabeli __drizzle_migrations dla bazy utworzonej przez `drizzle-kit push` (D11).
// Mars Terraform, Faza 8 (runbook .docs/faza-8/DEPLOYMENT.md sekcja 2, szczegóły: MIGRATIONS_BASELINE.md).
//
// Uruchom z KATALOGU REPO (stamtąd skrypt bierze @libsql/client i drizzle/):
//   node --env-file-if-exists=.env --env-file-if-exists=.env.local <ścieżka>\db-baseline.mjs --variant=A           (dry-run)
//   node --env-file-if-exists=.env --env-file-if-exists=.env.local <ścieżka>\db-baseline.mjs --variant=A --apply   (zapis)
// Wariant A: baza ma 8 tabel (0000 + maps, colonies). Wariant B: tylko 6 tabel z 0000.
// Hashe (sha256 plików drizzle/<tag>.sql) i created_at (`when` z drizzle/meta/_journal.json) są liczone tutaj.
// Bez --apply nic nie jest zapisywane. NIE commituj tego skryptu.

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const VARIANTS = {
  A: ["0000_tidy_living_mummy", "0001_maps_colonies"],
  B: ["0000_tidy_living_mummy"],
};
const MIGRATIONS_TABLE = "__drizzle_migrations";
const CREATE_MIGRATIONS_TABLE =
  'CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)';

const fail = (message, code = 1) => {
  console.error(`BŁĄD: ${message}`);
  process.exit(code);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const known = new Set(["--apply"]);
  let variant;
  for (const arg of args) {
    if (arg.startsWith("--variant=")) variant = arg.slice("--variant=".length).toUpperCase();
    else if (!known.has(arg)) fail(`nieznany argument: ${arg}`);
  }
  if (!variant || !(variant in VARIANTS)) fail("wymagany argument --variant=A albo --variant=B (patrz MIGRATIONS_BASELINE.md, krok 3).");
  return { variant, apply: args.includes("--apply") };
};

const loadLibsql = async () => {
  try {
    const require = createRequire(path.join(process.cwd(), "package.json"));
    return await import(pathToFileURL(require.resolve("@libsql/client")).href);
  } catch {
    fail("nie znaleziono @libsql/client. Uruchom skrypt z katalogu repo po `npm ci`.");
  }
};

const describeUrl = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === "file:" ? url : `${u.protocol}//${u.host}`;
  } catch {
    return "(niepoprawny URL)";
  }
};

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`nie mogę odczytać ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Tak jak drizzle-orm (migrator.js): sha256 treści pliku, created_at = `when` z journala.
const loadMigrations = (drizzleDir, tags) => {
  const journal = readJson(path.join(drizzleDir, "meta", "_journal.json"));
  return tags.map((tag) => {
    const entry = journal.entries.find((e) => e.tag === tag);
    if (!entry) fail(`brak wpisu ${tag} w drizzle/meta/_journal.json`);
    const sqlPath = path.join(drizzleDir, `${tag}.sql`);
    if (!fs.existsSync(sqlPath)) fail(`brak pliku ${sqlPath}`);
    const query = fs.readFileSync(sqlPath).toString();
    const hash = crypto.createHash("sha256").update(query).digest("hex");
    const snapshotPath = path.join(drizzleDir, "meta", `${String(entry.idx).padStart(4, "0")}_snapshot.json`);
    return { tag, idx: entry.idx, when: entry.when, hash, snapshotPath };
  });
};

// Porównanie struktury tabel z oczekiwaną (snapshot drizzle-kit ostatniej migracji wariantu):
// kolumny (nazwa, typ, NOT NULL, PK), indeksy unikalne, klucze obce. DEFAULT sprawdź ręcznie (checklista).
const compareSchema = async (client, snapshot) => {
  const problems = [];
  for (const [tableName, table] of Object.entries(snapshot.tables)) {
    const cols = await client.execute({ sql: "SELECT name, type, \"notnull\" AS nn, pk FROM pragma_table_info(?)", args: [tableName] });
    if (cols.rows.length === 0) {
      problems.push(`${tableName}: brak tabeli`);
      continue;
    }
    const actual = new Map(cols.rows.map((r) => [String(r.name), { type: String(r.type).toLowerCase(), notNull: Number(r.nn) === 1, pk: Number(r.pk) > 0 }]));
    const pkCols = new Set(Object.values(table.columns).filter((c) => c.primaryKey).map((c) => c.name));
    for (const cpk of Object.values(table.compositePrimaryKeys ?? {})) cpk.columns.forEach((c) => pkCols.add(c));
    for (const col of Object.values(table.columns)) {
      const a = actual.get(col.name);
      if (!a) {
        problems.push(`${tableName}.${col.name}: brak kolumny`);
        continue;
      }
      if (a.type !== col.type.toLowerCase()) problems.push(`${tableName}.${col.name}: typ ${a.type}, oczekiwano ${col.type}`);
      // Kolumna INTEGER PRIMARY KEY bywa w PRAGMA raportowana jako nullable; pomijamy NOT NULL dla PK.
      if (!pkCols.has(col.name) && a.notNull !== col.notNull) problems.push(`${tableName}.${col.name}: NOT NULL=${a.notNull}, oczekiwano ${col.notNull}`);
      if (a.pk !== pkCols.has(col.name)) problems.push(`${tableName}.${col.name}: PK=${a.pk}, oczekiwano ${pkCols.has(col.name)}`);
    }
    for (const name of actual.keys()) {
      if (!(name in table.columns)) problems.push(`${tableName}.${name}: kolumna spoza schematu`);
    }
    const idx = await client.execute({ sql: "SELECT name, \"unique\" AS u FROM pragma_index_list(?)", args: [tableName] });
    const uniqueNames = new Set(idx.rows.filter((r) => Number(r.u) === 1).map((r) => String(r.name)));
    for (const index of Object.values(table.indexes ?? {})) {
      if (index.isUnique && !uniqueNames.has(index.name)) problems.push(`${tableName}: brak indeksu unikalnego ${index.name}`);
    }
    const fks = await client.execute({ sql: "SELECT \"table\" AS t, \"from\" AS f, \"to\" AS o FROM pragma_foreign_key_list(?)", args: [tableName] });
    const actualFks = new Set(fks.rows.map((r) => `${r.f}->${r.t}.${r.o}`));
    for (const fk of Object.values(table.foreignKeys ?? {})) {
      const key = `${fk.columnsFrom.join(",")}->${fk.tableTo}.${fk.columnsTo.join(",")}`;
      if (!actualFks.has(key)) problems.push(`${tableName}: brak klucza obcego ${key}`);
    }
  }
  return problems;
};

const main = async () => {
  const { variant, apply } = parseArgs();
  const url = process.env.turso_url;
  if (!url) fail("brak zmiennej turso_url (sprawdź .env / .env.local i flagi --env-file-if-exists).");
  const authToken = process.env.turso_token || undefined;

  const drizzleDir = path.resolve(process.cwd(), "drizzle");
  if (!fs.existsSync(drizzleDir)) fail(`brak katalogu ${drizzleDir}. Uruchom z katalogu repo.`);

  const variantMigrations = loadMigrations(drizzleDir, VARIANTS[variant]);
  const allTags = readJson(path.join(drizzleDir, "meta", "_journal.json")).entries.map((e) => e.tag);
  const allMigrations = loadMigrations(drizzleDir, allTags);
  const expectedSnapshot = readJson(variantMigrations[variantMigrations.length - 1].snapshotPath);
  const expectedTables = new Set(Object.keys(expectedSnapshot.tables));
  // Tabele, których w danym wariancie NIE może być (utworzy je dopiero migrator).
  const latestSnapshot = readJson(allMigrations[allMigrations.length - 1].snapshotPath);
  const forbiddenTables = Object.keys(latestSnapshot.tables).filter((t) => !expectedTables.has(t));

  console.log(`Tryb: ${apply ? "APPLY (zapis)" : "DRY-RUN (bez zapisu)"}, wariant ${variant}`);
  console.log("Migracje do wpisania:");
  for (const m of variantMigrations) console.log(`  ${m.tag}  created_at=${m.when}  sha256=${m.hash}`);

  const { createClient } = await loadLibsql();
  const client = createClient({ url, authToken });
  try {
    console.log(`Baza: ${describeUrl(url)}`);
    const tablesRes = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
    const present = new Set(tablesRes.rows.map((r) => String(r.name)));

    if (present.has(MIGRATIONS_TABLE)) {
      const rows = await client.execute(`SELECT hash, created_at FROM "${MIGRATIONS_TABLE}" ORDER BY created_at`);
      console.error(`STOP: ${MIGRATIONS_TABLE} już istnieje (wierszy: ${rows.rows.length}). Ktoś wykonał migrator albo baseline.`);
      for (const r of rows.rows) console.error(`  ${r.created_at}  ${r.hash}`);
      process.exitCode = 2;
      return;
    }

    const missing = [...expectedTables].filter((t) => !present.has(t));
    const unexpected = forbiddenTables.filter((t) => present.has(t));
    if (missing.length > 0 || unexpected.length > 0) {
      if (missing.length > 0) console.error(`Brakujące tabele dla wariantu ${variant}: ${missing.join(", ")}`);
      if (unexpected.length > 0) console.error(`Tabele, których w wariancie ${variant} nie powinno być: ${unexpected.join(", ")}`);
      console.error("STOP: stan bazy nie pasuje do wariantu. Sprawdź tabelę w MIGRATIONS_BASELINE.md (krok 3), możliwy wariant C.");
      process.exitCode = 3;
      return;
    }

    const problems = await compareSchema(client, expectedSnapshot);
    if (problems.length > 0) {
      console.error("STOP: struktura tabel różni się od migracji (wariant C):");
      for (const p of problems) console.error(`  - ${p}`);
      process.exitCode = 3;
      return;
    }
    console.log(`Struktura ${expectedTables.size} tabel zgodna ze snapshotem (kolumny, typy, NOT NULL, PK, indeksy unikalne, FK).`);
    console.log("DEFAULT-y sprawdź ręcznie z checklistą w MIGRATIONS_BASELINE.md.");

    const statements = [
      CREATE_MIGRATIONS_TABLE,
      ...variantMigrations.map((m) => ({ sql: `INSERT INTO "${MIGRATIONS_TABLE}" (hash, created_at) VALUES (?, ?)`, args: [m.hash, m.when] })),
    ];
    const lastWhen = variantMigrations[variantMigrations.length - 1].when;
    const pending = allMigrations.filter((m) => m.when > lastWhen).map((m) => m.tag);

    if (!apply) {
      console.log("\nSQL, który zostałby wykonany w jednej transakcji:");
      console.log(`  ${CREATE_MIGRATIONS_TABLE};`);
      for (const m of variantMigrations) console.log(`  INSERT INTO "${MIGRATIONS_TABLE}" (hash, created_at) VALUES ('${m.hash}', ${m.when});`);
      console.log(`\nPo baseline migrator zastosuje: ${pending.length === 0 ? "nic (No new migrations)" : pending.join(", ")}`);
      console.log("DRY-RUN: nic nie zapisano. Dodaj --apply, żeby wykonać.");
      return;
    }

    await client.batch(statements, "write");
    const check = await client.execute(`SELECT hash, created_at FROM "${MIGRATIONS_TABLE}" ORDER BY created_at`);
    console.log(`\nZapisano. ${MIGRATIONS_TABLE}:`);
    for (const r of check.rows) console.log(`  ${r.created_at}  ${r.hash}`);
    console.log(`Następny deploy (migrator) zastosuje: ${pending.length === 0 ? "nic (No new migrations)" : pending.join(", ")}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`zapytanie nie powiodło się (nic nie zapisano, jeśli błąd wystąpił przed „Zapisano”): ${message}`);
  } finally {
    client.close();
  }
};

await main();
```

**Oczekiwany wynik:**

- dry-run: `Struktura 8 tabel zgodna ze snapshotem ...`, blok `SQL, który zostałby wykonany ...` z hashami
  `4cd12e0f…3383` (`0000`) i `e4de0522…be34` (`0001`, tylko A), `Po baseline migrator zastosuje: nic (No new migrations)`
  dla A albo `0001_maps_colonies` dla B, na końcu `DRY-RUN: nic nie zapisano.`
- `--apply`: `Zapisano. __drizzle_migrations:` z 2 (A) albo 1 (B) wierszami, `created_at` = `1778522201990` / `1790271837079`.
- ponowne uruchomienie: `STOP: __drizzle_migrations już istnieje` (exit 2), czyli baseline nie wykona się drugi raz.

**Co jeśli nie wyszło:**

| Objaw | Działanie |
|---|---|
| `wymagany argument --variant=A albo --variant=B` | Podaj wariant jawnie. Skrypt celowo nie ma domyślnego. |
| `brak katalogu ...\drizzle` | Uruchamiasz spoza katalogu repo. |
| `Brakujące tabele` / `Tabele, których w wariancie X nie powinno być` (exit 3) | Zły wariant albo stan C. Wróć do kroku 2. |
| `STOP: struktura tabel różni się od migracji` (exit 3) | Wariant C. Nie wykonuj baseline. Opisz rozbieżności (wypisane przez skrypt) i ustal naprawę (`MIGRATIONS_BASELINE.md`, wariant C). |
| błąd w trakcie `--apply` | Transakcja jest atomowa: nic nie zostało zapisane. Uruchom `db-inspect.mjs` i sprawdź stan `__drizzle_migrations`. |
| Trzeba cofnąć baseline | `DROP TABLE IF EXISTS "__drizzle_migrations";` (panel Turso, jeśli ma konsolę SQL) albo przywrócenie z backupu (niżej). |

### Alternatywa: SQL w panelu Turso

Jeśli panel app.turso.tech ma konsolę SQL / edytor zapytań (**do potwierdzenia**: nazwa i położenie w panelu),
można tam wkleić SQL wariantu A albo B z `MIGRATIONS_BASELINE.md` (krok 4). Najpierw sprawdź hashe:

```powershell
Get-FileHash drizzle\0000_tidy_living_mummy.sql, drizzle\0001_maps_colonies.sql -Algorithm SHA256
node -p "require('./drizzle/meta/_journal.json').entries.map(e => e.tag + ' ' + e.when).join('\n')"
```

`Get-FileHash` wypisuje hash WIELKIMI literami; w SQL użyj małych (tak liczy migrator). Konsola webowa może nie
wykonywać wielu instrukcji w jednej transakcji; skrypt Node jest bezpieczniejszy.

### Przywrócenie z backupu (awaryjnie)

Backup z `db-inspect.mjs` jest zwykłym SQL-em. Przywracaj do **nowej** bazy (utwórz w panelu `<baza>-restore`, nowy token),
nigdy na produkcję bez drugiego backupu. Najprostsza droga bez CLI: jednorazowy skrypt Node w `$HOME\mars-ops`:

```js
// restore.mjs: wykonuje plik SQL na bazie z turso_url (użyj URL-a i tokenu NOWEJ bazy).
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(path.join(process.cwd(), "package.json"));
const { createClient } = await import(pathToFileURL(require.resolve("@libsql/client")).href);
const client = createClient({ url: process.env.turso_url, authToken: process.env.turso_token || undefined });
await client.executeMultiple(fs.readFileSync(process.argv[2], "utf8"));
console.log("restored");
client.close();
```

```powershell
$env:turso_url = "libsql://<baza>-restore-<org>.turso.io"; $env:turso_token = "<token nowej bazy>"
node $HOME\mars-ops\restore.mjs $HOME\mars-terraform-backups\backup-<czas>.sql
Remove-Item Env:turso_url, Env:turso_token
```

(Tu celowo bez `--env-file-if-exists`, żeby nie trafić w produkcyjny `turso_url` z `.env.local`; skrypt bierze zmienne z sesji.
Przetestowano na `file:`; `executeMultiple` z `BEGIN`/`COMMIT` na zdalnym `libsql://` **do potwierdzenia**.)

---

## 3. Backend na Render (D15)

**Cel:** API (`Dockerfile.api`, `serve_frontend=false`) na `https://<app>.onrender.com`, region Frankfurt, plan **Free**
(usypia po 15 min bez ruchu, start ok. 1 min), migracje **przy starcie kontenera** (CMD obrazu), bo darmowy plan
Render nie obsługuje pre-deploy command.

> Historia: pierwotnie Fly.io (D1, D8). 2026-09-26 zmiana na Render (D15), bo Fly po zakończeniu triala wymaga karty.
> Aplikacja `mars-terraform-api` utworzona na Fly nie ma maszyn i nic nie kosztuje. Usunięcie (nieodwracalne, wykonuje
> człowiek): `fly apps destroy mars-terraform-api`.

### Kroki

1. **Konto:** https://dashboard.render.com, logowanie przez GitHub i dostęp Render do repo `develforever/mars-terraform`
   (etykiety w panelu **do potwierdzenia**). Plan Free nie wymaga karty.
2. **Blueprint:** New → **Blueprint** → repo `develforever/mars-terraform`, gałąź `main`. Render wczyta `render.yaml`:
   usługa `mars-terraform-api`, runtime Docker (`Dockerfile.api`), plan Free, region Frankfurt, health check `/api/health`,
   automatyczny deploy po zielonym CI (`autoDeployTrigger: checksPass`).
   - Jeśli adres usługi będzie inny niż `https://mars-terraform-api.onrender.com` (nazwa zajęta), zmień `backend_url`
     w panelu (usługa → Environment) i w `render.yaml` (commit przez PR). Od niego zależą callbacki OAuth.
3. **Zmienne tajne** (`sync: false` w `render.yaml`): Render pyta o nie przy tworzeniu Blueprintu. Wartości wpisujesz
   tylko w panelu, nigdy w repo ani w terminalu:
   - `jwt_secret`: **nowy, osobny od lokalnego**. Wygeneruj prosto do schowka (bez wypisywania na ekran):
     ```powershell
     node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('hex'))" | Set-Clipboard
     ```
     Wklej w pole `jwt_secret`, a potem wyczyść schowek: `Set-Clipboard -Value ' '`.
   - `turso_url`, `turso_token`: te same co w `.env.local` (skopiuj z pliku w edytorze). `turso_url` musi zaczynać się od `libsql://`.
   - Opcjonalne (OAuth, e-mail, AI) dodajesz później: usługa → Environment (lista nazw w komentarzu `render.yaml`).
     `NODE_ENV`, `serve_frontend`, `PORT`, `backend_url` ustawia `render.yaml`; nie dubluj ich w panelu.
   - `frontend_url` i `cors_origins` ustawiasz dopiero w sekcji 5 (po poznaniu domeny Vercel).
4. **Deploy:** utworzenie Blueprintu uruchamia pierwszy build i start. Kolejne deploye idą same po pushu na `main`
   z zielonym CI; ręcznie: usługa → Manual Deploy → Deploy latest commit (**do potwierdzenia**: etykieta).
   Co się dzieje:
   - build obrazu z `Dockerfile.api` (BuildKit; kontekst filtruje `Dockerfile.api.dockerignore`),
   - start kontenera = `node dist_backend/migrate.js && exec node dist_backend/index.js`. Błąd migracji kończy kontener
     kodem 1, API nie startuje, deploy jest oznaczony jako nieudany, a poprzednia wersja działa dalej,
   - Render przełącza ruch, gdy `/api/health` odpowiada 200.
   Migrator działa przy **każdym** starcie (także po uśpieniu). Bez nowych migracji to jedno zapytanie (kilkadziesiąt ms).

### Oczekiwany wynik

- Logi usługi (panel → Logs):
  - `[migrate] No new migrations (applied total: 2) in … ms` (baseline z sekcji 2 zrobiony),
  - potem `🚀 Backend running on http://0.0.0.0:8080`.
- Health:
  ```powershell
  curl.exe -s https://<app>.onrender.com/api/health
  ```
  → `{"status":"ok","version":"<wersja z package.json>"}` (HTTP 200). Po uśpieniu pierwsze wywołanie trwa ok. 1 min.
- `curl.exe -s -i https://<app>.onrender.com/generate` → `404` z `{"error":"Not Found"}` (obraz API-only).
- Panel → Events: ostatni deploy „live”.

### Co jeśli nie wyszło

| Objaw | Działanie |
|---|---|
| Deploy nieudany, log: `[migrate] Failed ... table ... already exists` | Brak baseline. Sekcja 2, potem Manual Deploy. |
| `[migrate] Failed ... Missing required env variable: jwt_secret` | Zmienna nie ustawiona: usługa → Environment, krok 3. |
| `[migrate] Failed ... 401` / `fetch failed` | Zły `turso_url` / `turso_token` (np. stary, unieważniony token). |
| `[migrate] Warning: NODE_ENV=production with a local file database` | `turso_url` nie ustawiony; migracja poszła na plik w kontenerze. Ustaw zmienną i wdroż ponownie. |
| Health 503 `{"status":"degraded","database":"unavailable"}` | API działa, baza nie odpowiada w 2 s. Logi (`[health] database check failed`), token i status Turso. Render nie przełączy ruchu na taki deploy. |
| Kontener restartuje się w pętli | Logi. Najczęściej błąd konfiguracji przy starcie (`Invalid env variable cors_origins ...`, brak `jwt_secret`). |
| Log builda pokazuje duży kontekst (`public/`, `dist/`) | Render nie użył `Dockerfile.api.dockerignore`. Obraz i tak kopiuje tylko wskazane ścieżki; zapisz jako follow-up (np. `dockerContext` z osobnym `.dockerignore`). |
| Usługa „suspended” | Wyczerpane 750 h/miesiąc albo limit transferu planu Free bez karty. Wraca od nowego miesiąca. |
| Build: błąd `bcrypt` / `@libsql` | Nie powinno wystąpić (CI buduje ten sam obraz). Sprawdź, czy wdrażasz `main` z zielonym CI. |

Rollback do poprzedniej wersji: usługa → Events → poprzedni udany deploy → **Rollback** (**do potwierdzenia**: etykieta).
Rollback obrazu **nie cofa** migracji bazy. Migrator starszej wersji nie zna nowszych migracji i wypisze `No new migrations`,
więc stary kod musi działać z nowszym schematem (dotychczasowe migracje tylko dodają tabele). Cofnięcie schematu: sekcja 7.

---

## 4. Frontend na Vercel (D3)

**Cel:** statyczny build Vite na Vercel z `vercel.json` (SPA rewrites, cache, nagłówki bezpieczeństwa), a API wołane
bezpośrednio przez `VITE_API_URL` + CORS (D3, bez proxy `/api` na Vercel).

### Kroki

1. vercel.com → **Add New… → Project** → **Import** repo `develforever/mars-terraform` (**do potwierdzenia**: etykiety w panelu).
2. Ustawienia projektu:
   - **Root Directory:** `./` (katalog główny repo).
   - **Framework Preset:** Vite (wykryje go też `vercel.json`: `"framework": "vite"`).
   - **Build / Install / Output:** zostaw domyślne; `vercel.json` ustawia `installCommand: npm ci`,
     `buildCommand: tsc -b && vite build` (tylko frontend, bez backendu), `outputDirectory: dist`.
   - **Node.js Version** (Settings → General / Build, **do potwierdzenia**): 24.x, tak jak CI i obraz API.
3. **Environment Variables:** `VITE_API_URL` = `https://<app>.onrender.com` (bez końcowego `/`), zaznacz **Production** i **Preview**.
   To zmienna czasu **builda**: po zmianie wartości trzeba zrobić nowy deploy (Redeploy), bo stary bundle ma starą wartość.
4. **Deploy.** Pierwszy deploy z gałęzi produkcyjnej (`main`) to Production. Preview powstaje dla każdego innego brancha / PR.
   Do testu przed produkcją: wypchnij dowolny branch (np. pusty commit) i poczekaj na Preview.
5. **Obowiązkowa weryfikacja nagłówków** (PLAN §5 T9; semantyka kolejności reguł `headers` w Vercel nie była
   sprawdzona w trakcie T5, bo vercel.com był niedostępny z sesji):
   ```powershell
   $base = "https://<projekt>.vercel.app"      # albo URL preview
   # nazwa zhashowanego bundla z index.html:
   $js = ((curl.exe -s "$base/") | Select-String -Pattern '/assets/[^"]+\.js' -AllMatches).Matches[0].Value
   $js
   foreach ($p in @('/', '/generate', $js, '/textures/2k_mars.jpg')) {
     "== $p"
     curl.exe -s -I "$base$p" | Select-String -Pattern '^(HTTP|cache-control|content-type|x-frame-options|strict-transport-security)'
   }
   ```

### Oczekiwany wynik

| Ścieżka | Status | `Cache-Control` |
|---|---|---|
| `/` | 200 | `no-cache` |
| `/generate` (SPA rewrite) | 200, `text/html` | `no-cache` |
| `/assets/<hash>.js` | 200 | `public, max-age=31536000, immutable` |
| `/textures/2k_mars.jpg` | 200 | `public, max-age=86400, stale-while-revalidate=604800` |

Na każdej ścieżce także `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy`, `permissions-policy`,
`strict-transport-security`, `content-security-policy-report-only`.
W przeglądarce: `https://<projekt>.vercel.app/generate` i `/mars` ładują się także po odświeżeniu (F5), tekstury Marsa są widoczne.

### Co jeśli nie wyszło

| Objaw | Działanie |
|---|---|
| **`/assets/*.js` albo `/textures/*` ma `no-cache`** | Vercel stosuje „pierwsza pasująca reguła wygrywa” dla tego samego klucza (test w repo zakłada „ostatnia wygrywa”). Napraw w repo (PR): w `vercel.json` przenieś regułę catch-all `"source": "/(.*)"` na **koniec** tablicy `headers` (po `/assets/(.*)` i `/(models\|textures\|icons)/(.*)`), a w `src/test/vercelConfig.test.ts` zmień `effectiveHeaders` na semantykę „pierwsza wygrywa” (ustawiaj klucz tylko, gdy `!result.has(key)`), popraw komentarz nad funkcją. `npm run test:front`, commit, deploy, powtórz `curl.exe -I`. |
| `/` albo `/generate` ma `public, max-age=0, must-revalidate` zamiast `no-cache` | Domyślny nagłówek Vercel nie został nadpisany. Sprawdź, czy wdrożony commit zawiera `vercel.json` (Deployment → Source). Semantycznie jest to równoważne `no-cache`; zapisz obserwację i zdecyduj, czy poprawiać. |
| `/generate` → 404 | Brak rewrite SPA: wdrożony commit bez `vercel.json` albo inny Root Directory. |
| Preview zwraca 401 / stronę logowania Vercel | Deployment Protection (Vercel Authentication) dla preview (**do potwierdzenia**: domyślne ustawienie konta). Zaloguj się w przeglądarce albo testuj nagłówki na Production. |
| Build pada na `tsc -b` | Ten sam błąd jest lokalnie: `npx tsc -b`. Deploy tylko z zielonego CI. |
| Aplikacja woła `https://<projekt>.vercel.app/api/...` (404) | `VITE_API_URL` nie był ustawiony w chwili builda. Ustaw i zrób Redeploy. |

---

## 5. Spięcie: CORS, frontend_url, OAuth

**Cel:** API akceptuje żądania z domeny Vercel (dokładna allowlista, bez wildcardów, bez credentials), linki e-mail
i przekierowania OAuth prowadzą na frontend na Vercel.

### Kroki

1. Ustaw originy i adres frontendu (bez końcowego `/`, bez ścieżki; kilka originów rozdziel przecinkiem, bez spacji):
   panel Render → usługa → **Environment** → dodaj:
   ```
   cors_origins=https://<projekt>.vercel.app
   frontend_url=https://<projekt>.vercel.app
   # z domeną własną:
   cors_origins=https://<projekt>.vercel.app,https://<domena>
   frontend_url=https://<domena>
   ```
   Zapisz i wdroż (opcja zapisu z deployem, **do potwierdzenia**: etykieta), żeby kontener wystartował z nowymi wartościami.
   Niepoprawny origin (np. `https://x.vercel.app/`) zatrzyma start API z błędem `Invalid env variable cors_origins`.
   Nie dopisuj tych kluczy do `render.yaml` (pusty `frontend_url` nie włącza wartości domyślnej).
2. **Test preflight z konsoli:**
   ```powershell
   curl.exe -s -i -X OPTIONS https://<app>.onrender.com/api/maps `
     -H "Origin: https://<projekt>.vercel.app" `
     -H "Access-Control-Request-Method: POST" `
     -H "Access-Control-Request-Headers: authorization, content-type"
   ```
   Oczekiwane: `HTTP/1.1 204` (albo `HTTP/2 204`), `access-control-allow-origin: https://<projekt>.vercel.app`,
   `access-control-allow-methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`, `access-control-allow-headers: Authorization, Content-Type`,
   `access-control-max-age: 600`, `vary: Origin`, **brak** `access-control-allow-credentials`.

   Kontrola negatywna (obcy origin):
   ```powershell
   curl.exe -s -i -X OPTIONS https://<app>.onrender.com/api/maps -H "Origin: https://evil.example" -H "Access-Control-Request-Method: POST"
   ```
   Oczekiwane: `403`, `vary: Origin`, brak `access-control-allow-origin`.
3. **Test z przeglądarki:** otwórz `https://<projekt>.vercel.app`, DevTools (F12) → **Network**, zaloguj się albo otwórz
   listę map w `/generate`. Żądania do `https://<app>.onrender.com/api/...` mają status 2xx/4xx aplikacji,
   w odpowiedzi `access-control-allow-origin` = origin strony, a w **Console** brak `blocked by CORS policy`.
4. **OAuth (jeśli używasz):** callback jest na API (`backend_url` z `render.yaml`), a po sukcesie API przekierowuje na
   `${frontend_url}/?token=...`.
   - Google Cloud Console → APIs & Services → Credentials → OAuth client → **Authorized redirect URIs**:
     `https://<app>.onrender.com/api/auth/google/callback`
   - GitHub → Settings → Developer settings → OAuth Apps → **Authorization callback URL**:
     `https://<app>.onrender.com/api/auth/github/callback`
     (aplikacja OAuth GitHub ma jeden callback URL, więc na lokalny dev załóż osobną aplikację).
   - Zmienne: `google_client_id`, `google_client_secret` (i/lub `github_*`) w panelu → Environment.
   - Sprawdzenie: `curl.exe -s https://<app>.onrender.com/api/auth/providers` pokazuje skonfigurowanych dostawców.

### Oczekiwany wynik

Preflight 204 dla originu Vercel, 403 dla obcego; w przeglądarce brak błędów CORS; logowanie OAuth kończy się
na `https://<projekt>.vercel.app/?token=...` i zalogowanym UI.

### Co jeśli nie wyszło

| Objaw | Działanie |
|---|---|
| `blocked by CORS policy: No 'Access-Control-Allow-Origin'` | Origin strony nie jest na liście. Porównaj znak po znaku (schemat, brak `/` na końcu, `www`). Popraw `cors_origins` w panelu → Environment. |
| CORS działa na Production, nie działa na Preview | Oczekiwane: URL-e preview (`<projekt>-<hash>-<team>.vercel.app`) nie są na allowliście (dokładne dopasowanie, bez wildcardów). Na czas testu dopisz konkretny URL preview do `cors_origins` i usuń go potem. |
| Preflight 403 z poprawnym originem | Zmiana zmiennych nie została wdrożona: panel → Events, czy nowy deploy jest „live”. |
| OAuth: `redirect_uri_mismatch` (Google) / `redirect_uri is not associated` (GitHub) | Redirect URI w konsoli dostawcy musi być identyczny z `${backend_url}/api/auth/<provider>/callback`. |
| Po OAuth ląduje na `http://localhost:5173/?token=...` | `frontend_url` nie ustawiony w Render. Krok 1. |

---

## 6. Smoke test produkcji

**Cel:** potwierdzić pełną ścieżkę użytkownika na produkcji. Wykonuj na `https://<projekt>.vercel.app` z otwartym DevTools → Network.

- [ ] **Health:** `curl.exe -s https://<app>.onrender.com/api/health` → `{"status":"ok",...}`. Pierwsze wywołanie po przerwie może trwać
      ok. 1 min (cold start planu Free Render).
- [ ] **Front:** `/`, `/generate`, `/mars` ładują się, także po F5 (SPA rewrite). Tekstury i modele z `/textures`, `/models`.
- [ ] **Rejestracja:** formularz rejestracji → komunikat „Registration successful. Please check your email…”.
- [ ] **Weryfikacja e-mail:**
  - przy `email_strategy=console` (domyślnie) e-mail trafia tylko do logów (panel Render → usługa → Logs).
    Szukaj bloku `========== EMAIL ==========` z `Subject: Verify Your Email` i linkiem
    `https://<projekt>.vercel.app/verify-email?token=...`. Otwórz link w przeglądarce.
    (Jeśli link zaczyna się od `http://localhost:5173`, `frontend_url` nie jest ustawiony: sekcja 5; możesz ręcznie podmienić host.)
  - przy prawdziwym dostawcy (SMTP/Resend/...) sprawdź skrzynkę; błąd wysyłki jest w logach usługi Render.
- [ ] **Logowanie** (e-mail + hasło) → UI zalogowany. Złe hasło → komunikat „Invalid credentials” (401), nie 500.
- [ ] **Zapis mapy w `/generate`:** wygeneruj teren → zapis do chmury (`CloudMapsModal`) → `POST /api/maps` = 2xx →
      mapa widoczna na liście po odświeżeniu (`GET /api/maps`).
- [ ] **Zapis i wczytanie kolonii w `/mars`:** zapis gry → `POST /api/colony` = 2xx; odśwież stronę → wczytaj
      (`LoadGameModal`, `GET /api/colony/<nazwa>`) → stan gry odtworzony (budynki, zasoby).
- [ ] **OAuth** (jeśli skonfigurowany): logowanie Google / GitHub kończy się zalogowanym UI.
- [ ] (Opcjonalnie) **413 dla ciała > 2 MB** (limit globalny `express.json`, sprawdzany przed autoryzacją, więc token nie jest potrzebny):
  ```powershell
  $big = '{"name":"smoke-413","state":{"x":"' + ('a' * 3MB) + '"}}'
  Set-Content -Path $HOME\mars-ops\big.json -Value $big -NoNewline -Encoding ascii
  curl.exe -s -w " HTTP %{http_code}`n" -X POST https://<app>.onrender.com/api/colony -H "Content-Type: application/json" --data-binary "@$HOME\mars-ops\big.json"
  Remove-Item $HOME\mars-ops\big.json
  ```
  Oczekiwane: `{"error":"Payload Too Large"} HTTP 413`.

**Co jeśli nie wyszło:** tabela w sekcji 7.

---

## 7. Rollback i awarie

| Objaw | Prawdopodobna przyczyna | Działanie |
|---|---|---|
| Console: `blocked by CORS policy` | `cors_origins` nie zawiera originu strony (literówka, `/` na końcu, preview URL) | Sekcja 5, krok 1; panel → Environment. |
| Front woła `/api/...` na domenie Vercel (404) | `VITE_API_URL` pusty w chwili builda | Ustaw w Vercel (Production + Preview) i Redeploy. |
| `/api/health` = **503** `database: unavailable` | Turso niedostępne, zły / unieważniony `turso_token`, zły `turso_url` | Logi usługi (`[health] database check failed`), status Turso, sekcja 1. Render uzna instancję za niezdrową (follow-up: rozdział liveness/readiness). |
| Deploy nieudany, kontener kończy się na migracji: `table ... already exists` | Brak baseline (baza z `push`) | Sekcja 2 (baseline), potem Manual Deploy. Stara wersja działa dalej. |
| Deploy nieudany na migracji przy starcie, inny błąd SQL | Migracja niezgodna ze stanem bazy (wariant C) | Nie ponawiaj w pętli. `db-inspect.mjs`, porównanie z `MIGRATIONS_BASELINE.md`, ręczna naprawa. |
| Zapis kolonii / mapy → **413** | Ciało > 2 MB (`JSON_BODY_LIMIT_BYTES`) | Oczekiwane dla ogromnych stanów. Typowa gra ~146 kB. Jeśli dotyczy zwykłych zapisów, zmierz payload (DevTools → Request size) i zgłoś. |
| Zapis kolonii → 400 z `fields` | Rozjazd tras TSOA z modelem | CI (`tsoa:gen` + `git diff`) powinien to wykryć; sprawdź, czy wdrożony commit ma zielone CI. |
| Pierwsze żądanie po przerwie trwa ok. 1 min / timeout | Cold start planu Free (uśpienie po 15 min bez ruchu) | Oczekiwane (D15). Jeśli przeszkadza: płatny plan bez usypiania (`plan` w `render.yaml`, PR). |
| API nie startuje: `Invalid env variable cors_origins` / `serve_frontend` | Niepoprawna wartość sekretu | Popraw zmienną w panelu → Environment i wdroż ponownie. |
| 401 dla wszystkich zalogowanych po deployu | Zmieniony `jwt_secret` | Oczekiwane po rotacji: zaloguj się ponownie. |

### Procedury rollbacku

- **API (kod):** panel Render → usługa → Events → poprzedni udany deploy → Rollback (sekcja 3).
- **Frontend:** Vercel → Deployments → poprzedni deploy Production → **Promote to Production** / **Instant Rollback**
  (**do potwierdzenia**: nazwa akcji). Nie wymaga nowego builda.
- **Baza:** baseline cofa `DROP TABLE IF EXISTS "__drizzle_migrations";`. Wariant B po deployu i poważne awarie:
  `MIGRATIONS_BASELINE.md` → „5. Rollback” oraz przywrócenie backupu do nowej bazy (sekcja 2) i przełączenie
  `turso_url` / `turso_token` w panelu Render → Environment (`libsql://<baza>-restore-<org>.turso.io`).
- **Zmienne:** usunięcie w panelu → Environment (wymaga ponownego deployu).

---

## 8. Po wdrożeniu

**Cel:** zaostrzyć konfigurację, gdy domeny są znane, i zamknąć pozostałe ryzyka.

1. **CSP `connect-src`:** w `vercel.json` (`Content-Security-Policy-Report-Only`) zawęź `connect-src 'self' https: blob: data:`
   do `connect-src 'self' https://<app>.onrender.com blob: data:` (albo domeny API). `blob:` i `data:` są potrzebne dla GLTFLoader.
   Na preview Vercel może wstrzykiwać skrypty `vercel.live` (toolbar), uwzględnij to przed trybem enforce.
   Zmiana wymaga aktualizacji `src/test/vercelConfig.test.ts`, jeśli test sprawdza CSP.
2. **`report-to` / `report-uri`** dla CSP, zebranie raportów na produkcji, dopiero potem przejście z `Report-Only` na enforce.
3. **HSTS `includeSubDomains`:** obecnie `max-age=63072000; includeSubDomains`. Przed podpięciem domeny własnej upewnij się,
   że **wszystkie** subdomeny tej domeny obsługują HTTPS (inaczej przeglądarki odetną je na 2 lata). W razie wątpliwości usuń
   `includeSubDomains` przed podpięciem domeny.
4. **Domena własna:** po podpięciu dopisz ją do `cors_origins`, ustaw `frontend_url`, zaktualizuj redirecty OAuth, jeśli API
   dostanie domenę (`backend_url` w `render.yaml` i w panelu Render).
5. **Lokalny dev a produkcja:** jeśli `.env.local` wskazuje na produkcyjną bazę Turso, to lokalne `npm run dev` i `npm run db:push`
   działają na produkcji. Po wdrożeniu przełącz lokalny dev na `turso_url=file:./local.db` albo osobną bazę deweloperską.
   **Nigdy `drizzle-kit push` na produkcji** (tylko `generate` → commit → deploy).
6. Usuń skrypty i backupy tymczasowe z `$HOME\mars-ops` albo przenieś backupy w bezpieczne miejsce (dane osobowe).

### Follow-upy z `QUEUE.md` (poza zakresem Fazy 8)

- Token JWT w query string po OAuth (`/?token=`) → fragment `#token=` albo wymiana jednorazowego kodu.
- Wersjonowanie nazw assetów w `public/` (umożliwi `immutable` dla `/models`, `/textures`, `/icons`).
- Hardcodowane hosty ngrok w `vite.config.ts` (`server.allowedHosts`).
- Rozjazd wersji Node: `.nvmrc` v25, obrazy node 24, backend target node22.
- `useGameStore.ts`: `/api/colony/${name}` bez `encodeURIComponent`.
- Walidacja `VITE_API_URL` przy starcie aplikacji.
- `.dockerignore` monolitu nie wyklucza `.env` / `local.db*`.
- `res.sendFile` w SPA fallbacku monolitu ignoruje dotfiles w ścieżce absolutnej.
- CSP: `report-to`, zawężenie `connect-src`, `vercel.live` na preview (punkt 1–2 wyżej).
- HSTS `includeSubDomains` przed domeną własną (punkt 3 wyżej).
- Graceful shutdown: handler SIGTERM/SIGINT w `src_backend/index.ts`.
- `/api/health` zależy od DB: rozdział liveness / readiness.
- Plan Free Render: cold start ok. 1 min, limit 750 h/miesiąc i transferu; płatny plan przy realnym ruchu.
- Migrator przy każdym starcie kontenera (D15): przy wielu instancjach równoległe starty mogą ścigać się o tę samą migrację; przy 1 instancji bez znaczenia.
- `src_backend/db/migrate.test.ts` pada lokalnie na Windows (`EPERM` przy usuwaniu katalogu tymczasowego z otwartą bazą SQLite); CI (Linux) zielone.
- Migracja z `file:` w produkcji tylko ostrzega (celowo, dla smoke testów kontenera).
- Timing `resend-verification` / `forgot-password` zdradza istnienie konta; rejestracja: 409 przy zajętym e-mailu, 500 przy awarii SMTP po utworzeniu konta.
- `GET /api/colony` zwraca pełny `state` każdej kolonii (lekka lista = zmiana kontraktu API).
- Limit body 2 MB jest globalny (także `/api/maps`).
- `resumeLocalGame` bez try/catch.

---

## Załącznik: jak przetestowano skrypty (T9, 2026-09-26)

Na lokalnych bazach `file:` (Linux, Node v22.22.2, `@libsql/client` 0.17.3); wersje w tym pliku są identyczne z testowanymi.

| Scenariusz | Wynik |
|---|---|
| Baza z `node dist_backend/migrate.js` → `db-inspect` | 9 tabel (z `__drizzle_migrations`, 2 wiersze, hashe zgodne z `MIGRATIONS_BASELINE.md`), backup zapisany |
| Ta sama baza → `db-baseline --variant=A` | `STOP: __drizzle_migrations już istnieje`, exit 2 |
| Baza z `drizzle-kit push --force` + dane testowe (apostrofy, cudzysłowy, znaki PL, nowe linie, liczba > 2^53) → `db-inspect` | 8 tabel, brak `__drizzle_migrations`, backup 7 wierszy; ponowny zapis do tego samego pliku odrzucony |
| Przywrócenie backupu do nowej bazy (`restore.mjs` z tego runbooka) i porównanie ze źródłem | 21 porównanych elementów (schemat, dane, `sqlite_sequence`), 0 różnic; `9007199254740993` zachowane jako integer |
| `db-baseline` bez argumentu / `--variant=B` na 8 tabelach | exit 1 / exit 3 (`maps`, `colonies` nie powinny istnieć) |
| `db-baseline --variant=A` (dry-run) | exit 0, SQL wypisany, `__drizzle_migrations` nadal nie istnieje |
| `migrate.js` bez baseline | `table email_verifications already exists`, exit 1 |
| `db-baseline --variant=A --apply`, potem `migrate.js` | 2 wiersze; `No new migrations (applied total: 2)` |
| Baza tylko z `0000` → `--variant=A` / `--variant=B --apply` → `migrate.js` ×2 | exit 3 / 1 wiersz; `Applied 1 migration(s) (applied total: 2)`, potem `No new migrations` |
| Dryf schematu (dodatkowa kolumna, brak indeksu unikalnego) → `--variant=A --apply` | exit 3, rozbieżności wypisane, nic nie zapisano |
| `turso_url` na nieistniejący host `libsql://` | `BŁĄD: zapytanie nie powiodło się: fetch failed`, exit 1, plik backupu nie powstał |
| `--env-file-if-exists=.env --env-file-if-exists=.env.local` z różnym `turso_url` w obu plikach | użyty `.env.local` |

Nieprzetestowane: połączenie z prawdziwym Turso (`libsql://` + token), PowerShell (sesja agenta na Linuksie).
