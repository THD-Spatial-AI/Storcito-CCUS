import type { LucideIcon } from "lucide-react";
import { Check, Spline, TrainFront, Truck } from "lucide-react";
import { Switch, cn } from "@spatialhub/ui";
import type { RoutingInputs, TransportMode } from "../services/nodeService";
import { MODE_COLORS } from "../hooks/useNodeOLLayers";
import { useTranslation } from "@/i18n";

interface Props {
  value: RoutingInputs;
  onChange: (value: RoutingInputs) => void;
  disabled: boolean;
}

export function routingInputError(value: RoutingInputs): string | null {
  if (!value.modes.length) return "Select a transport mode.";
  return null;
}

const MODES: Array<{ mode: TransportMode; icon: LucideIcon; hint: string }> = [
  { mode: "pipeline", icon: Spline, hint: "Least-cost corridor" },
  { mode: "truck", icon: Truck, hint: "Road network" },
  { mode: "railway", icon: TrainFront, hint: "Rail network" },
];

/** Mode picker. */
export function RoutingSettings({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const update = (patch: Partial<RoutingInputs>) => onChange({ ...value, ...patch });
  const toggle = (mode: TransportMode) =>
    update({
      modes: value.modes.includes(mode)
        ? value.modes.filter((item) => item !== mode)
        : [...value.modes, mode],
    });

  return (
    <fieldset disabled={disabled} className="space-y-3 disabled:opacity-60">
      <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("co2Routing.modes", "Transport modes")}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {MODES.map(({ mode, icon: Icon, hint }) => {
          const active = value.modes.includes(mode);
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(mode)}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-foreground/20 bg-card shadow-sm"
                  : "border-border bg-muted/20 text-muted-foreground hover:border-foreground/20 hover:bg-card",
              )}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                style={{
                  backgroundColor: active ? `${MODE_COLORS[mode]}1f` : undefined,
                  color: active ? MODE_COLORS[mode] : undefined,
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-foreground">{t(`co2Nodes.modes.${mode}`, mode)}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{t(`co2Routing.modeHints.${mode}`, hint)}</span>
              </span>
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  active ? "border-transparent text-white" : "border-border",
                )}
                style={{ backgroundColor: active ? MODE_COLORS[mode] : undefined }}
              >
                {active && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-foreground">{t("co2Routing.optimize", "Respect sink capacity")}</span>
          <span className="block text-[11px] leading-snug text-muted-foreground">
            {t("co2Routing.optimizeHint", "Solve the assignment so no sink takes more than it can store. Otherwise each emitter takes its cheapest sink.")}
          </span>
        </span>
        <Switch
          checked={value.optimize}
          onCheckedChange={(checked) => update({ optimize: checked })}
          aria-label={t("co2Routing.optimize", "Respect sink capacity")}
        />
      </label>
    </fieldset>
  );
}
