import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  LEVEL_TONES,
  applicationLabel,
  channelLabel,
  comparisonLabel,
  factorLabel,
  levelLabel,
  levelMessage,
  suggestionText,
} from "./labels";
import type { SurveyApplicationKey, SurveyRegion } from "./types";

const pct = (value: number | undefined) => (typeof value === "number" ? `${Math.round(value)}%` : "—");

/** Indicative-data caveat. */
export function SurveyCaveat({ respondents }: { respondents: number }) {
  const { t } = useTranslation();
  return (
    <p className="text-[11px] leading-snug text-muted-foreground">
      {t("survey.caveat", {
        count: respondents,
        defaultValue:
          "Indicative only: {{count}} rural respondents, RUB survey (STORCITO D5.2). Descriptive results; no targeting (D5.3).",
      })}
    </p>
  );
}

function ApplicationRows({ region, national, keys }: { region: SurveyRegion; national?: SurveyRegion; keys: SurveyApplicationKey[] }) {
  const { t } = useTranslation();
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground">
          <th className="py-1 text-left font-normal">{t("survey.application", "Application")}</th>
          <th className="py-1 text-right font-normal">{t("survey.support", "Support")}</th>
          <th className="py-1 text-right font-normal">{t("survey.oppose", "Oppose")}</th>
          <th className="py-1 text-right font-normal">{t("survey.petitionAgainst", "Petition against")}</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => {
          const app = region.applications[key];
          const base = national?.applications[key];
          return (
            <tr key={key} className="border-t border-border align-top">
              <th className="py-1 text-left font-normal">
                {applicationLabel(t, key)}
                {app.contested && (
                  <span className="ml-1.5 rounded border border-red-500/40 bg-red-500/10 px-1 text-[10px] text-red-700 dark:text-red-400">
                    {t("survey.contested", "Contested")}
                  </span>
                )}
              </th>
              {[
                [app.pct_support, base?.pct_support],
                [app.pct_oppose, base?.pct_oppose],
                [app.pct_petition_against, base?.pct_petition_against],
              ].map(([value, reference], index) => (
                <td key={index} className="py-1 text-right tabular-nums">
                  {pct(value)}
                  {base && !region.national && (
                    <span className="block text-[10px] text-muted-foreground">
                      {t("survey.nationalShort", { value: pct(reference), defaultValue: "national {{value}}" })}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** One region's results. */
export function SurveyRegionCard({
  region,
  national,
  applications,
  compact = false,
}: {
  region: SurveyRegion;
  national?: SurveyRegion;
  applications: SurveyApplicationKey[];
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const diff = region.diff_to_national;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-medium", LEVEL_TONES[region.support_level])}>
          {levelLabel(t, region.support_level)}
        </span>
        {region.comparison && (
          <span className="text-[11px] text-muted-foreground">
            {comparisonLabel(t, region.comparison)}
            {typeof diff === "number" && national && (
              <>
                {" "}
                ({diff > 0 ? "+" : ""}
                {diff.toFixed(2)}; {t("survey.nationalIndex", { value: national.support_index.toFixed(2), defaultValue: "national {{value}}" })})
              </>
            )}
          </span>
        )}
      </div>
      {!compact && <p className="text-xs text-muted-foreground">{levelMessage(t, region.support_level)}</p>}
      <ApplicationRows region={region} national={national} keys={applications} />
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <div className="text-muted-foreground">{t("survey.topFactors", "What matters most")}</div>
          <ul>
            {region.top_factors.map((key) => (
              <li key={key}>
                {factorLabel(t, key)} <span className="tabular-nums text-muted-foreground">{pct(region.factors[key])}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-muted-foreground">{t("survey.topChannels", "Most trusted sources")}</div>
          <ul>
            {region.top_channels.map((key) => (
              <li key={key}>
                {channelLabel(t, key)}{" "}
                <span className="tabular-nums text-muted-foreground">{pct(region.channels[key]?.pct_trusts)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {!compact && region.suggestions.length > 0 && (
        <div className="text-xs">
          <div className="text-muted-foreground">{t("survey.suggestionsTitle", "Suggestions for communication")}</div>
          <ul className="list-disc space-y-0.5 pl-4">
            {region.suggestions.map((suggestion) => (
              <li key={suggestion.code}>{suggestionText(t, suggestion)}</li>
            ))}
          </ul>
        </div>
      )}
      <SurveyCaveat respondents={region.respondents} />
    </div>
  );
}
