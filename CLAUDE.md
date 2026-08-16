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
- HMR nie odświeża zmemoizowanych materiałów 3D — przy zmianach shaderów/materiałów testuj po twardym reloadzie (F5).
- **Git & Gałęzie**: Nigdy nie pracujemy na `main`. Zawsze tworzymy dedykowany branch (`feat/...`, `fix/...`, `refactor/...`). Na koniec zadania commitujemy na ten branch. Wymagany jest review zmian przed merge.

---

## Status / roadmapa generatora

Zrobione: siatka heksów, edycja terenu, build/resource/spawn/decor + inspektory (z footprintem),
szczelny schodkowy mesh z fazowaniem (Preview = renderer gry), materiał triplanar + slope + szron,
bloom (tylko Preview), tło/światło/akcent UI spójne ze stroną główną, eksport/import + walidacja zod,
walidacja reguł gry, minimapa, undo, skróty.

Do zrobienia:
1. **Seed → proceduralna generacja** (TODO): dziś `Generate Map` daje płaskie „plains", `seed` jest zapisany,
   ale nieużywany. Plan: seeded `simplex-noise` fBm → wysokości/typy terenu, kratery, łaty rocky;
   deterministycznie (ten sam seed = ta sama mapa); opcjonalnie seeded auto-placement spawnów/złóż.
2. Decor: więcej typów niż `rock_01` (głaz, kamienie, kryształ/złoże, wrak).
3. Resource `model` — edycja w inspektorze (gdy będzie lista modeli).
4. (Później) Agent AI podpięty do generatora — korzysta ze schematu v2.0 / seeda.
5. **Faza 2**: rozgrywka na wygenerowanej mapie zastępuje `/mars`; ruch jednostek po grafie heksów
   (`worldY` per heks, klify jako bariery, drony nad powierzchnią).

*Zaktualizowano po przebudowie na heksy.*
