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

import { createApp } from "../app";
import { db } from "../data-source";

/**
 * T4d: zapis kolonii (POST /api/colony) przez prawdziwe trasy TSOA (`routes.ts`).
 * `tsoa.json` ma `noImplicitAdditionalProperties: "throw-on-extras"`, więc każdy rozjazd
 * między `model/types.ts` a wygenerowanym `routes.ts` (np. brak `minerals`) daje 400.
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

const postColony = (baseUrl: string, body: unknown): Promise<Response> =>
  fetch(`${baseUrl}/api/colony`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer()}` },
    body: JSON.stringify(body),
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

/** Pola `state` objęte `SavedGameState` (model/types.ts), z `minerals` jak w `Resources`/`ResourceCapacity` frontendu. */
const typedState = {
  resources: { o2: 120, power: 80, water: 60, biomass: 10, minerals: 250 },
  capacity: { power: 200, water: 200, biomass: 100, minerals: 500 },
  placed: [
    { id: "colony-center-hab", definitionId: "hab", position: { x: 1.8, y: 1.2, z: -3.1 }, condition: 100 },
  ],
  occupied: { "2,-3": "colony-center-hab" },
  weather: { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: 120 },
  terraforming: 0,
  o2Accumulated: 0,
  difficulty: "normal",
  gameMode: "exploration",
};

/**
 * Pełne ciało żądania z `useGameStore.saveGame` (src/application/store/useGameStore.ts):
 * frontend wysyła też pola spoza `SavedGameState` oraz opcjonalne pola zagnieżdżone
 * (`PlacedBuilding.level`, `WeatherState.trajectories`).
 */
const frontendState = {
  ...typedState,
  placed: [{ ...typedState.placed[0], level: 1 }],
  weather: { ...typedState.weather, trajectories: [] },
  mapSeed: 42,
  units: [],
  sun: 1,
  alienState: { wave: 0 },
  resourceNodes: [],
  decorations: [],
  currentMapData: null,
  researchPoints: 0,
  unlockedTechs: [],
  activeQuests: [],
  tick: 0,
  sol: 1,
  aliensDefeated: 0,
  analyticsSnapshots: [],
  isEndless: false,
  population: { total: 4, capacity: 4 },
  morale: 100,
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

describe("POST /api/colony (T4d)", () => {
  it("accepts resources/capacity with minerals (routes.ts in sync with model/types.ts)", async () => {
    const baseUrl = await start();
    const values = mockNewColony(5);

    const res = await postColony(baseUrl, { name: "Tharsis One", state: typedState });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 5, message: "Colony saved successfully" });
    expect(values).toHaveBeenCalledWith({
      userId: 7,
      name: "Tharsis One",
      state: JSON.stringify(typedState),
    });
  });

  it("rejects an unknown field with 400 and names it in fields (throw-on-extras)", async () => {
    const baseUrl = await start();
    mockNewColony(5);

    const res = await postColony(baseUrl, {
      name: "Tharsis One",
      state: { ...typedState, resources: { ...typedState.resources, unobtainium: 1 } },
    });

    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("unobtainium");
    expect(db.insert).not.toHaveBeenCalled();
  });

  /**
   * ZNANA LUKA (poza zakresem T4d): `saveGame` wysyła pola spoza `SavedGameState`
   * (`mapSeed`, `units`, `sun`, `alienState`, ..., `PlacedBuilding.level`, `WeatherState.trajectories`),
   * a `throw-on-extras` odrzuca je z 400, nawet po regeneracji tras. Naprawa wymaga zmiany
   * `model/types.ts` albo payloadu frontendu. `it.fails`: gdy zapis zacznie działać, ten test
   * zacznie padać, co wymusi zamianę go na zwykły test regresji.
   */
  it.fails("accepts the full useGameStore.saveGame payload (known gap: extra fields → 400)", async () => {
    const baseUrl = await start();
    mockNewColony(5);

    const res = await postColony(baseUrl, { name: "Tharsis One", state: frontendState });

    expect(res.status).toBe(200);
  });
});
