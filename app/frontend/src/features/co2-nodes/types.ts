// Facility, category, industry.

// Emitting categories.
export const EMITTER_CATEGORIES = [
  "bioenergy",
  "biogas",
  "cement",
  "chemicals",
  "coal_power",
  "emitter",
  "fossil_power",
  "gas_power",
  "gas_processing",
  "glass",
  "industry",
  "iron_and_steel",
  "pulp_and_paper",
  "refinery",
  "waste_to_energy",
] as const;

// Absorbing categories.
export const SINK_CATEGORIES = ["storage", "utilisation"] as const;

// STORE_CO2 sink kinds.
export const SINK_KINDS = [
  "storage",
  "greenhouse",
  "brewery",
  "ccu_chemicals",
  "urea",
  "mineralization",
  "utilisation",
] as const;

// Transport switches.
export const TRANSPORT_CATEGORIES = ["transport"] as const;

export const NODE_CATEGORIES = [
  ...EMITTER_CATEGORIES,
  ...SINK_CATEGORIES,
  ...TRANSPORT_CATEGORIES,
] as const;

/** The node_type column. */
export type NodeCategory = (typeof NODE_CATEGORIES)[number];

export interface CO2Node {
  id: number;
  node_id: string;
  node_name: string;
  longitude: number;
  latitude: number;
  altitude: number | null;
  annual_flux: number | null;
  node_type: NodeCategory;
  industry?: string | null;
  country_code: string | null;
  state?: string | null;
  municipality?: string | null;
  nuts1?: string | null;
  nuts2?: string | null;
  nuts3?: string | null;
  rural?: boolean | null;
  /** First operating year. */
  operating_from?: number | null;
  /** First year stopped. */
  operating_until?: number | null;
  retired?: boolean;
  source: string;
  metadata?: Record<string, unknown>;
}

export const isEmitterCategory = (category: string): boolean =>
  (EMITTER_CATEGORIES as readonly string[]).includes(category);

export const isSinkCategory = (category: string): boolean =>
  (SINK_CATEGORIES as readonly string[]).includes(category) ||
  (SINK_KINDS as readonly string[]).includes(category);

export const isEmitter = (node: CO2Node): boolean => isEmitterCategory(node.node_type);

export const isSink = (node: CO2Node): boolean => isSinkCategory(node.node_type);

export const isTransport = (node: CO2Node): boolean =>
  (TRANSPORT_CATEGORIES as readonly string[]).includes(node.node_type);

/** Selector group key. */
export const nodeCategory = (node: CO2Node): string =>
  node.node_type === "utilisation" &&
  node.industry &&
  (SINK_KINDS as readonly string[]).includes(node.industry)
    ? node.industry
    : node.node_type;
