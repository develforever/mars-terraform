export type ApiPath = `/api/${string}`;

const ALLOWED_PROTOCOLS: readonly string[] = ["http:", "https:"];

/**
 * Resolves the base URL of the backend API from `VITE_API_URL`.
 * Empty or missing value returns `""`, so requests stay relative (Vite dev proxy / monolith).
 * Otherwise returns `origin + pathname` without a trailing slash, e.g. `https://api.example.com/base`.
 * Throws when the value is not an absolute http(s) URL or contains a query string or hash.
 */
export const getApiBaseUrl = (env: string | undefined = import.meta.env.VITE_API_URL): string => {
  const raw = env?.trim() ?? "";
  if (raw === "") return "";

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid VITE_API_URL "${raw}": expected an absolute URL such as https://api.example.com`);
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    throw new Error(`Invalid VITE_API_URL "${raw}": protocol must be http or https, got "${url.protocol}"`);
  }
  if (url.search !== "" || url.hash !== "") {
    throw new Error(`Invalid VITE_API_URL "${raw}": query string and hash are not allowed`);
  }

  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
};

/** Builds the full URL of an API endpoint, e.g. `apiUrl("/api/maps")`. */
export const apiUrl = (path: ApiPath): string => `${getApiBaseUrl()}${path}`;
