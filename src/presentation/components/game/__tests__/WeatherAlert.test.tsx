import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WeatherAlert } from "../WeatherAlert";
import { useGameStore } from "../../../../application/store/useGameStore";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            if (key === "weather.dust_storm") return "ALERT: DUST STORM IN PROGRESS";
            if (key === "weather.polar_aurora") return "ATMOSPHERIC EVENT: POLAR AURORA";
            if (key === "weather.effects.solar_penalty") return "Solar generator efficiency: -50%";
            if (key === "weather.effects.aurora_active") return "Atmospheric luminescence & ionization active";
            if (key === "weather.subtitle.dust_storm") return `Ends in: ${options?.ticks}s`;
            if (key === "weather.subtitle.polar_aurora") return `Visible for: ${options?.ticks}s`;
            return key;
        },
    }),
}));

describe("WeatherAlert Component", () => {
    it("should render nothing when weather is clear", () => {
        useGameStore.setState({
            weather: { type: "clear", intensity: 0, remainingTicks: 0, cooldownTicks: 0 },
        });

        const { container } = render(<WeatherAlert />);
        expect(container.firstChild).toBeNull();
    });

    it("should render dust storm alert with solar penalty badge", () => {
        useGameStore.setState({
            weather: { type: "dust_storm", intensity: 0.8, remainingTicks: 25, cooldownTicks: 0 },
        });

        render(<WeatherAlert />);
        expect(screen.getByText("ALERT: DUST STORM IN PROGRESS")).toBeTruthy();
        expect(screen.getByText("Solar generator efficiency: -50%", { exact: false })).toBeTruthy();
        expect(screen.getByText("Ends in: 25s")).toBeTruthy();
    });

    it("should render polar aurora alert with atmospheric luminescence badge", () => {
        useGameStore.setState({
            weather: { type: "polar_aurora", intensity: 0.9, remainingTicks: 40, cooldownTicks: 0 },
        });

        render(<WeatherAlert />);
        expect(screen.getByText("ATMOSPHERIC EVENT: POLAR AURORA")).toBeTruthy();
        expect(screen.getByText("Atmospheric luminescence & ionization active", { exact: false })).toBeTruthy();
    });
});
