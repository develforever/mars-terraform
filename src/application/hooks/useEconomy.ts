import { useCallback, useEffect, useRef } from "react";
import { useGameStore } from "../store/useGameStore";
import { useUIStore } from "../store/useUIStore";
import { LocalSaveService } from "../service/localSaveService";

const BASE_TICK_INTERVAL = 1000; // 1 second at 1x speed
const AUTOSAVE_INTERVAL_MS = 30000; // 30 seconds

export function useEconomy() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  const gameSpeed = useGameStore((state) => state.gameSpeed);
  const isPaused = useGameStore((state) => state.isPaused);

  const applyVisibilityState = useCallback(() => {
    if (typeof document === "undefined") return;

    const state = useGameStore.getState();
    if (document.visibilityState === "hidden") {
      if (state.alive && !state.won && state.colonyName && !state.isDevFixture) {
        LocalSaveService.saveLocal(state);
      }
      if (!state.isPaused) {
        useUIStore.getState().setIsAutoPaused(true);
      }
    } else if (document.visibilityState === "visible") {
      const { isAutoPaused, setIsAutoPaused, setAutoPauseToast } = useUIStore.getState();
      if (isAutoPaused) {
        setIsAutoPaused(false);
        setAutoPauseToast(true);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
          setAutoPauseToast(false);
        }, 3000);
      }
    }
  }, []);

  const scheduleNext = useCallback(() => {
    if (!runningRef.current) return;

    const { alive, isPaused: paused, gameSpeed: speed, applyEconomyTick } = useGameStore.getState();
    const isAutoPaused = useUIStore.getState().isAutoPaused;

    if (!alive) {
      runningRef.current = false;
      return;
    }

    if (!paused && !isAutoPaused) {
      applyEconomyTick();
    }

    const interval = BASE_TICK_INTERVAL / speed;
    timerRef.current = setTimeout(scheduleNext, interval);
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;

    applyVisibilityState();

    const { gameSpeed: speed } = useGameStore.getState();
    const interval = BASE_TICK_INTERVAL / speed;
    timerRef.current = setTimeout(scheduleNext, interval);
  }, [applyVisibilityState, scheduleNext]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // When gameSpeed or isPaused changes while running, adjust interval immediately
  useEffect(() => {
    if (runningRef.current) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      const interval = BASE_TICK_INTERVAL / gameSpeed;
      timerRef.current = setTimeout(scheduleNext, interval);
    }
  }, [gameSpeed, isPaused, scheduleNext]);

  // Periodic autosave every 30s
  useEffect(() => {
    autosaveTimerRef.current = setInterval(() => {
      const state = useGameStore.getState();
      if (state.alive && !state.won && state.colonyName && !state.isDevFixture) {
        LocalSaveService.saveLocal(state);
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearInterval(autosaveTimerRef.current);
      }
    };
  }, []);

  // Window lifecycle: beforeunload, visibilitychange, and initial visibility check
  useEffect(() => {
    const handleBeforeUnload = () => {
      const state = useGameStore.getState();
      if (state.alive && !state.won && state.colonyName && !state.isDevFixture) {
        LocalSaveService.saveLocal(state);
      }
    };

    // Apply visibility state immediately on mount (handles background tabs on initial load)
    applyVisibilityState();

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", applyVisibilityState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", applyVisibilityState);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [applyVisibilityState]);

  return { start, stop };
}
