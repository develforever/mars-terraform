# CLAUDE.md — Mars Terraform: Generator Mapy `/generate`

> Ten plik zawiera pełny kontekst z sesji planowania. Wczytaj go przed rozpoczęciem pracy.

---

## Kontekst projektu

**Mars Terraform** — przeglądarkowa gra strategiczna 3D (RTS jak StarCraft) osadzona na Marsie.

Stack:
- Frontend: React 19, TypeScript, Vite, react-three-fiber (r3f), @react-three/drei, Zustand, TailwindCSS 4
- Backend: Node.js, TypeScript, Express, tsoa, Drizzle ORM, JWT
- Testy: Vitest, React Testing Library

Projekt ma już działającą bazę React/r3f. Routing i `App.tsx` są w `src/app/`. UI i sceny 3D w `src/presentation/`. Zustand stores w `src/application/store/`.

---

## Zadanie: nowa podstrona `/generate`

Stwórz profesjonalne narzędzie do konfiguracji mapy RTS — edytor wizualny 3D działający pod `/generate` (bez auth).

### Co robi generator:
- Wczytuje teren marsjański z GLB i wyświetla go w viewporcie r3f
- Pozwala malować tile'e na siatce 100×100 (tryby: build / resource / blocked / spawn / erase)
- Konfiguruje buildNode'y, resourceNode'y i spawnPoint'y przez Inspector
- Eksportuje konfigurację do pliku `.json` gotowego do wczytania w grze
- Importuje wcześniej zapisany `.json` i odtwarza scenę

---

## Asset terenu — dane z Blendera

Plik `mars_terrain.blend` został przeanalizowany i wyeksportowany.

| Parametr | Wartość |
|---|---|
| Obiekt mesh | `Marsterrain_LOD2` |
| Wierzchołki | 657 |
| Polygony | 1224 |
| Wymiary | ~100 × 100 × 7.4 units |
| Materiał | brak (pusty) — dodać w Three.js |
| Kamera w scenie | `Camera_TopDown` na Z=80 |
| Światło | `Sun_Mars` na pozycji (30, -30, 60) |

**Wyeksportowany plik:** `C:\Users\Public\mars_terrain.glb` (196 KB)
**Docelowa lokalizacja w projekcie:** `public/models/mars_terrain.glb`

Skopiuj plik ręcznie: `Copy-Item C:\Users\Public\mars_terrain.glb .\public\models\`

### Implikacje dla generatora:
- Siatka gry = **100×100 tiles**, 1 tile = 1 unit Blendera
- Origin siatki: `(-50, 0, -50)` → `(50, 0, 50)`
- Teren renderować z materiałem: `meshStandardMaterial`, kolor `#c1440e`, roughness 0.9, metalness 0.1
- Kamera startowa: position `(0, 60, 60)`, lookAt `(0, 0, 0)`, FOV 50

---

## Nowe zależności do zainstalowania

Zapytaj użytkownika przed instalacją (zgodnie z RULES.md):

```
simplex-noise   — proceduralne generowanie (opcjonalne, fallback jeśli GLB niedostępny)
zod             — walidacja schematu JSON przy imporcie
```

Zustand jest już w projekcie.

---

## Struktura plików do stworzenia

```
src/presentation/generator/
  GeneratorPage.tsx                  — główna strona, layout trójpanelowy
  components/
    GeneratorToolbar.tsx             — toolbar górny z przyciskami
    GeneratorLeftPanel.tsx           — panel narzędzi (tryby, brush size)
    GeneratorRightPanel.tsx          — inspector + JSON preview + settings
    GeneratorViewport.tsx            — Canvas r3f z całą sceną 3D
    viewport/
      TerrainMesh.tsx                — wczytanie i render mars_terrain.glb
      GridOverlay.tsx                — siatka 100×100 jako LineSegments
      TileOverlay.tsx                — instanced quads dla kolorowania tile'i
      BuildNodeMarker.tsx            — wizualizacja buildNode (zielona płyta)
      ResourceNodeMarker.tsx         — marker 3D złoża (kolorowy sześcian + label)
      SpawnPointMarker.tsx           — flaga/stożek z numerem gracza

src/application/store/
  useMapEditorStore.ts               — Zustand store — stan całego edytora mapy

src/domain/
  mapEditorTypes.ts                  — interfejsy TypeScript dla mapy
```

Dodaj route w `src/app/App.tsx`:
```tsx
<Route path="/generate" element={<GeneratorPage />} />
```

---

## Zustand Store — struktura

```ts
// src/application/store/useMapEditorStore.ts

interface MapMeta {
  name: string
  description: string
  size: [number, number]      // [100, 100]
  tileSize: number            // 1
  players: number             // 1–4
  terrainFile: string         // 'mars_terrain.glb'
  seed: number | null
}

interface BuildNode {
  id: string
  pos: [number, number]       // tile coords [x, z]
  footprint: [number, number] // [w, h] w tiles
  allowedTypes: BuildingType[]
}

interface ResourceNode {
  id: string
  type: ResourceType
  pos: [number, number]
  amount: number              // 100–5000
  richness: 'low' | 'med' | 'high'
  model: string               // np. 'mineral_pile_01'
}

interface SpawnPoint {
  player: number              // 1–4
  pos: [number, number]
}

type TileType = 'empty' | 'build' | 'resource' | 'blocked' | 'spawn'
type BuildingType = 'colony' | 'oxygen_generator' | 'greenhouse' | 'solar_power' | 'extractor'
type ResourceType = 'minerals' | 'ice' | 'organics' | 'energy'
type ToolMode = 'build' | 'resource' | 'blocked' | 'spawn' | 'erase' | 'select'

interface MapEditorState {
  meta: MapMeta
  tiles: Uint8Array           // 100*100 = 10000 bytes, index = z*100+x
  buildNodes: BuildNode[]
  resourceNodes: ResourceNode[]
  spawnPoints: SpawnPoint[]
  decor: DecorItem[]

  // UI state
  activeTool: ToolMode
  brushSize: 1 | 3 | 5
  selectedNodeId: string | null
  showGrid: boolean
  undoStack: MapSnapshot[]    // max 20

  // Actions
  setTile: (x: number, z: number, type: TileType) => void
  paintTiles: (tiles: [number, number][], type: TileType) => void
  addBuildNode: (node: BuildNode) => void
  updateBuildNode: (id: string, patch: Partial<BuildNode>) => void
  addResourceNode: (node: ResourceNode) => void
  updateResourceNode: (id: string, patch: Partial<ResourceNode>) => void
  addSpawnPoint: (spawn: SpawnPoint) => void
  setActiveTool: (tool: ToolMode) => void
  setBrushSize: (size: 1 | 3 | 5) => void
  undo: () => void
  loadFromJSON: (data: MapExportJSON) => void
  exportToJSON: () => MapExportJSON
  resetMap: () => void
}
```

---

## Kolory tile'i (overlay)

| Typ | Kolor hex | Opacity |
|---|---|---|
| `build` | `#00ff88` | 0.4 |
| `resource` | `#ffcc00` | 0.4 |
| `blocked` | `#ff3300` | 0.4 |
| `spawn` | `#0088ff` | 0.4 |
| hover | `#ffffff` | 0.25 |

---

## Format JSON eksportu (finalny schemat)

```json
{
  "meta": {
    "name": "mars_alpha",
    "description": "",
    "size": [100, 100],
    "tileSize": 1,
    "players": 2,
    "terrainFile": "mars_terrain.glb",
    "seed": null
  },
  "buildNodes": [
    {
      "id": "b1",
      "pos": [12, 34],
      "footprint": [3, 3],
      "allowedTypes": ["colony", "oxygen_generator"]
    }
  ],
  "resourceNodes": [
    {
      "id": "r1",
      "type": "minerals",
      "pos": [50, 23],
      "amount": 1000,
      "richness": "high",
      "model": "mineral_pile_01"
    }
  ],
  "spawnPoints": [
    { "player": 1, "pos": [5, 5] },
    { "player": 2, "pos": [94, 94] }
  ],
  "decor": [],
  "blockedTiles": "<gzip+base64 bitmask 100x100>"
}
```

`blockedTiles` — bitmask `Uint8Array(10000)` skompresowany przez pako (gzip) i zakodowany base64.

---

## Layout GeneratorPage

```
┌─────────────────────────────────────────────────────────────┐
│  TOOLBAR: [🗺 New] [📂 Load] [💾 Export] [Grid: ON]  Stats  │
├──────────────┬─────────────────────────────┬────────────────┤
│  LEFT PANEL  │     VIEWPORT (r3f Canvas)   │  RIGHT PANEL   │
│  ──────────  │                             │  ────────────  │
│  🖊 Build    │   Teren GLB + siatka        │  [Settings]    │
│  💎 Resource │   + kolorowe tile overlay   │  [Inspector]   │
│  🚫 Blocked  │   + markery 3D              │  [JSON]        │
│  🚩 Spawn    │                             │                │
│  🗑 Erase    │                             │  Formularz     │
│  ──────────  │                             │  wybranego     │
│  Brush: 1×1  │                             │  elementu      │
│  Brush: 3×3  │                             │                │
│  Brush: 5×5  │                             │  Live JSON     │
│              │                             │  preview       │
└──────────────┴─────────────────────────────┴────────────────┘
```

Styling: TailwindCSS 4, ciemny motyw (`bg-zinc-900`, `text-zinc-100`), akcenty marsjańskie (`orange-500`).

---

## Keyboard shortcuts

| Klawisz | Akcja |
|---|---|
| `B` | Tryb Build |
| `R` | Tryb Resource |
| `X` | Tryb Blocked |
| `S` | Tryb Spawn |
| `E` | Tryb Erase |
| `G` | Toggle Grid |
| `Ctrl+Z` | Undo |
| `1/2/3` | Brush size 1×1 / 3×3 / 5×5 |

---

## Etapy wdrożenia (kolejność)

Implementuj etap po etapie. Po każdym etapie uruchom `npm run build` i upewnij się, że nie ma błędów.

### Etap 1 — Route + layout *(zrób najpierw)*
- Dodaj route `/generate` w `App.tsx`
- Stwórz `GeneratorPage.tsx` z layoutem CSS Grid (trzy panele)
- Stwórz pusty `useMapEditorStore.ts` z typami
- Viewport: pusty Canvas r3f z OrbitControls, kamera z góry
- Wynik: wchodzisz na `/generate`, widzisz ciemny layout z pustą sceną 3D

### Etap 2 — Teren GLB
- Skopiuj `C:\Users\Public\mars_terrain.glb` → `public/models/`
- `TerrainMesh.tsx`: `useGLTF('/models/mars_terrain.glb')` + materiał mars
- Światło zgodne z Blenderem: directional (30, -30, 60), ambient słabe
- Wynik: widzisz teren marsjański w edytorze

### Etap 3 — Siatka 100×100
- `GridOverlay.tsx`: `LineSegments` 100×100 tile
- Hover raycast do płaszczyzny y=0, snap do tile
- Toggle widoczności siatki (stan w store)
- Wynik: siatka nakłada się na teren, hover podświetla tile

### Etap 4 — Tryby narzędzi + malowanie
- `TileOverlay.tsx`: `InstancedMesh` z quads dla każdego aktywnego tile
- Malowanie kliknięciem i przeciąganiem
- Brush size 1×1 / 3×3 / 5×5
- Wynik: możesz malować kolorowe obszary na siatce

### Etap 5 — Build Nodes Inspector
- Kliknięcie na build tile → Inspector w prawym panelu
- Formularz: footprint, allowedTypes (checkboxy)
- Wynik: konfiguracja miejsc pod budynki

### Etap 6 — Resource Nodes
- `ResourceNodeMarker.tsx`: kolorowy Box + `<Html>` label (drei)
- Inspector: type, amount, richness
- Wynik: złoża z markerami i konfiguracją

### Etap 7 — Spawn Points
- `SpawnPointMarker.tsx`: stożek z numerem gracza
- Max 4 spawnPoint'y
- Wynik: punkty startowe graczy

### Etap 8 — Panel JSON + Settings
- Zakładki w prawym panelu: Settings / Inspector / JSON
- Live JSON preview (read-only textarea)
- Formularz meta: name, description, players
- Wynik: widzisz aktualny JSON mapy

### Etap 9 — Eksport / Import
- Export: `Blob` → download jako `{name}.json`
- `blockedTiles`: pako gzip + base64 bitmask
- Import: `<input type="file">` → parse → `loadFromJSON()`
- Walidacja Zod
- Wynik: możesz zapisać i wczytać mapę

### Etap 10 — Polish
- Keyboard shortcuts (useEffect na keydown)
- Undo stack (max 20 snapshots w store)
- Minimap 2D (canvas 2D 200×200px, overhead view)
- Status bar w toolbarze: tile count per type
- Wynik: profesjonalne narzędzie

---

## Ważne zasady (z RULES.md)

- Używaj arrow functions dla komponentów, PascalCase dla plików
- Strict TypeScript — żadnych `any`, używaj interfejsów
- Zustand stores w `src/application/store/`
- TailwindCSS 4 — bez inline styles (oprócz dynamicznych właściwości 3D)
- Każdy nowy feature = unit test (Vitest)
- Po każdym etapie: `npm run build`
- Nie instaluj nowych npm packages bez potwierdzenia użytkownika
- Nie zmieniaj struktury folderów bez uzasadnienia
- Nie modyfikuj `package.json` scripts bez potwierdzenia

---

## Paczki npm które będą potrzebne (zapytaj użytkownika)

```
pako        — gzip kompresja blockedTiles (mała, ~50KB)
zod         — walidacja JSON przy imporcie
```

Jeśli projekt już ma `pako` lub `zod` — sprawdź `package.json` przed pytaniem.

---

*Wygenerowano na podstawie sesji planowania z Claude, 2026-06-03*
