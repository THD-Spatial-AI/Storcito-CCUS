import { useMemo, useState, type FC } from "react";
import { AlertCircle, Database, Factory, Globe, Loader2, Search } from "lucide-react";
import { useTranslation } from "@/i18n";

import { useNodesQuery } from "../hooks/useNodesQuery";
import {
  matchesCategory,
  matchesCountry,
  matchesState,
  matchesMunicipality,
  matchesFlux,
  useNodeFilterStore,
  NO_FLUX_RANGE,
} from "../stores/nodeFilterStore";
import { isEmitterCategory, isSinkCategory, type CO2Node } from "../types";
import { SourceCatalogue } from "./SourceCatalogue";
import { AdvancedFilters } from "./selector/AdvancedFilters";
import { CategoryRow } from "./selector/CategoryRow";
import { FilterSection } from "./selector/FilterSection";
import { LocationRows } from "./selector/LocationRows";
import { sameRange } from "./selector/shared";

interface NodeSelectorProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

/** Catalogue picker. */
export const NodeSelector: FC<NodeSelectorProps> = ({ selectedIds, onChange }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data: nodes = [], isLoading, isError } = useNodesQuery();

  // Map-linked.
  const countryFilter = useNodeFilterStore((state) => state.countries);
  const stateFilter = useNodeFilterStore((state) => state.states);
  const municipalityFilter = useNodeFilterStore((state) => state.municipalities);
  const emitterFilter = useNodeFilterStore((state) => state.emitterCategories);
  const sinkFilter = useNodeFilterStore((state) => state.sinkCategories);
  const fluxRange = useNodeFilterStore((state) => state.fluxRange);
  const toggleCountry = useNodeFilterStore((state) => state.toggleCountry);
  const toggleState = useNodeFilterStore((state) => state.toggleState);
  const toggleMunicipality = useNodeFilterStore((state) => state.toggleMunicipality);
  const toggleEmitterCategory = useNodeFilterStore((state) => state.toggleEmitterCategory);
  const toggleSinkCategory = useNodeFilterStore((state) => state.toggleSinkCategory);
  const clearFilters = useNodeFilterStore((state) => state.clear);

  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(
    new Set(["country", "emitters", "sinks"]),
  );
  const toggleSection = (key: string) => {
    const next = new Set(openSections);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenSections(next);
  };

  const [openCategories, setOpenCategories] = useState<ReadonlySet<string>>(new Set());
  const toggleCategoryOpen = (key: string) => {
    const next = new Set(openCategories);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenCategories(next);
  };

  const [openLocations, setOpenLocations] = useState<ReadonlySet<string>>(new Set());
  const toggleLocationOpen = (key: string) => {
    const next = new Set(openLocations);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenLocations(next);
  };

  const searched = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return nodes;
    return nodes.filter(
      (node) =>
        node.node_name?.toLowerCase().includes(term) || node.node_id.toLowerCase().includes(term),
    );
  }, [nodes, search]);

  const inFlux = useMemo(
    () => searched.filter((node) => matchesFlux(node, fluxRange)),
    [searched, fluxRange],
  );

  // Narrows everything.
  const locationScope = useMemo(
    () =>
      inFlux.filter(
        (node) => matchesState(node, stateFilter) && matchesMunicipality(node, municipalityFilter),
      ),
    [inFlux, stateFilter, municipalityFilter],
  );

  // Facets exclude themselves.
  const countryScope = useMemo(
    () => locationScope.filter((node) => matchesCategory(node, emitterFilter, sinkFilter)),
    [locationScope, emitterFilter, sinkFilter],
  );

  const categoryScope = useMemo(
    () => locationScope.filter((node) => matchesCountry(node, countryFilter)),
    [locationScope, countryFilter],
  );

  const filtered = useMemo(
    () => categoryScope.filter((node) => matchesCategory(node, emitterFilter, sinkFilter)),
    [categoryScope, emitterFilter, sinkFilter],
  );

  const countries = useMemo(() => {
    const seen = new Set<string>();
    for (const node of nodes) {
      if (node.country_code) seen.add(node.country_code);
    }
    return [...seen].sort();
  }, [nodes]);

  // Scope plus picks.
  const categoriesIn = (
    scope: CO2Node[],
    belongs: (category: string) => boolean,
    picked: ReadonlySet<string>,
  ) => {
    const seen = new Set<string>();
    for (const node of scope) {
      if (belongs(node.node_type)) seen.add(node.node_type);
    }
    for (const category of picked) seen.add(category);
    return [...seen].sort();
  };

  const emitterCategories = useMemo(
    () => categoriesIn(categoryScope, isEmitterCategory, emitterFilter),
    [categoryScope, emitterFilter],
  );

  const sinkCategories = useMemo(
    () => categoriesIn(categoryScope, isSinkCategory, sinkFilter),
    [categoryScope, sinkFilter],
  );

  const countByCountry = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of countryScope) {
      const code = node.country_code ?? "—";
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return counts;
  }, [countryScope]);

  // Nested count maps.
  // Empty-state bucket.
  const locationTree = useMemo(() => {
    const states = new Map<string, Map<string, number>>();
    const municipalities = new Map<string, Map<string, number>>();
    for (const node of countryScope) {
      const code = node.country_code ?? "";
      if (!code) continue;
      const stateName = node.state?.trim() ?? "";
      const municipality = node.municipality?.trim() ?? "";
      if (stateName) {
        const stateCounts = states.get(code) ?? new Map<string, number>();
        stateCounts.set(stateName, (stateCounts.get(stateName) ?? 0) + 1);
        states.set(code, stateCounts);
      }
      if (municipality) {
        const key = `${code}|${stateName}`;
        const municipalityCounts = municipalities.get(key) ?? new Map<string, number>();
        municipalityCounts.set(municipality, (municipalityCounts.get(municipality) ?? 0) + 1);
        municipalities.set(key, municipalityCounts);
      }
    }
    return { states, municipalities };
  }, [countryScope]);

  const statesOf = (code: string): [string, number][] =>
    [...(locationTree.states.get(code) ?? new Map<string, number>()).entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

  const municipalitiesOf = (code: string, stateName: string): [string, number][] =>
    [...(locationTree.municipalities.get(`${code}|${stateName}`) ?? new Map<string, number>()).entries()].sort(
      (a, b) => a[0].localeCompare(b[0]),
    );

  const countByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of categoryScope) {
      counts.set(node.node_type, (counts.get(node.node_type) ?? 0) + 1);
    }
    return counts;
  }, [categoryScope]);

  // Biggest emitters first.
  const facilitiesByCategory = useMemo(() => {
    const byCategory = new Map<string, CO2Node[]>();
    for (const node of filtered) {
      const list = byCategory.get(node.node_type) ?? [];
      list.push(node);
      byCategory.set(node.node_type, list);
    }
    for (const list of byCategory.values()) {
      list.sort((a, b) => (b.annual_flux ?? 0) - (a.annual_flux ?? 0));
    }
    return byCategory;
  }, [filtered]);

  const selected = new Set(selectedIds);
  const isSelected = (node: CO2Node) => selected.has(node.id);

  const toggleNode = (node: CO2Node) => {
    const next = new Set(selected);
    if (next.has(node.id)) next.delete(node.id);
    else next.add(node.id);
    onChange([...next]);
  };

  const selectAll = (list: CO2Node[]) => {
    const next = new Set(selected);
    for (const node of list) next.add(node.id);
    onChange([...next]);
  };

  const clearAll = (list: CO2Node[]) => {
    const next = new Set(selected);
    for (const node of list) next.delete(node.id);
    onChange([...next]);
  };

  const emitterCount = nodes.filter((n) => selected.has(n.id) && isEmitterCategory(n.node_type)).length;
  const sinkCount = nodes.filter((n) => selected.has(n.id) && isSinkCategory(n.node_type)).length;

  const hasActiveFilters =
    countryFilter.size > 0 ||
    stateFilter.size > 0 ||
    municipalityFilter.size > 0 ||
    emitterFilter.size > 0 ||
    sinkFilter.size > 0 ||
    !sameRange(fluxRange, NO_FLUX_RANGE);

  const expandLabel = t("co2Nodes.expandCategory", "Show facilities");

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-6 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t("co2Nodes.loading", "Loading nodes…")}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-6 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        {t("co2Nodes.loadError", "Could not load the node catalogue.")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SourceCatalogue />
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("co2Nodes.searchPlaceholder", "Search by name or id…")}
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
        </div>
        <AdvancedFilters nodes={nodes} />
      </div>

      {/* Map-linked filters. */}
      <div className="space-y-2">
        <FilterSection
          title={t("co2Nodes.countrySection", "Country")}
          icon={Globe}
          expanded={openSections.has("country")}
          onToggle={() => toggleSection("country")}
          picked={countryFilter.size + stateFilter.size + municipalityFilter.size}
          total={countries.length}
        >
          <LocationRows
            countries={countries}
            countByCountry={countByCountry}
            statesOf={statesOf}
            municipalitiesOf={municipalitiesOf}
            countryFilter={countryFilter}
            stateFilter={stateFilter}
            municipalityFilter={municipalityFilter}
            onToggleCountry={toggleCountry}
            onToggleState={toggleState}
            onToggleMunicipality={toggleMunicipality}
            openKeys={openLocations}
            onToggleOpen={toggleLocationOpen}
            noStateLabel={t("co2Nodes.noState", "No state recorded")}
          />
        </FilterSection>

        <FilterSection
          title={t("co2Nodes.emittersSection", "Emitter categories")}
          icon={Factory}
          expanded={openSections.has("emitters")}
          onToggle={() => toggleSection("emitters")}
          picked={emitterFilter.size}
          total={emitterCategories.length}
        >
          {emitterCategories.map((category) => (
            <CategoryRow
              key={category}
              label={t(`co2Nodes.types.${category}`, category)}
              total={countByCategory.get(category) ?? 0}
              facilities={facilitiesByCategory.get(category) ?? []}
              checked={emitterFilter.has(category)}
              onCheck={() => toggleEmitterCategory(category)}
              expanded={openCategories.has(category)}
              onExpand={() => toggleCategoryOpen(category)}
              isSelected={isSelected}
              onToggleNode={toggleNode}
              onSelectAll={selectAll}
              onClearAll={clearAll}
              expandLabel={expandLabel}
            />
          ))}
        </FilterSection>

        <FilterSection
          title={t("co2Nodes.sinksSection", "Sink categories")}
          icon={Database}
          expanded={openSections.has("sinks")}
          onToggle={() => toggleSection("sinks")}
          picked={sinkFilter.size}
          total={sinkCategories.length}
        >
          {sinkCategories.length === 0 ? (
            <p className="px-1.5 py-1 text-[11px] text-muted-foreground">
              {t("co2Nodes.noSinks", "No sinks in the catalogue yet.")}
            </p>
          ) : (
            sinkCategories.map((category) => (
              <CategoryRow
                key={category}
                label={t(`co2Nodes.types.${category}`, category)}
                total={countByCategory.get(category) ?? 0}
                facilities={facilitiesByCategory.get(category) ?? []}
                checked={sinkFilter.has(category)}
                onCheck={() => toggleSinkCategory(category)}
                expanded={openCategories.has(category)}
                onExpand={() => toggleCategoryOpen(category)}
                isSelected={isSelected}
                onToggleNode={toggleNode}
                onSelectAll={selectAll}
                onClearAll={clearAll}
                expandLabel={expandLabel}
              />
            ))
          )}
        </FilterSection>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
          >
            {t("co2Nodes.clearFilters", "Clear filters")}
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
          {nodes.length === 0
            ? t("co2Nodes.catalogueEmpty", "The node catalogue is empty.")
            : t("co2Nodes.empty", "No nodes match your search.")}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        {t("co2Nodes.selectionSummary", {
          count: selectedIds.length,
          emitters: emitterCount,
          sinks: sinkCount,
          defaultValue: "{{count}} selected — {{emitters}} emitters, {{sinks}} sinks",
        })}
      </p>
    </div>
  );
};
