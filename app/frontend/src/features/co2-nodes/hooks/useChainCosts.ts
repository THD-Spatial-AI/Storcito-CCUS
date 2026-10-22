import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { nodeService, type CO2Route } from "../services/nodeService";
import { isEmitter, isSink, type CO2Node } from "../types";
import { useNodeFilterStore, type AssessmentPeriod } from "../stores/nodeFilterStore";
import { useNodesQuery } from "./useNodesQuery";

/** Low–high €/t range. */
export interface CostRange {
  low: number;
  high: number;
}

/** Chain cost per route. */
export interface ChainCost {
  capture: CostRange | null;
  liquefaction: CostRange | null;
  transport: CostRange | null;
  storage: CostRange | null;
  total: CostRange | null;
}

const CONTAINER_MODES = new Set(["truck", "railway"]);

const range = (record: Record<string, unknown> | undefined, prefix: string): CostRange | null => {
  const low = record?.[`${prefix}_low`];
  const high = record?.[`${prefix}_high`];
  return typeof low === "number" && typeof high === "number" ? { low, high } : null;
};

type Fields = Record<string, unknown>;

/** Interpolated yearly value. */
const atYear = (byYear: Record<string, Fields | null>, prefix: string, year: number): CostRange | null => {
  const points = Object.entries(byYear)
    .map(([key, value]) => [Number(key), range(value ?? undefined, prefix)] as const)
    .filter((point): point is readonly [number, CostRange] => point[1] !== null)
    .sort((a, b) => a[0] - b[0]);
  if (points.length === 0) return null;
  if (year <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (year >= last[0]) return last[1];
  const upper = points.findIndex(([at]) => at >= year);
  const [y0, v0] = points[upper - 1];
  const [y1, v1] = points[upper];
  const share = (year - y0) / (y1 - y0);
  return { low: v0.low + (v1.low - v0.low) * share, high: v0.high + (v1.high - v0.high) * share };
};

/** Mean over operating years. */
const overPeriod = (
  byYear: Record<string, Fields | null>,
  prefix: string,
  period: AssessmentPeriod,
  node: CO2Node,
): CostRange | null => {
  const from = Math.max(period.start, node.operating_from ?? period.start);
  const to = Math.min(period.end, (node.operating_until ?? period.end + 1) - 1);
  const values: CostRange[] = [];
  for (let year = from; year <= to; year += 1) {
    const value = atYear(byYear, prefix, year);
    if (value) values.push(value);
  }
  if (values.length === 0) return null;
  return {
    low: values.reduce((total, value) => total + value.low, 0) / values.length,
    high: values.reduce((total, value) => total + value.high, 0) / values.length,
  };
};

const sum = (parts: (CostRange | null)[]): CostRange | null =>
  parts.some((part) => part === null)
    ? null
    : parts.reduce<CostRange>((acc, part) => ({ low: acc.low + part!.low, high: acc.high + part!.high }), { low: 0, high: 0 });

/** Full-chain cost per tonne. */
export const useChainCosts = (routes: CO2Route[]) => {
  const { data: nodes = [] } = useNodesQuery();
  const period = useNodeFilterStore((state) => state.period);

  const ends = useMemo(() => {
    const byNodeID = new Map<string, CO2Node>(nodes.map((node) => [node.node_id, node]));
    const picked = new Map<number, CO2Node>();
    for (const route of routes) {
      for (const id of [route.from_node_id, route.to_node_id]) {
        const node = byNodeID.get(id);
        if (node?.source === "store_co2") picked.set(node.id, node);
      }
    }
    return { byNodeID, picked: [...picked.values()] };
  }, [nodes, routes]);

  // From node records.
  const details = useQueries({
    queries: ends.picked.map((node) => ({
      queryKey: ["co2-node-detail", node.id],
      queryFn: async () => (await nodeService.getNode(node.id)).metadata ?? null,
      staleTime: 5 * 60 * 1000,
    })),
  });

  return useMemo(() => {
    const metadata = new Map<string, Record<string, unknown>>();
    ends.picked.forEach((node, index) => {
      const data = details[index]?.data;
      if (data) metadata.set(node.node_id, data);
    });

    return (route: CO2Route): ChainCost => {
      const from = ends.byNodeID.get(route.from_node_id);
      const to = ends.byNodeID.get(route.to_node_id);
      const emitter = [from, to].find((node) => node && isEmitter(node));
      const sink = [from, to].find((node) => node && isSink(node));
      const record = emitter ? metadata.get(emitter.node_id) : undefined;
      const chain = record?.chain as Fields | undefined;
      const byYear = record?.chain_by_year as Record<string, Fields | null> | undefined;
      const container = CONTAINER_MODES.has(route.mode);
      // Period, else 2030.
      const cost = (prefix: string): CostRange | null =>
        period && byYear && emitter ? overPeriod(byYear, prefix, period, emitter) : range(chain, prefix);

      const capture = cost("capture_eur_per_t");
      const liquefaction = container ? cost("liquefaction_eur_per_t") : null;
      const tariff = route.metadata?.gamma2_eur_per_t;
      const transport = container && typeof tariff === "number" ? { low: tariff, high: tariff } : null;
      const storage = sink ? range(metadata.get(sink.node_id), "storage_eur_per_t") : null;
      const total = container ? sum([capture, liquefaction, transport, storage]) : null;
      return { capture, liquefaction, transport, storage, total };
    };
  }, [ends, details, period]);
};
