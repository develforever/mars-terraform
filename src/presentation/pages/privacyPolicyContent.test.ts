import { describe, it, expect } from "vitest";
import { getPolicyContent } from "./privacyPolicyContent";

describe("privacyPolicyContent (T14: gra bez kont)", () => {
  const pl = getPolicyContent("pl");
  const en = getPolicyContent("en");
  const text = (c: typeof pl): string => c.sections.map((s) => [s.heading, ...s.paragraphs].join(" ")).join(" ");

  it("wybiera język: pl/pl-PL -> PL, pozostałe -> EN", () => {
    expect(getPolicyContent("pl-PL")).toBe(pl);
    expect(getPolicyContent("de")).toBe(en);
    expect(pl.title).toBe("Prywatność");
    expect(en.title).toBe("Privacy");
  });

  it("wersje PL i EN mają tyle samo sekcji", () => {
    expect(pl.sections).toHaveLength(en.sections.length);
  });

  it("deklaruje brak kont, danych osobowych i cookies", () => {
    expect(text(pl)).toContain("Gra nie ma kont");
    expect(text(pl)).toContain("nie używamy plików cookies");
    expect(text(en)).toContain("The game has no accounts");
  });

  it("mówi, że dane gry są tylko w przeglądarce i jak zrobić kopię", () => {
    expect(text(pl)).toContain("wyłącznie w Twojej przeglądarce");
    expect(text(pl)).toContain("usuwa je bezpowrotnie");
    expect(text(pl)).toContain("Wczytaj → ⬇");
  });

  it("wskazuje hosting, administratora i skargę do UODO", () => {
    expect(text(pl)).toContain("Vercel");
    expect(text(pl)).toContain("Administratorem");
    expect(text(pl)).toContain("uodo.gov.pl");
  });

  it("oznacza pola do uzupełnienia przez administratora", () => {
    expect(JSON.stringify(pl)).toContain("[UZUPEŁNIJ");
    expect(JSON.stringify(en)).toContain("[TO FILL IN");
  });
});
