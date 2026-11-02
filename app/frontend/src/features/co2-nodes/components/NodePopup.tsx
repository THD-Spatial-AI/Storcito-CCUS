import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type OLMap from "ol/Map";
import Overlay from "ol/Overlay";
import { Check, Info, Minus, Plus, X } from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { EMITTER_COLOR, SINK_COLOR } from "../hooks/useNodeOLLayers";
import { isSink, type CO2Node } from "../types";
import { formatFlux } from "./selector/shared";

interface NodePopupProps {
  map: OLMap | null;
  node: CO2Node | null;
  coordinate?: number[];
  selected: boolean;
  // Acceptance line.
  extra?: string | null;
  onToggle: (node: CO2Node) => void;
  // Hidden when absent.
  onDetails?: (node: CO2Node) => void;
  onClose: () => void;
}

/** Card beside a dot. */
export function NodePopup({ map, node, coordinate, selected, extra, onToggle, onDetails, onClose }: NodePopupProps) {
  const { t } = useTranslation();
  const element = useMemo(() => document.createElement("div"), []);
  const overlay = useMemo(
    () => new Overlay({ element, positioning: "bottom-center", offset: [0, -14], stopEvent: true, autoPan: { margin: 24 } }),
    [element],
  );

  useEffect(() => {
    if (!map) return;
    map.addOverlay(overlay);
    return () => {
      map.removeOverlay(overlay);
    };
  }, [map, overlay]);

  useEffect(() => {
    overlay.setPosition(node && coordinate ? coordinate : undefined);
  }, [overlay, node, coordinate]);

  useEffect(() => {
    if (!node) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node, onClose]);

  if (!node) return null;
  const sink = isSink(node);
  const type = (node.industry || node.node_type).replaceAll("_", " ");
  const meta = [
    type.charAt(0).toUpperCase() + type.slice(1),
    [node.municipality, node.country_code].filter(Boolean).join(", "),
    node.annual_flux ? formatFlux(node.annual_flux) : null,
  ].filter(Boolean);

  return createPortal(
    <div className="w-64 rounded-xl border border-border bg-card p-3 text-xs shadow-xl">
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: sink ? SINK_COLOR : EMITTER_COLOR }} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold" title={node.node_name || node.node_id}>
            {node.node_name || node.node_id}
          </div>
          <div className="truncate text-muted-foreground">{meta.join(" · ")}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("common.close", "Close")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {extra && <p className="mt-2 rounded-md bg-muted/60 px-2 py-1 text-[11px] leading-snug">{extra}</p>}

      <div
        className={cn(
          "mt-2 flex items-center gap-1 text-[11px] font-medium",
          selected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
        )}
      >
        {selected ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        {selected ? t("co2Nodes.popup.inModel", "In your model") : t("co2Nodes.popup.notInModel", "Not in your model")}
      </div>

      <div className={cn("mt-2 grid gap-1.5", onDetails ? "grid-cols-2" : "grid-cols-1")}>
        {onDetails && <button
          type="button"
          onClick={() => onDetails(node)}
          className="flex items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Info className="h-3.5 w-3.5" />
          {t("co2Nodes.popup.details", "Details")}
        </button>}
        <button
          type="button"
          onClick={() => onToggle(node)}
          className="flex items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium hover:bg-muted"
        >
          {selected ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {selected ? t("co2Nodes.popup.remove", "Remove") : t("co2Nodes.popup.add", "Add to model")}
        </button>
      </div>
    </div>,
    element,
  );
}
