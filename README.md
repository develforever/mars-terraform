# Mars Terraform

Gra przeglądarkowa 3D (React + Three.js / React Three Fiber) o terraformacji Marsa: widok „Home” z planetą oraz widok kolonii z budową struktur zużywających i produkujących zasoby.

## Uruchamianie

Wymaga Node.js z npm.

```bash
npm install
```

Frontend (Vite):

```bash
npm run dev:front
```

Backend Express (API użytkowników/grup, JWT — osobny moduł, nie spięty z logiką gry w UI):

```bash
npm run dev:back
```

Oba procesy naraz:

```bash
npm run dev
```

Domyślny frontend: adres z konsoli Vite (zwykle `http://localhost:5173`). Konfiguracja backendu przez zmienne środowiskowe (np. `.env.local`).

## Nawigacja w aplikacji

- **`/`** — start: obracająca się Mars, klik otwiera modal nazwy kolonii.
- **`/mars`** — scena pola terraformacji z siatką terenu, HUD (zasoby ☀️, O₂, energia, woda, biomasa), tryby budowy / rozbiórki (również klawisze **B**, **X**, **Esc**).

Ekonomia gry wywoływana jest co około **1 sekundę** podczas gry na trasie `/mars` (tick w `useEconomy`; po **game over** pętla się zatrzymuje i startuje ponownie po **„Nowa gra”**, bez przeładowania strony).

## Skrypty przydatne w dev

- `npm run build` — build produkcyjny frontu  
- `npm run test` — testy frontend + backend Vitest  
- `npm run tsoa:gen` — regeneracja tras OpenAPI dla backendu (Tsoa)  
- `npm run db:push` — schemat bazy Drizzle  

## Repo

Część plików w `src/app/mars3d/` to starsza lub równoległa ścieżka; aktywna gra i routing korzystają z **`src/app/App.tsx`** oraz komponentów w **`src/presentation/`**.
