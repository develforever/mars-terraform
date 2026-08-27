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

---

## 2. Bieżące i Nadchodzące Fazy (Upcoming Milestones)

### Faza 8: Infrastruktura Produkcyjna i Hosting (Vercel Edge + API Backend)
- [ ] **Wdrożenie Frontendu na Vercel Edge CDN (`feat/vercel-edge-deployment`)**:
  - Konfiguracja `vercel.json` ze wsparciem SPA rewrites (`/* -> /index.html`) i nagłówków cache dla assetów statycznych (`/models/*`, `/textures/*`, `/icons/*`).
  - Zero cold startu, globalna dystrybucja assetów 3D.
- [ ] **Niezależny Serwis API Backend (`feat/api-backend-hosting`)**:
  - Konteneryzacja samego backendu Node.js/TSOA na dedykowanej platformie (Render / Railway / Supabase DB) z trwałym wolumenem bazy danych.
  - Konfiguracja CORS i zmiennych środowiskowych `VITE_API_URL` / `API_URL`.

---

## 3. Standardy Jakościowe Projektu

- **Test Suite**: **510 / 510 testów PASS (100%)** w Vitest (477 frontend + 33 backend).
- **Linter**: **0 błędów i 0 ostrzeżeń** w ESLint pod regułami strict TypeScript.
- **Kompilacja**: Czysty build produkcyjny (`tsc -b && vite build` + backend SSR).
- **UX**: Wszystkie okna modalne, popovery i panele spełniają *Modal & Popover Dismiss Rule* (`✕`, Escape, kliknięcie w tło).
