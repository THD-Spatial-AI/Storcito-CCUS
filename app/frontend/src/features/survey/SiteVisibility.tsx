import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { EMITTER_COLOR, SINK_COLOR } from "@/features/co2-nodes/hooks/useNodeOLLayers";
import { useSurveyLayerStore } from "./surveyLayerStore";

type DotMode = "all" | "emitters" | "sinks" | "none";

const MODES: { key: DotMode; emitters: boolean; sinks: boolean; label: string }[] = [
  { key: "all", emitters: true, sinks: true, label: "All" },
  { key: "emitters", emitters: true, sinks: false, label: "Emitters" },
  { key: "sinks", emitters: false, sinks: true, label: "Sinks" },
  { key: "none", emitters: false, sinks: false, label: "None" },
];

/** Which dots show. */
export function SiteVisibility() {
  const { t } = useTranslation();
  const { showEmitters, showSinks, setShowEmitters, setShowSinks } = useSurveyLayerStore();
  const current = MODES.find((mode) => mode.emitters === showEmitters && mode.sinks === showSinks)?.key ?? "all";

  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium text-foreground">{t("survey.dotsOnMap", "Dots on map")}</div>
      <div className="grid grid-cols-4 rounded-lg bg-muted p-0.5">
        {MODES.map((mode) => (
          <button
            key={mode.key}
            type="button"
            aria-pressed={current === mode.key}
            onClick={() => {
              setShowEmitters(mode.emitters);
              setShowSinks(mode.sinks);
            }}
            className={cn(
              "flex items-center justify-center gap-1 rounded-md px-1 py-1 text-[10px] font-medium transition-colors",
              current === mode.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {mode.key === "emitters" && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EMITTER_COLOR }} />}
            {mode.key === "sinks" && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SINK_COLOR }} />}
            {t(`survey.dots.${mode.key}`, mode.label)}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground">{t("survey.dotsHint", "Selected sites always stay visible.")}</p>
    </div>
  );
}
