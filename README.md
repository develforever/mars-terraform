# Mars Terraform 🚀🔴

**Mars Terraform** to zaawansowana, przeglądarkowa gra strategiczna czasu rzeczywistego (RTS / Colony Sim) w pełnym 3D oraz demonstrator architektury fullstack, zbudowany w oparciu o **React 19**, **TypeScript**, **Three.js / React Three Fiber**, **Node.js (TSOA + Drizzle ORM)** oraz integrację z **Blenderem 5.1.1** poprzez protokół **MCP (Model Context Protocol)**.

Gracz zakłada bazę na Czerwonej Planecie, zarządza surowcami, buduje infrastrukturę przesyłową, rozwija drzewo technologiczne, zarządza łazikami i dronami logistycznymi, odpiera inwazje obcych i prowadzi proces terraformacji Marsa.

---

## 🌟 Kluczowe Podsystemy i Architektura

### 1. 🪐 Schodkowy Silnik Terenu Heksagonalnego (Hex Grid Engine)
- **Układ osiowy (Axial Coordinates)**: Płaska siatka `(q, r)` o zmiennym promieniu ($R=20$, promień heksa `1.2`).
- **Watertight Step-Mesh z Fazowaniem (Bevel/Chamfer)**: Dedykowane generatory geometrii (`TerrainMeshBuilder.ts` + `CliffBuilder.ts`) eliminujące szczeliny między różnymi poziomami wysokości (`worldY: 0.0` do `4.0`).
- **Triplanarny Shader Terenu (`SlopeMaterial.ts`)**: Modulacja teksturą Marsa 2K w przestrzeni triplanarnej, detekcja nachylenia ścian skalnych, szron na szczytach i zgodność z oświetleniem PBR.
- **Wielopoziomowy Pathfinding A\* (`HexPathfindingService.ts`)**: Nawigacja po siatce heksagonalnej uwzględniająca profile wysokościowe, z automatycznym omijaniem nieprzekraczalnych klifów.

### 2. 🗺️ Edytor Map & Asystent AI (`/generate`)
- **Pełny zestaw narzędzi edytorskich**: Malowanie biomów, kładzenie punktów startowych, węzłów budowy, złóż surowców i obiektów dekoracyjnych.
- **Asystent AI (NLP Prompt-to-Map)**: `AIMapGeneratorService.ts` przekształcający polecenia w języku naturalnym (PL/EN) na kontrakt `MapExportJSON v2.0` (np. *"Stwórz lodowy krater w centrum, otoczony górami z 2 bazami"*).
- **Deterministyczny Generator Proceduralny**: 4-oktawowy szum fBm (fractal Brownian motion), generowanie kraterów i łańcuchów górskich ze stałym seedem.
- **Chmura Map**: Pełny backend persistence (`/api/maps`) z walidacją schematów Zod.

### 3. ⚡ Pętla Rozgrywki, Logistyka i Obrona (`/mars`)
- **Infrastruktura Przesyłowa (MSF / DSU)**: Graf linii energetycznych (HDR Bloom) i rurociągów wodnych wyznaczany algorytmem *Minimum Spanning Forest* o zasięgu $R \le 4$.
- **Drzewo Ulepszeń Budynków (Poziomy 1 → 2 → 3)**:
  - *Poziom 1*: Wydobycie stacjonarne.
  - *Poziom 2*: Zautomatyzowany łazik naziemny (`rover_combat.glb` / `rover.glb`) poruszający się po ścieżkach A\*.
  - *Poziom 3*: Dron logistyczny (`craft_miner.glb` / `drone_repair.glb`) latający ponad klifami po krzywych Béziera.
- **Pętla Ekonomii i Złoża**: Złoża minerałów i lodu z premią sąsiedztwa (+50% per złoże) i dynamicznym ubytkiem surowców.
- **System Inwazji Obcych**: Ataki jednostek obcych omijających klify w drodze do Centrum Kolonii, odpierane przez wieżyczki obronne.
- **Drzewo Technologii (Tech Tree)**: 12 technologii w 6 kategoriach odblokowywanych za Punkty Badań (RP) wytwarzane w Laboratoriach.

### 4. 🎨 Asset Pipeline via Blender 5.1.1 MCP
- **Centralna Biblioteka 3D**: `C:\Users\robert\Documents\mars-terraform.blend` (504 obiekty, 153 uporządkowane assety).
- **Zautomatyzowany Kitbashing**: Proceduralne generowanie wariantów budynków (`_lvl2.glb`, `_lvl3.glb`) oraz jednostek bojowych i transportowych.
- **Proceduralne Prefaby POI**: Złożone formacje (`poi_abandoned_lab.glb`, `poi_alien_hive.glb`, `poi_crashed_freighter.glb`).
- **Optymalizacja LOD**: 26 modeli `{asset}_lod1.glb` o redukcji ~65% trójkątów zintegrowanych z komponentem `<Detailed distances={[0, 45]}>`.
- **Batch Renderer Ikon 3D**: Skrypt generujący miniatury WebP (128×128 px) w rzucie izometrycznym z przezroczystym tłem do `public/icons/`.

---

## 🛠️ Stack Technologiczny

### Frontend
- **Framework**: React 19, TypeScript
- **3D & Shaders**: Three.js, React Three Fiber (`@react-three/fiber`), `@react-three/drei`, `@react-three/postprocessing`
- **State Management**: Zustand (z selektorami i pełną niemutowalnością)
- **Styling**: TailwindCSS 4, customowy postprocessing (HDR Bloom, Screen-Space Dithering, Mie Scattering Atmosphere)
- **Testy**: Vitest, React Testing Library (352 testy frontendu)

### Backend
- **Środowisko**: Node.js, Express, TypeScript
- **API Architecture**: TSOA (kontrolery z dekoratorami `@Route`, `@Get`, `@Post`, automatyczny OpenAPI spec)
- **Baza Danych**: Drizzle ORM, Drizzle Kit, SQLite / PostgreSQL
- **Autentykacja**: JWT, OAuth2 (Google, GitHub), bezpieczna obsługa haseł
- **Testy**: Vitest Backend Suite (33 testy backendu)

---

## 🎮 Dostępne Trasy (Routes)

| Trasa | Opis |
|---|---|
| `/` | Ekran startowy z interaktywnym globem Marsa w 3D, atmosferą Mie i wyborem trybu gry |
| `/mars` | Główny widok rozgrywki strategicznej na wybranej/wygenerowanej mapie |
| `/generate` | Edytor map heksagonalnych z asystentem AI, podglądem 3D i eksportem JSON v2.0 |
| `/api/docs` | Dokumentacja Swagger / OpenAPI generowana automatycznie przez TSOA |

---

## 🚀 Uruchomienie Projektu

### Wymagania wstępne
- Node.js 20+
- npm 10+
- *(Opcjonalnie dla Asset Pipeline)*: Blender 5.1.1 z zainstalowanym dodatkiem `blender-mcp`

### 1. Instalacja zależności
```bash
npm install
```

### 2. Uruchomienie deweloperskie (Frontend + Backend)
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000/api`

### 3. Uruchomienie osobno
```bash
npm run dev:front  # Frontend Vite
npm run dev:back   # Backend Express + TSOA
```

### 4. Testy i Walidacja
```bash
npm run test       # Uruchamia 385 testów jednostkowych (Frontend + Backend)
npm run lint       # Sprawdza linter ESLint (0 błędów)
npm run build      # Pełna kompilacja produkcyjna (SSR Backend + Client Vite)
```

---

## 📊 Jakość Kodu i Standardy Inżynieryjne

- **385 / 385 testów zaliczonych (100% PASS)**
- **0 błędów i 0 ostrzeżeń ESLint**
- **Modal & Popover Dismiss Rule**: Każdy modal, popover i panel inspekcji w projekcie posiada przycisk `✕`, zamyka się po kliknięciu w tło oraz reaguje na klawisz `Escape`.
- **Strict Typing**: Całkowity zakaz typu `any`. Scentralizowana konfiguracja zmiennych środowiskowych przez `Config.ts`.
