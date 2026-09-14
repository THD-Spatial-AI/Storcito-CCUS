import { useMemo, type FC } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";

import type { CO2Route } from "../services/nodeService";
import { costedRoutes, useRoutingRunStore } from "../stores/routingRunStore";
import { formatNumber } from "../utils/format";

/** Run costs. */
export const CostResults: FC = () => {
  const { t } = useTranslation();
  const routes = useRoutingRunStore((state) => state.routes);
  const isRunning = useRoutingRunStore((state) => state.isRunning);
  const error = useRoutingRunStore((state) => state.error);

  const byMode = useMemo(() => {
    const grouped = new Map<string, CO2Route[]>();
    for (const route of costedRoutes(routes)) {
      const list = grouped.get(route.mode) ?? [];
      list.push(route);
      grouped.set(route.mode, list);
    }
    return [...grouped.entries()];
  }, [routes]);

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
      {byMode.map(([mode, list]) => (
        <div key={mode} className="overflow-x-auto rounded-xl border border-border">
          <div className="border-b border-border bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`co2Nodes.modes.${mode}`, mode)} · {list.length}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2">{t("co2Routing.connection", "Connection")}</th>
                <th className="px-3 py-2">{t("co2Routing.distance", "Distance")}</th>
                <th className="px-3 py-2">
                  {mode === "pipeline"
                    ? t("co2Routing.capex", "CAPEX (€2021)")
                    : t("co2Routing.unitCost", "Cost (€/t/km)")}
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((route) => (
                <tr key={`${route.mode}-${route.from_node_id}-${route.to_node_id}`} className="border-t border-border/60">
                  <td className="px-3 py-2 font-medium">
                    {route.from_node_id} → {route.to_node_id}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {route.distance_km !== undefined
                      ? `${formatNumber(route.distance_km, 3)} km`
                      : t("co2Routing.unrouted", "Not routed")}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};
