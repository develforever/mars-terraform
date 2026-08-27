import { useCallback, useEffect, useRef } from "react";
import { useGameStore } from "../store/useGameStore";

const BASE_TICK_INTERVAL = 1000; // 1 second at 1x speed

export function useEconomy() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  const gameSpeed = useGameStore((state) => state.gameSpeed);
  const isPaused = useGameStore((state) => state.isPaused);

  const scheduleNext = useCallback(() => {
    if (!runningRef.current) return;

    const { alive, isPaused: paused, gameSpeed: speed, applyEconomyTick } = useGameStore.getState();
    if (!alive) {
      runningRef.current = false;
      return;
    }

    if (!paused) {
      applyEconomyTick();
    }

    const interval = BASE_TICK_INTERVAL / speed;
    timerRef.current = setTimeout(scheduleNext, interval);
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;

    const { gameSpeed: speed } = useGameStore.getState();
    const interval = BASE_TICK_INTERVAL / speed;
    timerRef.current = setTimeout(scheduleNext, interval);
  }, [scheduleNext]);

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

  return { start, stop };
}
