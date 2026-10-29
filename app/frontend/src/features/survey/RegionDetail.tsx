import { ChevronDown, X } from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { LEVEL_TONES, applicationLabel, applicationShort, channelLabel, factorLabel, levelLabel, suggestionText } from "./labels";
import { SURVEY_APPLICATIONS, type SurveyApplicationKey, type SurveyRegion } from "./types";

const pct = (value: number | undefined) => (typeof value === "number" ? `${Math.round(value)}%` : "—");

function Stat({ label, value, national, tone }: { label: string; value?: number; national?: number; tone?: string }) {
  const { t } = useTranslation();
  const diff = typeof value === "number" && typeof national === "number" ? Math.round(value - national) : null;
  return (
    <div className="rounded-lg bg-muted/60 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-base font-semibold leading-tight tabular-nums", tone)}>{pct(value)}</div>
      {diff !== null && (
        <div className="text-[9px] tabular-nums text-muted-foreground">
          {t("survey.vsNational", { diff: `${diff > 0 ? "+" : ""}${diff}`, defaultValue: "{{diff}} vs national" })}
        </div>
      )}
    </div>
  );
}

function Chips({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px]">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Region results. */
export function RegionDetail({ region, national, application, onClose, className }: {
  region: SurveyRegion;
  national?: SurveyRegion;
  application: SurveyApplicationKey;
  // Hidden when absent.
  onClose?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const figures = region.applications[application];
  const base = national?.applications[application];
  const contested = SURVEY_APPLICATIONS.filter((key) => region.applications[key]?.contested);
  return (
    <div className={cn("min-h-0 space-y-2.5 overflow-y-auto rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{region.name}</h3>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={cn("rounded-full border px-1.5 text-[10px] font-medium", LEVEL_TONES[region.support_level])}>
              {levelLabel(t, region.support_level)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {t("survey.respondents", { count: region.respondents, defaultValue: "n = {{count}}" })}
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("common.close", "Close")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div>
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {applicationLabel(t, application)}
        </div>
        {/* RUB asked no petition question for CCUS in general. */}
        <div className={cn("grid gap-1.5", typeof figures.pct_petition_against === "number" ? "grid-cols-3" : "grid-cols-2")}>
          <Stat label={t("survey.support", "Support")} value={figures.pct_support} national={base?.pct_support} tone="text-emerald-600 dark:text-emerald-400" />
          <Stat label={t("survey.oppose", "Oppose")} value={figures.pct_oppose} national={base?.pct_oppose} tone="text-red-600 dark:text-red-400" />
          {typeof figures.pct_petition_against === "number" && (
            <Stat label={t("survey.petitionShort", "Petition against")} value={figures.pct_petition_against} national={base?.pct_petition_against} />
          )}
        </div>
      </div>

      {contested.length > 0 && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-2 py-1 text-[10px] text-red-700 dark:text-red-400">
          {t("survey.contestedHere", {
            applications: contested.map((key) => applicationShort(t, key)).join(", "),
            defaultValue: "Contested: {{applications}}",
          })}
        </p>
      )}

      <Chips title={t("survey.topFactors", "What matters most")} items={region.top_factors.map((key) => factorLabel(t, key))} />
      <Chips title={t("survey.topChannels", "Most trusted sources")} items={region.top_channels.map((key) => channelLabel(t, key))} />

      {region.suggestions.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3 w-3 -rotate-90 transition-transform group-open:rotate-0" />
            {t("survey.suggestionsCount", { count: region.suggestions.length, defaultValue: "Suggestions ({{count}})" })}
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-snug">
            {region.suggestions.map((suggestion) => (
              <li key={suggestion.code}>{suggestionText(t, suggestion)}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-[9px] leading-snug text-muted-foreground">
        {t("survey.caveatShort", "Indicative: rural respondents, RUB survey (D5.2). No targeting (D5.3).")}
      </p>
    </div>
  );
}
