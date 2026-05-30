export type GameMode = "adventure" | "exploration" | "survival";

export interface GameModeConfig {
  label: string;
  description: string;
  icon: string;
  hazardsEnabled: boolean;
  conditionDamageMultiplier: number;
  sandstormChanceMultiplier: number;
  meteorChanceMultiplier: number;
  hasWinCondition: boolean;
  alienInvasion: boolean;
}

export const GAME_MODE_CONFIGS: Record<GameMode, GameModeConfig> = {
  adventure: {
    label: "Przygoda",
    description: "Tryb piaskownicy. Buduj bez presji — brak katastrof i celu.",
    icon: "🏕️",
    hazardsEnabled: false,
    conditionDamageMultiplier: 0,
    sandstormChanceMultiplier: 0,
    meteorChanceMultiplier: 0,
    hasWinCondition: false,
    alienInvasion: false,
  },
  exploration: {
    label: "Eksploracja",
    description: "Realistyczne warunki. Terraformuj Marsa i przeżyj burze.",
    icon: "🔭",
    hazardsEnabled: true,
    conditionDamageMultiplier: 1.0,
    sandstormChanceMultiplier: 1.0,
    meteorChanceMultiplier: 1.0,
    hasWinCondition: true,
    alienInvasion: false,
  },
  survival: {
    label: "Przetrwanie",
    description: "Ekstremalne warunki + inwazja obcych. Tylko dla wytrwałych.",
    icon: "👽",
    hazardsEnabled: true,
    conditionDamageMultiplier: 1.5,
    sandstormChanceMultiplier: 2.0,
    meteorChanceMultiplier: 1.5,
    hasWinCondition: true,
    alienInvasion: true,
  },
};
