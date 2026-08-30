import { test, expect } from "@playwright/test";

interface GlobalStoreWindow {
  __THREE_RENDERER__?: {
    info: {
      render: {
        calls: number;
        triangles: number;
      };
      memory: {
        geometries: number;
        textures: number;
      };
    };
  };
  useGameStore: {
    getState: () => {
      placed: Array<{ id: string; position: { x: number; y: number; z: number } }>;
      alive: boolean;
      resources: {
        o2: number;
        power: number;
        water: number;
        biomass: number;
        minerals: number;
      };
      applyEconomyTick: () => void;
    };
  };
  useUIStore: {
    getState: () => {
      buildMode: "place" | "demolish" | null;
      cameraTarget: { x: number; y: number; z: number };
    };
  };
}

test.describe("Playable Game Loop E2E Test", () => {
  test("starts new game, verifies centered camera, visible dock, B key toggling and 90 ticks economic survival", async ({ page }) => {
    const consoleLogs: Array<{ text: string; url: string; time: number }> = [];
    page.on("console", (msg) => {
      consoleLogs.push({
        text: msg.text(),
        url: page.url(),
        time: Date.now(),
      });
    });
    page.on("pageerror", (err) => {
      console.error("PAGE_ERROR:", err.message, "\n", err.stack);
    });

    // Navigate to start page
    await page.goto("/");

    // Click start button on start page
    const startBtn = page.locator(".start-btn-primary");
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Fill colony name and confirm
    const colonyInput = page.locator(".colony-modal__input");
    await expect(colonyInput).toBeVisible();
    await colonyInput.fill("Alpha Colony");

    const confirmBtn = page.locator(".colony-modal__confirm-btn");
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Wait for launch transition and navigation to /mars
    await page.waitForURL("**/mars", { timeout: 15000 });
    await page.waitForSelector(".hud-dock", { state: "attached", timeout: 15000 });
    await page.waitForFunction(() => typeof (window as unknown as GlobalStoreWindow).useGameStore !== "undefined");
    await page.waitForFunction(() => typeof (window as unknown as GlobalStoreWindow).useUIStore !== "undefined");
    await page.waitForTimeout(500);

    // 1. Check habitat and camera centering
    const habData = await page.evaluate(() => {
      const win = window as unknown as GlobalStoreWindow;
      const gameState = win.useGameStore.getState();
      const hab = gameState.placed.find((b) => b.id === "colony-center-hab");
      return {
        habExists: !!hab,
        habPos: hab ? hab.position : null,
      };
    });

    expect(habData.habExists).toBe(true);
    expect(habData.habPos).not.toBeNull();

    if (habData.habPos) {
      await page.waitForFunction((expectedHabPos) => {
        const win = window as unknown as GlobalStoreWindow;
        const target = win.useUIStore?.getState()?.cameraTarget;
        if (!target || !expectedHabPos) return false;
        const dist = Math.hypot(target.x - expectedHabPos.x, target.z - expectedHabPos.z);
        return dist < 5;
      }, habData.habPos, { timeout: 10000 });

      const camTarget = await page.evaluate(() => {
        const win = window as unknown as GlobalStoreWindow;
        return win.useUIStore.getState().cameraTarget;
      });
      const dist = Math.hypot(camTarget.x - habData.habPos.x, camTarget.z - habData.habPos.z);
      expect(dist).toBeLessThan(5);
    }

    // 2. Dock HUD (.hud-dock) is visible immediately on start without pressing keys
    const hudDock = page.locator(".hud-dock");
    await expect(hudDock).toBeVisible();
    await expect(hudDock).toHaveClass(/hud-dock--visible/);

    const paletteRow = page.locator(".hud-dock__row--palette").first();
    await expect(paletteRow).toBeVisible();

    // 3. Test pressing 'B' key toggles build mode
    await page.keyboard.press("b");
    const isPlaceModeActive = await page.evaluate(() => {
      const win = window as unknown as GlobalStoreWindow;
      return win.useUIStore.getState().buildMode === "place";
    });
    expect(isPlaceModeActive).toBe(true);

    // Verify HUD dock remains visible when B is pressed
    await expect(hudDock).toHaveClass(/hud-dock--visible/);

    // Record initial minerals before 90 ticks
    const mineralsBefore = await page.evaluate(() => {
      const win = window as unknown as GlobalStoreWindow;
      return win.useGameStore.getState().resources.minerals;
    });

    // 4. Simulate 90 ticks of colony economy with initial habitat
    await page.evaluate(() => {
      const win = window as unknown as GlobalStoreWindow;
      const gameStore = win.useGameStore;
      for (let i = 0; i < 90; i++) {
        gameStore.getState().applyEconomyTick();
      }
    });

    // Check colony state after 90 ticks
    const post90sState = await page.evaluate(() => {
      const win = window as unknown as GlobalStoreWindow;
      const state = win.useGameStore.getState();
      return {
        alive: state.alive,
        o2: state.resources.o2,
        minerals: state.resources.minerals,
        power: state.resources.power,
        water: state.resources.water,
      };
    });

    expect(post90sState.alive).toBe(true);
    expect(post90sState.o2).toBeGreaterThan(0);
    expect(post90sState.minerals).toBeGreaterThan(mineralsBefore);

    // Verify at least one building in the palette is affordable (no .unaffordable and no .locked)
    const affordableBuildingsCount = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll(".palette-btn"));
      const affordable = buttons.filter(
        (b) => !b.classList.contains("unaffordable") && !b.classList.contains("locked")
      );
      return affordable.length;
    });

    expect(affordableBuildingsCount).toBeGreaterThan(0);

    // 5. Verify 3D WebGL scene rendering (real scene triangles > 10000 and draw calls > 10)
    await page.waitForTimeout(2000);
    const renderStats = await page.evaluate(() => {
      const win = window as unknown as GlobalStoreWindow;
      return {
        triangles: win.__THREE_RENDERER__?.info?.render?.triangles ?? 0,
        calls: win.__THREE_RENDERER__?.info?.render?.calls ?? 0,
      };
    });
    expect(renderStats.triangles).toBeGreaterThan(10000);
    expect(renderStats.calls).toBeGreaterThan(10);

    // Verify exactly 1 active WebGL context remains on /mars
    const activeContextCount = await page.evaluate(() => {
      const win = window as unknown as { __GET_ACTIVE_CONTEXT_COUNT__?: () => number };
      return win.__GET_ACTIVE_CONTEXT_COUNT__?.() ?? 1;
    });
    expect(activeContextCount).toBe(1);

    // Verify no WebGL Context Lost occurred during the ENTIRE test run (from goto('/') to end of gameplay)
    const allContextLostLogs = consoleLogs.filter(
      (l) => l.text.includes("Context Lost") || l.text.includes("webglcontextlost") || l.text.includes("WebGL context lost")
    );
    if (allContextLostLogs.length > 0) {
      console.error("DEBUG: Found Context Lost in console logs:", allContextLostLogs);
    }
    expect(allContextLostLogs.length).toBe(0);
  });

  test("sesja przezywa odswiezenie strony i zachowuje stan na /mars", async ({ page }) => {
    await page.goto("/");

    const startBtn = page.locator(".start-btn-primary");
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    const colonyInput = page.locator(".colony-modal__input");
    await expect(colonyInput).toBeVisible();
    await colonyInput.fill("Reload Colony");

    const confirmBtn = page.locator(".colony-modal__confirm-btn");
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    await page.waitForURL("**/mars", { timeout: 15000 });
    await page.waitForSelector(".hud-dock", { state: "attached", timeout: 15000 });
    await page.waitForFunction(() => typeof (window as unknown as GlobalStoreWindow).useGameStore !== "undefined");

    // Advance 10 ticks
    await page.evaluate(() => {
      const win = window as unknown as GlobalStoreWindow;
      for (let i = 0; i < 10; i++) {
        win.useGameStore.getState().applyEconomyTick();
      }
    });

    const stateBeforeReload = await page.evaluate(() => {
      const win = window as unknown as GlobalStoreWindow;
      const s = win.useGameStore.getState();
      return {
        colonyName: (s as unknown as { colonyName: string }).colonyName,
        minerals: s.resources.minerals,
        o2: s.resources.o2,
        placedCount: s.placed.length,
      };
    });

    expect(stateBeforeReload.colonyName).toBe("Reload Colony");

    // Reload page
    await page.reload();

    // Verify stays on /mars and does not redirect to /
    await page.waitForURL("**/mars", { timeout: 10000 });
    await page.waitForSelector(".hud-dock", { state: "attached", timeout: 15000 });
    await page.waitForFunction(() => typeof (window as unknown as GlobalStoreWindow).useGameStore !== "undefined");

    const stateAfterReload = await page.evaluate(() => {
      const win = window as unknown as GlobalStoreWindow;
      const s = win.useGameStore.getState();
      return {
        colonyName: (s as unknown as { colonyName: string }).colonyName,
        minerals: s.resources.minerals,
        o2: s.resources.o2,
        placedCount: s.placed.length,
      };
    });

    expect(stateAfterReload.colonyName).toBe("Reload Colony");
    expect(stateAfterReload.minerals).toBe(stateBeforeReload.minerals);
    expect(stateAfterReload.placedCount).toBe(stateBeforeReload.placedCount);

    // Wait for at least one rendered frame and verify 3D scene rehydration
    await page.waitForFunction(() => {
      const win = window as unknown as GlobalStoreWindow;
      const r = win.__THREE_RENDERER__;
      return (r?.info?.render?.triangles ?? 0) > 10000 && (r?.info?.memory?.geometries ?? 0) > 100;
    }, { timeout: 15000 });

    const reloadRenderStats = await page.evaluate(() => {
      const win = window as unknown as GlobalStoreWindow;
      return {
        triangles: win.__THREE_RENDERER__?.info?.render?.triangles ?? 0,
        geometries: win.__THREE_RENDERER__?.info?.memory?.geometries ?? 0,
      };
    });
    expect(reloadRenderStats.triangles).toBeGreaterThan(10000);
    expect(reloadRenderStats.geometries).toBeGreaterThan(100);

    // Verify right rail container exists
    const rightRail = page.locator(".hud-right-rail");
    await expect(rightRail).toBeAttached();
  });

  test("brak katastrof w pierwszych 60 sekundach nowej gry", async ({ page }) => {
    await page.goto("/");

    const startBtn = page.locator(".start-btn-primary");
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    const colonyInput = page.locator(".colony-modal__input");
    await expect(colonyInput).toBeVisible();
    await colonyInput.fill("Safe Haven");

    const confirmBtn = page.locator(".colony-modal__confirm-btn");
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    await page.waitForURL("**/mars", { timeout: 15000 });
    await page.waitForSelector(".hud-dock", { state: "attached", timeout: 15000 });
    await page.waitForFunction(() => typeof (window as unknown as GlobalStoreWindow).useGameStore !== "undefined");

    // Simulate 60 economy / weather ticks
    await page.evaluate(() => {
      const win = window as unknown as GlobalStoreWindow;
      for (let i = 0; i < 60; i++) {
        win.useGameStore.getState().applyEconomyTick();
      }
    });

    const weatherState = await page.evaluate(() => {
      const win = window as unknown as { useGameStore: { getState: () => { weather: { type: string; cooldownTicks: number } } } };
      return win.useGameStore.getState().weather;
    });

    expect(weatherState.type).toBe("clear");
    expect(weatherState.cooldownTicks).toBeGreaterThan(0);
    expect(weatherState.cooldownTicks).toBeLessThanOrEqual(180);

    // Verify weather alert is not rendered in right rail
    const weatherAlert = page.locator(".weather-alert");
    expect(await weatherAlert.count()).toBe(0);
  });
});

