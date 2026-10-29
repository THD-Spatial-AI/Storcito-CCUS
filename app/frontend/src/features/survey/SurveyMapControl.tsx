import { ChevronDown, Info, Users } from "lucide-react";
import { Switch } from "@spatialhub/ui";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { nationalFor, useSurvey } from "./useSurvey";
import { useSurveyApplication } from "./useSurveyApplication";
import { SurveySettings } from "./SurveySettings";
import { applicationLabel } from "./labels";
import { RegionDetail } from "./RegionDetail";
import { useSurveyLayerStore } from "./surveyLayerStore";
import { useSurveyBands } from "./useSurveyBands";
import type { SurveyRegion } from "./types";

function Legend() {
  const { t } = useTranslation();
  const { limits, colors, min, max } = useSurveyBands();
  const metric = useSurveyLayerStore((state) => state.metric);
  const { application } = useSurveyApplication();
  const ticks = [min, ...limits, max];
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium text-foreground">
        {metric === "oppose"
          ? t("survey.legendOppose", "% of rural residents who oppose")
          : t("survey.legendSupport", "% of rural residents who support")}
        <span className="font-normal text-muted-foreground"> · {applicationLabel(t, application)}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full">
        {colors.map((color) => (
          <div key={color} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="relative mt-1 h-3 text-[9px] tabular-nums text-muted-foreground">
        {ticks.map((tick, i) => (
          <span
            key={`${i}-${tick}`}
            className={cn("absolute", i === 0 ? "left-0" : i === ticks.length - 1 ? "right-0" : "-translate-x-1/2")}
            style={i > 0 && i < ticks.length - 1 ? { left: `${(i / colors.length) * 100}%` } : undefined}
          >
            {tick}%
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
        {metric === "oppose"
          ? t("survey.readOppose", "Darker = more residents oppose. Labels on the map show each region's %.")
          : t("survey.readSupport", "Darker = more residents support. Labels on the map show each region's %.")}
      </p>
      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="h-2 w-3.5 rounded-sm border border-dashed border-slate-400 bg-slate-400/10" />
        {t("survey.noDataShort", "No survey data")}
      </div>
    </div>
  );
}

/** Source and caveats. */
function AboutData({ regions }: { regions: SurveyRegion[] }) {
  const { t } = useTranslation();
  const national = regions.filter((region) => region.national);
  const total = national.reduce((sum, region) => sum + region.respondents, 0);
  const perCountry = national.map((region) => `${region.country} ${region.respondents.toLocaleString()}`).join(" · ");
  const items = [
    t("survey.about.source", {
      total: total.toLocaleString(),
      countries: perCountry,
      defaultValue: "Source: RUB survey (STORCITO D5.2), {{total}} rural respondents ({{countries}}).",
    }),
    t("survey.about.regions", "Small regions are merged (e.g. Gelderland and Flevoland, Berlin with Brandenburg and Mecklenburg-Vorpommern). Bremen has no data."),
    t("survey.about.oppose", "Oppose = answered 1–3, support = 5–7 on a 7-point scale."),
    t("survey.about.scale", "Colours compare the regions shown; the % labels give the real values."),
    t("survey.about.caveat", "Indicative only: rural residents, regional averages, no targeting (D5.3)."),
  ];
  return (
    <details className="group mt-2 border-t border-border/60 pt-1.5">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground">
        <ChevronDown className="h-3 w-3 -rotate-90 transition-transform group-open:rotate-0" />
        {t("survey.about.title", "About this data")}
      </summary>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] leading-snug text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </details>
  );
}

/** Legend and details. */
export function SurveyMapControl() {
  const { t } = useTranslation();
  const title = t("survey.title", "Public acceptance");
  const { data } = useSurvey();
  const { enabled, seen, selectedKey, select, setEnabled } = useSurveyLayerStore();
  const { application } = useSurveyApplication();
  const regions = data?.regions ?? [];
  const selected = regions.find((region) => region.key === selectedKey);

  if (!enabled) {
    return (
      <div className="absolute bottom-4 right-4 z-20">
        <label className="relative flex cursor-pointer items-center gap-3 rounded-full border border-primary/50 bg-primary/10 py-1.5 pl-3 pr-1.5 text-xs text-primary shadow-lg ring-4 ring-primary/10 backdrop-blur-md transition-colors hover:bg-primary/15">
          {!seen && (
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
          )}
          <span className="flex items-center gap-1.5 font-semibold">
            <Users className="h-4 w-4" />
            {title}
          </span>
          <Switch checked={false} onCheckedChange={setEnabled} aria-label={title} />
        </label>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-20 flex max-h-[calc(100%-2rem)] flex-row-reverse items-end gap-2">
      <div className="w-64 shrink-0 rounded-2xl border border-border bg-card/95 p-3 text-xs shadow-lg backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="font-semibold">{title}</span>
          </span>
          <Switch checked onCheckedChange={setEnabled} aria-label={title} />
        </div>
        <p className="-mt-1 mb-2 text-[10px] leading-snug text-muted-foreground">
          {t("survey.cardIntro", "Survey of rural residents (RUB, 2026): share who support or oppose each CCUS use, by region.")}
        </p>
        {regions.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">{t("survey.loading", "Loading survey data…")}</p>
        ) : (
          <>
            <SurveySettings />
            <div className="mt-2.5 border-t border-border/60 pt-2">
              <Legend />
            </div>
            <AboutData regions={regions} />
          </>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
          <span>{t("survey.mapHintShort", "Click a region for details")}</span>
          <span className="flex items-center gap-1">
            <span title="© EuroGeographics (boundaries) · © OpenStreetMap contributors (lakes)">© EuroGeographics, OSM</span>
            <span title={t("survey.caveatShort", "Indicative: rural respondents, RUB survey (D5.2). No targeting (D5.3).")}>
              <Info className="h-3 w-3 cursor-help" />
            </span>
          </span>
        </div>
      </div>

      {selected && (
        <RegionDetail
          region={selected}
          national={nationalFor(selected.country, regions)}
          application={application}
          onClose={() => select(null)}
          className="md-fade-in w-64 max-h-full"
        />
      )}
    </div>
  );
}
