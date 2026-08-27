import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmergencyLifeSupportAlert } from "./EmergencyLifeSupportAlert";
import { useGameStore } from "../../../application/store/useGameStore";
import "../../../app/i18n";

describe("EmergencyLifeSupportAlert Component", () => {
    beforeEach(() => {
        useGameStore.setState({
            alive: true,
            emergencyLifeSupport: {
                active: false,
                secondsRemaining: 60,
            },
        });
    });

    it("does not render when emergency life support is inactive", () => {
        render(<EmergencyLifeSupportAlert />);
        expect(screen.queryByTestId("emergency-life-support-alert")).not.toBeInTheDocument();
    });

    it("renders warning banner with countdown when emergency life support is active", () => {
        useGameStore.setState({
            alive: true,
            emergencyLifeSupport: {
                active: true,
                secondsRemaining: 42,
            },
        });

        render(<EmergencyLifeSupportAlert />);

        const banner = screen.getByTestId("emergency-life-support-alert");
        expect(banner).toBeInTheDocument();
        expect(banner.textContent).toContain("42s");
        expect(banner.textContent).toContain("⚠️");
    });

    it("does not render if alive is false even if emergencyLifeSupport was active", () => {
        useGameStore.setState({
            alive: false,
            emergencyLifeSupport: {
                active: true,
                secondsRemaining: 0,
            },
        });

        render(<EmergencyLifeSupportAlert />);
        expect(screen.queryByTestId("emergency-life-support-alert")).not.toBeInTheDocument();
    });
});
