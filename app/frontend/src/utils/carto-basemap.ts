const CARTO_BASEMAP_API_KEY =
  import.meta.env.VITE_CARTO_BASEMAP_API_KEY?.trim() ?? "";

/** CARTO CDN only. */
export function isCartoBasemapUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "cartocdn.com" || hostname.endsWith(".cartocdn.com");
  } catch {
    return false;
  }
}

/** Append CARTO key. */
export function withCartoBasemapKey(
  url: string,
  apiKey: string = CARTO_BASEMAP_API_KEY,
): string {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey || !isCartoBasemapUrl(url) || /[?&]key=/i.test(url)) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}key=${encodeURIComponent(normalizedKey)}`;
}
