import { test, expect } from "@playwright/test";

test.describe("Dev State Fixtures E2E", () => {
  test("1. URL z fixture wchodzi prosto do gry bez klikania (mid-game)", async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      consoleLogs.push(msg.text());
    });

    // 1. Direct navigation to /mars?fixture=mid-game
    await page.goto("/mars?fixture=mid-game");

    // 2. Verify URL stays on /mars
    await expect(page).toHaveURL(/.*\/mars\?fixture=mid-game/);

    // 3. Verify HUD dock is visible
    const hudDock = page.locator(".hud-dock");
    await expect(hudDock).toBeVisible({ timeout: 15000 });

    // Wait for at least one rendered frame
    await page.waitForFunction(() => {
      const r = (window as unknown as { __THREE_RENDERER__?: { info?: { render?: { triangles: number } } } }).__THREE_RENDERER__;
      return (r?.info?.render?.triangles ?? 0) > 0;
    }, { timeout: 10000 });

    // 4. Verify game state via window.useGameStore
    const gameState = await page.evaluate(() => {
      const s = (window as unknown as { useGameStore?: { getState: () => { placed: unknown[]; isDevFixture: boolean; colonyName: string } } }).useGameStore?.getState();
      const renderer = (window as unknown as { __THREE_RENDERER__?: { info?: { render?: { triangles: number; calls: number } } } }).__THREE_RENDERER__;
      return {
        placedLength: s?.placed?.length ?? 0,
        isDevFixture: s?.isDevFixture ?? false,
        colonyName: s?.colonyName ?? "",
        triangles: renderer?.info?.render?.triangles ?? 0,
        calls: renderer?.info?.render?.calls ?? 0,
      };
    });

    expect(gameState.colonyName).toContain("Środek gry");
    expect(gameState.placedLength).toBeGreaterThanOrEqual(10);
    expect(gameState.isDevFixture).toBe(true);
    expect(gameState.triangles).toBeGreaterThan(10000);

    // 5. Verify zero Context Lost
    const contextLost = consoleLogs.some((l) => l.includes("Context Lost"));
    expect(contextLost).toBe(false);
  });

  test("2. Nieznany fixture pokazuje czytelny komunikat i nie przekierowuje na /", async ({ page }) => {
    await page.goto("/mars?fixture=nie-ma-takiego");

    // URL remains on /mars?fixture=nie-ma-takiego
    await expect(page).toHaveURL(/.*\/mars\?fixture=nie-ma-takiego/);

    // Error container is rendered
    const errorCard = page.locator("[data-testid=\"fixture-error-screen\"]");
    await expect(errorCard).toBeVisible({ timeout: 10000 });
    await expect(errorCard).toContainText("Nieznany fixture stanu gry");
    await expect(errorCard).toContainText("nie-ma-takiego");
    await expect(errorCard).toContainText("mid-game");
    await expect(errorCard).toContainText("combat");
  });

  test("3. Fixture nie nadpisuje autozapisu gracza", async ({ page }) => {
    // 1. Seed player autosave in localStorage
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.setItem("mars-terraform:autosave:v1", JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        colonyName: "Player Original Colony",
        mapSeed: 42,
        difficulty: "normal",
        gameMode: "exploration",
        resources: { o2: 6, power: 8, water: 6, biomass: 3, minerals: 60 },
        capacity: { power: 20, water: 20, biomass: 20, minerals: 200 },
        placed: [{ id: "colony-center-hab", definitionId: "hab", position: { x: 0, y: 0, z: 0 }, level: 1, condition: 100 }],
        occupied: { "0,0": "colony-center-hab" },
        units: [],
        weather: { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: 180 },
        terraforming: 0,
        o2Accumulated: 0,
        sun: 1,
        alienState: { wave: 0, timeUntilNextWave: 60, ships: [], groundUnits: [], hiveMinds: [] },
        researchPoints: 0,
        unlockedTechs: ["basic_structures"],
        activeQuests: [],
        tick: 1,
        sol: 1,
        aliensDefeated: 0,
        isEndless: false,
      }));
    });

    // Verify Continue button exists on Start page
    await page.reload();
    const continueBtnBefore = page.locator(".start-btn-continue");
    await expect(continueBtnBefore).toBeVisible({ timeout: 5000 });
    await expect(continueBtnBefore).toContainText("Player Original Colony");

    // 2. Navigate to dev fixture URL
    await page.goto("/mars?fixture=combat");
    const hudDock = page.locator(".hud-dock");
    await expect(hudDock).toBeVisible({ timeout: 15000 });

    // Verify fixture is active and isDevFixture is true
    const fixtureState = await page.evaluate(() => {
      const s = (window as unknown as { useGameStore?: { getState: () => { colonyName: string; isDevFixture: boolean } } }).useGameStore?.getState();
      return {
        colonyName: s?.colonyName,
        isDevFixture: s?.isDevFixture,
      };
    });
    expect(fixtureState.colonyName).toContain("Walka");
    expect(fixtureState.isDevFixture).toBe(true);

    // 3. Return to main start view
    await page.goto("/");

    // 4. Verify Continue button STILL points to the player original colony, NOT the fixture
    const continueBtnAfter = page.locator(".start-btn-continue");
    await expect(continueBtnAfter).toBeVisible({ timeout: 5000 });
    await expect(continueBtnAfter).toContainText("Player Original Colony");

    // Verify localStorage content is untouched
    const storedSave = await page.evaluate(() => {
      return JSON.parse(window.localStorage.getItem("mars-terraform:autosave:v1") || "{}") as { colonyName?: string };
    });
    expect(storedSave.colonyName).toBe("Player Original Colony");
  });

  test("4. window.__loadFixture i window.__listFixtures dzialaja w konsoli bez przeladowania strony", async ({ page }) => {
    await page.goto("/mars?fixture=fresh");
    const hudDock = page.locator(".hud-dock");
    await expect(hudDock).toBeVisible({ timeout: 15000 });

    const result = await page.evaluate(() => {
      const win = window as unknown as {
        __listFixtures?: () => { id: string; label: string }[];
        __loadFixture?: (id: string) => boolean;
        useGameStore?: { getState: () => { placed: unknown[]; colonyName: string } };
      };

      const list = win.__listFixtures ? win.__listFixtures() : [];
      const loaded = win.__loadFixture ? win.__loadFixture("combat") : false;
      const afterState = win.useGameStore?.getState();

      return {
        listCount: list.length,
        loadedSuccess: loaded,
        placedCount: afterState?.placed?.length ?? 0,
        colonyName: afterState?.colonyName ?? "",
      };
    });

    expect(result.listCount).toBe(7);
    expect(result.loadedSuccess).toBe(true);
    expect(result.colonyName).toContain("Walka");
    expect(result.placedCount).toBeGreaterThanOrEqual(8);
  });

  test("5. Sekwencja 10 kolejnych wejsc przez pasek adresu (wszystkie 7 fixture'ow) w tej samej karcie", async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      consoleLogs.push(msg.text());
    });

    const fixturesToTest = [
      "mid-game",
      "combat",
      "crisis",
      "late-game",
      "perf-stress",
      "fresh",
      "early-eco",
      "mid-game",
      "combat",
      "crisis",
    ];

    for (const fixtureId of fixturesToTest) {
      await page.goto(`/mars?fixture=${fixtureId}`);
      await expect(page.locator(".hud-dock")).toBeVisible({ timeout: 15000 });

      await page.waitForFunction(() => {
        const r = (window as unknown as { __THREE_RENDERER__?: { info?: { render?: { triangles: number } } } }).__THREE_RENDERER__;
        return (r?.info?.render?.triangles ?? 0) > 10000;
      }, { timeout: 15000 });

      const stats = await page.evaluate(() => {
        const r = (window as unknown as { __THREE_RENDERER__?: { info?: { render?: { triangles: number; calls: number }; memory?: { geometries: number } } } }).__THREE_RENDERER__;
        const s = (window as unknown as { useGameStore?: { getState: () => { colonyName: string; isDevFixture: boolean } } }).useGameStore?.getState();
        return {
          colonyName: s?.colonyName,
          isDevFixture: s?.isDevFixture,
          triangles: r?.info?.render?.triangles ?? 0,
          calls: r?.info?.render?.calls ?? 0,
          geometries: r?.info?.memory?.geometries ?? 0,
        };
      });

      expect(stats.isDevFixture).toBe(true);
      expect(stats.triangles).toBeGreaterThan(10000);
      expect(stats.geometries).toBeGreaterThan(0);
    }

    const contextLost = consoleLogs.some((l) => l.includes("Context Lost"));
    expect(contextLost).toBe(false);
  });
});

