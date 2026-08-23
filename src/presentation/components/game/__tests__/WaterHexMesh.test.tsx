import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as THREE from "three";
import { WaterHexMesh } from "../WaterHexMesh";
import { createWaterMaterial } from "../WaterMaterial";

let mockFrameCallback: ((state: { clock: { elapsedTime: number } }, delta: number) => void) | null = null;

vi.mock("@react-three/fiber", () => ({
  useFrame: (cb: (state: { clock: { elapsedTime: number } }, delta: number) => void) => {
    mockFrameCallback = cb;
  },
}));

vi.mock("../../../../application/store/useGameStore", () => ({
  useGameStore: (selector: (state: { waterLevel: number; hexGrid: { radius: number } }) => unknown) => {
    const state = {
      waterLevel: 0.25,
      hexGrid: { radius: 20 },
    };
    return selector(state);
  },
}));

describe("WaterMaterial & WaterHexMesh", () => {
  beforeEach(() => {
    mockFrameCallback = null;
    vi.clearAllMocks();
  });

  it("should create a ShaderMaterial with correct default uniforms", () => {
    const mat = createWaterMaterial();
    expect(mat).toBeInstanceOf(THREE.ShaderMaterial);
    expect(mat.transparent).toBe(true);
    expect(mat.uniforms.uTime).toBeDefined();
    expect(mat.uniforms.uDeepColor).toBeDefined();
    expect(mat.uniforms.uShallowColor).toBeDefined();
    expect(mat.uniforms.uFoamColor).toBeDefined();
  });

  it("should render WaterHexMesh and register frame callback", () => {
    const { container } = render(<WaterHexMesh />);
    expect(container).toBeTruthy();
    expect(mockFrameCallback).toBeDefined();
  });

  it("should update time uniform on frame tick", () => {
    render(<WaterHexMesh waterLevel={0.5} mapRadius={15} />);
    expect(mockFrameCallback).toBeDefined();

    if (mockFrameCallback) {
      mockFrameCallback({ clock: { elapsedTime: 12.34 } }, 0.016);
    }
  });

  it("should dispose geometry and material on unmount", () => {
    const geoDisposeSpy = vi.spyOn(THREE.CircleGeometry.prototype, "dispose");
    const matDisposeSpy = vi.spyOn(THREE.ShaderMaterial.prototype, "dispose");

    const { unmount } = render(<WaterHexMesh />);
    unmount();

    expect(geoDisposeSpy).toHaveBeenCalled();
    expect(matDisposeSpy).toHaveBeenCalled();
  });
});
