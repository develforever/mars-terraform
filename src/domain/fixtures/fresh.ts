import type { StateFixture } from "./types";

export const freshFixture: StateFixture = {
  id: "fresh",
  label: "Nowa gra",
  description: "Odpowiednik startNewGame, seed 42",
  seed: 42,
  difficulty: "normal",
  gameMode: "exploration",
  apply: (store, options) => {
    const seed = options?.seed ?? 42;
    store.getState().startNewGame("DEV: Nowa gra", "normal", "exploration", null, seed);
    if (options?.speed) store.setState({ gameSpeed: options.speed });
    if (options?.paused !== undefined) store.setState({ isPaused: options.paused });
  },
};

