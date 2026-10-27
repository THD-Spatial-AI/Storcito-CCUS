import { create } from "zustand";

import { isEmitter, isSink, nodeCategory, type CO2Node } from "../types";

/** Emissions band, kt/yr. */
export interface FluxRange {
  min: number | null;
  max: number | null;
}

export const NO_FLUX_RANGE: FluxRange = { min: null, max: null };

/** Inclusive year range. */
export interface AssessmentPeriod {
  start: number;
  end: number;
}

/** Period from ISO dates. */
export const periodOf = (fromDate: string, toDate: string): AssessmentPeriod | null => {
  const start = Number(fromDate.slice(0, 4));
  const end = Number(toDate.slice(0, 4));
  return Number.isInteger(start) && Number.isInteger(end) && start > 0 && start <= end ? { start, end } : null;
};

/** Rural or urban. */
export type RuralFilter = "all" | "rural" | "urban";

/** Shared catalogue filters. */
export interface NodeFilterCriteria {
  countries: ReadonlySet<string>;
  states: ReadonlySet<string>;
  municipalities: ReadonlySet<string>;
  emitterCategories: ReadonlySet<string>;
  sinkCategories: ReadonlySet<string>;
  regions: ReadonlySet<string>;
  rural: RuralFilter;
  fluxRange: FluxRange;
  /** Hide inactive sites. */
  periodOnly: boolean;
  period: AssessmentPeriod | null;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

export const NO_FILTER_CRITERIA: NodeFilterCriteria = {
  countries: EMPTY_SET,
  states: EMPTY_SET,
  municipalities: EMPTY_SET,
  emitterCategories: EMPTY_SET,
  sinkCategories: EMPTY_SET,
  regions: EMPTY_SET,
  rural: "all",
  fluxRange: NO_FLUX_RANGE,
  periodOnly: true,
  period: null,
};

/** Category filters. */
interface NodeFilterStore extends NodeFilterCriteria {
  // Empty means all.
  toggleCountry: (code: string) => void;
  toggleState: (state: string) => void;
  toggleMunicipality: (municipality: string) => void;
  toggleEmitterCategory: (category: string) => void;
  toggleSinkCategory: (category: string) => void;
  toggleRegion: (nuts2: string) => void;
  setRural: (rural: RuralFilter) => void;
  setPeriodOnly: (periodOnly: boolean) => void;
  setPeriod: (period: AssessmentPeriod | null) => void;
  setFluxRange: (range: FluxRange) => void;
  clear: () => void;
}

const toggleIn = (current: ReadonlySet<string>, value: string): ReadonlySet<string> => {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

export const useNodeFilterStore = create<NodeFilterStore>()((set) => ({
  ...NO_FILTER_CRITERIA,
  toggleCountry: (code) => set((state) => ({ countries: toggleIn(state.countries, code) })),
  toggleState: (value) => set((state) => ({ states: toggleIn(state.states, value) })),
  toggleMunicipality: (value) =>
    set((state) => ({ municipalities: toggleIn(state.municipalities, value) })),
  toggleEmitterCategory: (category) =>
    set((state) => ({ emitterCategories: toggleIn(state.emitterCategories, category) })),
  toggleSinkCategory: (category) =>
    set((state) => ({ sinkCategories: toggleIn(state.sinkCategories, category) })),
  toggleRegion: (value) => set((state) => ({ regions: toggleIn(state.regions, value) })),
  setRural: (rural) => set({ rural }),
  setPeriodOnly: (periodOnly) => set({ periodOnly }),
  setPeriod: (period) =>
    set((state) =>
      state.period?.start === period?.start && state.period?.end === period?.end ? state : { period },
    ),
  setFluxRange: (range) => set({ fluxRange: range }),
  // Model period, not filter.
  clear: () => set((state) => ({ ...NO_FILTER_CRITERIA, period: state.period })),
}));

/** Country picks. */
export const matchesCountry = (node: CO2Node, countries: ReadonlySet<string>): boolean =>
  countries.size === 0 || countries.has(node.country_code ?? "");

/** State picks, emitters only. */
export const matchesState = (node: CO2Node, states: ReadonlySet<string>): boolean =>
  states.size === 0 || !isEmitter(node) || states.has(node.state ?? "");

/** City picks, emitters only. */
export const matchesMunicipality = (node: CO2Node, municipalities: ReadonlySet<string>): boolean =>
  municipalities.size === 0 || !isEmitter(node) || municipalities.has(node.municipality ?? "");

/** Each side narrows itself. */
export const matchesCategory = (
  node: CO2Node,
  emitterCategories: ReadonlySet<string>,
  sinkCategories: ReadonlySet<string>,
): boolean => {
  if (isEmitter(node)) return emitterCategories.size === 0 || emitterCategories.has(node.node_type);
  if (isSink(node)) return sinkCategories.size === 0 || sinkCategories.has(nodeCategory(node));
  // No transport section.
  return true;
};

/** Flux band, emitters only. */
export const matchesFlux = (node: CO2Node, range: FluxRange): boolean => {
  if (range.min === null && range.max === null) return true;
  if (!isEmitter(node)) return true;
  if (node.annual_flux === null) return false;
  const kt = node.annual_flux / 1000;
  if (range.min !== null && kt < range.min) return false;
  if (range.max !== null && kt > range.max) return false;
  return true;
};

/** NUTS 2 regions. */
export const matchesRegion = (node: CO2Node, regions: ReadonlySet<string>): boolean =>
  regions.size === 0 || regions.has(node.nuts2 ?? "");

/** Rural/urban match. */
export const matchesRural = (node: CO2Node, rural: RuralFilter): boolean =>
  rural === "all" || (node.rural != null && node.rural === (rural === "rural"));

/** Operates in period. */
export const operatesIn = (node: CO2Node, period: AssessmentPeriod | null): boolean => {
  if (node.retired) return false;
  if (!period) return true;
  if (node.operating_from != null && node.operating_from > period.end) return false;
  if (node.operating_until != null && node.operating_until <= period.start) return false;
  return true;
};

export const matchesPeriod = (node: CO2Node, period: AssessmentPeriod | null, periodOnly: boolean): boolean =>
  !periodOnly || operatesIn(node, period);

/** Apply every filter. */
export const filterNodes = (nodes: CO2Node[], filters: NodeFilterCriteria): CO2Node[] =>
  nodes.filter(
    (node) =>
      matchesCountry(node, filters.countries) &&
      matchesState(node, filters.states) &&
      matchesMunicipality(node, filters.municipalities) &&
      matchesRegion(node, filters.regions) &&
      matchesRural(node, filters.rural) &&
      matchesPeriod(node, filters.period, filters.periodOnly) &&
      matchesCategory(node, filters.emitterCategories, filters.sinkCategories) &&
      matchesFlux(node, filters.fluxRange),
  );
