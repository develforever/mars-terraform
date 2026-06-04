# HEX_TERRAIN_PLAN.md
# Plan przejścia generatora na siatkę heksagonalną
# Wygenerowano: 2026-06-04

---

## CEL

Zastąpić obecny generator mapy (flat plane + siatka kwadratowa) nowym systemem
opartym na heksagonalnej siatce proceduralnej — podobnym do zdjęcia poglądowego
(Civilization/RTS hex terrain), ale w marsjańskiej kolorystyce.

Teren budowany jest z instancji heksagonalnych kafelków z różnymi wysokościami
(Simplex Noise), kolorami wierzchołków (Vertex Colors bez tekstur) i typami terenu.

---

## ANALIZA OBECNEGO STANU

### Co jest teraz w generatorze:
- Płaski PlaneGeometry 100×100 jako teren
- Kwadratowa siatka tile (Uint8Array 100×100)
- Malowanie tile'i kolorem overlay (TileOverlay.tsx)
- Raycast hover do płaszczyzny y=0
- Eksport JSON z pozycjami w tile coords [x, z]

### Co trzeba zmienić:
- Teren → hex grid z Simplex Noise wysokościami i vertex colors
- Siatka → hex koordinaty (axial q,r)
- TileOverlay → hexagon instanced quads zamiast kwadratów
- Eksport JSON → hex coords + terrain type per hex
- Kamera → zachować RTS angle, dostosować zoom

### Co zostaje bez zmian:
- Panel narzędzi (lewý panel)
- Inspector (prawy panel)
- Toolbar (Export/Import/Undo)
- Zustand store (mapEditorStore) — rozszerzyć, nie zastępować
- Keyboard shortcuts
- Typy mapEditorTypes.ts

---

## MATEMATYKA HEX GRIDU (Red Blob Games)

### Orientacja: FLAT-TOP (flat top hexagons)
Wybór flat-top zamiast pointy-top bo:
- Lepiej wygląda z kamery RTS (szerszy widok poziomy)
- Łatwiejsze dopasowanie do terrainu w stylu Civ

### Rozmiar mapy: 40×40 heksów (axial coordinates)
- q: od -20 do +19 (oś pozioma)
- r: od -20 do +19 (oś pionowa)
- Łącznie: ~1200–1400 heksów (widocznych, po obcięciu do hex-kształtu)
- Rozmiar pojedynczego heksa: size = 1.2 units

### Konwersja hex → pixel (flat-top):
```
x = size * (3/2 * q)
z = size * (sqrt(3)/2 * q + sqrt(3) * r)
```

### Konwersja pixel → hex (flat-top):
```
q = (2/3 * x) / size
r = (-1/3 * x + sqrt(3)/3 * z) / size
// następnie hex_round(q, r)
```

### Storage: offset coordinates (even-q)
Dla prostego zapisu do JSON/tablicy używamy even-q offset:
```
col = q
row = r + (q - (q&1)) / 2
```

---

## TYPY TERENU (marsjańskie)

Każdy heks ma typ terenu zależny od wysokości z Noise:

| Typ | Wysokość (noise) | Kolor vertex | Opis |
|---|---|---|---|
| `deep_crater` | < 0.15 | #3d1f0a (ciemny brąz) | Kratry, doliny |
| `lowland` | 0.15–0.35 | #8b3a1a (rdzawy brąz) | Niziny |
| `plains` | 0.35–0.55 | #c1440e (marsjański pomarańcz) | Główny teren |
| `highland` | 0.55–0.72 | #d4622a (jasny pomarańcz) | Wyżyny |
| `rocky` | 0.72–0.88 | #6b4c32 (ciemny szary-brąz) | Skaliste |
| `peak` | > 0.88 | #9e8060 (piaskowy) | Szczyty |

Typy specjalne (nakładane ręcznie przez użytkownika):
- `build` — zielony overlay (#00ff88)
- `resource` — żółty overlay (#ffcc00)
- `blocked` — czerwony overlay (#ff3300)
- `spawn` — niebieski overlay (#0088ff)

---

## MODELE DOSTĘPNE W PROJEKCIE

Z katalogu `/public/models/mars/` — do użycia jako dekoracje na heksach:

### Skały (decor na rocky/peak hex):
- `rock.glb`, `rock_largeA.glb`, `rock_largeB.glb`
- `rocks_smallA.glb`, `rocks_smallB.glb`
- `rock_crystals.glb`, `rock_crystalsLargeA.glb`, `rock_crystalsLargeB.glb`
- `crater.glb`, `craterLarge.glb`
- `meteor.glb`, `meteor_half.glb`

### Budynki/struktury (na build hexes):
- `hangar_smallA.glb`, `hangar_roundA.glb`
- `platform_center.glb`, `platform_small.glb`
- `structure.glb`, `structure_closed.glb`
- `chimney.glb`
- `machine_generator.glb`

### Pojazdy (dekor):
- `rover.glb`
- `craft_miner.glb`

→ **Nie trzeba nic modelować w Blenderze** — mamy kompletny asset pack Mars.

---

## ARCHITEKTURA — NOWE PLIKI

```
src/presentation/generator/
  hex/
    HexMath.ts              ← czysta matematyka (axial↔pixel, neighbors, round)
    HexGrid.ts              ← klasa generująca grid + noise heights + types
    HexGeometry.ts          ← THREE.BufferGeometry dla pojedynczego heksa
  components/viewport/
    HexTerrain.tsx          ← główny mesh terenu (merged BufferGeometry)
    HexOverlay.tsx          ← instanced hex quads dla paint overlay
    HexGridLines.tsx        ← wireframe siatki (toggle G)
    HexHoverHighlight.tsx   ← highlight hovered hexa
  hooks/
    useHexRaycast.ts        ← raycast pixel→hex conversion

  GeneratorPage.tsx         ← bez zmian w strukturze
  components/
    GeneratorLeftPanel.tsx  ← bez zmian
    GeneratorRightPanel.tsx ← bez zmian (hex coords w inspectorze)
    GeneratorToolbar.tsx    ← bez zmian
```

### Zmiany w istniejących plikach:
```
src/application/store/useMapEditorStore.ts
  - tiles: Uint8Array(100*100) → hexes: Map<string, HexCell>
  - MAP_SIZE: 100×100 → HEX_RADIUS: 20 (promień siatki)
  - setTile/paintTiles → setHex/paintHexes
  - exportToJSON → hex format

src/domain/mapEditorTypes.ts
  - TileType (zostaje)
  - dodać: HexCell, HexCoord, HexTerrainType
  - BuildNode.pos: [number,number] tile → HexCoord {q,r}
  - ResourceNode.pos → HexCoord {q,r}
  - SpawnPoint.pos → HexCoord {q,r}

src/presentation/generator/utils/validateMap.ts
  - bez zmian logiki, tylko update typów

src/presentation/generator/components/viewport/TileOverlay.tsx
  → zastąpić przez HexOverlay.tsx (instanced hex quads)

src/presentation/generator/components/viewport/GridOverlay.tsx
  → zastąpić przez HexGridLines.tsx
```

---

## FORMAT JSON EKSPORTU (nowy)

```json
{
  "meta": {
    "name": "mars_alpha",
    "version": "2.0",
    "gridType": "hex-flat-top",
    "hexSize": 1.2,
    "hexRadius": 20,
    "players": 2,
    "terrainFile": null,
    "seed": 42
  },
  "hexes": [
    {
      "q": 0, "r": 0,
      "terrainType": "plains",
      "height": 0.48,
      "userType": "build",
      "decor": "rock_largeA"
    },
    {
      "q": 1, "r": -1,
      "terrainType": "lowland",
      "height": 0.22,
      "userType": null,
      "decor": null
    }
  ],
  "buildNodes": [
    {
      "id": "b1",
      "hex": {"q": 3, "r": -2},
      "footprint": 1,
      "allowedTypes": ["colony"]
    }
  ],
  "resourceNodes": [
    {
      "id": "r1",
      "type": "minerals",
      "hex": {"q": -5, "r": 4},
      "amount": 1500,
      "richness": "high"
    }
  ],
  "spawnPoints": [
    { "player": 1, "hex": {"q": -15, "r": 10} },
    { "player": 2, "hex": {"q": 15, "r": -10} }
  ],
  "decor": []
}
```

---

## ETAPY IMPLEMENTACJI

---

### ETAP H1 — HexMath.ts (czysta matematyka)
**Czas: ~1h**

Plik: `src/presentation/generator/hex/HexMath.ts`

```ts
// Flat-top hexagon
export const HEX_SIZE = 1.2

// Axial → world position
export function hexToPixel(q: number, r: number): [number, number] {
  const x = HEX_SIZE * (3/2 * q)
  const z = HEX_SIZE * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r)
  return [x, z]
}

// World position → axial hex (float, before rounding)
export function pixelToHex(x: number, z: number): [number, number] {
  const q = (2/3 * x) / HEX_SIZE
  const r = (-1/3 * x + Math.sqrt(3)/3 * z) / HEX_SIZE
  return [q, r]
}

// Cube rounding
export function hexRound(q: number, r: number): [number, number]

// 6 neighbors
export function hexNeighbors(q: number, r: number): [number, number][]

// Distance between two hexes
export function hexDistance(q1: number, r1: number, q2: number, r2: number): number

// All hexes in radius
export function hexesInRadius(radius: number): [number, number][]

// String key for Map<string, ...>
export function hexKey(q: number, r: number): string // `${q},${r}`
```

Testy: `HexMath.test.ts` — sprawdzić konwersje, neighbors, distance, rounding

---

### ETAP H2 — HexGrid.ts (generator + noise)
**Czas: ~2h**

Plik: `src/presentation/generator/hex/HexGrid.ts`

```ts
import SimplexNoise from 'simplex-noise'

export interface HexCell {
  q: number
  r: number
  height: number        // 0..1 z noise
  terrainType: HexTerrainType
  userType: TileType | null  // null = brak nadpisania przez użytkownika
  decor: string | null  // nazwa modelu GLB lub null
}

export class HexGrid {
  private cells: Map<string, HexCell>
  private radius: number
  private seed: number

  constructor(radius: number, seed: number)

  generate(): void   // Simplex Noise → heights → terrainType
  getCell(q: number, r: number): HexCell | undefined
  setUserType(q: number, r: number, type: TileType | null): void
  getAllCells(): HexCell[]
  toJSON(): object
  fromJSON(data: object): void
}

// Height → terrain type mapping:
function heightToTerrainType(h: number): HexTerrainType {
  if (h < 0.15) return 'deep_crater'
  if (h < 0.35) return 'lowland'
  if (h < 0.55) return 'plains'
  if (h < 0.72) return 'highland'
  if (h < 0.88) return 'rocky'
  return 'peak'
}
```

---

### ETAP H3 — HexGeometry.ts (geometria pojedynczego heksa)
**Czas: ~1.5h**

Plik: `src/presentation/generator/hex/HexGeometry.ts`

```ts
// Tworzy BufferGeometry dla flat-top hexagonu
// 6 trójkątów (fan od środka), vertex colors
export function createHexGeometry(size: number): THREE.BufferGeometry

// Tworzy merged BufferGeometry dla całego gridu
// Każdy hex ma własną wysokość (Y) i kolor wierzchołków
export function buildHexTerrainGeometry(
  cells: HexCell[],
  hexSize: number
): THREE.BufferGeometry
```

Kluczowe szczegóły:
- Wierzchołki heksa: środek + 6 rogów
- Górna ściana (cap): 6 trójkątów (triangle fan)
- Boczne ściany: opcjonalne (solid hex columns jak w Civ)
- Vertex colors: kolor zależny od terrainType
- Płynne przejścia: interpolacja kolorów między hex a sąsiadami (opcjonalnie v2)

---

### ETAP H4 — HexTerrain.tsx (render terenu)
**Czas: ~2h**

Plik: `src/presentation/generator/components/viewport/HexTerrain.tsx`

```tsx
const HexTerrain = () => {
  const geometry = useMemo(() => buildHexTerrainGeometry(cells, HEX_SIZE), [cells])

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        vertexColors    // ← kluczowe! kolory z BufferGeometry
        roughness={0.85}
        metalness={0.1}
      />
    </mesh>
  )
}
```

Brak tekstur — vertex colors. Szybkie, czyste, jak na screenie referencyjnym.

---

### ETAP H5 — useHexRaycast.ts + HexHoverHighlight.tsx
**Czas: ~2h**

Plik: `src/presentation/generator/hooks/useHexRaycast.ts`

```ts
// Raycast do mesha terenu → punkt 3D → konwersja na hex coord
// Używa pixelToHex + hexRound
const useHexRaycast = (terrainRef: RefObject<THREE.Mesh>) => {
  // zwraca: hoveredHex: {q, r} | null
}
```

Plik: `src/presentation/generator/components/viewport/HexHoverHighlight.tsx`

```tsx
// Renderuje jeden podświetlony heks (flat geometry nad terenem)
// Kolor zależy od aktywnego narzędzia
const HexHoverHighlight = ({ q, r }: { q: number; r: number })
```

---

### ETAP H6 — HexOverlay.tsx (paint overlay)
**Czas: ~2h**

Zastępuje `TileOverlay.tsx`.

```tsx
// InstancedMesh z hex geometrią (flat, bez wysokości)
// Renderuje tylko hexesy z userType != null
// Kolory: build=#00ff88, resource=#ffcc00, blocked=#ff3300, spawn=#0088ff
// Pozycje z hexToPixel() + height z HexCell

const HexOverlay = () => {
  // Buduje instanced mesh z aktywnych hexów ze store
}
```

---

### ETAP H7 — HexGridLines.tsx
**Czas: ~1h**

```tsx
// Wireframe siatki hex (LineSegments)
// Renderuje krawędzie wszystkich heksów
// Toggle przez klawisz G / przycisk Grid

const HexGridLines = ({ cells }: { cells: HexCell[] }) => {
  const geometry = useMemo(() => buildHexEdgesGeometry(cells), [cells])
  return <lineSegments geometry={geometry} material={...} />
}
```

---

### ETAP H8 — useMapEditorStore.ts — migracja
**Czas: ~2h**

Zmiany:
```ts
// Stary:
tiles: Uint8Array(10000)
setTile(x, z, type)
paintTiles(coords, type)

// Nowy:
hexGrid: HexGrid          // instancja klasy
setHexUserType(q, r, type)
paintHexes(coords: [number,number][], type)
getBrushHexes(q, r, radius): [number,number][]  // koło brush
autoScatter(opts)         // używa hexGrid
exportToJSON()            // nowy format v2
loadFromJSON(data)        // obsługa v1 i v2
```

Brush size zmienia znaczenie:
- 1×1 → 1 hex
- 3×3 → hex + 6 sąsiadów (ring 1)
- 5×5 → hex + 6 + 12 sąsiadów (ring 2)

---

### ETAP H9 — Dekoracje na hexach (modele GLB)
**Czas: ~2h**

Auto-scatter dekoracji na hexach o typie `rocky` / `peak`:
- `rock_largeA.glb`, `rock_crystals.glb`, `crater.glb` → peak/rocky
- `rocks_smallA.glb`, `meteor_half.glb` → lowland/plains
- Pozycja: `hexToPixel(q, r)` + heightY z HexCell
- Rotacja: losowa z seed

Nowy komponent: `HexDecorMarkers.tsx`
Zastępuje stary `DecorMarkers.tsx` który generował proceduralne icosahedra.

---

### ETAP H10 — Minimap + testy + walidacja
**Czas: ~1.5h**

Minimap:
- Zamiast tile grid → renderuj hexesy jako małe filled polygons na canvas 2D
- `ctx.beginPath()` → 6 punktów heksagonu → `ctx.fill()`
- Kolor z terrainType

Testy:
- `HexMath.test.ts` — konwersje, rounding, neighbors
- `HexGrid.test.ts` — generowanie, noise heights, setUserType
- `useMapEditorStore.test.ts` — update dla hex coords

---

## KOLEJNOŚĆ WYKONANIA

```
[ ] H1 — HexMath.ts + testy         (matematyka)
[ ] H2 — HexGrid.ts                 (generator + noise)
[ ] H3 — HexGeometry.ts             (geometria 3D)
[ ] H4 — HexTerrain.tsx             (render w r3f)
[ ] H5 — useHexRaycast + Highlight  (interakcja)
[ ] H6 — HexOverlay.tsx             (paint overlay)
[ ] H7 — HexGridLines.tsx           (wireframe)
[ ] H8 — useMapEditorStore migracja (store)
[ ] H9 — HexDecorMarkers.tsx        (modele GLB)
[ ] H10 — Minimap + testy           (finalizacja)
```

Po każdym etapie: `npm run build` — brak błędów TypeScript.

---

## PORÓWNANIE: PRZED vs PO

| Aspekt | Teraz | Po zmianie |
|---|---|---|
| Teren | PLaneGeometry + tekstura PNG | Hex BufferGeometry + vertex colors |
| Siatka | 100×100 tiles kwadratowe | ~1200 hexów (radius 20) |
| Koordynaty | [x, z] tile | {q, r} axial |
| Brush | N×N kwadrat | Koło hex (ring radius) |
| Wysokość | Brak (płasko) | Simplex Noise 0..3 units |
| Dekoracje | Proceduralne icosahedra | Prawdziwe GLB (rock, crater) |
| Eksport | v1 JSON (tile coords) | v2 JSON (hex coords + terrain) |
| Minimap | Canvas 2D tile grid | Canvas 2D hex polygons |
| Tekstury | mars_color.png | Brak — vertex colors |
| Performance | InstancedMesh quads | Merged BufferGeometry (1 draw call) |

---

## ZALEŻNOŚCI NPM

```
simplex-noise    — już w projekcie (sprawdzić) lub dodać (zapytać usera)
```

Sprawdzić: `cat package.json | grep simplex`

---

## NOTATKI TECHNICZNE

### Dlaczego vertex colors zamiast tekstur?
- 1 draw call dla całego terenu (merged geometry)
- Brak UV mapping
- Łatwa zmiana kolorów runtime (regenerate mesh)
- Wygląd jak na screenie referencyjnym (Civ-style)
- Wydajność: GPU odczytuje kolor z bufora, nie z tekstury

### Dlaczego flat-top zamiast pointy-top?
- Kamera RTS patrzy z góry pod kątem 45-60°
- Flat-top wygląda szerzej poziomo → naturalne dla RTS
- Civ 5/6 używa flat-top

### Dlaczego radius 20 (nie 50)?
- Mapa 40×40 hexów (~1200 hexów) jest wystarczająca dla gry RTS
- Przy rozmiarze hex 1.2 units: całkowita szerokość ≈ 72 units
- Odpowiada obecnemu TERRAIN_BOUNDS.halfX = 50 (gra)
- Więcej hexów → więcej wierzchołków → wolniejszy merged geometry

### Boczne ściany hexów (columns)?
- Opcjonalne w v1 — można dodać w v2
- Wyglądają lepiej przy zbliżeniu kamery
- Civ używa kolumn o stałej wysokości z gradientem bocznym

---

*Plan zapisany: 2026-06-04*
*Wróć i napisz "zaczynamy H1" — idę przez etapy bez pytań*
