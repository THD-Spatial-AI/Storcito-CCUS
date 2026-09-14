// Shared viewer types.

export interface ModelResult {
  id: number;
  model_id: number;
  geoserver_status: string;
}

export interface LayerBounds {
  minx: number;
  miny: number;
  maxx: number;
  maxy: number;
  crs?: string;
}

export interface AvailableLayer {
  key: string;
  title: string;
  layer_name: string;
}

export interface LayerInfo {
  wms_url: string;
  layer_name: string;
  status: string;
  bounds?: LayerBounds;
  available_layers?: AvailableLayer[];
}

export const EPSG_32629 = "EPSG:32629";
export const POLL_INTERVAL_MS = 10_000;
// Applied once here.
export const RESULT_DEFAULT_OPACITY = 0.7;
export const RESULT_STYLE_VERSION = "result-style-v7";
export const MAP_REFERENCE_DARK_OPACITY = 0.95;
export const MAP_REFERENCE_LIGHT_ROADS_OPACITY = 0.82;
export const MAP_REFERENCE_LIGHT_LABELS_OPACITY = 0.62;
// Transparent transportation overlay.
export const ESRI_TRANSPORTATION_REFERENCE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}";
export const ESRI_PLACES_REFERENCE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
export const ESRI_ATTRIBUTION = "© 2026, Deggendorf Institute of Technology | Esri contribution";

