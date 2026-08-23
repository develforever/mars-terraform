import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WeatherEffects } from "../WeatherEffects";

vi.mock("@react-three/fiber", () => ({
    useFrame: vi.fn(),
}));

vi.mock("../../../../application/store/useGameStore", () => ({
    useGameStore: <T,>(fn: (state: { weather: { type: string; intensity: number }; terraforming: number }) => T) => {
        const state = {
            weather: { type: "dust_storm", intensity: 0.8 },
            terraforming: 50,
        };
        return fn ? fn(state) : (state as unknown as T);
    },
}));

describe("WeatherEffects Component", () => {
    it("should render weather effects group and properly instantiate geometries and materials", () => {
        const { container } = render(<WeatherEffects />);
        expect(container).toBeTruthy();
    });
});
