import { render, screen } from "@testing-library/react";
import { it, expect, vi, describe } from "vitest";
import { Scene3D } from "../Scene3D";

vi.mock("@react-three/fiber", async () => {
    const actual = await vi.importActual<typeof import("@react-three/fiber")>("@react-three/fiber");
    return {
        ...actual,
        Canvas: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
            <div data-testid="canvas" {...props}>{children}</div>
        ),
        useFrame: vi.fn((cb) => cb({ clock: { elapsedTime: 0 }, camera: { position: { x: 0, y: 0, z: 0 } }, scene: { background: null, fog: null } }, 0.016)),
        useThree: () => ({
            gl: { domElement: document.createElement("canvas") },
            camera: { position: { set: () => {} } },
            scene: { background: null, fog: null },
        }),
    };
});

vi.mock("@react-three/drei", () => ({
    OrbitControls: () => <div data-testid="orbit-controls" />,
    useTexture: () => [{ image: { width: 512 } }, { image: { width: 512 } }],
    Html: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-html">{children}</div>,
    Loader: () => <div data-testid="mock-loader" />,
    useProgress: () => ({ progress: 100, active: false }),
    useGLTF: Object.assign(vi.fn(() => ({ scene: { clone: () => ({ position: { set: () => {} }, traverse: () => {} }) } })), {
        preload: vi.fn(),
    }),
}));

vi.mock("../PostProcessingComposer", () => ({
    PostProcessingComposer: (props: { bloomIntensity?: number; bloomThreshold?: number; bloomSmoothing?: number }) => (
        <div
            data-testid="post-processing-composer"
            data-bloom-intensity={props.bloomIntensity}
            data-bloom-threshold={props.bloomThreshold}
            data-bloom-smoothing={props.bloomSmoothing}
        />
    ),
}));

vi.mock("three", async () => {
    const actual = await vi.importActual<typeof import("three")>("three");
    return {
        ...actual,
        Vector3: class {
            x: number;
            y: number;
            z: number;
            constructor(x = 0, y = 0, z = 0) {
                this.x = x;
                this.y = y;
                this.z = z;
            }
            clone() { return this; }
            copy() { return this; }
            sub() { return this; }
            normalize() { return this; }
            lerp() { return this; }
        },
        CanvasTexture: class {
            constructor() {}
        },
        Color: class {
            constructor() {}
            copy() { return this; }
            lerp() { return this; }
        },
        MathUtils: { lerp: (a: number, b: number, t: number) => a + (b - a) * t },
        FogExp2: class {
            color: unknown;
            density: number;
            constructor() {
                this.color = { copy: () => {}, lerp: () => {} };
                this.density = 0.012;
            }
        },
    };
});

vi.mock("../../../../application/hooks/usePlacement", () => {
    return {
        usePlacement: () => {},
    };
});

vi.mock("../../../../application/store/useUIStore", () => ({
    useUIStore: <T,>(fn: (state: { buildMode: string | null; cancelBuild: () => void }) => T) => {
        const state = { buildMode: null as string | null, cancelBuild: () => {} };
        return fn ? fn(state) : (state as unknown as T);
    },
}));

vi.mock("../../../../application/store/useGameStore", () => ({
    useGameStore: <T,>(fn: (state: { setSun: () => void; weather: { type: string; intensity: number; impactZones: unknown[] }; alienState: { ships: unknown[]; groundUnits: unknown[]; wave: number }; gameMode: string; placed: unknown[]; hexGrid: { getCell: () => { worldY: number } } }) => T) => {
        const state = {
            setSun: () => {},
            weather: { type: "clear", intensity: 0, impactZones: [] },
            alienState: { ships: [], groundUnits: [], wave: 0 },
            gameMode: "exploration",
            placed: [],
            hexGrid: { getCell: () => ({ worldY: 0 }) },
        };
        return fn ? fn(state) : (state as unknown as T);
    },
}));

vi.mock("../TerrainHexMesh", () => ({
    TerrainHexMesh: () => <div data-testid="terrain-hex-mesh" />,
    default: () => <div data-testid="terrain-hex-mesh" />,
}));

vi.mock("../Decorations", () => ({
    Decorations: () => <div data-testid="decorations" />,
    default: () => <div data-testid="decorations" />,
}));

vi.mock("../../../generator/components/viewport/SmoothTerrain", () => ({
    SmoothTerrain: () => <div data-testid="smooth-terrain" />,
    default: () => <div data-testid="smooth-terrain" />,
}));

vi.mock("../Buildings", () => ({
    Buildings: () => <div data-testid="buildings" />,
    HoverGhost: () => <div data-testid="hover-ghost" />,
    DemolishGhost: () => <div data-testid="demolish-ghost" />,
}));

vi.mock("../TerrainHeightContext", () => ({
    TerrainHeightContext: { Provider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> },
    useTerrainHeight: () => () => 0,
}));

vi.mock("../MarsEnvironment", () => ({
    MarsEnvironment: () => <div data-testid="mars-environment" />,
}));

vi.mock("../VisibilitySystem", () => ({
    VisibilitySystem: () => <div data-testid="visibility-system" />,
}));

vi.mock("../TerrainDataSystem", () => ({
    TerrainDataSystem: () => <div data-testid="terrain-data-system" />,
}));

vi.mock("../MeteorShower", () => ({
    MeteorShower: () => <div data-testid="meteor-shower" />,
}));

vi.mock("../BuildingConnections", () => ({
    BuildingConnections: () => <div data-testid="building-connections" />,
}));

vi.mock("../AlienInvasion", () => ({
    AlienInvasion: () => <div data-testid="alien-invasion" />,
}));

vi.mock("../MiningLogisticsSystem", () => ({
    MiningLogisticsSystem: () => <div data-testid="mining-logistics-system" />,
}));

describe("Scene3D", () => {
    it("should render Canvas with post-processing Bloom", () => {
        render(<Scene3D />);

        expect(screen.getByTestId("canvas")).toBeTruthy();
        expect(screen.getByTestId("post-processing-composer")).toBeTruthy();
    });

    it("should configure Bloom for lasers and meteors with low luminance threshold", () => {
        render(<Scene3D />);
        const bloom = screen.getByTestId("post-processing-composer");
        expect(bloom.getAttribute("data-bloom-threshold")).toBe("0.2");
        expect(bloom.getAttribute("data-bloom-smoothing")).toBe("0.9");
    });
});
