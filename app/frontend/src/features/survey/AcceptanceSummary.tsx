import { useMemo } from "react";
import { ChevronRight, Users } from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { useNodesQuery } from "@/features/co2-nodes/hooks/useNodesQuery";
import { applicationForNode, nationalFor, regionForNode, useSurvey } from "./useSurvey";
import { LEVEL_TONES, applicationLabel, levelLabel } from "./labels";
import { SurveyRegionCard } from "./SurveyPanel";
import type { SurveyApplicationKey, SurveyRegion } from "./types";

interface RegionGroup {
  region: SurveyRegion;
  applications: Set<SurveyApplicationKey>;
  nodes: number;
}

/** Acceptance per model region. */
export function AcceptanceSummary({ selectedIds }: { selectedIds: number[] }) {
  const { t } = useTranslation();
  const { data } = useSurvey();
  const { data: nodes = [] } = useNodesQuery();

  const { groups, uncovered } = useMemo(() => {
    const regions = data?.regions ?? [];
    const picked = new Set(selectedIds);
    const byKey = new Map<string, RegionGroup>();
    let missing = 0;
    for (const node of nodes) {
      if (!picked.has(node.id)) continue;
      const app = applicationForNode(node);
      const region = regionForNode(node, regions) ?? (app === "storage" ? nationalFor(node.country_code, regions) : undefined);
      if (!region) {
        missing++;
        continue;
      }
      const group = byKey.get(region.key) ?? { region, applications: new Set<SurveyApplicationKey>(["pipelines"]), nodes: 0 };
      group.applications.add(app);
      group.nodes++;
      byKey.set(region.key, group);
    }
    return { groups: [...byKey.values()], uncovered: missing };
  }, [data, nodes, selectedIds]);

  if (!data?.regions.length || groups.length === 0) return null;
  const regions = data.regions;

  return (
    <section className="mt-3 space-y-1.5" data-tour="acceptance-summary">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        {t("survey.summaryTitle", "Public acceptance in the model's regions")}
      </h3>
      <ul className="space-y-1.5">
        {groups.map(({ region, applications, nodes: count }) => {
          const keys = [...applications];
          const contested = keys.filter((key) => region.applications[key]?.contested);
          return (
            <li key={region.key} className="rounded-md border border-border bg-background">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start gap-2 px-2.5 py-2 hover:bg-muted/40">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                      {region.national ? `${region.country} · ${t("survey.nationalFigures", "national figures")}` : region.name}
                      <span className={cn("rounded border px-1.5 text-[10px] font-medium", LEVEL_TONES[region.support_level])}>
                        {levelLabel(t, region.support_level)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {t("survey.summaryNodes", { count, defaultValue_one: "1 node", defaultValue_other: "{{count}} nodes" })}
                      {contested.length > 0 && (
                        <>
                          {" · "}
                          <span className="text-red-700 dark:text-red-400">
                            {t("survey.contestedHere", {
                              applications: contested.map((key) => applicationLabel(t, key)).join(", "),
                              defaultValue: "contested: {{applications}}",
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </summary>
                <div className="border-t border-border px-2.5 py-2">
                  <SurveyRegionCard
                    region={region}
                    national={region.national ? undefined : nationalFor(region.country, regions)}
                    applications={keys}
                  />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
      {uncovered > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {t("survey.uncovered", { count: uncovered, defaultValue_one: "1 node is outside the survey area.", defaultValue_other: "{{count}} nodes are outside the survey area." })}
        </p>
      )}
    </section>
  );
}
