import { useEffect, useMemo, useState, type FC } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";

import { useTranslation } from "@/i18n";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { MapContainer } from "@/components/shared/MapContainer";
import { useMapStore } from "@/features/interactive-map/store/map-store";
import { modelService, Model } from "@/features/model-dashboard/services/modelService";
import { getSelectedNodeIdsFromConfig } from "@/features/configurator/hooks/area-select/utils";
import {
  routeService,
  useNodeOLLayers,
  useNodesQuery,
  useFitToNodes,
  type CO2Route,
} from "@/features/co2-nodes";
import { formatNumber } from "@/features/co2-nodes/utils/format";

import { extractErrorMessage } from "./viewer-helpers";
import { ViewerStatusBanners } from "./components/ViewerStatusBanners";

const FIT_PADDING: [number, number, number, number] = [48, 48, 48, 48];

/** One model's nodes and routes. */
export const ModelResultsViewer: FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const modelId = Number(id);

  const [model, setModel] = useState<Model | null>(null);
  const [routes, setRoutes] = useState<CO2Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const map = useMapStore((state) => state.map);
  const { data: nodes = [] } = useNodesQuery();

  useDocumentTitle(model?.title ?? t("modelResults.title", "Model results"));

  useEffect(() => {
    if (!Number.isFinite(modelId)) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([modelService.getModel(modelId), routeService.getRoutes(modelId)])
      .then(([loaded, saved]) => {
        if (cancelled) return;
        setModel(loaded);
        setRoutes(saved);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(extractErrorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  const selectedIds = useMemo(
    () => (model?.config ? getSelectedNodeIdsFromConfig(model.config) : []),
    [model],
  );

  const modelNodes = useMemo(() => {
    const picked = new Set(selectedIds);
    return nodes.filter((node) => picked.has(node.id));
  }, [nodes, selectedIds]);

  useNodeOLLayers({ map, nodes: modelNodes, selectedIds, onToggle: () => {} });
  useFitToNodes({ map, nodes: modelNodes, enabled: modelNodes.length > 0, padding: FIT_PADDING });

  const byMode = useMemo(() => {
    const grouped = new Map<string, CO2Route[]>();
    for (const route of routes) {
      const list = grouped.get(route.mode) ?? [];
      list.push(route);
      grouped.set(route.mode, list);
    }
    return [...grouped.entries()];
  }, [routes]);

  const header = (
    <div className="flex h-11 items-center gap-3 border-b border-border bg-background px-3">
      <h1 className="truncate text-sm font-semibold text-foreground">
        {model?.title ?? t("modelResults.title", "Model results")}
      </h1>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <span className="ml-auto text-[11px] text-muted-foreground">
        {t("modelResults.summary", {
          nodes: modelNodes.length,
          routes: routes.length,
          defaultValue: `${modelNodes.length} nodes · ${routes.length} routes`,
        })}
      </span>
    </div>
  );

  const overlays = byMode.length > 0 && (
    <div className="absolute bottom-4 right-4 z-20 max-h-[60%] w-80 overflow-y-auto rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur-md">
      {byMode.map(([mode, list]) => (
        <div key={mode}>
          <div className="border-b border-border bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`co2Nodes.modes.${mode}`, mode)} · {list.length}
          </div>
          <table className="w-full text-xs">
            <tbody>
              {list.map((route) => (
                <tr key={`${route.mode}-${route.from_node_id}-${route.to_node_id}`} className="border-t border-border/60">
                  <td className="px-3 py-1.5">
                    {route.from_node_id} → {route.to_node_id}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {route.distance_km !== undefined
                      ? `${formatNumber(route.distance_km, 1)} km`
                      : t("co2Routing.unrouted", "Not routed")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <MapContainer
        modal={false}
        showSidebar={false}
        topBar={header}
        mapHeader={null}
        mapOverlays={
          <>
            <ViewerStatusBanners model={model} />
            {overlays}
          </>
        }
      />
    </div>
  );
};
