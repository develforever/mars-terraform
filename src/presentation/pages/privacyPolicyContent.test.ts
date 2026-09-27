import { describe, it, expect } from "vitest";
import { getPolicyContent } from "./privacyPolicyContent";

describe("privacyPolicyContent (T12, RODO art. 13)", () => {
  const pl = getPolicyContent("pl");
  const en = getPolicyContent("en");

  it("wybiera język: pl/pl-PL -> PL, pozostałe -> EN", () => {
    expect(getPolicyContent("pl-PL")).toBe(pl);
    expect(getPolicyContent("de")).toBe(en);
    expect(pl.title).toBe("Polityka prywatności");
    expect(en.title).toBe("Privacy Policy");
  });

  it("wersje PL i EN mają tyle samo sekcji", () => {
    expect(pl.sections).toHaveLength(en.sections.length);
    expect(pl.sections.length).toBeGreaterThanOrEqual(10);
  });

  it("zawiera obowiązkowe elementy art. 13: administrator, podstawy, odbiorcy, retencja, prawa, skarga do PUODO", () => {
    const text = pl.sections.map((s) => [s.heading, ...s.paragraphs].join(" ")).join(" ");
    for (const phrase of ["Administrator", "art. 6 ust. 1 lit. b", "Vercel", "Render", "Turso", "30 dniach", "sprostowania", "uodo.gov.pl"]) {
      expect(text).toContain(phrase);
    }
  });

  it("opisuje pamięć przeglądarki zgodnie z kodem: brak cookies, token, język, autozapis", () => {
    const text = pl.sections.map((s) => s.paragraphs.join(" ")).join(" ");
    expect(text).toContain("nie używa plików cookies");
    expect(text).toContain("token logowania");
    expect(text).toContain("język");
    expect(text).toContain("autozapis");
  });

  it("oznacza pola do uzupełnienia przez administratora", () => {
    expect(JSON.stringify(pl)).toContain("[UZUPEŁNIJ");
    expect(JSON.stringify(en)).toContain("[TO FILL IN");
  });
});
