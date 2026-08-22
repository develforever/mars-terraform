import type { PlacedBuilding, BuildingDefinition } from "../entities/Building";
import { worldToHex, hexDistance } from "../../presentation/generator/hex/HexMath";

export type GridConnectionType = "power" | "water";
export type GridNodeRole = "producer" | "consumer" | "storage";

export interface GridNodeInfo {
  building: PlacedBuilding;
  definition: BuildingDefinition;
  axial: [number, number]; // [q, r]
  powerRole?: GridNodeRole;
  waterRole?: GridNodeRole;
}

export interface BuildingConnection {
  id: string;
  type: GridConnectionType;
  from: PlacedBuilding;
  to: PlacedBuilding;
  fromHex: [number, number];
  toHex: [number, number];
  fromPos: { x: number; y: number; z: number };
  toPos: { x: number; y: number; z: number };
  distance: number; // axial hex distance
}

export interface GridCandidateEdge {
  from: PlacedBuilding;
  to: PlacedBuilding;
  fromHex: [number, number];
  toHex: [number, number];
  distance: number;
  type: GridConnectionType;
}

export interface GridNetworkStats {
  powerNodesCount: number;
  powerProducersCount: number;
  powerConsumersCount: number;
  powerStorageCount: number;
  powerClustersCount: number;
  waterNodesCount: number;
  waterProducersCount: number;
  waterConsumersCount: number;
  waterStorageCount: number;
  waterClustersCount: number;
  totalConnectionsCount: number;
}

export const DEFAULT_MAX_GRID_DISTANCE = 4;

class DisjointSet {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  constructor(elements: string[]) {
    for (const el of elements) {
      this.parent.set(el, el);
      this.rank.set(el, 0);
    }
  }

  find(item: string): string {
    const root = this.parent.get(item);
    if (!root) {
      this.parent.set(item, item);
      this.rank.set(item, 0);
      return item;
    }
    if (root !== item) {
      const actualRoot = this.find(root);
      this.parent.set(item, actualRoot);
      return actualRoot;
    }
    return root;
  }

  union(a: string, b: string): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA === rootB) return false;

    const rankA = this.rank.get(rootA) ?? 0;
    const rankB = this.rank.get(rootB) ?? 0;

    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }

    return true;
  }
}

export class BuildingConnectionService {
  /**
   * Determine power grid role for a building definition.
   */
  static getPowerRole(definition: BuildingDefinition | undefined): GridNodeRole | null {
    if (!definition) return null;

    if ((definition.capacity?.power ?? 0) > 0) {
      return "storage";
    }

    const powerProd = definition.production?.power ?? 0;
    if (powerProd > 0) {
      return "producer";
    }

    if (powerProd < 0 || definition.connectionType === "power" || (definition.cost && (definition.cost.power ?? 0) > 0)) {
      return "consumer";
    }

    return null;
  }

  /**
   * Determine water grid role for a building definition.
   */
  static getWaterRole(definition: BuildingDefinition | undefined): GridNodeRole | null {
    if (!definition) return null;

    if ((definition.capacity?.water ?? 0) > 0) {
      return "storage";
    }

    const waterProd = definition.production?.water ?? 0;
    if (waterProd > 0) {
      return "producer";
    }

    if (waterProd < 0 || definition.connectionType === "water" || (definition.cost && (definition.cost.water ?? 0) > 0)) {
      return "consumer";
    }

    return null;
  }

  /**
   * Parse placed buildings into typed grid nodes.
   */
  static getNodeInfos(
    placed: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>
  ): GridNodeInfo[] {
    const nodes: GridNodeInfo[] = [];

    for (const b of placed) {
      const def = definitions[b.definitionId];
      if (!def) continue;

      const [q, r] = worldToHex(b.position.x, b.position.z);
      const powerRole = this.getPowerRole(def) ?? undefined;
      const waterRole = this.getWaterRole(def) ?? undefined;

      if (powerRole || waterRole) {
        nodes.push({
          building: b,
          definition: def,
          axial: [q, r],
          powerRole,
          waterRole,
        });
      }
    }

    return nodes;
  }

  /**
   * Get all valid candidate edges within maximum axial hex distance for a specific grid type.
   */
  static getCandidateEdges(
    placed: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
    type: GridConnectionType,
    maxDistance: number = DEFAULT_MAX_GRID_DISTANCE
  ): GridCandidateEdge[] {
    const nodes = this.getNodeInfos(placed, definitions).filter((n) =>
      type === "power" ? n.powerRole !== undefined : n.waterRole !== undefined
    );

    const edges: GridCandidateEdge[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        const dist = hexDistance(
          nodeA.axial[0],
          nodeA.axial[1],
          nodeB.axial[0],
          nodeB.axial[1]
        );

        if (dist <= maxDistance && dist > 0) {
          edges.push({
            from: nodeA.building,
            to: nodeB.building,
            fromHex: nodeA.axial,
            toHex: nodeB.axial,
            distance: dist,
            type,
          });
        }
      }
    }

    // Sort edges deterministically: distance ascending, then by building IDs
    edges.sort((a, b) => {
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      const keyA = `${a.from.id}:${a.to.id}`;
      const keyB = `${b.from.id}:${b.to.id}`;
      return keyA.localeCompare(keyB);
    });

    return edges;
  }

  /**
   * Build a Minimum Spanning Forest (MSF) of connections for the given grid type.
   * This guarantees that nearby connected buildings form a non-cyclical, minimal infrastructure network.
   */
  static getSpanningConnectionsForGrid(
    placed: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
    type: GridConnectionType,
    maxDistance: number = DEFAULT_MAX_GRID_DISTANCE
  ): BuildingConnection[] {
    const relevantNodes = this.getNodeInfos(placed, definitions).filter((n) =>
      type === "power" ? n.powerRole !== undefined : n.waterRole !== undefined
    );

    if (relevantNodes.length < 2) return [];

    const candidateEdges = this.getCandidateEdges(placed, definitions, type, maxDistance);
    const dsu = new DisjointSet(relevantNodes.map((n) => n.building.id));
    const connections: BuildingConnection[] = [];

    for (const edge of candidateEdges) {
      if (dsu.union(edge.from.id, edge.to.id)) {
        const sortedIds = [edge.from.id, edge.to.id].sort();
        connections.push({
          id: `${sortedIds[0]}-${sortedIds[1]}-${type}`,
          type,
          from: edge.from,
          to: edge.to,
          fromHex: edge.fromHex,
          toHex: edge.toHex,
          fromPos: { ...edge.from.position },
          toPos: { ...edge.to.position },
          distance: edge.distance,
        });
      }
    }

    return connections;
  }

  /**
   * Get all active infrastructure connections (Power Grid and Water Grid) for the current colony.
   */
  static getGridConnections(
    placed: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
    maxDistance: number = DEFAULT_MAX_GRID_DISTANCE
  ): BuildingConnection[] {
    const powerConnections = this.getSpanningConnectionsForGrid(
      placed,
      definitions,
      "power",
      maxDistance
    );
    const waterConnections = this.getSpanningConnectionsForGrid(
      placed,
      definitions,
      "water",
      maxDistance
    );

    return [...powerConnections, ...waterConnections];
  }

  /**
   * Check if a specific building is connected to an active producer of a given grid type.
   */
  static isSupplied(
    buildingId: string,
    placed: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
    type: GridConnectionType,
    maxDistance: number = DEFAULT_MAX_GRID_DISTANCE
  ): boolean {
    const relevantNodes = this.getNodeInfos(placed, definitions).filter((n) =>
      type === "power" ? n.powerRole !== undefined : n.waterRole !== undefined
    );

    const targetNode = relevantNodes.find((n) => n.building.id === buildingId);
    if (!targetNode) return false;

    const role = type === "power" ? targetNode.powerRole : targetNode.waterRole;
    if (role === "producer") return true;

    // Use DSU to check if target node shares a component with any producer
    const candidateEdges = this.getCandidateEdges(placed, definitions, type, maxDistance);
    const dsu = new DisjointSet(relevantNodes.map((n) => n.building.id));

    for (const edge of candidateEdges) {
      dsu.union(edge.from.id, edge.to.id);
    }

    const targetRoot = dsu.find(buildingId);
    const producerNodes = relevantNodes.filter((n) =>
      (type === "power" ? n.powerRole : n.waterRole) === "producer"
    );

    return producerNodes.some((p) => dsu.find(p.building.id) === targetRoot);
  }

  /**
   * Returns network statistics for debugging and UI status overlays.
   */
  static getNetworkStats(
    placed: PlacedBuilding[],
    definitions: Record<string, BuildingDefinition>,
    maxDistance: number = DEFAULT_MAX_GRID_DISTANCE
  ): GridNetworkStats {
    const nodes = this.getNodeInfos(placed, definitions);

    const powerNodes = nodes.filter((n) => n.powerRole !== undefined);
    const waterNodes = nodes.filter((n) => n.waterRole !== undefined);

    const powerEdges = this.getCandidateEdges(placed, definitions, "power", maxDistance);
    const powerDsu = new DisjointSet(powerNodes.map((n) => n.building.id));
    for (const e of powerEdges) powerDsu.union(e.from.id, e.to.id);
    const powerClusters = new Set(powerNodes.map((n) => powerDsu.find(n.building.id))).size;

    const waterEdges = this.getCandidateEdges(placed, definitions, "water", maxDistance);
    const waterDsu = new DisjointSet(waterNodes.map((n) => n.building.id));
    for (const e of waterEdges) waterDsu.union(e.from.id, e.to.id);
    const waterClusters = new Set(waterNodes.map((n) => waterDsu.find(n.building.id))).size;

    const connections = this.getGridConnections(placed, definitions, maxDistance);

    return {
      powerNodesCount: powerNodes.length,
      powerProducersCount: powerNodes.filter((n) => n.powerRole === "producer").length,
      powerConsumersCount: powerNodes.filter((n) => n.powerRole === "consumer").length,
      powerStorageCount: powerNodes.filter((n) => n.powerRole === "storage").length,
      powerClustersCount: powerClusters,

      waterNodesCount: waterNodes.length,
      waterProducersCount: waterNodes.filter((n) => n.waterRole === "producer").length,
      waterConsumersCount: waterNodes.filter((n) => n.waterRole === "consumer").length,
      waterStorageCount: waterNodes.filter((n) => n.waterRole === "storage").length,
      waterClustersCount: waterClusters,

      totalConnectionsCount: connections.length,
    };
  }
}
