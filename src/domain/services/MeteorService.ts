import type { PlacedBuilding } from "../entities/Building";
import type { ImpactZone, MeteorTrajectory } from "./WeatherService";

/** Grid cells within this radius of an impact zone take damage. */
const IMPACT_RADIUS = 2;
/** Condition damage per building hit by a meteor. */
const IMPACT_DAMAGE = 35;

export class MeteorService {
  /**
   * Returns updated buildings after applying meteor impact damage.
   * Buildings within IMPACT_RADIUS cells of any impact zone lose condition.
   */
  static applyImpacts(
    buildings: PlacedBuilding[],
    impactZones: ImpactZone[]
  ): PlacedBuilding[] {
    if (!impactZones.length) return buildings;

    return buildings.map((b) => {
      const hit = impactZones.some(
        (zone) =>
          Math.abs(b.position.x - zone.x) <= IMPACT_RADIUS &&
          Math.abs(b.position.z - zone.z) <= IMPACT_RADIUS
      );
      if (!hit) return b;
      return { ...b, condition: Math.max(0, b.condition - IMPACT_DAMAGE) };
    });
  }

  /** Returns which impact zones actually hit at least one building. */
  static getHitZones(
    buildings: PlacedBuilding[],
    impactZones: ImpactZone[]
  ): ImpactZone[] {
    return impactZones.filter((zone) =>
      buildings.some(
        (b) =>
          Math.abs(b.position.x - zone.x) <= IMPACT_RADIUS &&
          Math.abs(b.position.z - zone.z) <= IMPACT_RADIUS
      )
    );
  }

  /**
   * Calculates interpolated 3D position [x, y, z] along a meteor trajectory.
   * Progress is clamped to [0, 1] (0 = start in upper atmosphere, 1 = target ground).
   */
  static getPositionOnTrajectory(
    trajectory: MeteorTrajectory,
    progress: number,
    groundY = 0
  ): [number, number, number] {
    const p = Math.max(0, Math.min(1, progress));
    const x = trajectory.startX + (trajectory.targetX - trajectory.startX) * p;
    const targetY = groundY + trajectory.targetY;
    const y = trajectory.startY + (targetY - trajectory.startY) * p;
    const z = trajectory.startZ + (trajectory.targetZ - trajectory.startZ) * p;
    return [x, y, z];
  }
}
