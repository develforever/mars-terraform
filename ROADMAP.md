# Mars Terraform — Project Architecture & Roadmap

Ten dokument stanowi centralny rejestr zrealizowanych kamieni milowych oraz planowanych faz rozwoju projektu **Mars Terraform**.

---

## 1. Zrealizowane Fazy Projektu (Completed Milestones)

### Faza 1: Silnik Heksagonalny i Render Terenu 3D
- [x] **Układ osiowy (Axial Coordinates)**: Siatka heksagonalna `(q, r)` z promieniem heksa `1.2`.
- [x] **Watertight Step-Mesh**: `TerrainMeshBuilder.ts` + `CliffBuilder.ts` z fazowaniem (chamfer) eliminujące szczeliny między poziomami wysokości (`worldY: 0.0` do `4.0`).
- [x] **Triplanarny Shader Terenu (`SlopeMaterial.ts`)**: Modulacja teksturą Marsa 2K, detekcja nachylenia ścian skalnych, szron na szczytach, zgodność z PBR i Bloom HDR.
- [x] **3D A* Pathfinding (`HexPathfindingService.ts`)**: Nawigacja uwzględniająca profile wysokościowe i omijanie nieprzekraczalnych klifów.
- [x] **Kinowe Słońce i Atmosfera**: Proceduralny billboard korony słonecznej `exp(-dist * k)` z ditherem oraz kierunkowy rim light atmosfery (rozpraszanie Mie).

### Faza 2: Generator Map i Asystent AI (`/generate`)
- [x] **Edytor Map Heksagonalnych**: Malowanie biomów, kładzenie punktów startowych, węzłów budowy, złóż i obiektów dekoracyjnych.
- [x] **Asystent AI NLP (`AIMapGeneratorService.ts`)**: Przetwarzanie poleceń w języku naturalnym (PL/EN) na kontrakt `MapExportJSON v2.0` (archetypy, modyfikatory wysokościowe, złoża i POI).
- [x] **Generator Proceduralny**: 4-oktawowy szum fBm ze stałym seedem dla łańcuchów górskich i kraterów.
- [x] **Persystencja Chmurowa**: Endpointy REST `/api/maps` oparte o TSOA + Drizzle ORM z walidacją schematów Zod.

### Faza 3: Pętla Gry, Ekonomia i Drzewo Badań (`/mars`)
- [x] **Graf Infrastruktury Przesyłowej (`BuildingConnectionService.ts`)**: Algorytm Minimum Spanning Forest (MSF / DSU) dla sieci energetycznej i rurociągów wodnych o zasięgu R <= 4.
- [x] **Pętla Wydobywcza i Złoża**: Złoża minerałów i lodu z premią sąsiedztwa (+50% per złoże) oraz mechanizmem wyczerpywania (deplecji).
- [x] **System Ulepszeń Budynków (1 -> 2 -> 3)**:
  - *Lvl 1*: Wydobycie stacjonarne.
  - *Lvl 2*: Zautomatyzowany łazik naziemny (`rover.glb` / `rover_combat.glb`) na ścieżkach A*.
  - *Lvl 3*: Dron logistyczny (`craft_miner.glb` / `drone_repair.glb`) po łukach Béziera ponad klifami.
- [x] **System Obrony Przed Inwazją**: Algorytmy ścieżek obcych i automatyczne wieżyczki obronne.
- [x] **Drzewo Technologii (`technologies.ts`, `ResearchTreeModal.tsx`)**: 12 technologii w 6 kategoriach zasilanych Punktami Badań (RP) wytwarzanymi w Laboratoriach.

### Faza 4: Blender 5.1.1 MCP Asset Pipeline
- [x] **Centralna Biblioteka 3D**: `mars-terraform.blend` (504 obiekty, 153 uporządkowane assety).
- [x] **Zautomatyzowany Kitbashing**: Generowanie wariantów budynków (`_lvl2.glb`, `_lvl3.glb`) do `public/models/mars/`.
- [x] **Nowe Klasy Jednostek**: `rover_combat.glb`, `drone_repair.glb`, `craft_hauler.glb`.
- [x] **Proceduralne Prefaby POI**: `poi_abandoned_lab.glb`, `poi_alien_hive.glb`, `poi_crashed_freighter.glb`.
- [x] **Optymalizacja LOD**: 26 modeli `{asset}_lod1.glb` o redukcji ~65% geometrii zintegrowanych z komponentem `<Detailed distances={[0, 45]}>`.
- [x] **Batch Renderer Ikon 3D (`render_icons.py`)**: 51 miniatur WebP (128x128 px) w rzucie izometrycznym z przezroczystym tłem do `public/icons/`.

### Faza 5: Dynamiczna Terraformacja Środowiska i Shadery Planetarne
- [x] **Dynamiczne Zbiorniki Wodne w Kraterach (`feat/dynamic-water-bodies`)**: Wzrost lustra wody Y w oparciu o wskaźnik H2O, shader `WaterMaterial.ts` (fale, piana brzegowa, refleksy Bloom HDR), blokada zalanych komórek w A* pathfindingu.
- [x] **Proceduralne Zielenienie Biomów i Wegetacja (`feat/biosphere-vegetation-growth`)**: Model matematyczny biosfery (`TerraformingService.ts`), dynamiczny shader `SlopeMaterial.ts` ze zielenieniem płaskich heksów wokół wody, instancjonowana roślinność 3D (`VegetationHexMesh.tsx`).
- [x] **Ewolucja Atmosfery i Dynamiczne Niebo (`feat/atmospheric-sky-evolution`)**: Dynamiczny lerp barwy nieba i mgły (`AtmosphereSky.tsx` z rozpraszaniem Rayleigh/Mie), zjawiska pogodowe w `WeatherService.ts` (burze pyłowe z cząsteczkami `WeatherEffects.tsx` i -50% wydajności paneli, zorza polarna, deszcze meteorów).

### Faza 6: Kampania Fabularna, Scenariusze i Warunki Zwycięstwa
- [x] **Silnik Zadań i Celów Misji (`feat/campaign-quest-engine`)**: `QuestService.ts`, `QuestTrackerWidget.tsx`, `QuestLogModal.tsx` z 10 powiązanymi zadaniami kampanii w 4 etapach.
- [x] **Predefiniowane Scenariusze Fabularne (`feat/campaign-scenarios`)**: `ScenarioService.ts`, `ScenarioSelectModal.tsx` z 5 zbalansowanymi misjami fabularnymi (Krater Gale, Placówka Olympus, Skażenie Ksenobiologiczne, Równiny Cydonia, Kanion Valles Marineris).
- [x] **Ekran Zwycięstwa / Porażki i Ewaluacja Kolonii (`feat/victory-defeat-summary`)**: `GameAnalyticsService.ts`, `VictorySummaryModal.tsx` z wykresami analitycznymi SVG time-series, punktacją i 4 rangami kolonii (Brąz, Srebro, Złoto, Platyna).

### Faza 7: Zarządzanie Populacją Kolonistów i Zaawansowane Łańcuchy Produkcji
- [x] **Mieszkańcy Kolonii, Zawody i Morale (`feat/colonists-and-morale`)**: `ColonistService.ts`, `ColonistManagerModal.tsx`, 4 specjalizacje zawodowe, dynamiczne zużycie zasobów, przylot promów transportowych, wpływ zadowolenia/morale na produktywność bazy.
- [x] **Zaawansowane Struktury Przemysłowe i Megastruktury (`feat/advanced-megastructures`)**: Megastruktury `biosphere_dome`, `atmosphere_factory`, `fusion_reactor` zintegrowane w `buildings.ts`, `technologies.ts` i `EconomyService.ts`.

### Faza Naprawcza: Grywalność, Niezawodność i System RTS (Gameplay Overhaul)
- [x] **Krok 1: Usunięcie Blokad Progresji Badań (`fix/progression-deadlocks-and-rp-loop`)**: Pasywny przyrost RP w habitatach, wczesne laboratorium, klikalna paleta budowy z automatycznym otwieraniem drzewa technologii `🔬` i rozbłyskami surowców.
- [x] **Krok 2: Architektura Zdarzeń 3D i Inspekcja Struktur (`fix/interaction-raycasting-popover-system`)**: Stabilny raycasting, rozbudowany popover inspekcji (ulepszenia, przełącznik zasilania, dynamiczne kolory produkcji 🟢/🔴), pierścienie zasięgu 3D (ekstrakcja, obrona, habitat).
- [x] **Krok 3: Pętla Gospodarcza Odporna na Awarię i Pauza Taktyczna (`feat/economy-resilience-and-alerts`)**: Pauza pod spacją `[ ⏸ ]`, skalowanie prędkości (`1x`, `2x`, `4x`), 60-sekundowy bufor podtrzymywania życia z czerwonym alarmem (Anti-Death-Spiral).
- [x] **Krok 4: System Sterowania RTS (`feat/rts-unit-control-and-combat`)**: Selekcja ramką (Drag Box), rozkazy PPM (Ruch, Atak, Naprawa), grupy bojowe `Ctrl + 1..9`, paski HP i panel dowodzenia jednostkami (`UnitCommandCard.tsx`).
- [x] **Krok 5: Taktyczna Mini-mapa i Radar Zagrożeń (`feat/tactical-minimap-and-radar`)**: Interaktywna mini-mapa 2D Canvas z podglądem bazy, wrogów i stożka kamery, radar zagrożeń poza ekranem (Offscreen Radar ze skokiem kamery).

### Faza 8: Infrastruktura Produkcyjna i Hosting (Vercel + Fly.io + Turso)
Konfiguracja gotowa w kodzie; wdrożenie wykonuje człowiek według runbooka [`.docs/faza-8/DEPLOYMENT.md`](.docs/faza-8/DEPLOYMENT.md). Plan i decyzje: `.docs/faza-8/PLAN.md`, `.docs/faza-8/QUEUE.md`.
- [x] **Frontend na Vercel (`vercel.json`)**: build tylko frontendu (`tsc -b && vite build`), SPA rewrite, cache `immutable` dla `/assets/*`, `max-age` + `stale-while-revalidate` dla `/models`, `/textures`, `/icons`, nagłówki bezpieczeństwa i CSP Report-Only; test konfiguracji.
- [x] **Resolver `VITE_API_URL`** (`apiConfig.ts`): wszystkie wywołania `/api` przez jeden bazowy URL.
- [x] **CORS**: własny middleware z dokładną allowlistą `cors_origins`, `Vary: Origin`, preflight 204/403, bez credentials.
- [x] **Tryb API-only** (`serve_frontend=false`, `createApp()`): nieznane ścieżki → 404 JSON, 5xx bez szczegółów w produkcji.
- [x] **`/api/health` z kontrolą bazy** (`select 1` z timeoutem 2 s, 503 przy awarii DB).
- [x] **`HttpError` i błędy 4xx** zamiast 500 dla błędów klienta (logowanie, rejestracja, mapy).
- [x] **Anty-enumeracja kont**: hasło sprawdzane przed „Email not verified”, stały czas (dummy bcrypt), `resend-verification` zawsze 200.
- [x] **Obraz API `Dockerfile.api`** (node 24 alpine, multi-stage, `USER node`, tini, HEALTHCHECK) + **`fly.toml`** (Fly.io, region `fra`, `min_machines_running = 0`, Turso bez wolumenu).
- [x] **Migracje produkcyjne** (`node dist_backend/migrate.js` jako `release_command`), naprawiony journal (`0001_maps_colonies`) i procedura baseline dla bazy z `push` (`MIGRATIONS_BASELINE.md`).
- [x] **CI GitHub Actions**: lint, typy, testy, build, spójność tras TSOA i migracji + job `docker-api` (build obrazu i smoke test kontenera).
- [x] **Odchudzone zależności produkcyjne**: paczki frontendowe w `devDependencies`, `@tsoa/runtime` zamiast `tsoa`, bez `@tursodatabase/database` (prod `node_modules` 437 → 54 MB).
- [x] **Naprawa zapisu kolonii**: aktualne trasy TSOA (`minerals`), `state` jako otwarty obiekt JSON, limit body 2 MB (413 JSON).
- [x] **Sekrety poza repo**: `.env` nieśledzony, `.env.example`; rotacja sekretów w runbooku (sekcja 1).

---

## 2. Bieżące i Nadchodzące Fazy (Upcoming Milestones)

### Faza 8: wdrożenie produkcyjne (człowiek)
- [ ] Rotacja sekretów, baseline migracji, pierwszy deploy API (Fly.io) i frontendu (Vercel), smoke test: [`.docs/faza-8/DEPLOYMENT.md`](.docs/faza-8/DEPLOYMENT.md).
- [ ] Follow-upy po wdrożeniu (CSP `connect-src` / `report-to`, HSTS przed domeną własną i inne): `.docs/faza-8/QUEUE.md` → „Follow-upy”.

---

## 3. Standardy Jakościowe Projektu

- **Test Suite**: **765 testów PASS** w Vitest (613 frontend + 152 backend).
- **Linter**: **0 błędów i 0 ostrzeżeń** w ESLint pod regułami strict TypeScript.
- **Kompilacja**: Czysty build produkcyjny (`tsc -b && vite build` + backend SSR).
- **UX**: Wszystkie okna modalne, popovery i panele spełniają *Modal & Popover Dismiss Rule* (`✕`, Escape, kliknięcie w tło).
