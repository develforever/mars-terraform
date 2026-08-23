# Mars Terraform

Mars Terraform is an interactive 3D real-time strategy (RTS) and colony simulation game built with React 19, TypeScript, Three.js / React Three Fiber, and Node.js. 

The repository serves as an advanced fullstack and graphics engineering portfolio showcase, demonstrating production-grade software design across 3D procedural rendering, domain-driven simulation logic, AI-assisted tooling, and automated asset pipelines with Blender MCP.

---

## Technical Highlights & Architecture

### 1. Hexagonal Terrain Engine (Three.js / GLSL)
- **Axial Coordinate Grid**: Flat-top axial coordinate system `(q, r)` with configurable map radius ($R=20$, hex size $1.2$).
- **Watertight Step-Mesh with Chamfer**: Custom procedural geometry generation (`TerrainMeshBuilder.ts`, `CliffBuilder.ts`) eliminating cracks and T-junctions between discrete elevation tiers (`worldY` levels $0.0$ through $4.0$).
- **Triplanar Slope PBR Shader (`SlopeMaterial.ts`)**: Custom shader with 2K Mars surface modulation, slope-based rock face projection on cliffs, elevation-based frost, and compatibility with Cineon Tone Mapping and HDR Bloom.
- **3D A* Pathfinding (`HexPathfindingService.ts`)**: Multi-tier pathfinding algorithm respecting elevation limits, cliff traversability, and dynamic flood water levels.

### 2. Map Generator & AI Assistant (`/generate`)
- **Map Editor**: Suite for painting biomes, configuring spawn points, build footprints, resource deposits, and decorative scatter.
- **NLP AI Assistant (`AIMapGeneratorService.ts`)**: Natural language prompt processing transforming Polish and English instructions into deterministic map mutations validated via Zod (`MapExportJSON v2.0` contract).
- **Procedural Synthesis**: 4-octave fractal Brownian motion (fBm) noise with persistent seeds for mountains, cratering, and mineral distributions.
- **Cloud Map Storage**: REST persistence layer (`/api/maps`) backed by Drizzle ORM and TSOA.

### 3. Simulation, Logistics & Combat (`/mars`)
- **Infrastructure Graph (`BuildingConnectionService.ts`)**: Minimum Spanning Forest (MSF) via Disjoint Set Union (DSU) for power conduits and water pipelines up to radius $R \le 4$.
- **Building Progression & 3D Units**:
  - *Tier 1*: Stationary extraction.
  - *Tier 2*: Ground rovers (`rover.glb`, `rover_combat.glb`) navigating via 3D A* pathfinding.
  - *Tier 3*: Aerial drones (`craft_miner.glb`, `drone_repair.glb`) flying over cliffs via 3D Bézier curves.
- **Resource Depletion & Adjacency**: Mineral and ice deposit extraction with adjacency efficiency multipliers ($+50\%$ per neighboring deposit) and difficulty-scaled depletion rates.
- **Alien Defense Subsystem**: Dynamic alien swarm pathfinding around cliffs targeting the colony core, countered by defensive turrets.
- **Technology Tree**: 12 research nodes across 6 categories driven by Research Points (RP) produced by Laboratories.
- **Dynamic Water Bodies**: Height-based water table simulation (`WaterHexMesh.tsx`, `WaterMaterial.ts`) with wave vertex shaders, foam depth calculation, and dynamic pathfinding obstruction.

### 4. Blender MCP Automation Pipeline
- **Project Library**: `mars-terraform.blend` containing 504 objects and 153 categorized modular assets.
- **Headless MCP Tooling**: Integration with Blender 5.1.1 via Model Context Protocol (`localhost:9876`).
- **Automated Kitbashing**: Procedural generation of building upgrades (`_lvl2.glb`, `_lvl3.glb`), combat units, and points of interest (`poi_abandoned_lab.glb`, `poi_alien_hive.glb`, `poi_crashed_freighter.glb`).
- **LOD Generation**: Automated mesh decimation (~$65\%$ triangle reduction) generating 26 `_lod1.glb` assets integrated with distance-based `<Detailed>` switching in R3F.
- **Batch Icon Renderer**: Automated isometric 3D thumbnail rendering (128x128 WebP) to `public/icons/`.

---

## Tech Stack

### Frontend
- **Core**: React 19, TypeScript (strict mode, zero `any`)
- **3D Graphics**: Three.js, React Three Fiber (`@react-three/fiber`), `@react-three/drei`, `@react-three/postprocessing`
- **State Management**: Zustand (immutable updates, selector-based consumption)
- **Styling**: TailwindCSS 4, Custom Shaders (GLSL)
- **Testing**: Vitest, React Testing Library (362 tests)

### Backend
- **Runtime**: Node.js, Express, TypeScript
- **API Framework**: TSOA (type-safe routing, decorators, automated OpenAPI/Swagger generation)
- **Database**: Drizzle ORM, Drizzle Kit, SQLite / PostgreSQL
- **Authentication**: JWT, OAuth2 (Google, GitHub)
- **Testing**: Vitest Backend Suite (33 tests)

---

## Available Routes

| Route | Purpose |
|---|---|
| `/` | Start scene with interactive 3D Mars globe, Mie scattering atmosphere, and game setup |
| `/mars` | Main real-time strategic gameplay and terraforming simulation |
| `/generate` | Hexagonal map generator and editor with AI prompt assistant and 3D preview |
| `/api/docs` | OpenAPI / Swagger documentation generated automatically via TSOA |

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+
- *(Optional for 3D asset automation)*: Blender 5.1.1 with `blender-mcp` add-on

### Installation
```bash
npm install
```

### Development
```bash
# Run both Frontend and Backend concurrently
npm run dev

# Or run separately
npm run dev:front  # Vite dev server on http://localhost:5173
npm run dev:back   # Express API server on http://localhost:3000
```

### Tests and Verification
```bash
npm run test       # Runs full test suite (395 tests, frontend + backend)
npm run lint       # ESLint static analysis (0 errors, 0 warnings)
npm run build      # Production build (SSR backend + Client bundle)
```

---

## Engineering Standards

- **Test Coverage**: 395/395 passing automated tests across domain logic, stores, components, and controllers.
- **Zero Lint Violations**: Clean ESLint configuration under strict TypeScript rules.
- **Modal & Popover Dismiss Rule**: All modal dialogs, popovers, and inspector overlays provide an explicit `✕` close button and support backdrop click and `Escape` key dismissal.
- **Centralized Configuration**: All environment variables and backend endpoints are accessed exclusively through `src_backend/config.ts` and frontend configuration constants.
