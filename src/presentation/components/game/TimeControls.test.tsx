import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeControls } from "./TimeControls";
import { useGameStore } from "../../../application/store/useGameStore";
import "../../../app/i18n";

describe("TimeControls Component", () => {
    beforeEach(() => {
        useGameStore.setState({
            isPaused: false,
            gameSpeed: 1,
        });
    });

    it("renders pause and speed buttons (1x, 2x, 4x)", () => {
        render(<TimeControls />);

        expect(screen.getByTestId("time-control-pause")).toBeInTheDocument();
        expect(screen.getByTestId("time-control-1x")).toBeInTheDocument();
        expect(screen.getByTestId("time-control-2x")).toBeInTheDocument();
        expect(screen.getByTestId("time-control-4x")).toBeInTheDocument();
        expect(screen.queryByTestId("time-paused-badge")).not.toBeInTheDocument();
    });

    it("toggles pause state when pause button is clicked", () => {
        render(<TimeControls />);

        const pauseBtn = screen.getByTestId("time-control-pause");
        expect(pauseBtn.textContent).toBe("⏸");

        fireEvent.click(pauseBtn);

        expect(useGameStore.getState().isPaused).toBe(true);
        expect(screen.getByTestId("time-paused-badge")).toBeInTheDocument();
        expect(pauseBtn.textContent).toBe("▶");

        fireEvent.click(pauseBtn);
        expect(useGameStore.getState().isPaused).toBe(false);
        expect(screen.queryByTestId("time-paused-badge")).not.toBeInTheDocument();
    });

    it("changes game speed when 2x and 4x buttons are clicked and unpauses if paused", () => {
        useGameStore.setState({ isPaused: true, gameSpeed: 1 });
        render(<TimeControls />);

        const btn2x = screen.getByTestId("time-control-2x");
        fireEvent.click(btn2x);

        expect(useGameStore.getState().gameSpeed).toBe(2);
        expect(useGameStore.getState().isPaused).toBe(false);

        const btn4x = screen.getByTestId("time-control-4x");
        fireEvent.click(btn4x);

        expect(useGameStore.getState().gameSpeed).toBe(4);
    });
});
