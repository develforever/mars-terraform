const PREFIXES = [
  "Nova", "Terra", "Ares", "Proxima", "Ultima", "Aurora", "Helios",
  "Olympus", "Valles", "Elysium", "Arcadia", "Chryse", "Cydonia",
  "Syrtis", "Amazonis", "Argyre", "Isidis", "Acidalia",
];

const ROOTS = [
  "Vigilis", "Fortis", "Caelum", "Ferrum", "Nexus", "Solaris",
  "Rubrum", "Petra", "Venti", "Aether", "Pax", "Lux",
  "Apex", "Crux", "Axis", "Vega", "Sigma", "Delta",
];

const SUFFIXES = [
  "Station", "Base", "Outpost", "Frontier", "Nexus", "Keep",
  "Prime", "Colony", "Post", "Hub", "Reach", "Point",
  "Dome", "Citadel", "Enclave", "Bastion", "Horizon",
];

const ADJECTIVES = [
  "Crimson", "Iron", "Scarlet", "Dusty", "Red", "Rustic",
  "Barren", "Desolate", "Eternal", "Silent", "Frozen",
  "Golden", "Ancient", "Forgotten", "Distant", "Bold",
];

type NamePattern = "prefix-root-suffix" | "adj-root" | "prefix-suffix" | "root-number";

const PATTERNS: NamePattern[] = [
  "prefix-root-suffix",
  "prefix-root-suffix",
  "adj-root",
  "prefix-suffix",
  "root-number",
];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generateOne = (): string => {
  const pattern = pick(PATTERNS);
  switch (pattern) {
    case "prefix-root-suffix":
      return `${pick(PREFIXES)} ${pick(ROOTS)} ${pick(SUFFIXES)}`;
    case "adj-root":
      return `${pick(ADJECTIVES)} ${pick(ROOTS)}`;
    case "prefix-suffix":
      return `${pick(PREFIXES)} ${pick(SUFFIXES)}`;
    case "root-number": {
      const num = Math.floor(Math.random() * 900) + 100;
      return `${pick(ROOTS)}-${num}`;
    }
  }
};

export const generateLocalNames = (count = 5): string[] => {
  const names = new Set<string>();
  let attempts = 0;
  while (names.size < count && attempts < count * 10) {
    names.add(generateOne());
    attempts++;
  }
  return Array.from(names);
};
