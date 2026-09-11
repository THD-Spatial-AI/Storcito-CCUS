import { create } from "zustand";

import { isEmitter, isSink, type CO2Node } from "../types";

/** Emissions band, kt/yr. */
export interface FluxRange {
  min: number | null;
  max: number | null;
}

export const NO_FLUX_RANGE: FluxRange = { min: null, max: null };

/** Shared catalogue filters. */
export interface NodeFilterCriteria {
  countries: ReadonlySet<string>;
  states: ReadonlySet<string>;
  municipalities: ReadonlySet<string>;
  emitterCategories: ReadonlySet<string>;
  sinkCategories: ReadonlySet<string>;
  fluxRange: FluxRange;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

export const NO_FILTER_CRITERIA: NodeFilterCriteria = {
  countries: EMPTY_SET,
  states: EMPTY_SET,
  municipalities: EMPTY_SET,
  emitterCategories: EMPTY_SET,
  sinkCategories: EMPTY_SET,
  fluxRange: NO_FLUX_RANGE,
};

/** Category filters. */
interface NodeFilterStore extends NodeFilterCriteria {
  // Empty means all.
  toggleCountry: (code: string) => void;
  toggleState: (state: string) => void;
  toggleMunicipality: (municipality: string) => void;
  toggleEmitterCategory: (category: string) => void;
  toggleSinkCategory: (category: string) => void;
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
  setFluxRange: (range) => set({ fluxRange: range }),
  clear: () => set({ ...NO_FILTER_CRITERIA }),
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
  if (isSink(node)) return sinkCategories.size === 0 || sinkCategories.has(node.node_type);
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

/** Apply every filter. */
export const filterNodes = (nodes: CO2Node[], filters: NodeFilterCriteria): CO2Node[] =>
  nodes.filter(
    (node) =>
      matchesCountry(node, filters.countries) &&
      matchesState(node, filters.states) &&
      matchesMunicipality(node, filters.municipalities) &&
      matchesCategory(node, filters.emitterCategories, filters.sinkCategories) &&
      matchesFlux(node, filters.fluxRange),
  );
