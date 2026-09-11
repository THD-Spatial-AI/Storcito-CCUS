import { useQuery } from "@tanstack/react-query";

import { nodeService, type NodeFilters } from "../services/nodeService";

export const nodeKeys = {
  all: ["co2-nodes"] as const,
  list: (filters?: NodeFilters) => [...nodeKeys.all, filters ?? {}] as const,
};

export const useNodesQuery = (filters?: NodeFilters) =>
  useQuery({
    queryKey: nodeKeys.list(filters),
    queryFn: () => nodeService.getNodes(filters),
    staleTime: 5 * 60 * 1000,
  });
