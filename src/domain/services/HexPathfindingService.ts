import type { HexGrid, HexCell } from "../../presentation/generator/hex/HexGrid";
import { hexNeighbors, hexDistance, hexKey } from "../../presentation/generator/hex/HexMath";

export interface PathfindingOptions {
  maxClimb?: number;
  blockedUserTypes?: string[];
}

interface PathNode {
  key: string;
  q: number;
  r: number;
  g: number;
  f: number;
}

class MinHeap {
  private heap: PathNode[] = [];

  push(node: PathNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): PathNode | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0 && bottom !== undefined) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  size(): number {
    return this.heap.length;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[index].f >= this.heap[parentIndex].f) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < length && this.heap[leftChild].f < this.heap[smallest].f) {
        smallest = leftChild;
      }
      if (rightChild < length && this.heap[rightChild].f < this.heap[smallest].f) {
        smallest = rightChild;
      }
      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

export class HexPathfindingService {
  /**
   * Evaluates if movement between two adjacent hex cells is passable.
   * Checks for blocked user types and maximum climbable cliff height difference.
   */
  static isPassable(
    fromCell: HexCell,
    toCell: HexCell,
    options?: PathfindingOptions,
  ): boolean {
    const maxClimb = options?.maxClimb ?? 0.85;
    const blockedUserTypes = options?.blockedUserTypes ?? ["blocked"];

    if (toCell.userType && blockedUserTypes.includes(toCell.userType)) {
      return false;
    }

    const heightDiff = Math.abs(fromCell.worldY - toCell.worldY);
    if (heightDiff > maxClimb + 1e-5) {
      return false;
    }

    return true;
  }

  /**
   * Deterministic A* pathfinding algorithm on axial hex grid.
   * Considers cell existence, worldY cliff height difference (maxClimb), and blocked userTypes.
   */
  static findPath(
    grid: HexGrid,
    start: [number, number],
    target: [number, number],
    options?: PathfindingOptions,
  ): [number, number][] | null {
    const blockedUserTypes = options?.blockedUserTypes ?? ["blocked"];

    const [startQ, startR] = start;
    const [targetQ, targetR] = target;

    const startCell = grid.getCell(startQ, startR);
    const targetCell = grid.getCell(targetQ, targetR);

    if (!startCell || !targetCell) {
      return null;
    }

    if (
      (startCell.userType && blockedUserTypes.includes(startCell.userType)) ||
      (targetCell.userType && blockedUserTypes.includes(targetCell.userType))
    ) {
      return null;
    }

    if (startQ === targetQ && startR === targetR) {
      return [[startQ, startR]];
    }

    const openSet = new MinHeap();
    const gScore = new Map<string, number>();
    const cameFrom = new Map<string, [number, number]>();

    const startKey = hexKey(startQ, startR);
    const startH = hexDistance(startQ, startR, targetQ, targetR);

    gScore.set(startKey, 0);
    openSet.push({
      key: startKey,
      q: startQ,
      r: startR,
      g: 0,
      f: startH,
    });

    while (openSet.size() > 0) {
      const current = openSet.pop();
      if (!current) break;

      // Found target! Reconstruct path.
      if (current.q === targetQ && current.r === targetR) {
        const path: [number, number][] = [];
        let currKey: string | undefined = current.key;
        let currCoords: [number, number] | undefined = [current.q, current.r];

        while (currCoords) {
          path.push(currCoords);
          currCoords = cameFrom.get(currKey);
          if (currCoords) {
            currKey = hexKey(currCoords[0], currCoords[1]);
          }
        }
        path.reverse();
        return path;
      }

      const currentCell = grid.getCell(current.q, current.r);
      if (!currentCell) continue;

      const currentG = gScore.get(current.key) ?? Infinity;

      for (const [neighborQ, neighborR] of hexNeighbors(current.q, current.r)) {
        const neighborCell = grid.getCell(neighborQ, neighborR);
        if (!neighborCell) continue;

        if (!this.isPassable(currentCell, neighborCell, options)) {
          continue;
        }

        const heightDiff = Math.abs(currentCell.worldY - neighborCell.worldY);
        const stepCost = 1 + heightDiff;
        const tentativeG = currentG + stepCost;
        const neighborKey = hexKey(neighborQ, neighborR);

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, [current.q, current.r]);
          gScore.set(neighborKey, tentativeG);
          const h = hexDistance(neighborQ, neighborR, targetQ, targetR);
          openSet.push({
            key: neighborKey,
            q: neighborQ,
            r: neighborR,
            g: tentativeG,
            f: tentativeG + h,
          });
        }
      }
    }

    return null;
  }
}
