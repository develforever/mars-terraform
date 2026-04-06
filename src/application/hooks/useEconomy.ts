import { useEffect, useRef } from "react";
import { useGameStore } from "../store/useGameStore";

const TICK_INTERVAL = 1000; // 1 second

export function useEconomy() {
  const applyEconomyTick = useGameStore((s) => s.applyEconomyTick);
  const alive = useGameStore((s) => s.alive);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  const tick = () => {
    if (!alive || !runningRef.current) return;
    applyEconomyTick();
    timerRef.current = setTimeout(tick, TICK_INTERVAL);
  };

  const start = () => {
    if (runningRef.current) return;
    runningRef.current = true;
    timerRef.current = setTimeout(tick, TICK_INTERVAL);
  };

  const stop = () => {
    runningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    start();
    return () => stop();
  }, [alive]);

  return { start, stop };
}
