# TEXTURE_PLAN.md
# Plan: Teksturyzacja płaskich powierzchni terenu (bez klifów)
# 2026-06-05

---

## CEL

Zastąpić vertex colors (flat kolor) prawdziwymi **tileable teksturami** na powierzchniach
terenu w trybie Preview. Styl: "Candy Mars" — nasycone, stylizowane kolory.

Technika: **DataArrayTexture + Vertex Blend Weights** (rekomendacja Gemini).
- Każdy wierzchołek przechowuje do 3 indeksów tekstur + wagi blendowania
- Rampowe wierzchołki (shared) dostają zblendowane wagi sąsiadujących biome'ów
- Shader łączy: `col1*w1 + col2*w2 + col3*w3`
- UV: planar mapping z pozycji XZ (bez UV attribute w geometrii)

Klify (ściany boczne) — osobny krok, zostawiamy na później.

---

## TEKSTURY — co potrzeba

### Sloty tekstur (indeksy 0–4):

| Indeks | terrainType   | Nazwa pliku           | Styl Candy Mars           |
|--------|---------------|----------------------|---------------------------|
| 0      | deep_crater   | `crater.jpg`         | Ciemny rdzawy krater, okrągłe dziury |
| 1      | lowland       | `lowland.jpg`        | Czerwono-brązowy piasek z kamieniami |
| 2      | plains        | `plains.jpg`         | **Jasny pomarańcz, wydmy** (główny) |
| 3      | highland      | `highland.jpg`       | Ciemniejsza pomarańcz, skała + piasek |
| 4      | rocky         | `rocky.jpg`          | Brązowa skała z pęknięciami |
| 5      | peak          | `peak.jpg`           | Jasny kremowy piasek / szron |

### Specyfikacja tekstur:
- Format: JPG, 512×512 px (wystarczy), tileable
- Styl: cartoon/candy — nasycone, outline'y, bez photorealistycznych detali
- Inspiracja: zdjęcia referencyjne (Candy Crater, Czysty Piasek, Przejście Wydmy)

### Skąd wziąć:
**Opcja A (szybka):** Pliki placeholder wygenerowane proceduralnie w kodzie
  → piasek = gradient pomarańcz, skała = szum brązowy, krater = okrągłe dziury
  → nie wymaga żadnych plików, działa od razu

**Opcja B (docelowa):** Własne tekstury w Substance Painter / AI / Photoshop
  → `public/textures/mars/plains.jpg` itd.

**Plan: zaczynamy od Opcji A (procedural), później swap na B**

---

## ARCHITEKTURA TECHNICZNA

### DataArrayTexture (WebGL2)

```ts
// Jeden obiekt THREE.DataArrayTexture zamiast N osobnych
// Indeksowanie: texture(tTerrainArray, vec3(uv, slotIndex))
// Zaleta: brak atlas bleeding, proper RepeatWrapping per layer
```

### Vertex Attributes (nowe w TerrainMeshBuilder)

```ts
// 3 indeksy tekstur + 3 wagi per wierzchołek (łącznie 6 floatów)
geometry.setAttribute('terrainIdx', new THREE.BufferAttribute(Float32Array, 3))
geometry.setAttribute('terrainWgt', new THREE.BufferAttribute(Float32Array, 3))

// Centrum hexa: terrainIdx=[2,0,0], terrainWgt=[1,0,0]  (tylko plains)
// Ramp corner plains↔highland: terrainIdx=[2,3,0], terrainWgt=[0.5,0.5,0]
// Ramp corner plains↔highland↔rocky: terrainIdx=[2,3,4], terrainWgt=[0.33,0.33,0.34]
```

### Planar UV (w vertex shaderze, bez atrybutu UV)

```glsl
// Vertex shader — oblicz UV z pozycji świata
vec2 vUv = vec2(worldPos.x, worldPos.z) / uMapScale;
// Fragment shader — tilowanie
vec2 tiledUv = fract(vUv * uTileScale);  // np. 8.0
```

---

## ETAPY IMPLEMENTACJI

---

### ETAP TX1 — TerrainTextureLoader.ts (~1h)
**Plik:** `src/presentation/generator/terrain/TerrainTextureLoader.ts`

```ts
// Tworzy DataArrayTexture z tablicy tekstur
// Wersja A: proceduralne (Canvas API) — bez plików
// Wersja B: ładowanie z public/textures/mars/

export function createProceduralTerrainTextures(): THREE.DataArrayTexture
// Generuje 6 warstw 256×256 proceduralnie:
//   plains   = gradient pomarańcz + szum
//   highland = ciemniejszy + skała pattern
//   rocky    = brązowy kamień
//   peak     = jasny kremowy
//   lowland  = ciemny brąz
//   crater   = okrągłe dziury / krater

export async function loadTerrainTextureArray(paths: string[]): Promise<THREE.DataArrayTexture>
// Ładuje pliki z public/textures/mars/
```

---

### ETAP TX2 — TerrainMeshBuilder.ts — dodanie blend attributes (~2h)

**Zmiany w istniejącym pliku:**

```ts
// Nowe stałe:
const TERRAIN_TEX_INDEX: Record<HexTerrainType, number> = {
  deep_crater: 0, lowland: 1, plains: 2,
  highland: 3, rocky: 4, peak: 5,
}

// Nowe arrays w buildSmoothTerrainGeometry:
const idxArr: number[] = []  // terrainIdx (3 per vertex)
const wgtArr: number[] = []  // terrainWgt (3 per vertex)

// Centrum hexa (single terrain):
idxArr.push(texIdx, 0, 0)
wgtArr.push(1.0, 0.0, 0.0)

// Ramp corner (blended) — dla każdego shared vertex:
// hexes = lista hexów dzielących ten narożnik
const texIndices = hexes.map(h => TERRAIN_TEX_INDEX[h.terrainType])
// Oblicz unikalne + wagi (ile hexów na typ)
idxArr.push(t0, t1, t2)    // do 3 unikalnych typów
wgtArr.push(w0, w1, w2)    // wagi sumujące się do 1.0

// Cliff corner (per-hex, single terrain):
idxArr.push(texIdx, 0, 0)
wgtArr.push(1.0, 0.0, 0.0)

// Dodaj do geometrii:
geo.setAttribute('terrainIdx', new THREE.Float32BufferAttribute(idxArr, 3))
geo.setAttribute('terrainWgt', new THREE.Float32BufferAttribute(wgtArr, 3))
```

---

### ETAP TX3 — SlopeMaterial.ts — texture sampling shader (~2h)

**Kompletne przepisanie shadera:**

```ts
export interface SlopeMaterialOptions {
  textureArray: THREE.DataArrayTexture  // nowe!
  mapScale?: number       // rozmiar mapy w world units (dla UV)
  tileScale?: number      // 8.0 = 8 repeats na mapę
  // ... (stare opcje frost/cliff zostają)
}
```

```glsl
// Vertex shader additions:
varying vec2 vWorldUv;   // planar UV z XZ
// ...
vWorldUv = vec2(worldPos.x, worldPos.z);

// Fragment shader — zamiana #include <color_fragment>:
attribute vec3 terrainIdx;  // jako varying
attribute vec3 terrainWgt;

vec2 tiledUv = fract(vWorldUv / uMapScale * uTileScale);

// Sample 3 tekstury z DataArrayTexture
vec3 c0 = texture(uTerrainArray, vec3(tiledUv, vTerrainIdx.x)).rgb;
vec3 c1 = texture(uTerrainArray, vec3(tiledUv, vTerrainIdx.y)).rgb;
vec3 c2 = texture(uTerrainArray, vec3(tiledUv, vTerrainIdx.z)).rgb;

// Blend
vec3 blended = c0 * vTerrainWgt.x + c1 * vTerrainWgt.y + c2 * vTerrainWgt.z;

// Candy boost
blended = mix(vec3(0.5), blended, 1.3);  // saturacja
blended *= 1.1;                           // luminancja

diffuseColor.rgb = blended;

// Frost effect (zostaje):
float frostBlend = smoothstep(2.8, 4.0, vWorldY);
diffuseColor.rgb = mix(diffuseColor.rgb, uFrostColor, frostBlend * 0.55);
```

---

### ETAP TX4 — SmoothTerrain.tsx — wiring (~30min)

```tsx
import { useTexture } from '@react-three/drei'

const SmoothTerrain = () => {
  // Opcja A: proceduralne
  const textureArray = useMemo(() => createProceduralTerrainTextures(), [])

  // Opcja B: z plików (po przygotowaniu assetów)
  // const textureArray = useTerrainTextureArray([
  //   '/textures/mars/crater.jpg',
  //   '/textures/mars/lowland.jpg',
  //   '/textures/mars/plains.jpg',
  //   '/textures/mars/highland.jpg',
  //   '/textures/mars/rocky.jpg',
  //   '/textures/mars/peak.jpg',
  // ])

  const terrainMat = useMemo(() =>
    createSlopeMaterial({ textureArray, mapScale: 36, tileScale: 8 }),
    [textureArray]
  )
  // ...
}
```

---

### ETAP TX5 — Przygotowanie tekstur assetów (opcjonalne po TX1-4)

Gdy proceduralne wyglądają dobrze, można zamienić na prawdziwe:

```
public/textures/mars/
  plains.jpg       ← jasny pomarańcz, fale piasku, 512×512, tileable
  highland.jpg     ← ciemniejszy pomarańcz, drobna skała
  rocky.jpg        ← brązowy kamień z pęknięciami
  peak.jpg         ← kremowy jasny piasek / szron
  lowland.jpg      ← rdzawy ciemny piasek
  crater.jpg       ← okrągłe dziury, ciemny brąz z czerwonym
```

Narzędzia: Substance, Midjourney "tileable cartoon mars texture", AI texture gen.

---

## KOLEJNOŚĆ WYKONANIA

```
[ ] TX1 — TerrainTextureLoader.ts   (proceduralne tekstury, DataArrayTexture)
[ ] TX2 — TerrainMeshBuilder.ts     (blend attributes: terrainIdx, terrainWgt)
[ ] TX3 — SlopeMaterial.ts          (shader texture sampling + candy boost)
[ ] TX4 — SmoothTerrain.tsx         (wiring + useEffect na array texture)
[ ] TX5 — Asset tekstury            (po weryfikacji pipeline, opcjonalne)
```

Po TX4: `npm run build` — sprawdź błędy. Odśwież przeglądarkę — teren powinien
mieć textury zamiast flat kolorów.

---

## DIAGRAM DANYCH

```
HexCell.terrainType = 'plains'
        ↓
TERRAIN_TEX_INDEX['plains'] = 2
        ↓
vertex.terrainIdx = [2, 0, 0]
vertex.terrainWgt = [1.0, 0, 0]
        ↓                        (ramp corner: average of neighbors)
shared corner: idx=[2,3,0], wgt=[0.5, 0.5, 0]
        ↓
Shader: sample DataArrayTexture[2] * 0.5 + DataArrayTexture[3] * 0.5
        ↓
Piksele na ekranie = blendowane tekstury marsjańskie
```

---

## CO NIE ZMIENIA SIĘ

- `CliffBuilder.ts` — klify zostają bez tekstur (osobny krok)
- `HexTerrain.tsx` (InstancedMesh editor) — zostaje vertex colors
- `HexInteraction.tsx` — bez zmian
- JSON export — bez zmian (terrainType → index = runtime only)

---

*Plan zapisany: 2026-06-05*
*Napisz "zaczynamy TX1" — implementuję po kolei*
