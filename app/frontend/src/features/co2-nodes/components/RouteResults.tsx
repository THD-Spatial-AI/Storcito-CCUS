import { useEffect, useMemo, type FC } from "react";
import { AlertCircle, Download, Loader2, Play } from "lucide-react";
import { Button } from "@spatialhub/ui";
import { useTranslation } from "@/i18n";
import { routeService, type CO2Route } from "../services/nodeService";
import { useRoutingRunStore } from "../stores/routingRunStore";
import { formatNumber } from "../utils/format";
import { useNodesQuery } from "../hooks/useNodesQuery";
import { isEmitter, isSink, isTransport } from "../types";
import { RoutingSettings, routingInputError } from "./RoutingSettings";

interface RouteResultsProps {
  modelId?: number;
  selectedIds: number[];
}

const stageLabels: Record<string, string> = {
  connections: "Connections",
  routing_pipeline: "Pipeline routing",
  routing_truck: "Truck routing",
  routing_railway: "Railway routing",
  costs_pipeline: "Pipeline costs",
  costs_container: "Container costs",
};

export const RouteResults: FC<RouteResultsProps> = ({ modelId, selectedIds }) => {
  const { t } = useTranslation();
  const { data: nodes = [] } = useNodesQuery();
  const inputs = useRoutingRunStore((state) => state.inputs);
  const routes = useRoutingRunStore((state) => state.routes);
  const result = useRoutingRunStore((state) => state.result);
  const isRunning = useRoutingRunStore((state) => state.isRunning);
  const error = useRoutingRunStore((state) => state.error);
  const setInputs = useRoutingRunStore((state) => state.setInputs);
  const start = useRoutingRunStore((state) => state.start);
  const cancel = useRoutingRunStore((state) => state.cancel);
  const loadSaved = useRoutingRunStore((state) => state.loadSaved);
  const reset = useRoutingRunStore((state) => state.reset);

  const selectionKey = [...selectedIds].sort((a, b) => a - b).join(",");

  const { emitterCount, destinationCount } = useMemo(() => {
    const selected = new Set(selectedIds);
    let emitters = 0;
    let destinations = 0;
    for (const node of nodes) {
      if (!selected.has(node.id)) continue;
      if (isEmitter(node)) emitters++;
      else if (isSink(node) || isTransport(node)) destinations++;
    }
    return { emitterCount: emitters, destinationCount: destinations };
  }, [nodes, selectedIds]);

  const inputError = routingInputError(inputs);
  const canRun = emitterCount > 0 && destinationCount > 0 && !inputError && !isRunning;

  // New selection resets.
  useEffect(() => {
    reset();
  }, [selectionKey, modelId, reset]);

  useEffect(() => {
    if (modelId) void loadSaved(modelId);
  }, [modelId, loadSaved]);

  const run = () => void start(modelId, selectedIds);

  const download = async () => {
    if (!result) return;
    const blob = await routeService.workbook(result.run_id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "co2routex_results.xlsx";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const byMode = useMemo(() => {
    const grouped = new Map<string, CO2Route[]>();
    for (const route of routes ?? []) {
      const list = grouped.get(route.mode) ?? [];
      list.push(route);
      grouped.set(route.mode, list);
    }
    return [...grouped.entries()];
  }, [routes]);

  return (
    <div className="space-y-3">
      <RoutingSettings value={inputs} disabled={isRunning} onChange={setInputs} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={run} disabled={!canRun} className="h-9 text-xs">
          {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {t("co2Routing.run", "Find routes")}
        </Button>
        {isRunning && result && <Button size="sm" variant="outline" onClick={() => void cancel()}>{t("co2Routing.cancel", "Cancel")}</Button>}
        {result?.status === "completed" && <Button size="sm" variant="outline" onClick={() => void download()}><Download className="h-3.5 w-3.5" />{t("co2Routing.download", "Download workbook")}</Button>}
      </div>
      {!isRunning && !canRun && <p className="text-[11px] text-muted-foreground">
        {emitterCount === 0 ? t("co2Nodes.needEmitter", "Add at least one emitter — routes start there.")
          : destinationCount === 0 ? t("co2Nodes.needDestination", "Add a storage, utilisation or transport node — routes have to end somewhere.")
          : inputError}
      </p>}
      {!modelId && <p className="text-[11px] text-muted-foreground">{t("co2Routing.preview", "Draft preview: download the workbook to keep it, or save the model and rerun to store its routes.")}</p>}
      {isRunning && !result && <p role="status" className="text-xs text-muted-foreground">{t("co2Routing.uploading", "Uploading routing data…")}</p>}
      {!!result?.jobs.length && <ol aria-live="polite" className="space-y-1 text-xs text-muted-foreground">
        {result.jobs.map(({ stage, job }) => <li key={job.job_id} className="flex items-center justify-between gap-2">
          <span>{t(`co2Routing.stages.${stage}`, stageLabels[stage] ?? stage)}{job.stage === "routing-railway-distances" ? " · " + t("co2Routing.stationDistances", "Station distances") : ""}</span>
          <span>{t(`co2Routing.status.${job.status}`, job.status)}</span>
        </li>)}
      </ol>}
      {error && <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}</p>}
      {routes !== null && routes.length === 0 && !error && <p className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-center text-xs text-muted-foreground">{t("co2Routing.noRoutes", "No routes found between the selected nodes.")}</p>}
      {byMode.map(([mode, list]) => <div key={mode} className="overflow-x-auto rounded-xl border border-border">
        <div className="border-b border-border bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t(`co2Nodes.modes.${mode}`, mode)} · {list.length}</div>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground">
            <th className="px-3 py-2">{t("co2Routing.connection", "Connection")}</th>
            <th className="px-3 py-2">{t("co2Routing.distance", "Distance")}</th>
          </tr></thead>
          <tbody>{list.map((route) => <tr key={`${route.mode}-${route.from_node_id}-${route.to_node_id}`} className="border-t border-border/60">
            <td className="px-3 py-2 font-medium">{route.from_node_id} → {route.to_node_id}
              {route.metadata?.scope === "station_to_station" && <div className="font-normal text-muted-foreground">{t("co2Routing.stationPair", "Station to station")}</div>}
              {typeof route.metadata?.message === "string" && route.metadata.message && <div className="max-w-64 font-normal text-muted-foreground">{route.metadata.message}</div>}
              {mode === "pipeline" && route.average_resistance !== undefined && <div className="font-normal text-muted-foreground">{t("co2Routing.resistance", "Resistance")}: {formatNumber(route.average_resistance)}</div>}
            </td>
            <td className="px-3 py-2 tabular-nums">{route.distance_km !== undefined ? `${formatNumber(route.distance_km, 3)} km` : t("co2Routing.unrouted", "Not routed")}</td>
          </tr>)}</tbody>
        </table>
      </div>)}
    </div>
  );
};
