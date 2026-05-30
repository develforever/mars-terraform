import { config } from "../config";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openrouter/free";

const LOCAL_PREFIXES = [
  "Nova", "Terra", "Ares", "Proxima", "Ultima", "Aurora", "Helios",
  "Olympus", "Valles", "Elysium", "Arcadia", "Chryse", "Cydonia",
  "Syrtis", "Amazonis", "Argyre", "Isidis", "Acidalia",
];
const LOCAL_ROOTS = [
  "Vigilis", "Fortis", "Caelum", "Ferrum", "Nexus", "Solaris",
  "Rubrum", "Petra", "Venti", "Aether", "Pax", "Lux",
  "Apex", "Crux", "Axis", "Vega", "Sigma", "Delta",
];
const LOCAL_SUFFIXES = [
  "Station", "Base", "Outpost", "Frontier", "Nexus", "Keep",
  "Prime", "Colony", "Post", "Hub", "Reach", "Point",
  "Dome", "Citadel", "Enclave", "Bastion", "Horizon",
];
const LOCAL_ADJ = [
  "Crimson", "Iron", "Scarlet", "Dusty", "Red", "Rustic",
  "Barren", "Eternal", "Silent", "Frozen", "Golden", "Ancient",
];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generateLocalNames = (count: number): string[] => {
  const names = new Set<string>();
  let attempts = 0;
  while (names.size < count && attempts < count * 10) {
    const r = Math.random();
    if (r < 0.4) names.add(`${pick(LOCAL_PREFIXES)} ${pick(LOCAL_ROOTS)} ${pick(LOCAL_SUFFIXES)}`);
    else if (r < 0.6) names.add(`${pick(LOCAL_ADJ)} ${pick(LOCAL_ROOTS)}`);
    else if (r < 0.8) names.add(`${pick(LOCAL_PREFIXES)} ${pick(LOCAL_SUFFIXES)}`);
    else names.add(`${pick(LOCAL_ROOTS)}-${Math.floor(Math.random() * 900) + 100}`);
    attempts++;
  }
  return Array.from(names);
};

export class ColonyNameService {
  static async generateNames(count: number = 5): Promise<string[]> {
    if (!config.openRouterApiKey) {
      return generateLocalNames(count);
    }

    const prompt = `Generate exactly ${count} unique, creative names for a Mars colony. 
The names should feel like real mission or settlement designations — a mix of Latin roots, mythological references, and NASA-style codes.
Format: return ONLY a JSON array of strings, no explanation. Example: ["Nova Ares Station","Iron Vigilis Base","Crimson Frontier","Helios-342","Proxima Caelum Keep"]`;

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://mars-terraform.app",
          "X-Title": "Mars Terraform",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 1.1,
          max_tokens: 200,
        }),
      });

      const textResponse = await response.text();

      if (!response.ok) {
        return generateLocalNames(count);
      }

      const data = JSON.parse(textResponse) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content ?? "";

      const match = content.match(/\[[\s\S]*?\]/);
      if (!match) return generateLocalNames(count);

      const parsed: unknown = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) return generateLocalNames(count);

      const names = (parsed as unknown[])
        .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
        .slice(0, count);

      return names.length >= count ? names : [...names, ...generateLocalNames(count - names.length)];
    } catch {
      return generateLocalNames(count);
    }
  }
}
