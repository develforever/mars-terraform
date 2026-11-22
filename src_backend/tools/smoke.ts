import { runSmokeTest, SMOKE_STEP_COUNT } from "./smokeGameServer";

/**
 * `npm run smoke -- <adres>`: sprawdza serwer gry pod adresem, który dostaną gracze (LAN albo tunel). F9-T7.
 * Przykład: `npm run smoke -- https://losowe-slowa.trycloudflare.com`
 */
const address = process.argv[2] ?? "http://localhost:3000";

try {
  new URL(address);
} catch {
  console.error(`Nieprawidłowy adres: ${address}`);
  process.exit(2);
}

console.log(`Smoke test serwera gry: ${address}`);
const steps = await runSmokeTest(address);
for (const { name, ok, detail } of steps) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` - ${detail}` : ""}`);
}
const passed = steps.length === SMOKE_STEP_COUNT && steps.every((s) => s.ok);
console.log(passed ? "Wynik: OK - gracze mogą się łączyć pod tym adresem." : "Wynik: BŁĄD - zobacz HOSTING.md, sekcja 7.");
process.exit(passed ? 0 : 1);
