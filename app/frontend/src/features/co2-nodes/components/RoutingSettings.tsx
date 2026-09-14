import type { RoutingInputs } from "../services/nodeService";
import { useTranslation } from "@/i18n";

interface Props {
  value: RoutingInputs;
  onChange: (value: RoutingInputs) => void;
  disabled: boolean;
}

export function routingInputError(value: RoutingInputs): string | null {
  if (!value.modes.length) return "Select a transport mode.";
  if (
    value.capacity_t_per_h !== undefined &&
    (!Number.isFinite(value.capacity_t_per_h) ||
      value.capacity_t_per_h < 18 ||
      value.capacity_t_per_h > 4050)
  ) {
    return "Pipeline capacity must be between 18 and 4050 t/h.";
  }
  return null;
}

const MODES = ["pipeline", "truck", "railway"] as const;

/** Mode picker. */
export function RoutingSettings({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const update = (patch: Partial<RoutingInputs>) => onChange({ ...value, ...patch });

  return (
    <fieldset disabled={disabled} className="space-y-2 rounded-xl border border-border p-3">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("co2Routing.modes", "Transport modes")}
      </legend>
      <div className="flex flex-wrap gap-3 text-xs text-foreground">
        {MODES.map((mode) => (
          <label key={mode} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-border accent-foreground"
              checked={value.modes.includes(mode)}
              onChange={(event) =>
                update({
                  modes: event.target.checked
                    ? [...value.modes, mode]
                    : value.modes.filter((item) => item !== mode),
                })
              }
            />
            {t(`co2Nodes.modes.${mode}`, mode)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
