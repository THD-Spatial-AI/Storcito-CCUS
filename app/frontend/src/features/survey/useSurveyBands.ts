import { useMemo } from "react";
import { useNodeFilterStore } from "@/features/co2-nodes/stores/nodeFilterStore";
import { useSurvey } from "./useSurvey";
import { bandsFor, useSurveyLayerStore } from "./surveyLayerStore";
import { useSurveyApplication } from "./useSurveyApplication";

/** Visible-region bands. */
export const useSurveyBands = () => {
  const { data } = useSurvey();
  const metric = useSurveyLayerStore((state) => state.metric);
  const { application } = useSurveyApplication();
  const countries = useNodeFilterStore((state) => state.countries);
  return useMemo(() => {
    const values = (data?.regions ?? [])
      .filter((region) => !region.national && (countries.size === 0 || countries.has(region.country)))
      .map((region) => region.applications[application])
      .filter(Boolean)
      .map((figures) => (metric === "oppose" ? figures.pct_oppose : figures.pct_support));
    return bandsFor(metric, values);
  }, [data, metric, application, countries]);
};
