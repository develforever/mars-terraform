import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../app/i18n";
import { LanguageToggle } from "./LanguageToggle";
import { describe, it, expect, beforeEach } from "vitest";

function renderWithI18n() {
    return render(
        <I18nextProvider i18n={i18n}>
            <LanguageToggle />
        </I18nextProvider>,
    );
}

describe("LanguageToggle", () => {
    beforeEach(() => {
        i18n.changeLanguage("pl");
        localStorage.clear();
    });

    it("shows 'EN' label when language is pl (toggle to en)", () => {
        renderWithI18n();
        expect(screen.getByRole("button")).toHaveTextContent("EN");
    });

    it("switches to EN on click", () => {
        renderWithI18n();
        fireEvent.click(screen.getByRole("button"));
        expect(i18n.language).toBe("en");
        expect(localStorage.getItem("mars-lang")).toBe("en");
    });

    it("shows 'PL' label when language is en (toggle back)", () => {
        i18n.changeLanguage("en");
        renderWithI18n();
        expect(screen.getByRole("button")).toHaveTextContent("PL");
    });

    it("switches back to PL on click when language is en", () => {
        i18n.changeLanguage("en");
        renderWithI18n();
        fireEvent.click(screen.getByRole("button"));
        expect(i18n.language).toBe("pl");
        expect(localStorage.getItem("mars-lang")).toBe("pl");
    });
});
