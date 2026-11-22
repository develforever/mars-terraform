import { describe, expect, it, vi } from "vitest";
import { createEntityId, uuidFromRandomBytes, type EntityIdCrypto } from "./entityId";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("createEntityId (F9-T7: gra w LAN po http)", () => {
  it("używa crypto.randomUUID, gdy jest dostępne", () => {
    const source: EntityIdCrypto = { randomUUID: vi.fn(() => "uuid-z-przegladarki"), getRandomValues: vi.fn() };
    expect(createEntityId(source)).toBe("uuid-z-przegladarki");
    expect(source.getRandomValues).not.toHaveBeenCalled();
  });

  it("bez bezpiecznego kontekstu (brak randomUUID) składa UUID v4 z getRandomValues", () => {
    const insecure: EntityIdCrypto = { getRandomValues: (array) => globalThis.crypto.getRandomValues(array) };
    const ids = new Set(Array.from({ length: 200 }, () => createEntityId(insecure)));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  it("ustawia bity wersji i wariantu niezależnie od losowych bajtów", () => {
    const allOnes: EntityIdCrypto = {
      getRandomValues: (array) => array.fill(0xff),
    };
    expect(uuidFromRandomBytes(allOnes)).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });

  it("domyślnie działa w bieżącym środowisku", () => {
    expect(createEntityId()).toMatch(UUID_V4);
  });
});
