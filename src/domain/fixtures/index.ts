import type { StateFixture } from "./types";
import { freshFixture } from "./fresh";
import { earlyEcoFixture } from "./earlyEco";
import { midGameFixture } from "./midGame";
import { lateGameFixture } from "./lateGame";
import { combatFixture } from "./combat";
import { crisisFixture } from "./crisis";
import { perfStressFixture } from "./perfStress";

export * from "./types";
export * from "./fixtureUtils";

export const STATE_FIXTURES: StateFixture[] = [
  freshFixture,
  earlyEcoFixture,
  midGameFixture,
  lateGameFixture,
  combatFixture,
  crisisFixture,
  perfStressFixture,
];

export const FIXTURES_BY_ID: Record<string, StateFixture> = Object.fromEntries(
  STATE_FIXTURES.map((f) => [f.id, f])
);

export function getFixtureById(id: string): StateFixture | undefined {
  return FIXTURES_BY_ID[id];
}

export function listFixtures(): { id: string; label: string; description: string }[] {
  return STATE_FIXTURES.map((f) => ({
    id: f.id,
    label: f.label,
    description: f.description,
  }));
}

