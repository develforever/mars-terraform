import { useCallback, useRef } from "react";
import { useGameStore } from "../store/useGameStore";

const TICK_INTERVAL = 1000; // 1 second

export function useEconomy() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;

    const schedule = () => {
      if (!runningRef.current) return;
      const { alive, applyEconomyTick } = useGameStore.getState();
      if (!alive) return;
      applyEconomyTick();
      timerRef.current = setTimeout(schedule, TICK_INTERVAL);
    };

    timerRef.current = setTimeout(schedule, TICK_INTERVAL);
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { start, stop };
}
