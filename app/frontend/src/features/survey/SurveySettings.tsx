import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { applicationLabel, applicationShort } from "./labels";
import { useSurveyLayerStore } from "./surveyLayerStore";
import { useSurveyApplication } from "./useSurveyApplication";
import { SiteVisibility } from "./SiteVisibility";

/** Layer settings. */
export function SurveySettings() {
  const { t } = useTranslation();
  const { metric, setApplication, setMetric } = useSurveyLayerStore();
  const { options, application } = useSurveyApplication();
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1">
        {options.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setApplication(key)}
            title={applicationLabel(t, key)}
            className={cn(
              "truncate rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors",
              application === key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {applicationShort(t, key)}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">{t("survey.shareOf", "Share of residents who")}</span>
        <div className="flex rounded-full bg-muted p-0.5">
          {(["oppose", "support"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                metric === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {key === "oppose" ? t("survey.oppose", "Oppose") : t("survey.support", "Support")}
            </button>
          ))}
        </div>
      </div>
      <SiteVisibility />
    </div>
  );
}
