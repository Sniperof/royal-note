const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function resolveStorageUrl(path?: string | null) {
  const raw = path?.trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const normalized = raw.startsWith("/") ? raw : `/${raw}`;

  if (normalized.startsWith("/api/storage/") || normalized.startsWith("/api/")) {
    return `${BASE_URL}${normalized}`;
  }

  if (
    normalized.startsWith("/objects/") ||
    normalized.startsWith("/public-objects/") ||
    normalized.startsWith("/local-uploads/")
  ) {
    return `${BASE_URL}/api/storage${normalized}`;
  }

  for (const marker of ["/objects/", "/public-objects/", "/local-uploads/"] as const) {
    const markerIndex = normalized.indexOf(marker);
    if (markerIndex >= 0) {
      return `${BASE_URL}/api/storage${normalized.slice(markerIndex)}`;
    }
  }

  return `${BASE_URL}/api/storage${normalized}`;
}
