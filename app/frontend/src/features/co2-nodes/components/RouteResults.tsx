import { useEffect, useMemo, type FC, type ReactNode } from "react";
import { AlertCircle, ArrowRight, CircleCheck, CircleX, Download, Loader2, Play, Route, TriangleAlert } from "lucide-react";
import { Button, cn } from "@spatialhub/ui";
import { useTranslation } from "@/i18n";
import { routeService, type CO2Route } from "../services/nodeService";
import { useRoutingRunStore } from "../stores/routingRunStore";
import { formatNumber } from "../utils/format";
import { useNodesQuery } from "../hooks/useNodesQuery";
import { MODE_COLORS } from "../hooks/useNodeOLLayers";
import { isEmitter, isSink, isTransport } from "../types";
import { RoutingSettings, routingInputError } from "./RoutingSettings";

interface RouteResultsProps {
  modelId?: number;
  selectedIds: number[];
}

const stageLabels: Record<string, string> = {
  routing_pipeline: "Pipeline routing",
  routing_road: "Truck routing",
  routing_rail: "Railway routing",
};

const stageModes: Record<string, string> = {
  routing_pipeline: "pipeline",
  routing_road: "truck",
  routing_rail: "railway",
};

const numberOf = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** Stat tile. */
const Stat: FC<{ label: string; value: string; unit?: string }> = ({ label, value, unit }) => (
  <div className="rounded-xl border border-border bg-card px-3 py-2.5">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
      {value}
      {unit && <span className="ml-1 text-[11px] font-medium text-muted-foreground">{unit}</span>}
    </div>
  </div>
);

/** Small metric. */
const Chip: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="rounded-md bg-muted/70 px-1.5 py-0.5 tabular-nums">{children}</span>
);

const StatusIcon: FC<{ status: string }> = ({ status }) => {
  if (status === "completed") return <CircleCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
  if (status === "failed") return <CircleX className="h-3.5 w-3.5 text-destructive" />;
  return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
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

  // Ids to names.
  const names = useMemo(() => new Map(nodes.map((node) => [node.node_id, node.node_name || node.node_id])), [nodes]);
  const nameOf = (id: string) => names.get(id) ?? id;

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
    link.download = "routing_results.xlsx";
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

  const totals = useMemo(() => {
    let tonnes = 0;
    let km = 0;
    let costTonnes = 0;
    let cost = 0;
    for (const route of routes ?? []) {
      const flow = numberOf(route.metadata?.co2_t_per_yr) ?? 0;
      const perTonne = numberOf(route.metadata?.eur_per_t);
      tonnes += flow;
      km += route.distance_km ?? 0;
      if (perTonne !== undefined && flow > 0) {
        cost += perTonne * flow;
        costTonnes += flow;
      }
    }
    return { tonnes, km, eurPerT: costTonnes > 0 ? cost / costTonnes : undefined };
  }, [routes]);

  const notes = !error && !isRunning ? result?.notes ?? [] : [];
  const idle = !isRunning && !result && routes === null && !error;

  return (
    <div className="space-y-4">
      <RoutingSettings value={inputs} disabled={isRunning} onChange={setInputs} />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={run} disabled={!canRun} className="h-9 gap-1.5 px-4 text-xs">
          {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {isRunning ? t("co2Routing.running", "Finding routes…") : t("co2Routing.run", "Find routes")}
        </Button>
        {isRunning && result && (
          <Button variant="outline" onClick={() => void cancel()} className="h-9 text-xs">
            {t("co2Routing.cancel", "Cancel")}
          </Button>
        )}
        {result?.status === "completed" && (
          <Button variant="outline" onClick={() => void download()} className="h-9 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            {t("co2Routing.download", "Download workbook")}
          </Button>
        )}
        {!!result?.jobs.length && (
          <ol aria-live="polite" className="ml-auto flex flex-wrap items-center gap-1.5">
            {result.jobs.map(({ stage, job }) => (
              <li
                key={job.job_id}
                title={t(`co2Routing.status.${job.status}`, job.status)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: MODE_COLORS[stageModes[stage]] }} />
                {t(`co2Routing.stages.${stage}`, stageLabels[stage] ?? stage)}
                <StatusIcon status={job.status} />
              </li>
            ))}
          </ol>
        )}
      </div>

      {!isRunning && !canRun && (
        <p className="text-[11px] text-muted-foreground">
          {emitterCount === 0
            ? t("co2Nodes.needEmitter", "Add at least one emitter — routes start there.")
            : destinationCount === 0
              ? t("co2Nodes.needDestination", "Add a storage, utilisation or transport node — routes have to end somewhere.")
              : inputError}
        </p>
      )}
      {!modelId && (
        <p className="text-[11px] text-muted-foreground">
          {t("co2Routing.preview", "Draft preview: download the workbook to keep it, or save the model and rerun to store its routes.")}
        </p>
      )}

      {idle && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Route className="h-5 w-5 text-muted-foreground" />
          </span>
          <p className="text-xs font-medium text-foreground">{t("co2Routing.emptyTitle", "No routes yet")}</p>
          <p className="max-w-xs text-[11px] text-muted-foreground">
            {t("co2Routing.emptyHint", "Pick the transport modes and find routes. They appear here and on the map.")}
          </p>
        </div>
      )}

      {isRunning && !result?.jobs.length && (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("co2Routing.starting", "Starting routing…")}
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {!!routes?.length && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={t("co2Routing.summary.routes", "Routes")} value={String(routes.length)} />
          <Stat label={t("co2Routing.summary.co2", "CO₂")} value={formatNumber(totals.tonnes / 1000, 1)} unit="kt/yr" />
          <Stat label={t("co2Routing.summary.distance", "Distance")} value={formatNumber(totals.km, 1)} unit="km" />
          <Stat
            label={t("co2Routing.summary.cost", "Avg. cost")}
            value={totals.eurPerT !== undefined ? `€${formatNumber(totals.eurPerT, 2)}` : "—"}
            unit={totals.eurPerT !== undefined ? "/ t" : undefined}
          />
        </div>
      )}

      {notes.length > 0 && (
        <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs">
          <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
            <TriangleAlert className="h-3.5 w-3.5" />
            {t("co2Routing.unrouted", "Not routed")}
          </p>
          <ul className="space-y-1 pl-5 text-muted-foreground">
            {notes.map((note) => (
              <li key={note} className="list-disc">{note}</li>
            ))}
          </ul>
        </div>
      )}

      {routes !== null && routes.length === 0 && !error && !notes.length && (
        <p className="rounded-xl border border-border bg-muted/30 px-3 py-3 text-center text-xs text-muted-foreground">
          {t("co2Routing.noRoutes", "No routes found between the selected nodes.")}
        </p>
      )}

      {byMode.map(([mode, list]) => (
        <section key={mode} className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MODE_COLORS[mode] }} />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">{t(`co2Nodes.modes.${mode}`, mode)}</span>
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{list.length}</span>
          </header>
          <ul className="divide-y divide-border/60">
            {list.map((route) => {
              const message = typeof route.metadata?.message === "string" ? route.metadata.message : "";
              const flow = numberOf(route.metadata?.co2_t_per_yr);
              const perTonne = numberOf(route.metadata?.eur_per_t);
              return (
                <li key={`${route.mode}-${route.from_node_id}-${route.to_node_id}`} className="flex items-stretch gap-3 px-3 py-2.5 transition-colors hover:bg-muted/20">
                  <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: MODE_COLORS[mode] }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
                      <span className="truncate" title={route.from_node_id}>{nameOf(route.from_node_id)}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate" title={route.to_node_id}>{nameOf(route.to_node_id)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                      {flow !== undefined && <Chip>{formatNumber(flow / 1000, 1)} kt/yr</Chip>}
                      {perTonne !== undefined && <Chip>€{formatNumber(perTonne, 2)} / t</Chip>}
                      {mode === "pipeline" && route.average_resistance !== undefined && (
                        <Chip>{t("co2Routing.resistance", "Resistance")} {formatNumber(route.average_resistance)}</Chip>
                      )}
                    </div>
                    {message && (
                      <p className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                        <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
                        {message}
                      </p>
                    )}
                  </div>
                  <div className={cn("shrink-0 self-center text-right", route.distance_km === undefined && "text-muted-foreground")}>
                    {route.distance_km !== undefined ? (
                      <>
                        <div className="text-sm font-semibold tabular-nums text-foreground">{formatNumber(route.distance_km, 1)}</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">km</div>
                      </>
                    ) : (
                      <span className="text-[11px]">{t("co2Routing.unrouted", "Not routed")}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
