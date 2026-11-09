import { useMemo, useState, type FC } from "react";
import { ArrowDownWideNarrow, ArrowLeft, ArrowUpNarrowWide, Info, Search } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

import { SourceDetails } from "../SourceDetails";
import { isSink, type CO2Node } from "../../types";
import { checkboxClass, formatFlux } from "./shared";

/** Operating period tag. */
const operatingTag = (node: CO2Node, t: TFunction): string | null => {
  if (node.retired) return t("co2Nodes.tag.retired", "retired");
  if (node.operating_from != null && node.operating_from > new Date().getFullYear())
    return t("co2Nodes.tag.from", { year: node.operating_from, defaultValue: "from {{year}}" });
  if (node.operating_until != null)
    return t("co2Nodes.tag.until", { year: node.operating_until, defaultValue: "until {{year}}" });
  if (node.source === "store_co2" && node.node_type === "storage" && node.operating_from == null)
    return t("co2Nodes.tag.startUnknown", "start unknown");
  return null;
};

// Rows per page.
const PAGE = 100;

/** One category's sites. */
export const CategoryFacilities: FC<{
  label: string;
  facilities: CO2Node[];
  isSelected: (node: CO2Node) => boolean;
  onToggleNode: (node: CO2Node) => void;
  onSelectAll: (nodes: CO2Node[]) => void;
  onClearAll: (nodes: CO2Node[]) => void;
  onBack: () => void;
}> = ({ label, facilities, isSelected, onToggleNode, onSelectAll, onClearAll, onBack }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [ascending, setAscending] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [detail, setDetail] = useState<CO2Node | null>(null);
  const detailIsSink = detail !== null && isSink(detail);

  // Facilities arrive biggest first.
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matched = term
      ? facilities.filter(
          (node) =>
            node.node_name?.toLowerCase().includes(term) ||
            node.municipality?.toLowerCase().includes(term) ||
            node.state?.toLowerCase().includes(term),
        )
      : facilities;
    return ascending ? [...matched].reverse() : matched;
  }, [facilities, query, ascending]);
  const picked = visible.reduce((sum, node) => sum + (isSelected(node) ? 1 : 0), 0);

  return (
    <div className="space-y-3">
      <SourceDetails
        sourceId={detail && !detailIsSink ? detail.node_id : null}
        nodeId={detailIsSink ? detail.id : null}
        onClose={() => setDetail(null)}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("common.back", "Back")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{label}</h3>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
          {picked > 0 ? `${picked}/` : ""}
          {facilities.length.toLocaleString()}
        </span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShown(PAGE);
          }}
          placeholder={t("co2Nodes.searchIn", { name: label, defaultValue: "Search in {{name}}…" })}
          className="h-10 w-full rounded-xl border border-border bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>

      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => onSelectAll(visible)}
          disabled={visible.length === 0 || picked === visible.length}
          className="font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {t("co2Nodes.selectAll", { count: visible.length, defaultValue: "Select all {{count}}" })}
        </button>
        {picked > 0 && (
          <button type="button" onClick={() => onClearAll(visible)} className="font-medium text-muted-foreground hover:text-foreground">
            {t("co2Nodes.clearCategory", "Clear")}
          </button>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setAscending((prev) => !prev)}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground"
        >
          {ascending ? <ArrowUpNarrowWide className="h-3.5 w-3.5" /> : <ArrowDownWideNarrow className="h-3.5 w-3.5" />}
          CO₂
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          {t("co2Nodes.noMatches", "No matches.")}
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
          {visible.slice(0, shown).map((node) => {
            const selected = isSelected(node);
            const tag = operatingTag(node, t);
            const where = [node.municipality?.trim() || node.state?.trim(), node.country_code].filter(Boolean).join(" · ");
            return (
              <li key={node.id} className={cn("flex items-center gap-2 px-3 py-2.5 transition-colors duration-150", selected ? "bg-primary/5" : "hover:bg-muted/40")}>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={selected} onChange={() => onToggleNode(node)} className={checkboxClass} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug text-foreground">{node.node_name || node.node_id}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate">{where}</span>
                      {tag && <span className="shrink-0 rounded bg-muted px-1 text-[10px]">{tag}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatFlux(node.annual_flux)}</span>
                </label>
                {node.source === "store_co2" && (
                  <button
                    type="button"
                    onClick={() => setDetail(node)}
                    aria-label={`${t("co2Source.details", "Source details")}: ${node.node_name || node.node_id}`}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {visible.length > shown && (
        <button
          type="button"
          onClick={() => setShown((count) => count + PAGE)}
          className="w-full rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/40 hover:text-foreground"
        >
          {t("co2Nodes.showMore", {
            count: Math.min(PAGE, visible.length - shown),
            total: (visible.length - shown).toLocaleString(),
            defaultValue: "Show {{count}} more ({{total}} left)",
          })}
        </button>
      )}
    </div>
  );
};
