import { useEffect, useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { create } from "zustand";

import { nodeService, type NodeFilters } from "../services/nodeService";
import type { CO2Node } from "../types";

export const nodeKeys = {
  all: ["co2-nodes"] as const,
  list: (filters?: NodeFilters) => [...nodeKeys.all, filters ?? {}] as const,
};

// Groups loaded on demand.
export const DEFERRED_INDUSTRIES = ["greenhouse"] as const;

const useDeferredStore = create<{ loaded: ReadonlySet<string>; load: (industry: string) => void }>()((set) => ({
  loaded: new Set(),
  load: (industry) =>
    set((state) => (state.loaded.has(industry) ? state : { loaded: new Set([...state.loaded, industry]) })),
}));

/** Loads a deferred group. */
export const useLoadDeferredNodes = () => useDeferredStore((state) => state.load);

const STALE_MS = 5 * 60 * 1000;
const EMPTY: Record<string, number> = {};

/** The node catalogue. */
export const useNodesQuery = () => {
  const loaded = useDeferredStore((state) => state.loaded);
  const base = useQuery({
    queryKey: nodeKeys.list({ exclude_industry: DEFERRED_INDUSTRIES.join(",") }),
    queryFn: () => nodeService.getNodeList({ exclude_industry: DEFERRED_INDUSTRIES.join(",") }),
    staleTime: STALE_MS,
  });
  const deferred = useQueries({
    queries: DEFERRED_INDUSTRIES.map((industry) => ({
      queryKey: nodeKeys.list({ industry }),
      queryFn: () => nodeService.getNodes({ industry }),
      enabled: loaded.has(industry),
      staleTime: STALE_MS,
    })),
  });
  // Stable merged list.
  const groups = deferred.map((result) => result.data);
  const data: CO2Node[] | undefined = useMemo(
    () => (base.data ? [...base.data.items, ...groups.flatMap((group) => group ?? [])] : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base.data, ...groups],
  );
  return {
    data,
    isLoading: base.isLoading,
    isError: base.isError,
    // Unloaded group sizes.
    deferredCounts: base.data?.excluded ?? EMPTY,
    loadedGroups: loaded,
    isLoadingDeferred: deferred.some((result) => result.isFetching),
  };
};

/** Loads missing deferred nodes. */
export const useEnsureNodes = (ids: readonly number[]) => {
  const { data, loadedGroups } = useNodesQuery();
  const load = useLoadDeferredNodes();
  useEffect(() => {
    if (!data || ids.length === 0 || DEFERRED_INDUSTRIES.every((industry) => loadedGroups.has(industry))) return;
    const present = new Set(data.map((node) => node.id));
    if (ids.some((id) => !present.has(id))) {
      for (const industry of DEFERRED_INDUSTRIES) load(industry);
    }
  }, [data, ids, loadedGroups, load]);
};
