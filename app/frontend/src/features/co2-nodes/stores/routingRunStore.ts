import { create } from "zustand";

import {
  routeService,
  type CO2Route,
  type RoutingInputs,
  type RunResult,
} from "../services/nodeService";

const POLL_INTERVAL_MS = 1000;

const DEFAULT_INPUTS: RoutingInputs = {
  modes: ["pipeline", "truck", "railway"],
  networks: [],
  network_countries: [],
  railway_country: "NL",
  station_radius_km: 5,
};

function errorMessage(error: unknown): string {
  const payload = (error as { response?: { data?: { error?: string } } })?.response?.data;
  return payload?.error ?? (error instanceof Error ? error.message : "The CO2RouteX run failed.");
}

/** One run, shared across steps. */
interface RoutingRunStore {
  inputs: RoutingInputs;
  routes: CO2Route[] | null;
  result: RunResult | null;
  isRunning: boolean;
  error: string | null;
  setInputs: (inputs: RoutingInputs) => void;
  start: (modelId: number | undefined, selectedIds: number[]) => Promise<void>;
  cancel: () => Promise<void>;
  loadSaved: (modelId: number) => Promise<void>;
  reset: () => void;
}

// Guards stale polls.
let generation = 0;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let activeRun: string | null = null;

const stopPolling = () => {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = undefined;
};

export const useRoutingRunStore = create<RoutingRunStore>()((set, get) => {
  const poll = async (runId: string, current: number) => {
    try {
      const next = await routeService.status(runId);
      if (current !== generation) return;
      set({ result: next });
      if (next.status === "running") {
        pollTimer = setTimeout(() => void poll(runId, current), POLL_INTERVAL_MS);
        return;
      }
      activeRun = null;
      set({ isRunning: false, routes: next.routes, error: next.error ?? null });
    } catch (caught) {
      if (current !== generation) return;
      activeRun = null;
      set({ isRunning: false, error: errorMessage(caught) });
    }
  };

  return {
    inputs: { ...DEFAULT_INPUTS },
    routes: null,
    result: null,
    isRunning: false,
    error: null,

    setInputs: (inputs) => set({ inputs, routes: null, result: null, error: null }),

    start: async (modelId, selectedIds) => {
      const current = ++generation;
      stopPolling();
      set({ isRunning: true, error: null, routes: null, result: null });
      try {
        const next = await routeService.start(modelId, selectedIds, get().inputs);
        if (current !== generation) {
          await routeService.cancel(next.run_id).catch(() => {});
          return;
        }
        activeRun = next.run_id;
        set({ result: next });
        pollTimer = setTimeout(() => void poll(next.run_id, current), POLL_INTERVAL_MS);
      } catch (caught) {
        if (current !== generation) return;
        set({ isRunning: false, error: errorMessage(caught) });
      }
    },

    cancel: async () => {
      if (!activeRun) return;
      const runId = activeRun;
      activeRun = null;
      generation++;
      stopPolling();
      set({ isRunning: false });
      try {
        await routeService.cancel(runId);
      } catch (caught) {
        set({ error: errorMessage(caught) });
      }
    },

    loadSaved: async (modelId) => {
      const current = generation;
      try {
        const saved = await routeService.getRoutes(modelId);
        if (current === generation && saved.length) set({ routes: saved });
      } catch (caught) {
        if (current === generation) set({ error: errorMessage(caught) });
      }
    },

    reset: () => {
      generation++;
      stopPolling();
      if (activeRun) void routeService.cancel(activeRun).catch(() => {});
      activeRun = null;
      set({ routes: null, result: null, isRunning: false, error: null });
    },
  };
});

/** Costed routes only. */
export const costedRoutes = (routes: CO2Route[] | null): CO2Route[] =>
  (routes ?? []).filter(
    (route) => route.cost_eur_per_t_km !== undefined || route.capex_eur !== undefined,
  );
