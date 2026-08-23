# CLAUDE.md — Mars Terraform: Generator Mapy `/generate`

> Aktualny stan generatora (siatka HEKSAGONALNA). Zastępuje stary plan z siatką
> kwadratową 100x100 — ten model już nie istnieje. Wczytaj przed pracą.

---

## Kontekst projektu

**Mars Terraform** — przeglądarkowa gra strategiczna 3D (RTS) na Marsie.

Stack:
- Frontend: React 19, TypeScript, Vite, react-three-fiber (r3f), @react-three/drei, Zustand, TailwindCSS 4
- Backend: Node.js, TypeScript, Express, tsoa, Drizzle ORM, JWT
- Testy: Vitest (`npm run build`, testy w `*.test.ts`)
- Zależności istotne dla generatora: `three`, `@react-three/fiber`, `@react-three/drei`,
  `@react-three/postprocessing`, `postprocessing`, `simplex-noise`, `zustand`, `zod`

Generator to podstrona `/generate` (bez auth). Tworzysz teren + dodatki, podglądasz,
eksportujesz JSON. **Faza 2 (później): rozgrywka na wygenerowanej mapie zastąpi obecne `/mars`.**
Renderer Preview generatora = docelowy renderer terenu w grze.
**Później** do generatora podepniemy agenta AI — dlatego schemat eksportu (v2.0) to stabilny kontrakt.

---

## Blender 3D Asset Library & MCP

- **Główny plik biblioteki 3D (Project Library - poza repozytorium Git)**:
  `C:\Users\robert\Documents\mars-terraform.blend`
- **Ścieżka docelowa eksportu modeli dla silnika gry**:
  `public/models/mars/*.glb`
- **Manifest assetów (generowany automatycznie)**:
  `src/domain/config/assetManifest.json`
- **Struktura Kolekcji w pliku `.blend`**:
  - `00_STUDIO_ENV`: kamery i światła studyjne (wyłączone z eksportu).
  - `01_BUILDINGS/`: `Habitation`, `Production`, `Storage`, `Defense` (np. `rocket_baseA`, `machine_generator`, `hangar_roundGlass`).
  - `02_UNITS_LOGISTICS/`: `Ground`, `Air` (np. `rover`, `craft_miner`, `craft_cargoA`, `craft_speederA`).
  - `03_MODULAR_BASE/`: `Corridors`, `Platforms`, `Monorail_Tracks`, `Stairs_Gates`.
  - `04_INFRASTRUCTURE/`: `Pipes`, `Communications`, `Energy_Rockets`.
  - `05_ENVIRONMENT_DECOR/`: `Rocks_Crystals`, `Craters`, `Terrains_Legacy`.
  - `06_PROPS_INTERIOR/`: `Furniture`, `Weapons`, `Characters_Misc`.
  - `99_STUDIO_SHOWCASE`: instancje kolekcji w siatce 14-kolumnowej do szybkiego podglądu wizualnego.
- **Skrypty automatyzacji CLI (Headless)**:
  - Przebudowa biblioteki z GLB:
    `& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' -b -P scripts/blender/build_library_from_glbs.py`
  - Batch eksport do GLB + aktualizacja manifestu:
    `& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' -b 'C:\Users\robert\Documents\mars-terraform.blend' -P scripts/blender/export_all_assets.py`
  - Eksport selektywny:
    `& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' -b 'C:\Users\robert\Documents\mars-terraform.blend' -P scripts/blender/export_all_assets.py -- --filter="rover,craft_miner"`
- **Integracja Blender MCP (Zweryfikowana sesja Live)**:
  - Wersja Blendera: **5.1.1**
  - Wersja Addonu: **1.5 (protokół 4)**
  - Endpoint/Socket: `localhost:9876`
  - Stan sceny: 504 obiekty, 153 uporządkowane assety, siatka podglądowa `99_STUDIO_SHOWCASE`.
  - Serwer MCP: `uvx blender-mcp` (zdefiniowany w `.agents/mcp_config.json`).
  - Addon Blendera: `Interface: Blender MCP` (zainstalowany przez `uvx blender-mcp install-addon`).
  - Zastosowanie: inspekcja geometrii, modelowanie assetów 3D na żywo, generowanie zrzutów ekranu (`get_viewport_screenshot`), optymalizacja siatek i automatyczny eksport `.glb`.

---

## Architektura HEKSAGONALNA

- Siatka flat-top, współrzędne AXIAL `(q, r)`, generowana promieniem (`radius`, domyślnie 20).
- `HEX_SIZE = 1.2` (środek→narożnik). Matematyka w `src/presentation/generator/hex/HexMath.ts`
  (`hexToWorld`, `worldToHex`, `hexNeighbors`, `hexDistance`, `hexCorners`, `hexBrush`...).
- Każdy heks ma `worldY` zależny od typu terenu (poziomy, NIE ciągła wysokość):

  | terrainType  | worldY |
  |--------------|--------|
  | deep_crater  | 0.0    |
  | lowland      | 0.6    |
  | plains       | 1.2    |
  | highland     | 2.0    |
  | rocky        | 2.8    |
  | peak         | 4.0    |

- Paleta `TERRAIN_COLORS` (stonowana, głęboka rdza Marsa — spójna ze stroną główną):
  crater #2e1710, lowland #5a2f20, plains #7d4530, highland #94583c, rocky #6b4a3a, peak #a8826a.
- Typy: `HexTerrainType` (6 wyżej), `TileType` overlay = empty|build|resource|blocked|spawn.

Pliki siatki: `hex/HexGrid.ts` (klasa HexGrid: cells Map, generate/get/set, snapshot, toJSON/fromJSON),
`hex/HexMath.ts`, `hex/HexGeometry.ts` (geometria heksa do trybu edycji).

---

## Stan (Zustand) — `src/application/store/useMapEditorStore.ts`

```ts
meta: { name, description, players }          // players 1..4
hexGrid: HexGrid | null                       // teren (terrainType + worldY per heks)
hexRadius, hexSeed                            // seed dziś NIEUŻYWANY (patrz roadmapa)
buildNodes:    { id, pos:[q,r], footprint:[w,h], allowedTypes:BuildingType[] }[]
resourceNodes: { id, type, pos:[q,r], amount, richness, model }[]
spawnPoints:   { player, pos:[q,r] }[]
decor:         { model, pos:[q,r], rot, scale }[]
// UI: activeTool, brushSize(1|3|5), activeTerrainType, selectedHex, selectedNodeId, showGrid, isPreviewMode, undoStack(max 20)
// akcje: setHexTerrainType/paintHexTerrainType, setHexUserType/paintHexes, add/update/remove* (build/resource/spawn/decor),
//        undo, generateHexGrid, exportToJSON, loadFromJSON, resetMap
```

Typy w `src/domain/mapEditorTypes.ts`. ToolMode: select|terrain|build|resource|blocked|spawn|erase|decor.

---

## Render — `src/presentation/generator/`

- `GeneratorPage.tsx` — layout 3-panelowy + skróty klawiszowe (V/T/B/R/X/S/E/D, G grid, 1/2/3 brush, Ctrl+Z).
- `components/GeneratorViewport.tsx` — Canvas r3f. Tło sceny `#050308`, światło jak `MarsStartScene`
  (słońce #ffeedd ~1.45, chłodny fill #445588, hemi ciepła), CineonToneMapping ekspozycja 0.92.
- **Tryb edycji**: `viewport/HexTerrain.tsx` — `InstancedMesh` (jeden draw call), płaskie heksy, vertex colors.
- **Tryb Preview** (`isPreviewMode`): `viewport/SmoothTerrain.tsx`:
  - `terrain/TerrainMeshBuilder.ts` — TOPY: każdy heks = płaski sześciokąt na worldY ze SFAZOWANĄ krawędzią
    (bevel, `CHAMFER_DROP=0.16`). Watertight (per-heks, brak uśredniania).
  - `terrain/CliffBuilder.ts` — ŚCIANKI: między różnymi sąsiadami + skirt na brzegu (BASE_Y=-2.5).
    Podpięte do sfazowanej krawędzi → zero szczelin.
  - `terrain/SlopeMaterial.ts` — materiał produkcyjny: baza = kolor biomu, detal = `2k_mars.jpg`
    TRIPLANAR (modulacja jasności), SLOPE-AWARE skała na ściankach (z normalnej), wysokość, szron na szczytach.
  - `viewport/GeneratorPostFX.tsx` — Bloom **tylko w Preview** (`@react-three/postprocessing`).
- Markery: `viewport/{BuildNodeMarkers,ResourceNodeMarkers,SpawnPointMarkers,DecorMarkers}.tsx`,
  wysokość z `hooks/useHexHeight.ts` (`worldY` z siatki — siadają na terenie w obu trybach).
- `viewport/Minimap.tsx` — canvas 2D 200x200.
- Panele: `components/GeneratorLeftPanel.tsx` (narzędzia/pędzle/typy/seed/generate),
  `components/GeneratorRightPanel.tsx` (Settings / Inspector / JSON), `components/GeneratorToolbar.tsx`.
- Akcent UI = czerwień strony głównej: `#e74c3c` / `#c0392b` / `#ec7063`.

Referencja wizualna = strona główna `src/presentation/components/game/MarsStartScene.tsx` + `Mars.tsx`
(prawdziwa tekstura `/textures/2k_mars.jpg`, ciemny kosmos, bloom). Teren rozgrywki `MarsTerrain.tsx`
też używa tej tekstury triplanarnie — generator jest z tym spójny.

---

## Eksport / Import — schemat v2.0 (KONTRAKT)

`exportToJSON()` → JSON; `loadFromJSON()` odtwarza. Round-trip jest 1:1 (testy).
Import w toolbarze waliduje KSZTAŁT przez **zod** (`schema/mapSchema.ts`, `parseMapJSON`) — złe pliki
odrzucane z czytelnym błędem. Reguły GRY sprawdza `utils/validateMap.ts` (granice mapy, spawny vs gracze,
spawn na zablokowanym heksie, zbyt bliskie spawny, balans złóż).

```json
{
  "meta": { "name","description","version":"2.0","gridType":"hex-flat-top","hexSize":1.2,"hexRadius":20,"players":2,"seed":42 },
  "hexes": [ { "q":0,"r":0,"terrainType":"plains","userType":null,"decor":null } ],
  "buildNodes":    [ { "id":"b1","pos":[12,-3],"footprint":[1,1],"allowedTypes":["colony"] } ],
  "resourceNodes": [ { "id":"r1","type":"minerals","pos":[5,2],"amount":1000,"richness":"high","model":"mineral_pile_01" } ],
  "spawnPoints":   [ { "player":1,"pos":[5,5] }, { "player":2,"pos":[-5,-5] } ],
  "decor":         [ { "model":"rock_01","pos":[1,1],"rot":0.5,"scale":1.0 } ]
}
```

---

## Zasady pracy (z RULES.md)

- Arrow functions dla komponentów, PascalCase plików; strict TS (bez `any`).
- Zustand stores w `src/application/store/`. TailwindCSS 4 (arbitrary values OK, np. `bg-[#e74c3c]`).
- Każdy nowy feature = test (Vitest). Po zmianach: `npm run build` / `tsc --noEmit -p tsconfig.app.json`.
- Nie instaluj paczek npm bez potwierdzenia użytkownika.
- **Shader & Postprocessing Standards**:
  - Dithering w custom GLSL: dla gradientów i poświat obowiązkowy screen-space dither `(fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0` przeciw bandingowi 8-bit.
  - Bloom & HDR: źródła światła HDR mają `toneMapped: false` i emisję > 1.0; próg `bloomThreshold` w `PostProcessingComposer` ustawiony na `>= 1.0` (brak rozmywania terenu i UI).
  - Billboardy poświaty: płynne okno wygaszania `smoothstep(1.0, 0.2, dist)` eliminuje odcięcia na krawędzi quada.

---

## Status / roadmapa generatora i silnika gry

Zrobione:
- Siatka heksów, edycja terenu, build/resource/spawn/decor + inspektory modeli 3D (z footprintem).
- Szczelny schodkowy mesh z fazowaniem (`TerrainMeshBuilder` + `CliffBuilder`), materiał triplanar + slope + szron.
- Backend Persistence (`/api/maps` w TSOA + Drizzle ORM) + `CloudMapsModal` w generatorze i `ColonyNameModal` w grze.
- Deterministyczna generacja proceduralna z Seed (4-oktawowe fBm, pasma górskie, kratery uderzeniowe i złoża).
- Algorytm ścieżek `HexPathfindingService` (A* z detekcją i omijaniem klifów) + płynny ruch 3D jednostek inwazji obcych.
- Kinowe słońce proceduralne (analityczny billboard korony `exp(-dist * k)` z ditherem) + kierunkowy rim light atmosfery (Mie scattering) + kalibracja Bloom HDR.
- Eksport/import map JSON v2.0 + walidacja Zod, minimapa, undo/redo, skróty klawiszowe.
- Mechanika wydobycia złóż surowców + premia sąsiedztwa heksów (`BuildingService`, `EconomyService`, deplecja złóż).
- System poziomów budynków (1→3) + jednostki logistyczne (Rover A*, Dron Bézier) + UI ulepszeń.
- Połączenia energetyczne i rurociągi na siatce heksagonalnej (MSF / DSU, `BuildingConnectionService`).
- Asystent AI w Generatorze Map (`AIMapGeneratorService`, archetypy terenu, modyfikatory selektywne, offline fallback).
- Pełna integracja Map Heksagonalnych (MapExportJSON v2.0) w silniku rozgrywki `/mars` (`TerrainHexMesh`, `Decorations`, spawn hab).
- System Badań Naukowych (Tech Tree: 12 technologii, RP z Lab, modal drzewa) + wskaźniki terraformacji.
- Warianty Wizualne Modeli Budynków dla Poziomów 2 i 3 via Blender MCP (`{building}_lvl2.glb`, `{building}_lvl3.glb`).
- Zautomatyzowany Renderer Ikon 3D (`scripts/blender/render_icons.py`, 51 miniatur WebP).
- Nowe Klasy Jednostek via Blender MCP (`rover_combat.glb`, `drone_repair.glb`, `craft_hauler.glb` + encje i konfiguracja).
- Prefaby Ruin i Baz Obcych jako POI na Mapie via Blender MCP (`poi_abandoned_lab.glb`, `poi_alien_hive.glb`, `poi_crashed_freighter.glb` + integracja w edytorze i asystencie AI).
- Optymalizacja Polycount i Generowanie Siatek LOD via Blender MCP (`scripts/blender/generate_lods.py`, 26 modeli `{asset}_lod1.glb` o redukcji ~65% trójkątów, `assetManifest.json` z metadanymi LOD, integracja distance-based LOD `<Detailed distances={[0, 45]}>` w `DecorMeshes.tsx` i `Decorations.tsx`).
- Dynamiczne Zbiorniki Wodne i Lustro Wody w Kraterach (`TerraformingService.ts`, `WaterHexMesh.tsx`, shader `WaterMaterial.ts`, adaptacja A* dla zalanych komórek).
- Proceduralne Zielenienie Biomów i Wegetacja (`TerraformingService.ts`, dynamiczny shader `SlopeMaterial.ts`, `VegetationHexMesh.tsx` z instancjonowaną geometrią kępek mchów i traw).

---

## Nowa Roadmapa Projektu (Next-Gen Milestones)

### Faza 5: Dynamiczna Terraformacja Środowiska i Shadery Planetarne
1. **Ewolucja Atmosfery i Dynamiczne Niebo (`feat/atmospheric-sky-evolution`)**:
   - Dynamiczne przejście koloru nieba i mgły z rdzawego/ciemnego na ziemski błękit przy wzroście ciśnienia atmosferycznego i O₂.
   - Zjawiska pogodowe: burze pyłowe (spadek wydajności solarnych), deszcze meteorów (aktywacja obrony przeciwlotniczej).

### Faza 6: Kampania Fabularna, Scenariusze i Warunki Zwycięstwa
1. **Silnik Zadań i Celów Misji (`feat/campaign-quest-engine`)**:
   - Rejestr celów etapowych (`QuestService.ts`): zadania wprowadzające, militarne, naukowe i terraformacyjne z nagrodami surowcowymi.
2. **Predefiniowane Scenariusze Fabularne (`feat/campaign-scenarios`)**:
   - 5 unikalnych map/misji: "Lądowanie w Kraterze Gale", "Ratunek Odciętej Placówki Olympus", "Skażenie Ksenobiologiczne", "Równiny Cydonia", "Wielki Kanion Valles Marineris".
3. **Ekran Zwycięstwa / Porażki i Podsumowanie Statystyk (`feat/victory-defeat-summary`)**:
   - Wykresy ewolucji kolonii, analiza czasu terraformacji, scoreboard i system ocen (od Brązowej do Platynowej Kolonii).

### Faza 7: Zarządzanie Populacją Kolonistów i Zaawansowane Łańcuchy Produkcji
1. **Mieszkańcy Kolonii, Zawody i Morale (`feat/colonists-and-morale`)**:
   - Grupy zawodowe (Inżynierowie, Naukowcy, Rolnicy, Górnicy).
   - Zużycie tlenu, wody i żywności per habitat; wskaźnik Morale wpływający na produktywność kolonii.
2. **Zaawansowane Struktury Przemysłowe (`feat/advanced-megastructures`)**:
   - Kopuła Biosfery (zaawansowane habitaty), Fabryka Atmosfery (zwiększanie ciśnienia), Reaktor Termojądrowy (stabilna energia jądrowa).

