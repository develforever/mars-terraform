import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AtmosphereSky } from "../AtmosphereSky";

vi.mock("@react-three/fiber", () => ({
    useFrame: vi.fn(),
}));

vi.mock("@react-three/drei", () => ({
    Sky: () => <div data-testid="mock-drei-sky" />,
    Stars: () => <div data-testid="mock-drei-stars" />,
}));

vi.mock("../Sun", () => ({
    Sun: () => <div data-testid="mock-sun" />,
}));

vi.mock("../../../../application/store/useGameStore", () => ({
    useGameStore: <T,>(fn: (state: { setSun: () => void; terraforming: number; o2Accumulated: number; weather: { type: string; intensity: number; impactZones: unknown[] } }) => T) => {
        const state = {
            setSun: vi.fn(),
            terraforming: 25,
            o2Accumulated: 150,
            weather: { type: "clear", intensity: 0, impactZones: [] },
        };
        return fn ? fn(state) : (state as unknown as T);
    },
}));

describe("AtmosphereSky Component", () => {
    it("should render without crashing with Drei Sky, Stars and Sun components", () => {
        const { getByTestId } = render(<AtmosphereSky />);
        expect(getByTestId("mock-drei-sky")).toBeTruthy();
        expect(getByTestId("mock-drei-stars")).toBeTruthy();
        expect(getByTestId("mock-sun")).toBeTruthy();
    });
});
