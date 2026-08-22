import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BuildingConnections } from "./BuildingConnections";
import { useGameStore } from "../../../application/store/useGameStore";
import { hexToWorld } from "../../generator/hex/HexMath";
import type { PlacedBuilding } from "../../../domain/entities/Building";
import { TerrainHeightContext } from "./TerrainHeightContext";

// Mock react-three-fiber hooks
vi.mock("@react-three/fiber", () => ({
  useFrame: vi.fn(),
}));

describe("BuildingConnections Component", () => {
  it("should render null when no buildings are placed", () => {
    useGameStore.setState({ placed: [] });

    const { container } = render(
      <TerrainHeightContext.Provider value={() => 0}>
        <BuildingConnections />
      </TerrainHeightContext.Provider>
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render connections when power and water nodes are placed within range", () => {
    const [w0x, w0z] = hexToWorld(0, 0);
    const [w1x, w1z] = hexToWorld(1, 0);

    const solar: PlacedBuilding = {
      id: "solar-1",
      definitionId: "solar",
      position: { x: w0x, y: 0, z: w0z },
      condition: 100,
    };
    const hab: PlacedBuilding = {
      id: "hab-1",
      definitionId: "hab",
      position: { x: w1x, y: 0, z: w1z },
      condition: 100,
    };

    useGameStore.setState({ placed: [solar, hab] });

    const mockTerrainHeight = vi.fn(() => 1.5);

    const { container } = render(
      <TerrainHeightContext.Provider value={mockTerrainHeight}>
        <BuildingConnections />
      </TerrainHeightContext.Provider>
    );

    expect(container.querySelector("group")).toBeTruthy();
    expect(mockTerrainHeight).toHaveBeenCalled();
  });
});
