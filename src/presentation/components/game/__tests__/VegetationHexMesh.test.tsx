import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as THREE from "three";
import { VegetationHexMesh } from "../VegetationHexMesh";
import {
  createTuftGeometry,
  populateVegetationInstances,
} from "../vegetationGeometry";
import { HexGrid } from "../../../generator/hex/HexGrid";

vi.mock("../../../../application/store/useGameStore", () => ({
  useGameStore: (selector: (state: {
    hexGrid: HexGrid;
    terraforming: number;
    o2Accumulated: number;
    waterLevel: number;
    difficulty: "normal";
  }) => unknown) => {
    const grid = new HexGrid(4, 42);
    grid.generate();
    const state = {
      hexGrid: grid,
      terraforming: 80,
      o2Accumulated: 700,
      waterLevel: 0.2,
      difficulty: "normal" as const,
    };
    return selector(state);
  },
}));

describe("VegetationHexMesh & createTuftGeometry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create low-poly tuft geometry with positions, normals, and vertex colors", () => {
    const geom = createTuftGeometry();
    expect(geom).toBeInstanceOf(THREE.BufferGeometry);
    expect(geom.getAttribute("position")).toBeDefined();
    expect(geom.getAttribute("normal")).toBeDefined();
    expect(geom.getAttribute("color")).toBeDefined();
    expect(geom.getAttribute("position").count).toBeGreaterThan(0);
  });

  it("should populate instanced mesh transforms and colors when conditions allow growth", () => {
    const grid = new HexGrid(4, 42);
    grid.generate();

    const mockInstancedMesh = {
      setMatrixAt: vi.fn(),
      setColorAt: vi.fn(),
      count: 0,
      instanceMatrix: { needsUpdate: false },
      instanceColor: { needsUpdate: false },
    } as unknown as THREE.InstancedMesh;

    const count = populateVegetationInstances(mockInstancedMesh, grid, {
      waterLevel: 0.2,
      o2Accumulated: 800,
      terraforming: 90,
      difficulty: "normal",
      maxInstances: 500,
    });

    expect(count).toBeGreaterThan(0);
    expect(mockInstancedMesh.setMatrixAt).toHaveBeenCalled();
    expect(mockInstancedMesh.setColorAt).toHaveBeenCalled();
    expect(mockInstancedMesh.count).toBe(count);
  });

  it("should produce 0 instances on barren Mars with 0 terraforming", () => {
    const grid = new HexGrid(4, 42);
    grid.generate();

    const mockInstancedMesh = {
      setMatrixAt: vi.fn(),
      setColorAt: vi.fn(),
      count: 0,
      instanceMatrix: { needsUpdate: false },
      instanceColor: { needsUpdate: false },
    } as unknown as THREE.InstancedMesh;

    const count = populateVegetationInstances(mockInstancedMesh, grid, {
      waterLevel: -0.5,
      o2Accumulated: 0,
      terraforming: 0,
      difficulty: "normal",
    });

    expect(count).toBe(0);
    expect(mockInstancedMesh.setMatrixAt).not.toHaveBeenCalled();
    expect(mockInstancedMesh.count).toBe(0);
  });

  it("should render VegetationHexMesh component without crashing", () => {
    const grid = new HexGrid(3, 42);
    grid.generate();

    const { container } = render(<VegetationHexMesh hexGrid={grid} />);
    expect(container).toBeTruthy();
  });

  it("should dispose geometry and material on unmount", () => {
    const geoDisposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const matDisposeSpy = vi.spyOn(THREE.MeshStandardMaterial.prototype, "dispose");

    const grid = new HexGrid(2, 42);
    grid.generate();

    const { unmount } = render(<VegetationHexMesh hexGrid={grid} />);
    unmount();

    expect(geoDisposeSpy).toHaveBeenCalled();
    expect(matDisposeSpy).toHaveBeenCalled();
  });
});
