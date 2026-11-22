import { mkdtempSync, rmSync, writeFileSync } from "fs";
import type { NetworkInterfaceInfo } from "os";
import { tmpdir } from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { createServer } from "net";
import { frontendBuilt, hostBanner, lanAddresses, portInUse, portInUseMessage } from "./hostInfo";

const iface = (address: string, family: "IPv4" | "IPv6", internal = false): NetworkInterfaceInfo =>
  ({ address, family, internal, netmask: "", mac: "", cidr: null }) as NetworkInterfaceInfo;

describe("hostInfo (F9-T7)", () => {
  it("lanAddresses: tylko IPv4 spoza loopback i link-local, bez duplikatów", () => {
    expect(
      lanAddresses({
        lo: [iface("127.0.0.1", "IPv4", true), iface("::1", "IPv6", true)],
        eth0: [iface("192.168.100.33", "IPv4"), iface("fe80::1", "IPv6")],
        wifi: [iface("10.0.0.5", "IPv4"), iface("169.254.10.1", "IPv4")],
        dup: [iface("192.168.100.33", "IPv4")],
        empty: undefined,
      }),
    ).toEqual(["192.168.100.33", "10.0.0.5"]);
  });

  it("baner: adres lokalny, adresy LAN i podpowiedź tunelu", () => {
    const lines = hostBanner({ port: 3000, addresses: ["192.168.100.33"], serveFrontend: true, frontendBuilt: true });
    const text = lines.join("\n");
    expect(text).toContain("http://localhost:3000");
    expect(text).toContain("http://192.168.100.33:3000");
    expect(text).toContain("cloudflared tunnel --url http://localhost:3000");
    expect(text).toContain("HOSTING.md");
    expect(text).not.toContain("not built");
  });

  it("baner ostrzega, gdy frontend nie jest zbudowany", () => {
    const text = hostBanner({ port: 4000, addresses: [], serveFrontend: true, frontendBuilt: false }).join("\n");
    expect(text).toContain("Frontend not built");
    expect(text).toContain("npm run host");
  });

  it("tryb API-only nie podaje linków do gry", () => {
    const text = hostBanner({ port: 3000, addresses: ["10.0.0.5"], serveFrontend: false, frontendBuilt: true }).join("\n");
    expect(text).toContain("API-only");
    expect(text).not.toContain("http://10.0.0.5");
  });

  it("frontendBuilt sprawdza dist/index.html", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mars-host-"));
    try {
      expect(frontendBuilt(dir)).toBe(false);
      writeFileSync(path.join(dir, "index.html"), "<!doctype html>");
      expect(frontendBuilt(dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("portInUse wykrywa zajęty port, zanim drugi serwer przejmie go po cichu (Windows)", async () => {
    const server = createServer((socket) => socket.end());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as { port: number };
    try {
      expect(await portInUse(port)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    expect(await portInUse(port)).toBe(false);
    expect(portInUseMessage(3000)).toContain("PORT=3001");
  });
});

