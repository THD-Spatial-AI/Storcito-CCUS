import { useMemo } from "react";
import { useNodeFilterStore } from "@/features/co2-nodes/stores/nodeFilterStore";
import { useSurveyLayerStore } from "./surveyLayerStore";
import { SURVEY_APPLICATIONS, type SurveyApplicationKey } from "./types";

// Category to application.
const CATEGORY_APPLICATION: Record<string, SurveyApplicationKey> = {
  bioenergy: "biomass",
  biogas: "biomass",
  waste_to_energy: "waste_to_energy",
  storage: "storage",
  greenhouse: "utilisation",
  brewery: "utilisation",
  ccu_chemicals: "utilisation",
  urea: "utilisation",
  mineralization: "utilisation",
  utilisation: "utilisation",
};

/** Options follow categories. */
export const useSurveyApplication = () => {
  const emitters = useNodeFilterStore((state) => state.emitterCategories);
  const sinks = useNodeFilterStore((state) => state.sinkCategories);
  const picked = useSurveyLayerStore((state) => state.application);
  return useMemo(() => {
    const categories = [...emitters, ...sinks];
    if (categories.length === 0) {
      return { options: [...SURVEY_APPLICATIONS], application: picked };
    }
    // Pipelines always apply.
    const wanted = new Set<SurveyApplicationKey>(["pipelines"]);
    for (const category of categories) wanted.add(CATEGORY_APPLICATION[category] ?? "general");
    const options = SURVEY_APPLICATIONS.filter((key) => wanted.has(key));
    const application = options.includes(picked) ? picked : (options.find((key) => key !== "pipelines") ?? options[0]);
    return { options, application };
  }, [emitters, sinks, picked]);
};
