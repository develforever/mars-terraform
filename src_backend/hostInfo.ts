import { existsSync } from "fs";
import { connect } from "net";
import { networkInterfaces, type NetworkInterfaceInfo } from "os";
import path from "path";

/**
 * Informacje startowe dla gospodarza (F9-T7): pod jakimi adresami gracze znajdą serwer gry. Wypisuje tylko adresy
 * tego komputera (lokalnie u gospodarza); żadnych danych graczy.
 */

type Interfaces = NodeJS.Dict<NetworkInterfaceInfo[]>;

/** Adresy IPv4 w sieci lokalnej (bez loopback i adresów link-local 169.254.x.x). */
export const lanAddresses = (interfaces: Interfaces = networkInterfaces()): string[] => {
  const addresses = new Set<string>();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal || entry.address.startsWith("169.254.")) continue;
      addresses.add(entry.address);
    }
  }
  return [...addresses];
};

export const frontendBuilt = (distPath: string): boolean => existsSync(path.join(distPath, "index.html"));

export interface HostBannerOptions {
  readonly port: number;
  readonly addresses: readonly string[];
  readonly serveFrontend: boolean;
  readonly frontendBuilt: boolean;
}

export const hostBanner = ({ port, addresses, serveFrontend, frontendBuilt }: HostBannerOptions): string[] => {
  const lines = [`🚀 Mars Terraform server on port ${port}`];
  if (!serveFrontend) {
    lines.push("   API-only mode (serve_frontend=false): no game page and no invite link here.");
    return lines;
  }
  if (!frontendBuilt) {
    lines.push("   ⚠ Frontend not built (dist/index.html missing): run `npm run host` or `npm run build` first.");
  }
  lines.push(`   This computer:   http://localhost:${port}`);
  for (const address of addresses) {
    lines.push(`   Local network:   http://${address}:${port}`);
  }
  lines.push(`   Internet:        start a tunnel, e.g. \`cloudflared tunnel --url http://localhost:${port}\``);
  lines.push("   Guide: HOSTING.md");
  return lines;
};

/**
 * Czy coś już nasłuchuje na porcie (np. serwer uruchomiony wcześniej). Na Windows drugi proces potrafi otworzyć
 * ten sam port bez `EADDRINUSE`, a ruch dalej trafia do pierwszego - gospodarz grałby wtedy na starej wersji.
 */
export const portInUse = (port: number, host = "127.0.0.1", timeoutMs = 1000): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = connect({ port, host });
    const finish = (inUse: boolean): void => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });

export const portInUseMessage = (port: number): string =>
  `✗ Port ${port} is already in use (another Mars Terraform server or another app?). ` +
  `Stop it or start on another port, e.g. PORT=${port + 1} npm start.`;
