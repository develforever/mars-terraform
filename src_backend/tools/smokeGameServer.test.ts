import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { attachGameServer, type GameServer } from "../game/gameServer";
import { runSmokeTest, SMOKE_STEP_COUNT } from "./smokeGameServer";

describe("smoke test serwera gry (F9-T7)", () => {
  let server: Server;
  let game: GameServer | null;
  let distPath: string;

  const start = async (withGame: boolean): Promise<string> => {
    distPath = mkdtempSync(path.join(tmpdir(), "mars-smoke-"));
    writeFileSync(path.join(distPath, "index.html"), "<!doctype html>");
    const app = createApp({ corsOrigins: [], distPath, serveFrontend: true, version: "1.2.3", isProduction: true });
    server = createServer(app);
    game = withGame ? attachGameServer(server, { allowedOrigins: [], tickIntervalMs: 30 }) : null;
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    await game?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(distPath, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("przechodzi wszystkie kroki na działającym serwerze gry", async () => {
    const steps = await runSmokeTest(await start(true), { timeoutMs: 3000 });
    expect(steps.map((s) => [s.name, s.ok])).toEqual([
      ["strona gry i nagłówki", true],
      ["/api/health", true],
      ["gospodarz tworzy pokój", true],
      ["gość dołącza po kodzie", true],
      ["komenda gościa dociera do gospodarza", true],
      ["tick serwera", true],
    ]);
    expect(steps).toHaveLength(SMOKE_STEP_COUNT);
    expect(steps[1].detail).toBe("wersja 1.2.3");
  });

  it("zgłasza błąd, gdy serwer nie obsługuje gry sieciowej (brak /ws)", async () => {
    const steps = await runSmokeTest(await start(false), { timeoutMs: 1000 });
    const room = steps.find((s) => s.name === "gospodarz tworzy pokój");
    expect(room?.ok).toBe(false);
    expect(steps.length).toBeLessThan(SMOKE_STEP_COUNT);
  });

  it("zatrzymuje się, gdy pod adresem nie ma serwera gry", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 502 })) as unknown as typeof fetch;
    const steps = await runSmokeTest("http://127.0.0.1:9", { fetchFn, timeoutMs: 500 });
    expect(steps.map((s) => s.ok)).toEqual([false, false]);
    expect(steps[0].detail).toBe("HTTP 502");
  });
});
