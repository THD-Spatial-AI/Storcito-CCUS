import { useQuery } from "@tanstack/react-query";
import axios from "@/lib/axios";
import type { CO2Node } from "@/features/co2-nodes/types";
import type { SurveyApplicationKey, SurveyData, SurveyRegion } from "./types";

const getSurvey = async (): Promise<SurveyData> => {
  const { data } = await axios.get<{ success: boolean; data: SurveyData }>("/survey/regions");
  return data.data;
};

// Cached 30 min.
export const useSurvey = () =>
  useQuery({ queryKey: ["survey-regions"], queryFn: getSurvey, staleTime: 30 * 60 * 1000, retry: 2 });

// Longest prefix wins.
export const regionForNuts = (code: string, regions: SurveyRegion[]): SurveyRegion | undefined => {
  let best: SurveyRegion | undefined;
  let bestLength = 0;
  for (const region of regions) {
    if (region.national) continue;
    const prefix = region.nuts.find((p) => code.startsWith(p) && p.length > bestLength);
    if (prefix) {
      best = region;
      bestLength = prefix.length;
    }
  }
  return best;
};

/** NUTS, else state. */
export const regionForNode = (node: CO2Node, regions: SurveyRegion[]): SurveyRegion | undefined => {
  const code = (node.nuts3 || node.nuts2 || node.nuts1 || "").toUpperCase();
  const match = code ? regionForNuts(code, regions) : undefined;
  if (match) return match;
  const state = node.state?.trim();
  if (!state) return undefined;
  return regions.find((region) => !region.national && region.country === node.country_code && region.states.includes(state));
};

export const nationalFor = (country: string | null | undefined, regions: SurveyRegion[]): SurveyRegion | undefined =>
  regions.find((region) => region.national && region.country === country);

/** Node's survey application. */
export const applicationForNode = (node: CO2Node): SurveyApplicationKey => {
  switch (node.node_type) {
    case "storage":
      return "storage";
    case "utilisation":
      return "utilisation";
    case "bioenergy":
    case "biogas":
      return "biomass";
    case "waste_to_energy":
      return "waste_to_energy";
    default:
      return "general";
  }
};
