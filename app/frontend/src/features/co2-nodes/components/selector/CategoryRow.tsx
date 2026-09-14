import { useRef, useState, type FC } from "react";
import { ChevronRight, Info } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

import { SourceDetails } from "../SourceDetails";
import type { CO2Node } from "../../types";
import { formatFlux } from "./shared";

// Virtualized rows.
const FACILITY_ROW_HEIGHT = 26;
const FACILITY_VIEWPORT_HEIGHT = 260;

/** Filter or expand. */
export const CategoryRow: FC<{
  label: string;
  total: number;
  facilities: CO2Node[];
  checked: boolean;
  onCheck: () => void;
  expanded: boolean;
  onExpand: () => void;
  isSelected: (node: CO2Node) => boolean;
  onToggleNode: (node: CO2Node) => void;
  onSelectAll: (nodes: CO2Node[]) => void;
  onClearAll: (nodes: CO2Node[]) => void;
  expandLabel: string;
}> = ({
  label,
  total,
  facilities,
  checked,
  onCheck,
  expanded,
  onExpand,
  isSelected,
  onToggleNode,
  onSelectAll,
  onClearAll,
  expandLabel,
}) => {
  const { t } = useTranslation();
  const [sourceId, setSourceId] = useState<string | null>(null);
  const pickedHere = facilities.reduce((sum, node) => sum + (isSelected(node) ? 1 : 0), 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: expanded ? facilities.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => FACILITY_ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div>
      <SourceDetails sourceId={sourceId} onClose={() => setSourceId(null)} />
      <div
        className={cn(
          "flex items-center gap-1 rounded-lg px-1.5 py-1 transition-colors duration-150",
          checked ? "bg-primary/5" : "hover:bg-muted/50",
        )}
      >
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-label={expandLabel}
          disabled={facilities.length === 0}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-30"
        >
          <ChevronRight
            className={cn("h-3 w-3 transition-transform duration-150", expanded && "rotate-90")}
          />
        </button>
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={checked}
            onChange={onCheck}
            className="h-3.5 w-3.5 shrink-0 rounded border-border accent-foreground"
          />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {pickedHere > 0 ? `${pickedHere}/` : ""}
            {total.toLocaleString()}
          </span>
        </label>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pl-7 pr-1">
            <div className="flex items-center gap-2 px-2 py-1 text-[10px]">
              <button
                type="button"
                onClick={() => onSelectAll(facilities)}
                disabled={pickedHere === facilities.length}
                className="font-medium text-primary underline-offset-2 hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {t("co2Nodes.selectAll", {
                  count: facilities.length,
                  defaultValue: `Select all ${facilities.length}`,
                })}
              </button>
              {pickedHere > 0 && (
                <button
                  type="button"
                  onClick={() => onClearAll(facilities)}
                  className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {t("co2Nodes.clearCategory", "Clear")}
                </button>
              )}
            </div>

            <div
              ref={scrollRef}
              className="overflow-y-auto"
              style={{ maxHeight: FACILITY_VIEWPORT_HEIGHT }}
            >
              <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                {virtualizer.getVirtualItems().map((row) => {
                  const node = facilities[row.index];
                  return (
                    <div
                      key={node.id}
                      className={cn(
                        "absolute left-0 top-0 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 text-xs transition-colors duration-150",
                        isSelected(node) ? "bg-primary/5 text-foreground" : "text-foreground hover:bg-muted/50",
                      )}
                      style={{ height: row.size, transform: `translateY(${row.start}px)` }}
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected(node)}
                        onChange={() => onToggleNode(node)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-border accent-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate">{node.node_name || node.node_id}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {formatFlux(node.annual_flux)}
                      </span>
                      </label>
                      {node.source === "store_co2" && <button type="button" className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={`${t("co2Source.details", "Source details")}: ${node.node_name || node.node_id}`} onClick={() => setSourceId(node.node_id)}><Info className="h-3 w-3" /></button>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
