import { render, screen } from "@testing-library/react";
import { it, expect, vi, describe } from "vitest";
import { StartScene3D } from "../MarsStartScene";

vi.mock("@react-three/fiber", async () => {
    const actual = await vi.importActual<typeof import("@react-three/fiber")>("@react-three/fiber");
    return {
        ...actual,
        Canvas: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
            <div data-testid="canvas" {...props}>{children}</div>
        ),
        useFrame: vi.fn(),
        useThree: () => ({
            gl: {
                domElement: document.createElement("canvas"),
                getContext: () => null,
                info: { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } },
                renderLists: { dispose: () => {} },
                dispose: () => {},
            },
            scene: { traverse: () => {} },
        }),
    };
});

vi.mock("@react-three/drei", () => {
    const mockUseGLTF = Object.assign(
        () => ({ scene: { clone: () => ({}) } }),
        { preload: () => {} }
    );
    return {
        Stars: () => <div data-testid="stars" />,
        useGLTF: mockUseGLTF,
        useTexture: () => [{ wrapS: 0, wrapT: 0 }, { wrapS: 0, wrapT: 0 }],
    };
});

vi.mock("../PostProcessingComposer", () => ({
    PostProcessingComposer: (props: { bloomIntensity?: number; bloomThreshold?: number; glitch?: boolean }) => (
        <div
            data-testid="post-processing-composer"
            data-bloom-intensity={props.bloomIntensity}
            data-bloom-threshold={props.bloomThreshold}
            data-glitch={props.glitch ? "true" : "false"}
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
        },
    };
});

vi.mock("../Sun", () => ({
    Sun: () => <div data-testid="sun" />,
}));

vi.mock("../Mars", () => ({
    Mars: () => <div data-testid="mars" />,
}));

describe("StartScene3D", () => {
    it("should render Canvas with Sun, Mars, and post-processing Bloom", () => {
        render(<StartScene3D onClick={() => {}} />);

        expect(screen.getByTestId("canvas")).toBeTruthy();
        expect(screen.getByTestId("sun")).toBeTruthy();
        expect(screen.getByTestId("mars")).toBeTruthy();
        expect(screen.getByTestId("post-processing-composer")).toBeTruthy();
    });

    it("should configure Bloom with calibrated HDR threshold for celestial glow", () => {
        render(<StartScene3D onClick={() => {}} />);
        const bloom = screen.getByTestId("post-processing-composer");
        expect(bloom.getAttribute("data-bloom-threshold")).toBe("1");
        expect(bloom.getAttribute("data-glitch")).toBe("true");
    });
});
