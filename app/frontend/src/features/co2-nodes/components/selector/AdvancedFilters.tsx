import { useEffect, useMemo, useRef, useState, type FC, type ReactNode } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CalendarRange,
  ChevronDown,
  Flame,
  Map as MapIcon,
  Trees,
  TrainFront,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { Switch } from "@spatialhub/ui";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

import {
  useNodeFilterStore,
  NO_FLUX_RANGE,
  type FluxRange,
  type RuralFilter,
} from "../../stores/nodeFilterStore";
import type { CO2Node } from "../../types";
import { checkboxClass, formatFlux, sameRange } from "./shared";

/** Emission bands. */
const FLUX_PRESETS: { key: string; range: FluxRange; short: string; long: string }[] = [
  { key: "all", range: NO_FLUX_RANGE, short: "All", long: "All sizes" },
  { key: "high", range: { min: 1000, max: null }, short: "High", long: "High · ≥1,000 kt" },
  { key: "medium", range: { min: 100, max: 1000 }, short: "Mid", long: "Mid · 100–1,000 kt" },
  { key: "low", range: { min: null, max: 100 }, short: "Low", long: "Low · <100 kt" },
];

const RURAL_OPTIONS: { value: RuralFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "rural", label: "Rural" },
  { value: "urban", label: "Urban" },
];

// Metres; null any.
const RAIL_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Any" },
  { value: 500, label: "500 m" },
  { value: 1000, label: "1 km" },
  { value: 2000, label: "2 km" },
  { value: 5000, label: "5 km" },
];

type SectionKey = "flux" | "rural" | "rail" | "regions";

/** Capped picker rows. */
const PICKER_LIMIT = 100;

const HINT_CLASS = "text-[10px] leading-snug text-muted-foreground";
const iconTone = (active: boolean): string => (active ? "text-primary" : "text-muted-foreground");
const inputTone = (highlight: boolean) => (highlight ? "border-primary/40" : "border-border");
const INPUT_CLASS =
  "h-8 w-full rounded-lg border bg-background px-2 text-xs text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus:border-ring focus:outline-none";

/** One-of buttons. */
function Segmented<T>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: (option: { value: T; label: string }) => string;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-md px-1 py-1 text-[11px] font-medium tabular-nums transition-colors duration-150",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label(option)}
          </button>
        );
      })}
    </div>
  );
}

/** Collapsible filter row. */
const Section: FC<{
  icon: LucideIcon;
  title: string;
  value: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}> = ({ icon: Icon, title, value, active, open, onToggle, children }) => (
  <div className="border-b border-border/60 last:border-b-0">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted/40"
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", iconTone(active))} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{title}</span>
      <span className={cn("max-w-[45%] truncate text-[11px] tabular-nums", active ? "font-medium text-primary" : "text-muted-foreground")}>
        {value}
      </span>
      <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150", open && "rotate-180")} />
    </button>
    {open && <div className="space-y-2 px-3 pb-3">{children}</div>}
  </div>
);

/** Searchable checkbox list. */
const LocationPicker: FC<{
  entries: [string, { count: number; flux: number }][];
  picked: ReadonlySet<string>;
  onToggle: (value: string) => void;
}> = ({ entries, picked, onToggle }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [ascending, setAscending] = useState(false);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matched = term ? entries.filter(([name]) => name.toLowerCase().includes(term)) : entries;
    // Pre-sorted desc.
    const ordered = ascending ? [...matched].reverse() : matched;
    return ordered.slice(0, PICKER_LIMIT);
  }, [entries, query, ascending]);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("co2Nodes.filterListPlaceholder", "Type to narrow…")}
          className={cn(INPUT_CLASS, inputTone(false))}
        />
        <button
          type="button"
          onClick={() => setAscending((prev) => !prev)}
          title={ascending ? t("co2Nodes.sortDesc", "Highest CO₂ first") : t("co2Nodes.sortAsc", "Lowest CO₂ first")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground"
        >
          {ascending ? <ArrowUpNarrowWide className="h-3.5 w-3.5" /> : <ArrowDownWideNarrow className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="max-h-40 space-y-0.5 overflow-y-auto pr-1">
        {visible.map(([name, stat]) => (
          <label
            key={name}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-xs text-foreground transition-colors duration-150",
              picked.has(name) ? "bg-primary/5" : "hover:bg-muted/50",
            )}
          >
            <input type="checkbox" checked={picked.has(name)} onChange={() => onToggle(name)} className={checkboxClass} />
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {stat.flux > 0 ? formatFlux(stat.flux) : `${stat.count}`}
            </span>
          </label>
        ))}
        {visible.length === 0 && <p className="px-1.5 py-1 text-[11px] text-muted-foreground">{t("co2Nodes.noMatches", "No matches.")}</p>}
      </div>
    </>
  );
};

/** Advanced filter popover. */
export const AdvancedFilters: FC<{ nodes: CO2Node[] }> = ({ nodes }) => {
  const { t } = useTranslation();
  const fluxRange = useNodeFilterStore((state) => state.fluxRange);
  const setFluxRange = useNodeFilterStore((state) => state.setFluxRange);
  const regionFilter = useNodeFilterStore((state) => state.regions);
  const toggleRegion = useNodeFilterStore((state) => state.toggleRegion);
  const ruralFilter = useNodeFilterStore((state) => state.rural);
  const setRural = useNodeFilterStore((state) => state.setRural);
  const railDistance = useNodeFilterStore((state) => state.railDistance);
  const setRailDistance = useNodeFilterStore((state) => state.setRailDistance);
  const periodOnly = useNodeFilterStore((state) => state.periodOnly);
  const setPeriodOnly = useNodeFilterStore((state) => state.setPeriodOnly);
  const period = useNodeFilterStore((state) => state.period);
  const clearFilters = useNodeFilterStore((state) => state.clear);

  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SectionKey | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleSection = (key: SectionKey) => setSection((current) => (current === key ? null : key));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Regions, biggest first.
  const regionStats = useMemo(() => {
    const regions = new Map<string, { count: number; flux: number }>();
    for (const node of nodes) {
      if (!node.nuts2) continue;
      const stat = regions.get(node.nuts2) ?? { count: 0, flux: 0 };
      stat.count += 1;
      stat.flux += node.annual_flux ?? 0;
      regions.set(node.nuts2, stat);
    }
    return [...regions.entries()].sort((a, b) => b[1].flux - a[1].flux);
  }, [nodes]);

  const fluxActive = !sameRange(fluxRange, NO_FLUX_RANGE);
  const activeCount =
    (fluxActive ? 1 : 0) +
    regionFilter.size +
    (ruralFilter === "all" ? 0 : 1) +
    (railDistance === null ? 0 : 1) +
    (periodOnly ? 0 : 1);
  const preset = FLUX_PRESETS.find((item) => sameRange(item.range, fluxRange));

  const fluxLabel = preset
    ? t(`co2Nodes.fluxPreset.${preset.key}`, preset.long)
    : `${fluxRange.min ?? 0}–${fluxRange.max ?? "∞"} kt`;
  const allLabel = t("co2Nodes.rural.all", "All");

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
        <div className="absolute right-0 top-10 z-30 flex max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-xs font-semibold text-foreground">{t("co2Nodes.filtersTitle", "Filters")}</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold tabular-nums text-primary">{activeCount}</span>
            )}
            <span className="flex-1" />
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                {t("co2Nodes.resetFilters", "Reset")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("common.close", "Close")}
              className="rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-y-auto">
            <div className="flex items-start gap-2 border-b border-border/60 px-3 py-2.5">
              <CalendarRange className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconTone(periodOnly))} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{t("co2Nodes.periodOnlyShort", "Operating in the period")}</p>
                <p className={HINT_CLASS}>
                  {period
                    ? t("co2Nodes.periodOnlyHint", {
                        start: period.start,
                        end: period.end,
                        defaultValue: "{{start}}–{{end}}: hides retired plants, plants built later and coal after its phase-out.",
                      })
                    : t("co2Nodes.periodMissing", "Set the assessment period in step 1; until then only retired plants are hidden.")}
                </p>
              </div>
              <Switch
                checked={periodOnly}
                onCheckedChange={setPeriodOnly}
                aria-label={t("co2Nodes.periodOnly", "Only sites operating in the assessment period")}
              />
            </div>

            <Section
              icon={Flame}
              title={t("co2Nodes.fluxFilterTitle", "Annual CO₂ emissions")}
              value={fluxLabel}
              active={fluxActive}
              open={section === "flux"}
              onToggle={() => toggleSection("flux")}
            >
              <Segmented
                options={FLUX_PRESETS.map((item) => ({ value: item.key, label: item.short }))}
                value={preset?.key ?? ""}
                onChange={(key) => setFluxRange(FLUX_PRESETS.find((item) => item.key === key)?.range ?? NO_FLUX_RANGE)}
                label={(option) => t(`co2Nodes.fluxShort.${option.value}`, option.label)}
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={fluxRange.min ?? ""}
                  onChange={(event) => setEdge("min", event.target.value)}
                  placeholder={t("co2Nodes.fluxMin", "Min")}
                  className={cn(INPUT_CLASS, inputTone(!preset))}
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="number"
                  min={0}
                  value={fluxRange.max ?? ""}
                  onChange={(event) => setEdge("max", event.target.value)}
                  placeholder={t("co2Nodes.fluxMax", "Max")}
                  className={cn(INPUT_CLASS, inputTone(!preset))}
                />
                <span className="shrink-0 text-[10px] text-muted-foreground">kt/yr</span>
              </div>
              <p className={HINT_CLASS}>{t("co2Nodes.fluxHint", "Emitters only — sinks always stay visible.")}</p>
            </Section>

            <Section
              icon={Trees}
              title={t("co2Nodes.ruralFilter", "Settlement type")}
              value={t(`co2Nodes.rural.${ruralFilter}`, RURAL_OPTIONS.find((item) => item.value === ruralFilter)?.label ?? ruralFilter)}
              active={ruralFilter !== "all"}
              open={section === "rural"}
              onToggle={() => toggleSection("rural")}
            >
              <Segmented
                options={RURAL_OPTIONS}
                value={ruralFilter}
                onChange={setRural}
                label={(option) => t(`co2Nodes.rural.${option.value}`, option.label)}
              />
              <p className={HINT_CLASS}>{t("co2Nodes.ruralHint", "Rural by the 2021 census grid (STORE_CO2).")}</p>
            </Section>

            <Section
              icon={TrainFront}
              title={t("co2Nodes.railFilter", "Near a railway")}
              value={railDistance === null ? t("co2Nodes.rail.any", "Any") : `≤ ${RAIL_OPTIONS.find((item) => item.value === railDistance)?.label}`}
              active={railDistance !== null}
              open={section === "rail"}
              onToggle={() => toggleSection("rail")}
            >
              <Segmented
                options={RAIL_OPTIONS}
                value={railDistance}
                onChange={setRailDistance}
                label={(option) => (option.value === null ? t("co2Nodes.rail.any", option.label) : option.label)}
              />
              <p className={HINT_CLASS}>
                {t("co2Nodes.railHint", "Emitters and sinks within this distance of a rail line in their country. Railway routing connects sites within 500 m.")}
              </p>
            </Section>

            <Section
              icon={MapIcon}
              title={t("co2Nodes.regionsFilter", "Regions (NUTS 2)")}
              value={regionFilter.size ? t("co2Nodes.selectedCount", { count: regionFilter.size, defaultValue: "{{count}} selected" }) : allLabel}
              active={regionFilter.size > 0}
              open={section === "regions"}
              onToggle={() => toggleSection("regions")}
            >
              <LocationPicker entries={regionStats} picked={regionFilter} onToggle={toggleRegion} />
            </Section>
          </div>
        </div>
      )}
    </div>
  );
};
