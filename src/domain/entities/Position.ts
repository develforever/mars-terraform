export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface GridCell {
  x: number;
  z: number;
}

export function keyFromCell(x: number, z: number): string {
  const ix = Math.round(x) || 0;
  const iz = Math.round(z) || 0;
  return `${ix},${iz}`;
}

export function cellFromKey(key: string): GridCell {
  const [x, z] = key.split(',').map(Number);
  return { x, z };
}
