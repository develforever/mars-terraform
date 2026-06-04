# SMOOTH_TERRAIN_PLAN.md
# Plan: Płynny teren RTS — Podgląd w generatorze
# 2026-06-04

---

## CEL

Dodać do generatora tryb **"Terrain Preview"** — zamiast siatki oddzielnych hex kafelków
użytkownik widzi **jedną ciągłą siatkę terenu** z płynnymi przejściami między wysokościami
(rampy, urwiska, interpolacja wierzchołków).

To jest podgląd tego, jak mapa będzie wyglądać w grze. Generator nadal pozwala malować
terrain types i userTypes na hexach — podgląd aktualizuje się w czasie rzeczywistym.

---

## KLUCZOWY POMYSŁ (z rozmowy Gemini)

### Problem z obecnym podejściem (InstancedMesh):
Każdy hex ma **własne** 7 wierzchołków. Przy różnych wysokościach powstaje efekt
"lego klocków" — schody zamiast terenu.

### Rozwiązanie: Shared Vertex Mesh
Zamiast 7 wierzchołków PER HEX → wierzchołki WSPÓŁDZIELONE między sąsiednimi hexami:
- Każdy narożnik hexa jest dzielony przez 3 sąsiednie hexy
- Wysokość narożnika = **średnia** wysokości sąsiadujących hexów
- Automatycznie powstają rampy i łagodne przejścia
- Stromizna ≥ 2 poziomów → generowanie pionowych ścian (urwisk)

### Shader zamiast danych w JSON:
NIE zapisujemy "to jest urwisko / rampa / stok" w JSON.
Shader oblicza to z **vertex normals**:
- `dot(normal, vec3(0,1,0)) ≈ 1.0` → płaska powierzchnia → kolor/tekstura terenu
- `dot(normal, vec3(0,1,0)) ≈ 0.0` → pionowa ściana → kolor skały / urwiska
- Przejście przez `smoothstep()` — automatyczne, bez danych w JSON

---

## ARCHITEKTURA NOWYCH PLIKÓW

```
src/presentation/generator/
  terrain/
    TerrainMeshBuilder.ts     ← ETAP T1: buduje unified BufferGeometry z HexCell[]
    CliffBuilder.ts           ← ETAP T3: generuje pionowe ściany urwisk
    SlopeMaterial.ts          ← ETAP T2: shader slope-blending (normals → kolor)
  components/viewport/
    SmoothTerrain.tsx         ← ETAP T4: komponent R3F renderujący unified mesh
    TerrainPreviewToggle.tsx  ← ETAP T5: przycisk toggle w toolbarze
```

---

## ETAPY IMPLEMENTACJI

---

### ETAP T1 — TerrainMeshBuilder.ts
**Czas: ~3h | Priorytet: KLUCZOWY**

Buduje jedną `THREE.BufferGeometry` z całego gridu hex.

#### Algorytm — Shared Vertex Grid:

```
Dla każdego hexa (q, r):
  Centrum: hexToWorld(q, r) → (cx, cy=worldY, cz)
  6 narożników: hexCorners(cx, cz, HEX_SIZE) → [(x0,z0)...(x5,z5)]

Krok 1: Zbierz wszystkie unikalne wierzchołki
  - Klucz narożnika = round(x, 3) + ',' + round(z, 3)
  - Każdy unikalny narożnik pojawia się dla 1-3 hexów → Y = średnia
  - Centrum hexa = tylko dla tego hexa → Y = worldY hexa

Krok 2: Triangulacja
  Dla każdego hexa: 6 trójkątów (centrum + 2 sąsiednie narożniki)
  Wierzchołki narożników mają interpolowane Y → rampy

Krok 3: Vertex Colors
  Kolor wierzchołka centrum = TERRAIN_COLORS[cell.terrainType]
  Kolor wierzchołka narożnika = blending kolorów sąsiadujących hexów (interpolacja)

Krok 4: computeVertexNormals()
  Three.js liczy normalne → shader może użyć dot product do detekcji stromizny
```

#### Interfejs:
```ts
export function buildSmoothTerrainGeometry(cells: HexCell[]): THREE.BufferGeometry
```

---

### ETAP T2 — SlopeMaterial.ts
**Czas: ~2h**

Shader `MeshStandardMaterial` z `onBeforeCompile` który:
1. Przekazuje world-space normalne do fragment shadera
2. Oblicza `slope = dot(normal, vec3(0,1,0))`
3. `smoothstep(0.3, 0.7, slope)` → blending między kolorem biome a kolorem skały

```ts
import * as THREE from 'three'

// Bez tekstur — vertex colors + slope tint
export function createSlopeMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
  })

  mat.onBeforeCompile = (shader) => {
    // Vertex shader: przekaż world normal
    shader.vertexShader = shader.vertexShader
      .replace('#include <normal_preamble_vertex>',
        'varying vec3 vWorldNormal;\n#include <normal_preamble_vertex>')
      .replace('#include <normal_vertex>',
        '#include <normal_vertex>\nvWorldNormal = normalize(mat3(modelMatrix) * objectNormal);')

    // Fragment shader: slope blending
    shader.fragmentShader = shader.fragmentShader
      .replace('varying vec3 vViewPosition;',
        'varying vec3 vViewPosition;\nvarying vec3 vWorldNormal;')
      .replace('#include <color_fragment>',
        `
        #include <color_fragment>
        // Slope: 1.0 = flat, 0.0 = vertical
        float slope = clamp(dot(normalize(vWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
        float blend = smoothstep(0.3, 0.65, slope);
        // Cliff color (ciemniejszy kamień marsjański)
        vec3 cliffColor = vec3(0.25, 0.15, 0.08);
        diffuseColor.rgb = mix(cliffColor, diffuseColor.rgb, blend);
        `)
  }

  return mat
}
```

---

### ETAP T3 — CliffBuilder.ts
**Czas: ~2h**

Generuje pionowe ściany dla stromych przejść (diff ≥ 2 poziomy).

```ts
// Dla każdej krawędzi hexa:
//   Jeśli sąsiad istnieje i różnica worldY > threshold (np. 1.2 jednostki):
//     Wygeneruj quad (2 trójkąty) między górną a dolną krawędzią
//     Kolor quadu = kolor urwiska (ciemny kamień)
//   Jeśli sąsiad nie istnieje (granica mapy):
//     Wygeneruj "spódnicę" do Y=0

export function buildCliffGeometry(cells: HexCell[]): THREE.BufferGeometry | null
```

Cliff geometry jest **oddzielnym meshem** od głównego terenu:
- Własny materiał (ciemniejszy, bardziej kamienny)
- Własne normalne (pionowe → shader automatycznie daje kolor skały)
- Może być generowany opcjonalnie (toggle "Show cliffs")

---

### ETAP T4 — SmoothTerrain.tsx
**Czas: ~1.5h**

Komponent R3F renderujący unified mesh:

```tsx
const SmoothTerrain = () => {
  const hexGrid = useMapEditorStore(s => s.hexGrid)

  const terrainGeo = useMemo(() =>
    hexGrid ? buildSmoothTerrainGeometry(hexGrid.getAllCells()) : null,
    [hexGrid]
  )

  const cliffGeo = useMemo(() =>
    hexGrid ? buildCliffGeometry(hexGrid.getAllCells()) : null,
    [hexGrid]
  )

  const mat = useMemo(() => createSlopeMaterial(), [])

  if (!terrainGeo) return null

  return (
    <>
      <mesh geometry={terrainGeo} material={mat} receiveShadow castShadow />
      {cliffGeo && (
        <mesh geometry={cliffGeo} receiveShadow castShadow>
          <meshStandardMaterial vertexColors roughness={0.9} metalness={0.05} />
        </mesh>
      )}
    </>
  )
}
```

---

### ETAP T5 — Toggle w UI + integracja z GeneratorViewport
**Czas: ~1h**

#### Toolbar — nowy przycisk:
```
[🗺 Preview] ← toggle smooth terrain vs hex tiles
```

#### GeneratorViewport — warunkowe renderowanie:
```tsx
{isPreviewMode ? (
  <>
    <SmoothTerrain />
    <HexGridLines />      {/* opcjonalnie — toggle G */}
    <HexInteraction />    {/* interaction nadal działa */}
    <BuildNodeMarkers />
    ...
  </>
) : (
  <>
    <HexTerrain />        {/* obecny InstancedMesh */}
    <HexGridLines />
    <HexInteraction />
    ...
  </>
)}
```

Stan `isPreviewMode` w `useMapEditorStore` lub lokalny w `GeneratorViewport`.

---

### ETAP T6 — Minimap: podgląd terenu zamiast kolorów hex
**Czas: ~1h**

Minimap w trybie preview rysuje gradient wysokości zamiast flat terrain colors:
- Ciemny = niziny (deep_crater → dark brown)
- Jasny = szczyty (peak → light sand)
- Gradient między nimi

Opcja: renderować minimap jako 2D canvas z cieniowaniem na podstawie worldY.

---

## KOLEJNOŚĆ WYKONANIA

```
[ ] T1 — TerrainMeshBuilder.ts   (shared vertex mesh, interpolacja Y)
[ ] T2 — SlopeMaterial.ts        (shader normals → slope blending)
[ ] T3 — CliffBuilder.ts         (pionowe ściany urwisk)
[ ] T4 — SmoothTerrain.tsx       (komponent R3F)
[ ] T5 — Toggle Preview w UI     (integracja z generatorem)
[ ] T6 — Minimap upgrade         (opcjonalne)
```

Po każdym etapie: `npm run build` — brak błędów TypeScript.

---

## DANE W JSON — BEZ ZMIAN

JSON v2 NADAL przechowuje tylko:
```json
{ "q": 0, "r": 0, "terrainType": "highland", "userType": null, "decor": null }
```

**Nie dodajemy**: cliff/ramp/slope/normal data.
Shader i mesh builder obliczają to dynamicznie z height + geometry.

---

## PORÓWNANIE: OBECNY vs NOWY WYGLĄD

| Aspekt | Obecny (InstancedMesh) | Nowy (Smooth Preview) |
|---|---|---|
| Geometria | 7 wierzchołków per hex, oddzielne | Shared vertices, jeden mesh |
| Przejścia | "Schody lego" | Rampy i łagodne stoki |
| Urwiska | Brak | Pionowe ściany między > 2 poziomami |
| Shader | vertexColors plain | slope-based blending (cliff vs biome) |
| Interakcja | Pełna (hover, paint) | Pełna (hex interaction bez zmian) |
| Wydajność | 1 draw call (instanced) | 1-2 draw calls (unified geo) |
| JSON | Bez zmian | Bez zmian |

---

## NOTATKI TECHNICZNE

### Dlaczego shared vertices działają?
Flat-top hex: narożnik między hexami (q,r), (q+1,r), (q,r+1) jest
geometrycznie wspólny (lub bliski). Rounding do 3 miejsc dziesiętnych
pozwala identyfikować identyczne pozycje XZ → interpolować Y.

### Ile wierzchołków?
- Osobne hexy (present): 7 × N wierzchołków
- Shared vertex mesh: ~3.5 × N wierzchołków (narożniki dzielone ~2x)
- Mniej wierzchołków → lepsza wydajność

### Cliff threshold:
`abs(hexA.worldY - hexB.worldY) > TERRAIN_HEIGHT['lowland'] - TERRAIN_HEIGHT['deep_crater']`
= `abs(worldY_diff) > 0.6`
→ generuj ścianę boczną

### Kompat z HexInteraction:
`HexInteraction` używa `e.ray.intersectPlane` na poziomie `TERRAIN_HEIGHT['plains']`.
W smooth terrain, plains są na Y=1.2 — to nadal działa poprawnie.
Dla bardzo wysokich hexów (peak Y=4.0) jest małe przesunięcie — akceptowalne w edytorze.

---

*Plan zapisany: 2026-06-04*
*Napisz "zaczynamy T1" — idę przez etapy bez pytań*
