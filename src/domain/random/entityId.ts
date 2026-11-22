/**
 * Losowy identyfikator encji (UUID v4). F9-T7: `crypto.randomUUID()` istnieje tylko w bezpiecznym kontekście
 * (https albo localhost), a gra w LAN działa po `http://192.168.x.x`, więc wtedy UUID składamy z
 * `crypto.getRandomValues()`, które jest dostępne zawsze.
 */
export interface EntityIdCrypto {
  randomUUID?: () => string;
  getRandomValues(array: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>;
}

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

export const uuidFromRandomBytes = (source: EntityIdCrypto): string => {
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // wersja 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // wariant RFC 4122
  const h = Array.from(bytes, (b) => HEX[b]);
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h.slice(10).join("")}`;
};

export const createEntityId = (source: EntityIdCrypto = globalThis.crypto): string =>
  typeof source.randomUUID === "function" ? source.randomUUID() : uuidFromRandomBytes(source);
