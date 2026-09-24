# Baseline migracji produkcyjnej bazy Turso (D11)

Wykonuje **człowiek**, ręcznie, **raz, przed pierwszym deployem** API z `node dist_backend/migrate.js`
(`npm run db:migrate:prod`). Agent nie łączy się z produkcyjną bazą.

## Dlaczego to jest potrzebne

Produkcyjna baza powstała przez `drizzle-kit push` (D11), więc nie ma tabeli `__drizzle_migrations`.
Migrator (`drizzle-orm/libsql/migrator`, używany przez `src_backend/db/migrate.ts`) uzna taką bazę
za pustą i spróbuje wykonać `0000` od początku. Deploy padnie na
`table ... already exists` (sprawdzone empirycznie na bazie utworzonej przez `push`).
Baseline wpisuje do `__drizzle_migrations` migracje, które baza już ma, żeby migrator je pominął.

## Jak działa migrator (drizzle-orm 0.45.2, sprawdzone w źródle)

Źródło: `node_modules/drizzle-orm/migrator.js` (`readMigrationFiles`) i `node_modules/drizzle-orm/libsql/migrator.js`.

- Tabela tworzona przez migrator (dokładny DDL):
  ```sql
  CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at numeric
  );
  ```
  `SERIAL` to w SQLite zwykły typ, nie alias `rowid`, więc `id` po INSERT ma wartość `NULL`.
  Tak samo zachowuje się tabela utworzona przez sam migrator, więc to nie jest błąd.
- `hash` = `sha256` (hex) **całej treści pliku** `drizzle/<tag>.sql`, bajt w bajt. Wynik jest identyczny z `sha256sum`.
- `created_at` = pole `when` wpisu w `drizzle/meta/_journal.json`.
- Porównanie: migrator czyta **tylko ostatni wiersz** (`ORDER BY created_at DESC LIMIT 1`) i stosuje
  każdą migrację z `when > created_at`. **Hash nie jest sprawdzany.** Decyduje wyłącznie `created_at`.
  Wpisujemy jednak poprawne hashe, żeby tabela wyglądała tak, jakby migracje wykonał migrator.
- Wszystkie zaległe migracje idą w jednym batchu (atomowo).

## Aktualne migracje

| # | tag | `when` (= `created_at`) | sha256 pliku `.sql` | tabele |
|---|-----|-------------------------|---------------------|--------|
| 0000 | `0000_tidy_living_mummy` | `1778522201990` | `4cd12e0f347c1d368124db1718372c933ed72b3706d45102cbaad6388a253383` | users, user_auth_methods, groups, user_groups, password_resets, email_verifications |
| 0001 | `0001_maps_colonies` | `1790271837079` | `e4de0522d7e25bb8bee91311713af581d3ed3b1ba1e67f2c895d49a9b2d9be34` | colonies, maps |

Sprawdź przed użyciem, czy wartości nadal się zgadzają (pliki nie mogą się zmienić po wdrożeniu):

```bash
sha256sum drizzle/0000_tidy_living_mummy.sql drizzle/0001_maps_colonies.sql
node -p 'require("./drizzle/meta/_journal.json").entries.map(e => e.tag + " " + e.when).join("\n")'
```

## Procedura

Poniżej `<db>` to nazwa bazy w Turso (nie zapisuj jej w repo).

### 0. Backup (obowiązkowo)

```bash
turso db shell <db> .dump > backup-<db>-$(date -u +%Y%m%dT%H%MZ).sql
```

Sprawdź, czy plik nie jest pusty i zawiera `CREATE TABLE`. Trzymaj go poza repo, bo zawiera dane użytkowników.

### 1. Inwentaryzacja

```bash
turso db shell <db> ".tables"
turso db shell <db> "SELECT name FROM sqlite_master WHERE name = '__drizzle_migrations'"
for t in users user_auth_methods groups user_groups password_resets email_verifications maps colonies; do
  echo "== $t"; turso db shell <db> ".schema $t"
done
```

Jeśli `__drizzle_migrations` **już istnieje**, STOP. Ktoś już wykonał migrator albo baseline.
Pokaż zawartość (`SELECT * FROM __drizzle_migrations`) i ustal stan, zanim cokolwiek zmienisz.

### 2. Porównanie z `0000` i `0001` (checklista)

Porównaj wynik `.schema` z `drizzle/0000_tidy_living_mummy.sql` i `drizzle/0001_maps_colonies.sql`.
Kolejność kolumn i cudzysłowy mogą się różnić. Liczą się nazwa, typ, `NOT NULL`, `DEFAULT`, PK, FK i indeksy unikalne.

**0000**

- [ ] `users`: `id` integer PK AUTOINCREMENT; `name` text NN; `email` text NN; `auth_provider` text NN DEFAULT `'local'`; `provider_id` text; `email_verified_at` integer; `deleted_at` integer; `created_at` integer NN DEFAULT `(unixepoch())`; `updated_at` integer NN DEFAULT `(unixepoch())`; indeks unikalny `users_email_unique(email)`
- [ ] `user_auth_methods`: `id` integer PK AUTOINCREMENT; `user_id` integer NN FK → `users.id`; `provider` text NN; `provider_id` text; `password_hash` text; `verified` integer NN DEFAULT `false`; `created_at` integer NN DEFAULT `(unixepoch())`
- [ ] `groups`: `id` integer PK AUTOINCREMENT; `name` text NN; `description` text; `created_at` integer NN DEFAULT `(unixepoch())`; indeks unikalny `groups_name_unique(name)`
- [ ] `user_groups`: `user_id` integer NN FK → `users.id`; `group_id` integer NN FK → `groups.id`; PK złożony (`user_id`, `group_id`)
- [ ] `password_resets`: `id` integer PK AUTOINCREMENT; `user_id` integer NN FK → `users.id`; `token` text NN; `expires_at` integer NN; `created_at` integer NN DEFAULT `(unixepoch())`; indeks unikalny `password_resets_token_unique(token)`
- [ ] `email_verifications`: jak `password_resets`, indeks unikalny `email_verifications_token_unique(token)`

**0001**

- [ ] `colonies`: `id` integer PK AUTOINCREMENT; `user_id` integer NN FK → `users.id`; `name` text NN; `state` text NN; `updated_at` integer NN DEFAULT `(unixepoch())`; `created_at` integer NN DEFAULT `(unixepoch())`
- [ ] `maps`: `id` integer PK AUTOINCREMENT; `user_id` integer NN FK → `users.id`; `name` text NN; `description` text; `players` integer NN DEFAULT `2`; `version` text NN DEFAULT `'2.0'`; `data` text NN; `created_at` integer NN DEFAULT `(unixepoch())`; `updated_at` integer NN DEFAULT `(unixepoch())`

Opcjonalna, dokładniejsza kontrola **na lokalnej kopii** (nie na produkcji):

```bash
sqlite3 /tmp/prod-copy.db < backup-<db>-....sql
turso_url=file:/tmp/prod-copy.db npx drizzle-kit push --strict --verbose
```

Oczekiwany wynik: `No changes detected`. Jeśli `push` pokazuje zmiany, odpowiedz **No** i przejdź do wariantu C.
Nie uruchamiaj `push` na bazie produkcyjnej.

### 3. Wybór wariantu

| Stan bazy | Wariant |
|-----------|---------|
| 8 tabel (6 z `0000` + `maps` + `colonies`), wszystkie zgodne z checklistą | **A**: baseline `0000` i `0001` |
| dokładnie 6 tabel z `0000`, zgodne; brak `maps` **i** `colonies` | **B**: baseline tylko `0000`. `0001` zastosuje się sama przy deployu |
| cokolwiek innego (brak tabeli z `0000`, tylko jedna z `maps`/`colonies`, inne kolumny, typy, FK, indeksy, dodatkowe tabele aplikacji) | **C**: STOP |

### 4. SQL baseline

Zapisz wybrany wariant do pliku i wykonaj: `turso db shell <db> < baseline.sql`.

**Wariant A** (8 tabel):

```sql
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric);
INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ('4cd12e0f347c1d368124db1718372c933ed72b3706d45102cbaad6388a253383', 1778522201990);
INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ('e4de0522d7e25bb8bee91311713af581d3ed3b1ba1e67f2c895d49a9b2d9be34', 1790271837079);
```

**Wariant B** (6 tabel):

```sql
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric);
INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ('4cd12e0f347c1d368124db1718372c933ed72b3706d45102cbaad6388a253383', 1778522201990);
```

**Wariant C**: nie wykonuj baseline. Opisz rozbieżności (wynik `.schema` + diff z checklistą) i ustal ręczną naprawę
(np. migracja wyrównująca albo ręczny `ALTER`). Dopiero potem wróć do kroku 1.

Weryfikacja po baseline:

```bash
turso db shell <db> "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at"
```

Pierwszy deploy (`node dist_backend/migrate.js`) powinien wypisać:

- wariant A: `No new migrations (applied total: 2)`
- wariant B: `Applied 1 migration(s) (applied total: 2)`, a potem `.tables` pokazuje `maps` i `colonies`

Zalecane: najpierw zrób próbę na lokalnej kopii z backupu (`sqlite3 /tmp/prod-copy.db < backup...sql`,
baseline, `jwt_secret=x turso_url=file:/tmp/prod-copy.db node dist_backend/migrate.js`).

### 5. Rollback

- Baseline tylko dodaje tabelę `__drizzle_migrations` i nie zmienia danych. Cofnięcie:
  ```sql
  DROP TABLE IF EXISTS "__drizzle_migrations";
  ```
- Wariant B po deployu (migrator utworzył `maps`/`colonies`): jeśli trzeba cofnąć, a tabele są **puste**
  (`SELECT COUNT(*) FROM maps; SELECT COUNT(*) FROM colonies;`):
  ```sql
  DROP TABLE maps;
  DROP TABLE colonies;
  DELETE FROM "__drizzle_migrations" WHERE created_at = 1790271837079;
  ```
- Utrata danych albo poważny błąd: odtwórz bazę z backupu z kroku 0 do **nowej** bazy
  (`turso db create <db-restore>` + `turso db shell <db-restore> < backup-....sql`) i przełącz na nią `turso_url` API.
  Nie nadpisuj bazy produkcyjnej bez drugiego backupu.

## Zasady od teraz

- Produkcję zmieniamy tylko przez `drizzle-kit generate` → commit → `node dist_backend/migrate.js`. Bez `push` na produkcji.
- Nie edytujemy zastosowanych plików `drizzle/*.sql` ani `when` w journalu. Migrator nie sprawdza hashy,
  więc zmiana przeszłaby niezauważona i baza rozjechałaby się z repo.

## Weryfikacja empiryczna (T7b, 2026-09-24, lokalny plik SQLite)

1. `drizzle-kit push --force` na pustej bazie (symulacja produkcji według D11) utworzył 8 tabel bez `__drizzle_migrations`.
   `node dist_backend/migrate.js` na takiej bazie bez baseline zakończył się błędem `table email_verifications already exists`, exit 1.
2. Ta sama baza po wariancie A (hashe z `sha256sum`) → `No new migrations (applied total: 2)`.
3. Świeża baza po migratorze ma w `__drizzle_migrations` hashe identyczne z `sha256sum` oraz `created_at` = `when`.
4. Wariant B (tabele `0000` + baseline `0000`) → migrator stosuje 1 migrację i tworzy `maps`/`colonies`.
   Scenariusze A i B są też testami automatycznymi w `src_backend/db/migrate.test.ts`.
