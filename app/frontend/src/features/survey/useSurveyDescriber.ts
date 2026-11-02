import { useCallback } from "react";
import { useTranslation } from "@/i18n";
import type { CO2Node } from "@/features/co2-nodes/types";
import { applicationForNode, nationalFor, regionForNode, useSurvey } from "./useSurvey";
import { applicationLabel, levelLabel } from "./labels";

/** Tooltip acceptance line. */
export const useSurveyDescriber = () => {
  const { t } = useTranslation();
  const { data } = useSurvey();
  return useCallback(
    (node: CO2Node): string | null => {
      const regions = data?.regions ?? [];
      if (regions.length === 0) return null;
      const app = applicationForNode(node);
      const region = regionForNode(node, regions) ?? (app === "storage" ? nationalFor(node.country_code, regions) : undefined);
      if (!region) return t("survey.noData", "No survey data for this location.");
      const figures = region.applications[app];
      return t("survey.tooltip", {
        region: region.national ? t("survey.nationalFigures", "national figures") : region.name,
        level: levelLabel(t, region.support_level),
        application: applicationLabel(t, app),
        support: Math.round(figures.pct_support),
        oppose: Math.round(figures.pct_oppose),
        defaultValue: "Public acceptance ({{region}}): {{level}} · {{application}} {{support}}% for, {{oppose}}% against",
      });
    },
    [data, t],
  );
};
