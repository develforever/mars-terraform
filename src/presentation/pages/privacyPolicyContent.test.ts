import { describe, it, expect } from "vitest";
import { getPolicyContent } from "./privacyPolicyContent";

describe("privacyPolicyContent (T12, RODO art. 13)", () => {
  const pl = getPolicyContent("pl");
  const en = getPolicyContent("en");

  it("wybiera język: pl/pl-PL -> PL, pozostałe -> EN", () => {
    expect(getPolicyContent("pl-PL")).toBe(pl);
    expect(getPolicyContent("de")).toBe(en);
    expect(pl.title).toBe("Prywatność");
    expect(en.title).toBe("Privacy");
  });

  it("wersje PL i EN mają tyle samo sekcji", () => {
    expect(pl.sections).toHaveLength(en.sections.length);
    expect(pl.sections.length).toBeGreaterThanOrEqual(7);
  });

  it("zawiera elementy art. 13: administrator, podstawy, odbiorcy, retencja, prawa, skarga do UODO", () => {
    const text = pl.sections.map((s) => [s.heading, ...s.paragraphs].join(" ")).join(" ");
    for (const phrase of ["Administrator", "art. 6 ust. 1 lit. b", "Vercel", "Render", "Turso", "2 lata", "usunąć konto", "uodo.gov.pl"]) {
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

  it("T13: deklaruje brak e-maila, hasła i zapisu IP przez serwer gry", () => {
    const text = pl.sections.map((s) => s.paragraphs.join(" ")).join(" ");
    expect(text).toContain("Nie zbieramy e-maila, imienia, nazwiska ani hasła");
    expect(text).toContain("Serwer gry nie zapisuje adresów IP");
    expect(text).toContain("samego numeru nie przechowujemy");
  });
});
