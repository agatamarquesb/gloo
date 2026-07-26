const API_ORIGIN = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/**
 * Uploads are stored as host-relative paths (`/uploads/…`) but served by the
 * API, which is a different origin from the dev server — so they need the API
 * origin prepended before they can be used as an <img> src.
 */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_ORIGIN}${path}`;
}
