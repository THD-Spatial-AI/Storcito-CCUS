import { useEffect, useMemo, useRef, useState, type FC } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Building2,
  Flame,
  MapPin,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

import {
  useNodeFilterStore,
  NO_FLUX_RANGE,
  type FluxRange,
} from "../../stores/nodeFilterStore";
import type { CO2Node } from "../../types";
import { checkboxClass, formatFlux, sameRange } from "./shared";

/** Emission bands. */
const FLUX_PRESETS: { key: string; range: FluxRange }[] = [
  { key: "all", range: NO_FLUX_RANGE },
  { key: "high", range: { min: 1000, max: null } },
  { key: "medium", range: { min: 100, max: 1000 } },
  { key: "low", range: { min: null, max: 100 } },
];

/** Capped picker rows. */
const PICKER_LIMIT = 100;

/** Searchable checkbox list. */
const LocationPicker: FC<{
  title: string;
  icon: LucideIcon;
  entries: [string, { count: number; flux: number }][];
  picked: ReadonlySet<string>;
  onToggle: (value: string) => void;
}> = ({ title, icon: Icon, entries, picked, onToggle }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [ascending, setAscending] = useState(false);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matched = term
      ? entries.filter(([name]) => name.toLowerCase().includes(term))
      : entries;
    // Pre-sorted desc.
    const ordered = ascending ? [...matched].reverse() : matched;
    return ordered.slice(0, PICKER_LIMIT);
  }, [entries, query, ascending]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">{title}</span>
        {picked.size > 0 && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {picked.size}
          </span>
        )}
        <button
          type="button"
          onClick={() => setAscending((prev) => !prev)}
          title={
            ascending
              ? t("co2Nodes.sortDesc", "Highest CO₂ first")
              : t("co2Nodes.sortAsc", "Lowest CO₂ first")
          }
          className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground"
        >
          {ascending ? (
            <ArrowUpNarrowWide className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("co2Nodes.filterListPlaceholder", "Type to narrow…")}
        className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus:border-ring focus:outline-none"
      />

      <div className="max-h-36 space-y-0.5 overflow-y-auto pr-1">
        {visible.map(([name, stat]) => (
          <label
            key={name}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-xs text-foreground transition-colors duration-150",
              picked.has(name) ? "bg-primary/5" : "hover:bg-muted/50",
            )}
          >
            <input
              type="checkbox"
              checked={picked.has(name)}
              onChange={() => onToggle(name)}
              className={checkboxClass}
            />
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {stat.flux > 0 ? formatFlux(stat.flux) : `${stat.count}`}
            </span>
          </label>
        ))}
        {visible.length === 0 && (
          <p className="px-1.5 py-1 text-[11px] text-muted-foreground">
            {t("co2Nodes.noMatches", "No matches.")}
          </p>
        )}
      </div>
    </div>
  );
};

/** Advanced filter popover. */
export const AdvancedFilters: FC<{ nodes: CO2Node[] }> = ({ nodes }) => {
  const { t } = useTranslation();
  const fluxRange = useNodeFilterStore((state) => state.fluxRange);
  const setFluxRange = useNodeFilterStore((state) => state.setFluxRange);
  const stateFilter = useNodeFilterStore((state) => state.states);
  const municipalityFilter = useNodeFilterStore((state) => state.municipalities);
  const toggleState = useNodeFilterStore((state) => state.toggleState);
  const toggleMunicipality = useNodeFilterStore((state) => state.toggleMunicipality);
  const clearFilters = useNodeFilterStore((state) => state.clear);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Biggest first.
  const locationStats = useMemo(() => {
    const states = new Map<string, { count: number; flux: number }>();
    const municipalities = new Map<string, { count: number; flux: number }>();
    const add = (map: Map<string, { count: number; flux: number }>, key: string, flux: number) => {
      const stat = map.get(key) ?? { count: 0, flux: 0 };
      stat.count += 1;
      stat.flux += flux;
      map.set(key, stat);
    };
    for (const node of nodes) {
      const flux = node.annual_flux ?? 0;
      const stateName = node.state?.trim();
      if (stateName) add(states, stateName, flux);
      const municipality = node.municipality?.trim();
      if (municipality) add(municipalities, municipality, flux);
    }
    const toSorted = (map: Map<string, { count: number; flux: number }>) =>
      [...map.entries()].sort((a, b) => b[1].flux - a[1].flux);
    return { states: toSorted(states), municipalities: toSorted(municipalities) };
  }, [nodes]);

  const activeCount =
    (sameRange(fluxRange, NO_FLUX_RANGE) ? 0 : 1) + stateFilter.size + municipalityFilter.size;
  const isCustom = !FLUX_PRESETS.some((preset) => sameRange(preset.range, fluxRange));

  const setEdge = (edge: "min" | "max", raw: string) => {
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) return;
    setFluxRange({ ...fluxRange, [edge]: value });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={t("co2Nodes.advancedFilters", "Advanced filters")}
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150",
          open || activeCount > 0
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 max-h-[70vh] w-72 space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-xl">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Flame className="h-3.5 w-3.5 text-primary" />
            {t("co2Nodes.fluxFilterTitle", "Annual CO₂ emissions")}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {FLUX_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => setFluxRange(preset.range)}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors duration-150",
                  sameRange(fluxRange, preset.range)
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {t(`co2Nodes.fluxPreset.${preset.key}`, {
                  all: "All sizes",
                  high: "High · ≥1,000 kt",
                  medium: "Mid · 100–1,000 kt",
                  low: "Low · <100 kt",
                }[preset.key] ?? preset.key)}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("co2Nodes.fluxCustom", "Custom range (kt/yr)")}
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                value={fluxRange.min ?? ""}
                onChange={(event) => setEdge("min", event.target.value)}
                placeholder={t("co2Nodes.fluxMin", "Min")}
                className={cn(
                  "h-8 w-full rounded-lg border bg-background px-2 text-xs text-foreground transition-colors duration-150 focus:border-ring focus:outline-none",
                  isCustom ? "border-primary/40" : "border-border",
                )}
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="number"
                min={0}
                value={fluxRange.max ?? ""}
                onChange={(event) => setEdge("max", event.target.value)}
                placeholder={t("co2Nodes.fluxMax", "Max")}
                className={cn(
                  "h-8 w-full rounded-lg border bg-background px-2 text-xs text-foreground transition-colors duration-150 focus:border-ring focus:outline-none",
                  isCustom ? "border-primary/40" : "border-border",
                )}
              />
            </div>
            <p className="text-[10px] leading-snug text-muted-foreground">
              {t(
                "co2Nodes.fluxHint",
                "Emitters only — sinks always stay visible.",
              )}
            </p>
          </div>

          <div className="border-t border-border/60" />

          <LocationPicker
            title={t("co2Nodes.statesFilter", "States")}
            icon={MapPin}
            entries={locationStats.states}
            picked={stateFilter}
            onToggle={toggleState}
          />

          <div className="border-t border-border/60" />

          <LocationPicker
            title={t("co2Nodes.municipalitiesFilter", "Cities / municipalities")}
            icon={Building2}
            entries={locationStats.municipalities}
            picked={municipalityFilter}
            onToggle={toggleMunicipality}
          />

          {activeCount > 0 && (
            <>
              <div className="border-t border-border/60" />
              <button
                type="button"
                onClick={clearFilters}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground"
              >
                <X className="h-3 w-3" />
                {t("co2Nodes.clearAllFilters", "Clear all filters")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
