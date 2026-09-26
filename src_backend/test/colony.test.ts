import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "http";
import type { AddressInfo } from "net";
import jwt from "jsonwebtoken";

vi.mock("../data-source", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("../config", () => ({
  config: {
    jwtSecret: "test-secret",
    jwtExpiresIn: "1h",
    frontendUrl: "http://localhost:5173",
    backendUrl: "http://localhost:3000",
    emailStrategy: "console",
    smtpFrom: "noreply@mars-terraform.local",
    corsOrigins: [],
  },
}));

import { createApp, JSON_BODY_LIMIT_BYTES } from "../app";
import { db } from "../data-source";

/**
 * Zapis/wczytanie kolonii (POST/GET /api/colony) przez prawdziwe trasy TSOA (`routes.ts`).
 * T4d: `routes.ts` zgodny z `model/types.ts` przy `noImplicitAdditionalProperties: "throw-on-extras"`.
 * T4e (D13 = c): `state` to otwarty obiekt JSON (`ColonyState`), backend nie zna jego kształtu;
 * tablica/null/prymityw → 400, ciało ponad `JSON_BODY_LIMIT_BYTES` → 413.
 */

let server: Server | null = null;

const start = async (): Promise<string> => {
  const app = createApp({
    corsOrigins: [],
    distPath: "/nonexistent",
    serveFrontend: false,
    checkDatabase: async (): Promise<void> => {},
    version: "test",
    isProduction: true,
  });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
};

const bearer = (): string =>
  jwt.sign({ userId: 7, email: "u@mars.test" }, "test-secret", { expiresIn: "1h" });

const postRaw = (baseUrl: string, body: string): Promise<Response> =>
  fetch(`${baseUrl}/api/colony`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer()}` },
    body,
  });

const postColony = (baseUrl: string, body: unknown): Promise<Response> =>
  postRaw(baseUrl, JSON.stringify(body));

const getColony = (baseUrl: string, name: string): Promise<Response> =>
  fetch(`${baseUrl}/api/colony/${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${bearer()}` },
  });

/** Brak istniejącej kolonii → insert z `lastInsertRowid`. */
const mockNewColony = (id: number): ReturnType<typeof vi.fn> => {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
  } as unknown as ReturnType<typeof db.select>);
  const values = vi.fn().mockResolvedValue({ lastInsertRowid: id });
  vi.mocked(db.insert).mockReturnValue({ values } as unknown as ReturnType<typeof db.insert>);
  return values;
};

interface ColonyRow {
  readonly id: number;
  readonly userId: number;
  readonly name: string;
  readonly state: string;
  readonly updatedAt: Date | null;
  readonly createdAt: Date | null;
}

/** `select().from().where().limit()` zwraca podane wiersze (odczyt kolonii). */
const mockExistingRows = (rows: readonly ColonyRow[]): void => {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  } as unknown as ReturnType<typeof db.select>);
};

const PLAYER_BUILDINGS: readonly string[] = [
  "biosphere_dome", "atmosphere_factory", "fusion_reactor", "rtg", "greenhouse", "lab",
  "turret", "solar", "ice", "miner", "battery", "watertank", "silo",
];

const TERRAINS: readonly string[] = ["deep_crater", "lowland", "plains", "highland", "rocky", "peak"];

/** Heksy mapy o promieniu `radius` (flat-top, axial) w kształcie `MapExportJSON.hexes`. */
const buildHexes = (radius: number): Record<string, unknown>[] => {
  const hexes: Record<string, unknown>[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      hexes.push({
        q,
        r,
        terrainType: TERRAINS[Math.abs(q * 7 + r * 3) % TERRAINS.length],
        userType: (q + r) % 11 === 0 ? "build" : null,
        decor: null,
      });
    }
  }
  return hexes;
};

/**
 * Stan w kształcie ciała `useGameStore.saveGame` (src/application/store/useGameStore.ts) dla typowej gry:
 * mapa `currentMapData` hexRadius 20 (1261 heksów), 30 budynków, 12 jednostek, 200 snapshotów analityki.
 * Pomiar realnego stanu (fixture `perf-stress` + mapa generatora r=20 + 200 snapshotów): ~146 kB.
 */
const buildFullSaveState = (): Record<string, unknown> => {
  const placed = Array.from({ length: 30 }, (_, i) => ({
    id: i === 0 ? "colony-center-hab" : `b-${PLAYER_BUILDINGS[i % PLAYER_BUILDINGS.length]}-${i}`,
    definitionId: i === 0 ? "hab" : PLAYER_BUILDINGS[i % PLAYER_BUILDINGS.length],
    position: { x: 1.8 * i - 27.3, y: 1.2, z: -5.196152422706631 + i * 0.4 },
    condition: 100 - (i % 7),
    level: 1 + (i % 3),
    disabled: i % 13 === 0,
  }));
  const occupied = Object.fromEntries(placed.map((b, i) => [`${i - 15},${(i * 3) % 7}`, b.id]));
  const analyticsSnapshots = Array.from({ length: 200 }, (_, i) => ({
    tick: i * 100,
    sol: Math.floor((i * 100) / 60),
    resources: { energy: 150 + i, water: 120.5, o2: 100 - i * 0.1, minerals: 5 + i, biomass: 100 },
    terraforming: { o2: 6172.8 * i, temp: -59.5 + i * 0.05, waterLevel: 0.33, progress: 0.6 * i },
    buildingsCount: 30,
    aliensDefeated: i,
  }));
  return {
    mapSeed: 42,
    resources: { o2: 120, power: 80, water: 60, biomass: 10, minerals: 250 },
    capacity: { power: 200, water: 200, biomass: 100, minerals: 500 },
    placed,
    occupied,
    units: Array.from({ length: 12 }, (_, i) => ({
      id: `unit-${i}`,
      definitionId: i % 2 === 0 ? "rover_combat" : "drone_repair",
      position: { x: 26.4 - i, y: 1.2, z: -1.0392304845413272 },
      heading: 0.25 * i,
      currentHealth: 250,
      status: "idle",
    })),
    weather: { type: "dust_storm", intensity: 0.7, remainingTicks: 40, cooldownTicks: 0, trajectories: [] },
    terraforming: 12.5,
    o2Accumulated: 4321.5,
    difficulty: "hard",
    gameMode: "survival",
    sun: 1,
    alienState: { wave: 3, nextWaveTick: 900, units: [{ id: "alien-1", hp: 80, position: { x: 1, y: 0, z: 2 } }] },
    resourceNodes: Array.from({ length: 8 }, (_, i) => ({
      id: `r${i}`, type: "minerals", pos: [i - 4, i], amount: 1000, richness: "high", model: "mineral_pile_01",
    })),
    decorations: Array.from({ length: 64 }, (_, i) => ({
      model: "rock_01", pos: [i % 20, (i % 13) - 6], rot: 0.5, scale: 1,
    })),
    currentMapData: {
      meta: {
        name: "mars_map", description: "", version: "2.0", gridType: "hex-flat-top",
        hexSize: 1.2, hexRadius: 20, players: 2, seed: 42,
      },
      hexes: buildHexes(20),
      buildNodes: [],
      resourceNodes: [],
      spawnPoints: [{ player: 1, pos: [5, 5] }, { player: 2, pos: [-5, -5] }],
      decor: [],
    },
    researchPoints: 17,
    unlockedTechs: ["basic_structures", "advanced_mining"],
    activeQuests: [{ id: "q1", status: "active", progress: 0.5 }],
    tick: 20000,
    sol: 333,
    aliensDefeated: 12,
    analyticsSnapshots,
    isEndless: false,
    population: { total: 24, capacity: 30, professions: { engineer: 8, scientist: 6, farmer: 10 } },
    morale: { value: 72, trend: "stable", factors: [] },
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (server) {
    const s = server;
    server = null;
    await new Promise<void>((resolve, reject) => s.close((err) => (err ? reject(err) : resolve())));
  }
});

describe("POST /api/colony + GET /api/colony/{name} (T4d, T4e)", () => {
  it("accepts the full useGameStore.saveGame payload and returns the same state on GET (round-trip)", async () => {
    const baseUrl = await start();
    const values = mockNewColony(5);
    const state = buildFullSaveState();
    const body = JSON.stringify({ name: "Tharsis One", state });
    // Ponad domyślne 100 kB body-parsera, poniżej ustawionego limitu.
    expect(body.length).toBeGreaterThan(100 * 1024);
    expect(body.length).toBeLessThan(JSON_BODY_LIMIT_BYTES);

    const saveRes = await postRaw(baseUrl, body);

    expect(saveRes.status).toBe(200);
    expect(await saveRes.json()).toEqual({ id: 5, message: "Colony saved successfully" });
    expect(values).toHaveBeenCalledTimes(1);
    const inserted = values.mock.calls[0][0] as { userId: number; name: string; state: string };
    expect(inserted.userId).toBe(7);
    expect(inserted.name).toBe("Tharsis One");

    mockExistingRows([
      { id: 5, userId: 7, name: "Tharsis One", state: inserted.state, updatedAt: null, createdAt: null },
    ]);
    const loadRes = await getColony(baseUrl, "Tharsis One");

    expect(loadRes.status).toBe(200);
    const loaded = (await loadRes.json()) as { id: number; name: string; state: unknown };
    expect(loaded.id).toBe(5);
    expect(loaded.name).toBe("Tharsis One");
    expect(loaded.state).toEqual(state);
  });

  it("accepts an empty state object (backend does not enforce the state shape)", async () => {
    const baseUrl = await start();
    const values = mockNewColony(6);

    const res = await postColony(baseUrl, { name: "Empty", state: {} });

    expect(res.status).toBe(200);
    expect(values).toHaveBeenCalledWith({ userId: 7, name: "Empty", state: "{}" });
  });

  it.each<[string, unknown]>([
    ["an array", [1, 2, 3]],
    ["null", null],
    ["a string", "state"],
    ["a number", 42],
    ["a boolean", true],
  ])("rejects state that is %s with 400", async (_label, state) => {
    const baseUrl = await start();
    mockNewColony(5);

    const res = await postColony(baseUrl, { name: "Tharsis One", state });

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("state");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects a body without name with 400", async () => {
    const baseUrl = await start();
    mockNewColony(5);

    const res = await postColony(baseUrl, { state: buildFullSaveState() });

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("name");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects an unknown top-level field with 400 (throw-on-extras still guards ColonyData)", async () => {
    const baseUrl = await start();
    mockNewColony(5);

    const res = await postColony(baseUrl, { name: "Tharsis One", state: {}, unobtainium: 1 });

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("unobtainium");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects a body over JSON_BODY_LIMIT_BYTES with 413 JSON", async () => {
    const baseUrl = await start();
    mockNewColony(5);

    const res = await postColony(baseUrl, { name: "Tharsis One", state: { padding: "x".repeat(JSON_BODY_LIMIT_BYTES) } });

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Payload Too Large" });
    expect(db.insert).not.toHaveBeenCalled();
  });
});
