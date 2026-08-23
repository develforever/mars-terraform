/**
 * vegetationGeometry.ts
 *
 * Procedural low-poly vegetation geometry and instance population logic.
 */

import * as THREE from "three";
import { HEX_SIZE, hexToWorld } from "../../generator/hex/HexMath";
import { TerraformingService } from "../../../domain/services/TerraformingService";
import type { HexGrid } from "../../generator/hex/HexGrid";
import type { DifficultyLevel } from "../../../domain/services/TerraformingService";

/**
 * Creates a low-poly stylized tuft geometry (crossed blades + central cluster).
 */
export function createTuftGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();

  // 3 crossed quads with slight outward curvature (6 triangles each = 18 triangles total)
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const angles = [0, Math.PI / 3, (2 * Math.PI) / 3];
  const baseWidth = 0.16;
  const tipWidth = 0.04;
  const height = 0.35;

  const baseCol = new THREE.Color("#2d5a27");
  const tipCol = new THREE.Color("#6ea84f");

  for (const angle of angles) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const perpX = -sin;
    const perpZ = cos;

    // Bottom left, bottom right, top right, top left
    const blX = -perpX * baseWidth;
    const blZ = -perpZ * baseWidth;
    const brX = perpX * baseWidth;
    const brZ = perpZ * baseWidth;

    const tlX = -perpX * tipWidth + perpX * 0.03;
    const tlZ = -perpZ * tipWidth + perpZ * 0.03;
    const trX = perpX * tipWidth + perpX * 0.03;
    const trZ = perpZ * tipWidth + perpZ * 0.03;

    // Quad triangle 1: BL -> BR -> TR
    positions.push(
      blX, 0, blZ,
      brX, 0, brZ,
      trX, height, trZ
    );
    // Quad triangle 2: BL -> TR -> TL
    positions.push(
      blX, 0, blZ,
      trX, height, trZ,
      tlX, height, tlZ
    );

    // Normals (approximate outward)
    for (let i = 0; i < 6; i++) {
      normals.push(cos * 0.3, 0.9, sin * 0.3);
    }

    // Vertex colors: base is darker moss green, tip is bright fertile green
    colors.push(
      baseCol.r, baseCol.g, baseCol.b,
      baseCol.r, baseCol.g, baseCol.b,
      tipCol.r, tipCol.g, tipCol.b,

      baseCol.r, baseCol.g, baseCol.b,
      tipCol.r, tipCol.g, tipCol.b,
      tipCol.r, tipCol.g, tipCol.b
    );
  }

  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  return geom;
}

/** Pseudo-random deterministic hash [0, 1) */
function pseudoHash(q: number, r: number, index: number): number {
  const val = Math.sin(q * 12.9898 + r * 78.233 + index * 37.719) * 43758.5453;
  return val - Math.floor(val);
}

export interface PopulateVegetationOptions {
  waterLevel: number;
  o2Accumulated: number;
  terraforming: number;
  difficulty?: DifficultyLevel;
  maxInstances?: number;
}

export function populateVegetationInstances(
  instMesh: THREE.InstancedMesh,
  hexGrid: HexGrid,
  options: PopulateVegetationOptions,
  dummy: THREE.Object3D = new THREE.Object3D()
): number {
  const { waterLevel, o2Accumulated, terraforming, difficulty = "normal", maxInstances = 2000 } = options;
  const cells = hexGrid.getAllCells();
  let instanceIdx = 0;

  const color = new THREE.Color();
  const greenTones = [
    new THREE.Color("#2d5a27"),
    new THREE.Color("#3e6b2c"),
    new THREE.Color("#5a8f3d"),
    new THREE.Color("#4c8b32"),
  ];

  for (const cell of cells) {
    const vegFactor = TerraformingService.calculateHexVegetation(
      cell.worldY,
      waterLevel,
      o2Accumulated,
      terraforming,
      difficulty
    );

    // Render low-poly tufts only on hexes with vegetationFactor > 0.3
    if (vegFactor > 0.3) {
      const [cx, cz] = hexToWorld(cell.q, cell.r);
      // Scale tufts count per hex from 1 to 6 as vegFactor grows from 0.3 to 1.0
      const tuftCount = Math.min(6, Math.max(1, Math.floor(1 + ((vegFactor - 0.3) / 0.7) * 5)));

      for (let i = 0; i < tuftCount; i++) {
        if (instanceIdx >= maxInstances) break;

        const angle = pseudoHash(cell.q, cell.r, i * 3 + 1) * Math.PI * 2;
        const dist = pseudoHash(cell.q, cell.r, i * 3 + 2) * (HEX_SIZE * 0.62);

        const posX = cx + Math.cos(angle) * dist;
        const posZ = cz + Math.sin(angle) * dist;
        const posY = cell.worldY;

        const scale = (0.5 + 0.5 * vegFactor) * (0.8 + 0.4 * pseudoHash(cell.q, cell.r, i * 3 + 3));
        const rotY = pseudoHash(cell.q, cell.r, i * 3 + 4) * Math.PI * 2;

        dummy.position.set(posX, posY, posZ);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();

        instMesh.setMatrixAt(instanceIdx, dummy.matrix);

        // Varied lush green instance tint
        if (typeof instMesh.setColorAt === "function") {
          const toneIdx = Math.floor(pseudoHash(cell.q, cell.r, i * 3 + 5) * greenTones.length);
          color.copy(greenTones[toneIdx]);
          instMesh.setColorAt(instanceIdx, color);
        }

        instanceIdx++;
      }
    }
  }

  instMesh.count = instanceIdx;
  if (instMesh.instanceMatrix) {
    instMesh.instanceMatrix.needsUpdate = true;
  }
  if (instMesh.instanceColor) {
    instMesh.instanceColor.needsUpdate = true;
  }

  return instanceIdx;
}
