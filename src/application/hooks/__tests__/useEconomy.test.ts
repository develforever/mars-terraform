import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEconomy } from "../useEconomy";
import { useGameStore } from "../../store/useGameStore";
import { useUIStore } from "../../store/useUIStore";
import { LocalSaveService } from "../../service/localSaveService";

describe("useEconomy - Background Auto-Pause Lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.getState().resetGame();
    useUIStore.getState().resetUI();
    useGameStore.getState().startNewGame("Test Colony", "normal", "exploration");
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("petla ekonomii wystartowana przy visibilityState === hidden nie wykonuje ani jednego tiku dopoki karta nie stanie sie widoczna", () => {
    // 1. Mock document.visibilityState as "hidden" from the very beginning
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });

    const applyEconomyTickSpy = vi.spyOn(useGameStore.getState(), "applyEconomyTick");
    const { result } = renderHook(() => useEconomy());

    // 2. Start economy loop while hidden
    act(() => {
      result.current.start();
    });

    expect(useUIStore.getState().isAutoPaused).toBe(true);

    // Advance 5 seconds (5 ticks)
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Verify 0 economy ticks executed while in background
    expect(applyEconomyTickSpy).not.toHaveBeenCalled();

    // 3. Switch document.visibilityState to "visible"
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(useUIStore.getState().isAutoPaused).toBe(false);
    expect(useUIStore.getState().autoPauseToast).toBe(true);

    // Advance 3 seconds (3 ticks)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(applyEconomyTickSpy).toHaveBeenCalled();
    expect(useUIStore.getState().autoPauseToast).toBe(false);

    act(() => {
      result.current.stop();
    });
  });

  it("przejscie karty w tlo w trakcie dzialania gry pauzuje petle i zapisuje stan", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });

    const saveLocalSpy = vi.spyOn(LocalSaveService, "saveLocal");
    const { result } = renderHook(() => useEconomy());

    act(() => {
      result.current.start();
    });

    expect(useUIStore.getState().isAutoPaused).toBe(false);

    // Switch to hidden
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(useUIStore.getState().isAutoPaused).toBe(true);
    expect(saveLocalSpy).toHaveBeenCalled();

    act(() => {
      result.current.stop();
    });
  });
});

