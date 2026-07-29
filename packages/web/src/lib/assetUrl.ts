const API_ORIGIN = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/**
 * Uploads are stored as host-relative paths (`/uploads/…`) but served by the
 * API, which is a different origin from the dev server — so they need the API
 * origin prepended before they can be used as an <img> src.
 */
const ABSOLUTE_PREFIXES = ['http://', 'https://', 'blob:', 'data:'];

export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  // blob:/data: cover locally-previewed files that haven't been uploaded yet —
  // prefixing those with the API origin would break the preview.
  if (ABSOLUTE_PREFIXES.some((prefix) => path.startsWith(prefix))) return path;
  return `${API_ORIGIN}${path}`;
}
