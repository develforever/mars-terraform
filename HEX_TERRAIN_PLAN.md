# HEX_TERRAIN_PLAN.md
# Plan generatora mapy heksagonalnej — zrewidowany
# Zaktualizowano: 2026-06-04

---

## CEL

Generator mapy RTS oparty na heksagonalnej siatce proceduralnej w marsjańskiej kolorystyce.

**Kluczowe decyzje projektowe (zrewidowane):**
- Teren jest **płaski** — wszystkie hexy mają `height = 0` (bez Simplex Noise wysokości)
- `terrainType` każdego hexa ustawiany **ręcznie przez użytkownika** (kliknięcie → wybranie typu)
- Hexy renderowane jako **THREE.InstancedMesh** (jeden draw call)
- Rozmiar mapy (radius) i seed ustawiane z UI
- **Brak falloff** — użytkownik sam kształtuje mapę klikając/malując

---

## AKTUALNY STAN IMPLEMENTACJI

### Gotowe (nie ruszamy):
- `HexMath.ts` — kompletna matematyka (hexToWorld, worldToHex, neighbors, ring, brush, corners)
- `HexGrid.ts` — generator gridu z noise (do dostosowania: wyłączyć noise heights, zachować strukturę)
- `HexGeometry.ts` — buildery geometrii (zachować `buildHexEdgesGeometry`, `buildHexHighlightGeometry`; usunąć `buildHexTerrainGeometry` → zastąpić InstancedMesh)
- `HexTerrain.tsx` — **do przepisania na InstancedMesh**
- `HexGridLines.tsx` — gotowe, bez zmian
- `useMapEditorStore.ts` — częściowe wsparcie hex, do dokończenia
- Testy `HexMath.test.ts`, `HexGrid.test.ts`, `HexGeometry.test.ts` — zachować i rozszerzyć
- `Minimap.tsx` — renderuje hexy na canvas 2D, do zachowania
- Layout trójpanelowy `GeneratorPage.tsx`, lewy/prawy panel, toolbar

### Do przepisania / stworzenia:
- `HexTerrain.tsx` → **InstancedMesh** zamiast merged BufferGeometry
- `TileOverlay.tsx` → **usunąć**, zastąpić logiką w InstancedMesh (jeden mesh = teren + overlay)
- `useHexRaycast.ts` → **brak**, trzeba stworzyć
- `HexHoverHighlight.tsx` → **brak**, trzeba stworzyć
- Store: usunąć dual-mode (stary `tiles: Uint8Array`), tylko `hexGrid: HexGrid`
- Export: zaktualizować do formatu v2 (hex coords)
- UI: dodać kontrolki radius + seed w lewym panelu
- `HexDecorMarkers.tsx` → modele GLB na hexach (opcjonalne, etap końcowy)

---

## MATEMATYKA HEX GRIDU (bez zmian)

### Orientacja: FLAT-TOP
```
x = HEX_SIZE * (3/2 * q)
z = HEX_SIZE * (sqrt(3)/2 * q + sqrt(3) * r)
```

### Rozmiar mapy: konfigurowalny radius (domyślnie 20)
- UI pozwala ustawić radius od 5 do 40
- Zmiana radius → regeneracja gridu

---

## MODEL DANYCH — PŁASKI TEREN

### HexCell (zaktualizowany):
```ts
interface HexCell {
  q: number
  r: number
  height: 0                    // zawsze 0 — teren płaski
  terrainType: HexTerrainType  // ustawiany ręcznie przez użytkownika
  userType: TileType | null    // nakładka (build/resource/blocked/spawn)
  decor: string | null
}
```

### HexTerrainType (zachowany schemat kolorów):
```ts
type HexTerrainType =
  | 'deep_crater'   // #3d1f0a — ciemny brąz
  | 'lowland'       // #8b3a1a — rdzawy brąz
  | 'plains'        // #c1440e — marsjański pomarańcz (domyślny)
  | 'highland'      // #d4622a — jasny pomarańcz
  | 'rocky'         // #6b4c32 — ciemny szary-brąz
  | 'peak'          // #9e8060 — piaskowy
```

**Domyślny terrainType dla nowej mapy: `'plains'`** (wszystkie hexy zaczynają jako plains).

### TileType (bez zmian — nakładka użytkownika):
```ts
type TileType = 'empty' | 'build' | 'resource' | 'blocked' | 'spawn'
// Nakładka wyświetlana jako półprzezroczyste zabarwienie heksa
```

---

## ARCHITEKTURA RENDEROWANIA — INSTANCEDMESH

### Jeden InstancedMesh dla całego terenu:

```tsx
// HexTerrain.tsx — nowa architektura
const HexTerrain = () => {
  const cells = hexGrid.getAllCells()
  const geometry = useMemo(() => createFlatHexGeometry(HEX_SIZE), [])
  const mesh = useRef<THREE.InstancedMesh>()

  // Aktualizacja instancji: pozycja + kolor
  useEffect(() => {
    cells.forEach((cell, i) => {
      const [x, z] = hexToWorld(cell.q, cell.r)
      dummy.position.set(x, 0, z)    // height = 0
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)

      // Kolor = terrainColor lub overlayColor (jeśli userType != null)
      const color = getUserTypeColor(cell) ?? getTerrainColor(cell)
      mesh.current.setColorAt(i, color)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.instanceColor.needsUpdate = true
  }, [cells, hoveredHex])

  return (
    <instancedMesh ref={mesh} args={[geometry, material, cells.length]}>
      <meshStandardMaterial roughness={0.85} metalness={0.1} vertexColors />
    </instancedMesh>
  )
}
```

### Geometry dla pojedynczego heksa:
```ts
// createFlatHexGeometry(size) — flat-top, Y=0, triangle fan
// 6 trójkątów od środka, bez ścian bocznych
// Zwraca THREE.BufferGeometry bez vertex colors (kolory przez instanceColor)
```

### Kolory:
- Bazowy kolor = `TERRAIN_COLORS[cell.terrainType]`
- Jeśli `cell.userType != null` → kolor nakładki (build=#00ff88, resource=#ffcc00, blocked=#ff3300, spawn=#0088ff) z opacity blendowaną w shaderze LUB przez jaśniejszy solid color
- Hover highlight → `HexHoverHighlight.tsx` (osobny mesh na wierzchu)

---

## INTERAKCJA UŻYTKOWNIKA

### Tryby narzędzi:

#### Tryb `select` (nowy, domyślny):
- Kliknięcie hexa → zaznaczenie, w prawym panelu pojawia się formularz heksa
- Formularz pozwala wybrać `terrainType` (radio/select) → natychmiastowy rebuild koloru instancji
- Nie maluje `userType`

#### Tryby `build` / `resource` / `blocked` / `spawn` / `erase`:
- Kliknięcie/przeciągnięcie → malowanie `userType` na heksach (brush size)
- Identyczne jak dotychczas, ale na hex coords

### HexHoverHighlight:
- Osobny cienki mesh (flat hex + outline) wyświetlany nad hovered hexem
- Kolor zależy od aktywnego trybu (biały=select, zielony=build, itd.)
- Przy trybie brush 3×3 lub 5×5: podświetla cały obszar brush

### useHexRaycast:
```ts
const useHexRaycast = (meshRef: RefObject<THREE.InstancedMesh>) => {
  // Raycast do InstancedMesh → instanceId → coords z hexGrid
  // LUB raycast do płaszczyzny y=0 → worldToHex()
  return { hoveredHex: { q, r } | null, hoveredInstanceId: number | null }
}
```

---

## UI — KONTROLKI GENERATORA

### Lewy panel (rozszerzony):

```
┌─────────────────────────┐
│  NARZĘDZIA              │
│  ○ Select (S)           │
│  ● Build (B)            │
│  ○ Resource (R)         │
│  ○ Blocked (X)          │
│  ○ Spawn (Sp)           │
│  ○ Erase (E)            │
│  ─────────────────────  │
│  Brush: ●1  ○3  ○5      │
│  ─────────────────────  │
│  MAPA                   │
│  Radius: [──●──] 20     │
│  Seed:   [12345  ] [↺]  │
│  [Generuj mapę]         │
│  ─────────────────────  │
│  TerrainType (Select):  │
│  ○ deep_crater          │
│  ● plains               │
│  ○ highland             │
│  ...                    │
└─────────────────────────┘
```

**Uwaga:** TerrainType picker w lewym panelu działa jak "pędzel terrainType" — maluje `terrainType` na klikanych hexach (brush size). Oddzielny od userType.

### Prawy panel — Inspector wybranego hexa:
```
┌─────────────────────────┐
│  Hex (q=3, r=-2)        │
│  terrainType: [plains▼] │
│  userType:    [build  ] │
│  height:      0.00      │
│  decor:       [none   ] │
└─────────────────────────┘
```

---

## STORE — useMapEditorStore (zrewidowany)

### Usunąć:
```ts
// USUNĄĆ:
tiles: Uint8Array(10000)       // stary system kwadratowy
setTile(x, z, type)
paintTiles(coords, type)
MAP_SIZE: 100
```

### Zachować / dodać:
```ts
// NOWE:
hexGrid: HexGrid | null
hexRadius: number              // 5–40, domyślnie 20
hexSeed: number                // domyślnie losowy

// Generacja
generateHexGrid(radius?: number, seed?: number): void

// Malowanie userType
setHexUserType(q: number, r: number, type: TileType | null): void
paintHexes(coords: [number, number][], type: TileType | null): void
getBrushHexes(q: number, r: number, brushSize: 1|3|5): [number, number][]

// Ustawianie terrainType (nowe!)
setHexTerrainType(q: number, r: number, type: HexTerrainType): void
paintHexTerrainType(coords: [number, number][], type: HexTerrainType): void

// Selekcja
selectedHex: { q: number, r: number } | null
selectHex(q: number, r: number): void
clearSelection(): void

// Ustawienia mapy
setHexRadius(radius: number): void
setHexSeed(seed: number): void

// Export/import
exportToJSON(): MapExportJSON   // format v2
loadFromJSON(data: unknown): void  // obsługuje v1 i v2

// Reszta bez zmian
buildNodes, resourceNodes, spawnPoints, decor
activeTool, brushSize, showGrid, undoStack
```

### HexGrid.generate() bez noise heights:
```ts
// HexGrid.ts — nowe zachowanie generate():
generate(): void {
  // Dla każdego hexa w radius:
  // height = 0 (zawsze)
  // terrainType = 'plains' (domyślnie, potem user zmienia)
  // userType = null
  // decor = null
  // BRAK Simplex Noise do wysokości
  // Seed przechowywany do ewentualnego auto-scatter decoru
}
```

---

## FORMAT JSON EKSPORTU v2 (bez zmian struktury)

```json
{
  "meta": {
    "name": "mars_alpha",
    "version": "2.0",
    "gridType": "hex-flat-top",
    "hexSize": 1.2,
    "hexRadius": 20,
    "players": 2,
    "seed": 42
  },
  "hexes": [
    { "q": 0, "r": 0, "terrainType": "plains", "userType": null, "decor": null },
    { "q": 1, "r": -1, "terrainType": "highland", "userType": "build", "decor": null }
  ],
  "buildNodes": [...],
  "resourceNodes": [...],
  "spawnPoints": [...],
  "decor": []
}
```

**Zmiana vs. v1:** brak `blockedTiles` base64 bitmask, brak `height` per hex (zawsze 0), brak `terrainFile`.

---

## ETAPY IMPLEMENTACJI (zrewidowane)

---

### ETAP H1 — HexGrid.ts: wyłączyć noise heights ✅ (do weryfikacji)
**Czas: ~30min**

Zmiana w `HexGrid.ts`:
- `generate()` → każdy hex dostaje `height = 0`, `terrainType = 'plains'`
- Usunąć Simplex Noise heights (zachować seed dla przyszłego auto-scatter decoru)
- Sprawdzić że `TERRAIN_COLORS` i `TERRAIN_HEIGHT` (jeśli istnieje) nie nadpisują userem

---

### ETAP H2 — HexTerrain.tsx: przepisać na InstancedMesh
**Czas: ~2h**

Plik: `src/presentation/generator/components/viewport/HexTerrain.tsx`

```tsx
// Jeden InstancedMesh zamiast merged BufferGeometry
// geometry = flat hex (triangle fan, Y=0)
// Kolor per instancja (terrainType lub userType overlay)
// Aktualizacja: tylko needsUpdate na instanceMatrix i instanceColor
// Hover: podświetlenie przez osobny HexHoverHighlight.tsx, nie tu
```

Usunąć:
- `buildHexTerrainGeometry()` z `HexGeometry.ts` (lub oznaczyć jako deprecated)
- `TileOverlay.tsx` — logikę przejąć w HexTerrain

---

### ETAP H3 — useHexRaycast.ts + HexHoverHighlight.tsx
**Czas: ~1.5h**

```ts
// useHexRaycast.ts
// Raycast do płaszczyzny y=0 → worldToHex() → hoveredHex {q, r}
// Lub: raycast do InstancedMesh → getInstanceId → hexGrid lookup
// Zwraca: { hoveredHex, setPointerHandlers }
```

```tsx
// HexHoverHighlight.tsx
// Flat hex mesh (outline / solid z opacity) wyświetlany nad hovered hexem
// Aktualizuje pozycję każdy frame na podstawie hoveredHex
// Przy brushSize 3: ring(1) hexes, przy brushSize 5: ring(2) hexes
```

---

### ETAP H4 — Store cleanup: usunąć dual-mode
**Czas: ~1.5h**

W `useMapEditorStore.ts`:
- Usunąć `tiles: Uint8Array`, `setTile`, `paintTiles`, `MAP_SIZE`
- Dodać `selectedHex`, `selectHex`, `clearSelection`
- Dodać `setHexTerrainType`, `paintHexTerrainType`
- Dodać `hexRadius`, `setHexRadius`
- Export `exportToJSON()` → format v2
- `loadFromJSON()` → obsługa v1 (legacy tiles) i v2 (hex coords)

---

### ETAP H5 — UI: radius, seed, terrainType picker w lewym panelu
**Czas: ~1h**

W `GeneratorLeftPanel.tsx`:
- Slider/input dla `hexRadius` (5–40)
- Input + losowy przycisk dla `hexSeed`
- Przycisk `[Generuj mapę]` → `generateHexGrid(radius, seed)`
- Radio group `terrainType` (malowanie terrainType przez klikanie)

Nowy tryb narzędzia: `'terrain'` — maluje terrainType (nie userType).

---

### ETAP H6 — Inspector hexa w prawym panelu
**Czas: ~1h**

W `GeneratorRightPanel.tsx`:
- Zakładka Inspector: pokazuje dane zaznaczonego hexa
- Formularz: `terrainType` (select), `userType` (select), `decor` (select lub null)
- Zmiana wartości → natychmiastowy update koloru instancji

---

### ETAP H7 — Export v2 + walidacja
**Czas: ~1h**

- `exportToJSON()` → nowy format v2 z hexami
- `loadFromJSON()` → detect v1/v2 po `meta.version`
- Walidacja Zod (jeśli jest w projekcie)
- Test roundtrip: generate → paint → export → load → compare

---

### ETAP H8 — HexDecorMarkers.tsx (opcjonalne)
**Czas: ~2h**

Modele GLB z `/public/models/mars/`:
- `rocky`/`peak` hexy → losowe skały i kratery (używając seed)
- Pozycja: `hexToWorld(q, r)` + Y=0
- Komponenty InstancedMesh lub useGLTF per model

---

### ETAP H9 — Testy + minimap + polish
**Czas: ~1.5h**

- Zaktualizować testy po usunięciu noise heights
- Minimap — weryfikacja że rysuje hex terrain types (nie stare tiles)
- Keyboard shortcuts: dodać klawisz dla trybu `terrain`
- Status bar: liczba hexów per terrainType + per userType

---

## KOLEJNOŚĆ WYKONANIA

```
[✅] H1 — HexGrid: wyłączyć noise heights, domyślnie 'plains'
[ ] H2 — HexTerrain: przepisać na InstancedMesh (KLUCZOWE)
[ ] H3 — useHexRaycast + HexHoverHighlight (interakcja)
[ ] H4 — Store cleanup: usunąć dual-mode tiles, dodać selectedHex, terrainType ops
[ ] H5 — UI: radius, seed, terrainType picker
[ ] H6 — Inspector zaznaczonego hexa
[ ] H7 — Export v2 + walidacja
[ ] H8 — HexDecorMarkers (opcjonalne, po reszcie)
[ ] H9 — Testy + minimap + polish
```

Po każdym etapie: `npm run build` — brak błędów TypeScript.

---

## PORÓWNANIE: STARY PLAN vs. NOWY PLAN

| Aspekt | Stary plan | Nowy plan |
|---|---|---|
| Wysokość hexów | Simplex Noise 0..1 | Zawsze 0 (płaski teren) |
| terrainType source | Generowany z noise | Ustawiany ręcznie przez user |
| Rendering | merged BufferGeometry | **InstancedMesh** (1 draw call) |
| Falloff krawędzi | Był planowany | **Usunięty** — user rysuje sam |
| Rozmiar mapy | Stały radius=20 | **Konfigurowalny** (5–40) z UI |
| Seed | W generatorze | **Widoczny w UI**, edytowalny |
| Narzędzie terrain | Brak | **Nowy tryb 'terrain'** — maluje terrainType |
| Selekcja hexa | Brak | **Tryb 'select'** + Inspector |
| TileOverlay.tsx | InstancedMesh quads | **Usunięty** — logika w HexTerrain |
| Boczne ściany | Opcjonalne | **Nie** — płaski hex, bez kolumn |

---

## ZALEŻNOŚCI NPM

```
simplex-noise    — jest w projekcie (seed-based PRNG, zachować do decoru)
three            — jest (InstancedMesh, BufferGeometry)
```

Nie potrzeba nowych paczek.

---

*Zaktualizowano: 2026-06-04*
*Napisz "zaczynamy H2" — idę przez etapy bez pytań*
