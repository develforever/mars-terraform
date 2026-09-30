import { describe, it, expect } from "vitest";
import { CONTACT_EMAIL, getPolicyContent } from "./privacyPolicyContent";

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

  it("wskazuje hosting i kontakt e-mail projektu, bez danych osobowych autora ani pól do uzupełnienia", () => {
    expect(CONTACT_EMAIL).toBe("mars_terraform@proton.me");
    expect(text(pl)).toContain("Vercel");
    expect(text(pl)).toContain(CONTACT_EMAIL);
    expect(text(en)).toContain(CONTACT_EMAIL);
    expect(JSON.stringify(pl)).not.toContain("UZUPEŁNIJ");
    expect(JSON.stringify(en)).not.toContain("TO FILL IN");
    expect(text(pl)).not.toContain("Administrator");
  });
});
