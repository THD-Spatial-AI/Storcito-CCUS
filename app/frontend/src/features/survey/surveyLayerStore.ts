import { create } from "zustand";
import type { SurveyApplicationKey } from "./types";

export type SurveyMetric = "oppose" | "support";

interface SurveyLayerState {
  enabled: boolean;
  // Used once.
  seen: boolean;
  application: SurveyApplicationKey;
  metric: SurveyMetric;
  selectedKey: string | null;
  // Dots while shading.
  showEmitters: boolean;
  showSinks: boolean;
  setEnabled: (enabled: boolean) => void;
  setApplication: (application: SurveyApplicationKey) => void;
  setMetric: (metric: SurveyMetric) => void;
  select: (key: string | null) => void;
  setShowEmitters: (show: boolean) => void;
  setShowSinks: (show: boolean) => void;
}

const SEEN_KEY = "survey-layer-seen";

const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
};

const writeSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage unavailable.
  }
};

export const useSurveyLayerStore = create<SurveyLayerState>((set) => ({
  enabled: false,
  seen: readSeen(),
  application: "storage",
  metric: "oppose",
  selectedKey: null,
  showEmitters: true,
  showSinks: true,
  setEnabled: (enabled) => {
    if (enabled) writeSeen();
    set(enabled ? { enabled, seen: true } : { enabled, selectedKey: null });
  },
  setApplication: (application) => set({ application }),
  setMetric: (metric) => set({ metric }),
  select: (selectedKey) => set({ selectedKey }),
  setShowEmitters: (showEmitters) => set({ showEmitters }),
  setShowSinks: (showSinks) => set({ showSinks }),
}));

// Sequential palettes.
export const PALETTES: Record<SurveyMetric, string[]> = {
  oppose: ["#fcbba1", "#fc9272", "#fb6a4a", "#de2d26", "#a50f15"],
  support: ["#c7e9c0", "#a1d99b", "#74c476", "#31a354", "#006d2c"],
};

export interface Bands {
  limits: number[];
  colors: string[];
  // Scale ends.
  min: number;
  max: number;
}

/** Equal-step bands. */
export const bandsFor = (metric: SurveyMetric, values: number[]): Bands => {
  const colors = PALETTES[metric];
  let lo = values.length ? Math.floor(Math.min(...values)) : 0;
  let hi = values.length ? Math.ceil(Math.max(...values)) : 100;
  // Minimum five points.
  if (hi - lo < colors.length) {
    lo = Math.max(0, lo - 1);
    hi = lo + colors.length;
  }
  const step = (hi - lo) / colors.length;
  const limits = Array.from({ length: colors.length - 1 }, (_, i) => Math.round(lo + step * (i + 1)));
  return { limits, colors, min: lo, max: hi };
};

export const bandColor = ({ limits, colors }: Bands, value: number): string => {
  const index = limits.findIndex((limit) => value < limit);
  return colors[index === -1 ? colors.length - 1 : index];
};
