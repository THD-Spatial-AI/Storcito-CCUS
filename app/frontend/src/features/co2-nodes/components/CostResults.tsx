import { useMemo, type FC } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";

import { useChainCosts, type CostRange } from "../hooks/useChainCosts";
import { useNodesQuery } from "../hooks/useNodesQuery";
import type { CO2Route } from "../services/nodeService";
import { useNodeFilterStore } from "../stores/nodeFilterStore";
import { costedRoutes, useRoutingRunStore } from "../stores/routingRunStore";
import { formatNumber } from "../utils/format";

// Compact cells.
const CELL = "px-2 py-1.5 align-top";

const formatRange = (value: CostRange | null): string =>
  value === null
    ? "—"
    : Math.abs(value.high - value.low) < 0.05
      ? `€${formatNumber(value.low, 1)}`
      : `€${formatNumber(value.low, 1)}–${formatNumber(value.high, 1)}`;

/** Run costs. */
export const CostResults: FC = () => {
  const { t } = useTranslation();
  const routes = useRoutingRunStore((state) => state.routes);
  const isRunning = useRoutingRunStore((state) => state.isRunning);
  const error = useRoutingRunStore((state) => state.error);
  const allCosted = useMemo(() => costedRoutes(routes), [routes]);
  const chainCost = useChainCosts(allCosted);
  const { data: nodes = [] } = useNodesQuery();
  // Prefer facility names.
  const nameOf = useMemo(() => {
    const names = new Map(nodes.map((node) => [node.node_id, node.node_name]));
    return (id: string) => names.get(id) || id;
  }, [nodes]);
  const period = useNodeFilterStore((state) => state.period);

  const byMode = useMemo(() => {
    const grouped = new Map<string, CO2Route[]>();
    for (const route of allCosted) {
      const list = grouped.get(route.mode) ?? [];
      list.push(route);
      grouped.set(route.mode, list);
    }
    return [...grouped.entries()];
  }, [allCosted]);

  if (isRunning) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("co2Costs.running", "The run is still going — costs appear once routing finishes.")}
      </p>
    );
  }

  if (error) {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {error}
      </p>
    );
  }

  if (routes === null) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
        {t("co2Costs.noRun", "Go back to Routes and find connections first — costs are calculated from them.")}
      </p>
    );
  }

  if (byMode.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
        {t("co2Costs.noCosts", "No costed routes. Pipeline CAPEX needs a routed pipeline; truck and railway tariffs need routed distances.")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {period && (
        <p className="text-[11px] font-medium text-foreground">
          {t("co2Costs.periodBasis", {
            start: period.start,
            end: period.end,
            defaultValue: "Capture and liquefaction averaged over {{start}}–{{end}}, the years each plant runs.",
          })}
        </p>
      )}
      <p className="text-[11px] leading-snug text-muted-foreground">
        {t(
          "co2Costs.chainNote",
          "Per tonne in €2024, low – high cost case, as STORE_CO2's scenarios price the chain: capture without conditioning (first of a kind; 2030 when no period is set), liquefaction at the emitter for road and rail, the route's tariff, and storage at Porthos's audited cost (none at a utiliser). Pipelines have a CAPEX, not a tariff, so no full-chain figure.",
        )}
      </p>
      {byMode.map(([mode, list]) => (
        <div key={mode} className="overflow-x-auto rounded-xl border border-border">
          <div className="border-b border-border bg-muted/30 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`co2Nodes.modes.${mode}`, mode)} · {list.length}
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left align-bottom text-[10px] leading-tight text-muted-foreground">
                <th className={CELL}>{t("co2Routing.connection", "Connection")}</th>
                <th className={CELL}>
                  {mode === "pipeline"
                    ? t("co2Routing.capex", "CAPEX (€2021)")
                    : t("co2Routing.unitCost", "Cost (€/t/km)")}
                </th>
                <th className={CELL}>{t("co2Costs.capture", "Capture (€/t)")}</th>
                {mode !== "pipeline" && (
                  <th className={CELL}>{t("co2Costs.liquefaction", "Liquefaction (€/t)")}</th>
                )}
                <th className={CELL}>{t("co2Costs.storage", "Storage (€/t)")}</th>
                {mode !== "pipeline" && (
                  <th className={CELL}>{t("co2Costs.total", "Full chain (€/t)")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {list.map((route) => (
                <tr key={`${route.mode}-${route.from_node_id}-${route.to_node_id}`} className="border-t border-border/60">
                  <td className={`${CELL} min-w-[8.5rem] max-w-[13rem]`} title={`${route.from_node_id} → ${route.to_node_id}`}>
                    <div className="break-words font-medium leading-snug text-foreground">{nameOf(route.from_node_id)}</div>
                    <div className="break-words leading-snug text-muted-foreground">→ {nameOf(route.to_node_id)}</div>
                    <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {route.distance_km !== undefined
                        ? `${formatNumber(route.distance_km, 1)} km`
                        : t("co2Routing.unrouted", "Not routed")}
                    </div>
                  </td>
                  <td className={`${CELL} tabular-nums`}>
                    {mode === "pipeline" ? (
                      <>
                        {route.capex_eur !== undefined
                          ? `€${formatNumber(route.capex_eur, 0)}`
                          : route.metadata?.capex_min_eur !== undefined
                            ? `€${formatNumber(route.metadata.capex_min_eur, 0)} – €${formatNumber(route.metadata.capex_max_eur, 0)}`
                            : "—"}
                        {route.metadata?.capacity_min_t_per_h !== undefined && (
                          <div className="text-[10px] text-muted-foreground">
                            {route.capex_eur !== undefined
                              ? formatNumber(route.metadata.capacity_t_per_h)
                              : `${formatNumber(route.metadata.capacity_min_t_per_h)}–${formatNumber(route.metadata.capacity_max_t_per_h)}`}{" "}
                            t/h
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {route.cost_eur_per_t_km !== undefined
                          ? `€${formatNumber(route.cost_eur_per_t_km, 4)}`
                          : "—"}
                        {typeof route.metadata?.gamma2_eur_per_t === "number" && (
                          <div className="text-[10px] text-muted-foreground">
                            €{formatNumber(route.metadata.gamma2_eur_per_t)} / t
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td className={`${CELL} tabular-nums`}>{formatRange(chainCost(route).capture)}</td>
                  {mode !== "pipeline" && (
                    <td className={`${CELL} tabular-nums`}>{formatRange(chainCost(route).liquefaction)}</td>
                  )}
                  <td className={`${CELL} tabular-nums`}>{formatRange(chainCost(route).storage)}</td>
                  {mode !== "pipeline" && (
                    <td className={`${CELL} font-medium tabular-nums`}>{formatRange(chainCost(route).total)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};
