import axios from "@/lib/axios";

import type { CO2Node } from "../types";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface NodeFilters {
  country?: string;
  node_type?: string;
  industry?: string;
  exclude_industry?: string;
  search?: string;
}

export interface NodeList {
  items: CO2Node[];
  total: number;
  /** Excluded per industry. */
  excluded?: Record<string, number>;
}

export const nodeService = {
  async refreshSources(): Promise<{ imported: number; source_total: number }> {
    const { data } = await axios.post<ApiResponse<{ imported: number; source_total: number }>>(
      "/co2-nodes/import", { all: true }, { timeout: 120_000 },
    );
    return data.data;
  },

  async getNode(id: number): Promise<CO2Node> {
    const { data } = await axios.get<ApiResponse<CO2Node>>(`/co2-nodes/${id}`);
    return data.data;
  },
  // List catalogue nodes.
  async getNodes(filters?: NodeFilters): Promise<CO2Node[]> {
    return (await this.getNodeList(filters)).items;
  },

  async getNodeList(filters?: NodeFilters): Promise<NodeList> {
    const { data } = await axios.get<ApiResponse<NodeList>>("/co2-nodes", { params: filters });
    return data?.data ?? { items: [], total: 0 };
  },
};

export interface CO2Route {
  id: number;
  model_id: number;
  from_node_id: string;
  to_node_id: string;
  mode: string;
  distance_km?: number;
  average_resistance?: number;
  cost_eur_per_t_km?: number;
  capex_eur?: number;
  metadata?: Record<string, unknown>;
}

export type TransportMode = "pipeline" | "truck" | "railway";

export interface RoutingInputs {
  modes: TransportMode[];
  /** Capacity-aware assignment. */
  optimize: boolean;
}

export interface RunResult {
  run_id: string;
  status: "running" | "completed" | "failed";
  error?: string;
  jobs: Array<{
    stage: string;
    job: {
      job_id: string;
      stage: string;
      status: string;
      error?: string;
      summary?: Record<string, unknown>;
    };
  }>;
  routes: CO2Route[];
  /** Why not routed. */
  notes?: string[];
}

export const routeService = {
  async start(modelId: number | undefined, nodeIds: number[], inputs: RoutingInputs): Promise<RunResult> {
    const { data } = await axios.post<ApiResponse<RunResult>>(
      modelId ? `/models/${modelId}/routing/run` : "/routing/preview",
      { node_ids: nodeIds, ...inputs },
    );
    return data.data;
  },

  async status(runId: string): Promise<RunResult> {
    const { data } = await axios.get<ApiResponse<RunResult>>(`/routing/runs/${runId}`);
    return data.data;
  },

  async cancel(runId: string): Promise<void> {
    await axios.delete(`/routing/runs/${runId}`);
  },

  async workbook(runId: string): Promise<Blob> {
    const { data } = await axios.get<Blob>(`/routing/runs/${runId}/workbook`, { responseType: "blob" });
    return data;
  },

  async getRoutes(modelId: number): Promise<CO2Route[]> {
    const { data } = await axios.get<ApiResponse<{ routes: CO2Route[] }>>(
      `/models/${modelId}/routing/routes`,
    );
    return data?.data?.routes ?? [];
  },
};

// Full catalogue record.
export interface CO2PointSource {
  [field: string]: unknown;
  entity_id: string;
  name: string | null;
  operator: string | null;
  country: string | null;
  state: string | null;
  municipality: string | null;
  latitude: number | null;
  longitude: number | null;
  co2_t_annual: number | null;
  capacity_mw: number | null;
  granularity: string | null;
  industry: string | null;
  capture_group: string | null;
  capture_application: string | null;
  technology: string | null;
  fuel: string | null;
  source_class: string | null;
  co2_source: string | null;
  status: string | null;
  co2_year: number | null;
  commissioning_year: number | null;
  co2_is_estimated: boolean | null;
}

export interface PointSourceFilters {
  country?: string;
  capture_group?: string;
  status?: string;
  min_co2_t?: number;
  bbox?: string;
  search?: string;
  with_coordinates?: boolean;
  dataset_version?: string;
  limit?: number;
  offset?: number;
}

export interface PointSourcePage {
  items: CO2PointSource[];
  total: number;
  limit: number;
  offset: number;
  has_more?: boolean;
  dataset_version?: string;
}

export interface SourceStats {
  total_sources: number;
  with_coordinates: number;
  by_country: Array<{ country: string; sources: number; co2_t_annual: number | null }>;
  by_capture_group: Array<{ capture_group: string | null; sources: number; co2_t_annual: number | null }>;
  by_status?: Array<{ status: string | null; sources: number; co2_t_annual: number | null }>;
}

/** One capture case. */
export interface CaptureCase {
  [field: string]: unknown;
  capture_application: string | null;
  capture_technology: string | null;
  is_primary_application: boolean | null;
  horizon_year: number | null;
  cost_case: "low" | "central" | "high" | null;
  maturity_case: "noak" | "foak_100" | "foak_200" | null;
  co2_capturable_t_annual: number | null;
  capture_rate: number | null;
  lcoc_eur_per_t: number | null;
}

/** STORE_CO2 catalogue proxy. */
export const sourceService = {
  // Page the catalogue.
  async getPointSources(filters?: PointSourceFilters): Promise<PointSourcePage> {
    const { data } = await axios.get<ApiResponse<PointSourcePage>>("/co2-sources", {
      params: filters,
    });
    return data?.data ?? { items: [], total: 0, limit: 0, offset: 0 };
  },

  // One facility.
  async getPointSource(entityId: string): Promise<CO2PointSource | null> {
    const { data } = await axios.get<ApiResponse<CO2PointSource>>("/co2-sources/detail", {
      params: { id: entityId },
    });
    return data?.data ?? null;
  },

  // Emitter capture cases.
  async getCapture(entityId: string): Promise<CaptureCase[]> {
    const { data } = await axios.get<ApiResponse<{ cases: CaptureCase[] }>>("/co2-sources/capture", {
      params: { id: entityId },
    });
    return data?.data?.cases ?? [];
  },

  // Dataset summary.
  async getStats(): Promise<SourceStats | null> {
    const { data } = await axios.get<ApiResponse<SourceStats>>("/co2-sources/stats");
    return data?.data ?? null;
  },

  // Type taxonomy.
  async getNodeTypes(): Promise<string[]> {
    const { data } = await axios.get<ApiResponse<{ node_types: string[] }>>(
      "/co2-sources/node-types",
    );
    return data?.data?.node_types ?? [];
  },
};
