# MARS_GAME_PLAN.md
# Plan rozwoju gry /mars — Mars Terraform
# Wygenerowano: 2026-06-03

---

## STATUS PROJEKTU

### Co działa
- Routing `/mars`, `/generate`, `/`, auth (JWT + OAuth)
- Scena 3D r3f — teren, budynki z GLB, oświetlenie
- System placement (klik → budynek na terenie)
- Ekonomia tykowa (useEconomy hook)
- Weather system (sandstorm, meteor shower)
- Alien system (wave 1: statki, wave 2: piechota)
- HUD z paletką budynków, resource bar, tooltips
- Generator mapy `/generate` z eksportem JSON
- Backend: auth, zapis kolonii do SQLite (Turso), colony API

### Co jest zepsute / wymaga naprawy
Patrz sekcja BUGI poniżej.

---

## BUGI — naprawić w pierwszej kolejności

### BUG-1: Placement key mismatch
**Plik:** `useGameStore.ts` → `placeBuilding()`
**Problem:** Budynek zapisywany kluczem `${Math.round(cell.x)},${Math.round(cell.z)}`
ale `keyFromCell()` w `Position.ts` robi to samo — jednak `usePlacement.ts`
blokuje placement gdy `y === 0` (terrain height = 0 gdy texture nie załadowana).
Efekt: klikasz → nic się nie dzieje przy zimnym starcie.
**Fix:** Usunąć guard `if (y === 0) return;` w `usePlacement.ts:78`.
Zastąpić warunkiem `if (y < -10 || y > 50) return;` (sanity check zamiast blokady na 0).

### BUG-2: Ekonomia — absurdalne zużycie O2
**Plik:** `EconomyService.ts` → `calculateConsumption()`
**Problem:** `o2: -O2_CONSUMPTION_PER_TICK * buildingCount`
Przy 5 budynkach: -0.25 O2/tick. Startowe zasoby: O2=5.
Po ~20 tickach (bez generatora O2) = game over. Niemożliwe do grania.
**Fix:**
```ts
// Stałe zużycie koloni, niezależne od liczby budynków
static calculateConsumption(): ResourceProduction {
  return { o2: -O2_CONSUMPTION_PER_TICK }; // 0.05/tick stałe
}
// Wywołanie: this.calculateConsumption() bez argumentu
```

### BUG-3: Początkowy capacity = 0 dla biomass/water/power przy nowej grze
**Plik:** `Colony.ts` → `INITIAL_COLONY_STATE`
**Problem:** capacity: { power: 10, water: 10, biomass: 10 } — za mało od startu.
Pierwsze budynki nie mieszczą produkcji i zasoby są natychmiast capped.
**Fix:**
```ts
capacity: { power: 50, water: 30, biomass: 20 }
```

### BUG-4: Alieni — SHIP_DAMAGE za duże
**Plik:** `AlienService.ts`
**Problem:** `SHIP_DAMAGE = 50` przy `condition: 100` → 2 ataki = zniszczony budynek.
`TURRET_RANGE = 15` units = praktycznie cały teren (teren ma ~100×50 units).
**Fix:**
```ts
const SHIP_DAMAGE = 15;        // był 50
const GROUND_DAMAGE = 5;       // był 15
const TURRET_RANGE = 8;        // był 15
```

### BUG-5: Demolish nie działa gdy buildingId nie zgadza się z occupied key
**Plik:** `BuildingService.ts` → `findBuildingAtCell()`
**Problem:** Fallback proximity search używa `< 0.51` ale budynki mogą stać
na pozycjach z wartościami float (heightY powoduje offset).
Occupied key jest zapisany po `Math.round(x), Math.round(z)` ale szuka też
po `building.position.x` (float z terenu).
**Fix:** W `demolishBuilding` w `useGameStore.ts` — szukaj zawsze przez
`keyFromCell(cell.x, cell.z)` i nigdy przez proximity.

---

## FUNKCJE DO IMPLEMENTACJI

### F1: Integracja mapy z generatora w grze
**Priorytet: WYSOKI**
**Opis:** Wczytany JSON z `/generate` ogranicza gdzie można stawiać budynki.
Tylko tile'e oznaczone jako `build` w mapie są dozwolone dla placement.
Resource nodes z mapy tworzą wizualne depozyty surowców (ekstraktory je eksploatują).

**Pliki do modyfikacji:**
- `useMapConfigStore.ts` — już istnieje, dodać selektor `getBuildablePositions()`
- `usePlacement.ts` — sprawdzać czy `(x, z)` jest na build node z mapy
- `MapOverlay.tsx` — już renderuje overlay, poprawić by był interaktywny
- `BuildingService.ts` — `placeBuilding()` przyjmuje opcjonalny `mapConfig`

**Algorytm weryfikacji placement:**
```
1. Gracz klika pozycję (x, z) na terenie
2. Przelicz (x, z) → tile coords: tx = floor(x + 50), tz = floor(z + 25)
3. Sprawdź useMapConfigStore.buildNodes czy tile tx,tz jest w footprincie
4. Jeśli brak załadowanej mapy → pozwól budować wszędzie (fallback)
5. Jeśli mapa załadowana → tylko na build nodes odpowiedniego typu
```

**UI:** Zielony highlight build nodes gdy jesteś w trybie place.
Czerwony highlight gdy klikasz poza dozwoloną strefą.

---

### F2: Grafika terenu — ulepszenia
**Priorytet: WYSOKI**
**Opis:** Teren wygląda płasko i bez głębi.

**Zmiany w `MarsTerrain.tsx`:**
```
- Zmienić teksturę: mars_colorx1.png → 2k_mars.jpg (lepsza rozdzielczość)
- Dodać normalMap: brak → 2k_mars_displacement.jpg jako normal approx
- Zwiększyć displacementScale: obecny → 3.0–5.0 (realna wysokość)
- Dodać fogExp2 z kolorem marsjańskim (#c1440e) density 0.008
- Dodać hemisphereLight dla koloru nieba
- Zwiększyć shadow map: 1024 → 2048
```

**Nowy plik: `MarsAtmosphere.tsx`**
```tsx
// Kopuła nieba — gradient od pomarańczowego do czarnego
// Marsjański kurz w tle (particles)
// Słońce jako sprite z lens flare (drei <Sparkles> lub custom)
```

---

### F3: HUD — czytelność i animacje
**Priorytet: ŚREDNI**

**Problemy:**
- Brak wskaźnika zdrowia budynku w paletce (widać tylko w popoverze po kliknięciu)
- Resource bar nie pokazuje pojemności (tylko aktualną wartość)
- Brak wskaźnika nadchodzącej fali alienów
- Brak informacji o postępie terraformowania poza paskiem

**Zmiany:**

**`ResourceBar.tsx`** — dodać format `{value}/{capacity}` dla power/water/biomass.
Kolor paska zmieniać się zależnie od % (zielony > 50%, żółty 20-50%, czerwony < 20%).

**`BuildingPalette.tsx`** — nad każdym budynkiem który jest placed:
małe kółko z kolorem kondycji (zielony/żółty/czerwony).

**Nowy komponent: `AlienThreatIndicator.tsx`**
```
Pozycja: prawy górny róg HUD
Wyświetla:
- "FALA 1 — STATKI" gdy wave >= 1 z licznikiem aktywnych statków
- "FALA 2 — ATAK NAZIEMNY" gdy wave >= 2
- Czas do następnego spawnu (nextShipSpawnIn / 120 jako pasek)
- Pulsujące czerwone tło gdy atak w toku
```

**Nowy komponent: `TerraformingPanel.tsx`**
```
Pozycja: lewy dolny róg
Wyświetla:
- Duży pasek terraformowania z % i etykietą
- Milestony: 25% → Fala 1, 60% → Fala 2, 100% → Wygrana
- Animacja gdy milestone osiągnięty
```

---

### F4: Nowe budynki i modele 3D
**Priorytet: ŚREDNI**

**Budynki do dodania:**

| id | Nazwa | Kategoria | Opis |
|---|---|---|---|
| `shield` | Kopuła Obronna | DEFENSE | Blokuje meteoryty w promieniu 10u |
| `repair-bay` | Hangar Naprawczy | INFRASTRUCTURE | +1% condition/tick dla sąsiednich budynków |
| `comms` | Wieża Komunikacyjna | INFRASTRUCTURE | Odblokowuje misje (przyszłość) |
| `algae` | Reaktor Glonowy | PRODUCTION | Produkuje O2 i biomass, wymaga water |
| `drill` | Wiertnica | PRODUCTION | Wydobywa water z głębokości, wolno ale autonomicznie |

**Pipeline modeli:**
```
1. Modelować w Blenderze (low-poly ~500-2000 tris)
2. Eksportować do /public/models/mars/ jako .glb
3. Dodać do BUILDING_SEED w buildings.ts
4. Przetestować placement i skalę
```

**Modele już w projekcie (sprawdzić `/public/models/mars/`):**
Sprawdzić co jest dostępne i przypisać do nowych definicji.

---

### F5: System jednostek / obrony
**Priorytet: NISKI — wymaga nowych modeli**

**Rozbudowa `AlienService.ts`:**
- Wave 3 przy terraforming >= 85% — "boss ship" z HP 500
- Ground units z animacją ruchu (lerp position w r3f)
- Turret visual — obracająca się wieżyczka śledząca nearest target

**Nowy serwis: `DefenseService.ts`**
```ts
// Logika turrety — strzelanie do ground units
// Zasięg zależy od building condition
// Efekt wizualny: laser beam (drei <Line>) między turretą a celem
```

**Nowy komponent: `AlienUnitsRenderer.tsx`**
```tsx
// Renderuje ground units jako czerwone sześciany z HP barem
// Lerp pozycji między tickami dla płynnego ruchu
// Efekt wybuchu przy zniszczeniu
```

---

### F6: Zapis gry — auto-save i UX
**Priorytet: ŚREDNI**

**Backend działa** — `POST /api/colony` i `GET /api/colony/:name` są gotowe.

**Problemy z aktualną implementacją:**
- Brak auto-save
- Brak feedback przy błędzie zapisu
- Brak listy kolonii do wyboru przy wczytywaniu
- `loadGame` nadpisuje stan bez potwierdzenia

**Zmiany:**

**`useEconomy.ts`** — dodać auto-save co 30 tyknięć:
```ts
if (tickCount % 30 === 0 && isAuthenticated) {
  saveGame().then(ok => ok && setLastSaved(Date.now()))
}
```

**`LoadGameModal.tsx`** — zamiast pola tekstowego, lista kolonii z API:
```
GET /api/colony → lista → wyświetl jako karty z nazwą, datą, postępem
Kliknij kartę → confirm dialog → loadGame(name)
```

**HUD save button** — pokazywać "💾 Zapisano 2min temu" zamiast "Save".

---

## KOLEJNOŚĆ IMPLEMENTACJI

### Sprint 1 — Bugi (1-2 dni)
```
[ ] BUG-1: Fix placement guard (y === 0)
[ ] BUG-2: Fix O2 consumption (stałe zamiast per-building)
[ ] BUG-3: Fix initial capacity values
[ ] BUG-4: Fix alien damage values
[ ] BUG-5: Fix demolish key lookup
[ ] npm run test:front — upewnić się że wszystkie testy przechodzą
[ ] npm run build — brak błędów TypeScript
```

### Sprint 2 — Grafika i terrain (1 dzień)
```
[ ] F2: Wymiana tekstur terenu na 2k
[ ] F2: Fog atmosferyczny
[ ] F2: Lepsza rozdzielczość shadow map
[ ] F2: MarsAtmosphere.tsx (niebo, kurz)
```

### Sprint 3 — Integracja generatora (1-2 dni)
```
[ ] F1: getBuildablePositions() w useMapConfigStore
[ ] F1: Weryfikacja placement vs. build nodes
[ ] F1: Highlight build zones w trybie place
[ ] F1: Resource node depots — wizualne złoża na mapie
```

### Sprint 4 — HUD (1 dzień)
```
[ ] F3: ResourceBar z capacity i kolorami
[ ] F3: BuildingPalette — kondycja placed buildings
[ ] F3: AlienThreatIndicator
[ ] F3: TerraformingPanel z milestones
```

### Sprint 5 — Zapis (1 dzień)
```
[ ] F6: Auto-save co 30 tyknięć
[ ] F6: LoadGameModal z listą kolonii
[ ] F6: "Zapisano X min temu" w HUD
[ ] F6: Confirm dialog przed nadpisaniem
```

### Sprint 6 — Nowe budynki (2-3 dni)
```
[ ] F4: Budynki shield, repair-bay, algae, drill w buildings.ts
[ ] F4: Modele w Blenderze lub reuse istniejących GLB
[ ] F4: Testy ekonomii z nowymi budynkami
```

### Sprint 7 — Obrona i alieni (2-3 dni)
```
[ ] F5: Wave 3 (boss ship)
[ ] F5: AlienUnitsRenderer z lerp
[ ] F5: DefenseService — turret AI
[ ] F5: Laser beam effect
```

---

## TECHNICZNE NOTATKI

### Rozmiar terenu w grze vs. generator
```
Generator:  100×100 tiles, 1 tile = 1 unit, origin (−50, 0, −50)→(50, 0, 50)
Gra:        TERRAIN_BOUNDS { halfX: 50, halfZ: 25, sizeX: 100, sizeZ: 50 }
UWAGA: Gra ma inny rozmiar Z (50 units) niż generator (100 units)!
Przy integracji przeliczać: gameZ = generatorTileZ * 0.5 - 25
```

### Klucze do budynków
```ts
// ZAWSZE używać keyFromCell() z Position.ts — nigdy template string ręcznie
// keyFromCell(x, z) = `${Math.round(x) || 0},${Math.round(z) || 0}`
```

### Tick rate
```ts
// useEconomy.ts — tick co ile ms?
// Sprawdzić i udokumentować tutaj po otwarciu pliku
```

### Modele 3D dostępne w /public/models/mars/
```
// Sprawdzić listę przed modelowaniem nowych — wiele może być nieużywanych
```

---

## PLIKI KLUCZOWE — MAPA

```
src/
  app/App.tsx                          # Routing
  application/
    hooks/
      useEconomy.ts                    # Główna pętla gry (tyki)
      usePlacement.ts                  # Placement raycast + click
    store/
      useGameStore.ts                  # Stan gry (resources, buildings, aliens)
      useUIStore.ts                    # Stan UI (buildMode, hoverCell, HUD)
      useMapConfigStore.ts             # Załadowana mapa z generatora
      useMapEditorStore.ts             # Stan edytora mapy (/generate)
  domain/
    config/buildings.ts                # Definicje wszystkich budynków
    entities/
      Building.ts                      # Typy PlacedBuilding, BuildingDefinition
      Colony.ts                        # INITIAL_COLONY_STATE (zasoby startowe)
      Position.ts                      # keyFromCell() — UŻYWAĆ ZAWSZE
      Resources.ts                     # ResourceKey, typy zasobów
    services/
      AlienService.ts                  # AI alienów, wave system
      BuildingService.ts               # Placement, demolish, conditions
      EconomyService.ts                # Tyki ekonomii, O2, produkcja
      EconomyService.ts                # Tyki ekonomii, O2, produkcja
      TerraformingService.ts           # Postęp terraformowania, win condition
      WeatherService.ts                # Sandstorm, meteor shower
  presentation/
    components/game/
      Scene3D.tsx                      # Główna scena r3f
      Buildings.tsx                    # Render placed buildings + ghost + demolish
      MarsTerrain.tsx                  # Mesh terenu z teksturami
      HUD.tsx                          # Główny HUD
      AlienInvasion.tsx                # Render statków i piechoty
      MapOverlay.tsx                   # Overlay build/resource nodes z mapy
    generator/
      GeneratorPage.tsx                # Strona /generate
      components/...                   # Komponenty edytora
      hooks/useTerrainHeight.ts        # Context do snap markerów na teren
      utils/validateMap.ts             # Walidacja JSON mapy

src_backend/
  controller/ColonyController.ts       # REST API zapisu kolonii
  service/ColonyService.ts             # Logika zapisu do DB
  db/schema.ts                         # Schemat SQLite (Turso)
```

---

*Plan wygenerowany na podstawie analizy kodu — 2026-06-03*
*Wróć do tego pliku i zacznij od Sprint 1 — Bugi*
