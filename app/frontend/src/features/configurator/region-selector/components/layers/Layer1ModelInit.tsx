import type { FC } from "react";
import { ArrowRight, CalendarRange } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@spatialhub/ui";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

import {
    ASSESSMENT_YEARS,
    MAX_ASSESSMENT_YEAR,
    MIN_ASSESSMENT_YEAR,
    formatPeriod,
    periodYears,
    yearOf,
} from "@/features/configurator/utils/assessmentYears";

import { LayerShell } from "./shared/LayerShell";
import { QuestionSection } from "../wizard";
import type { ConfiguratorContext } from "./types";

// Common periods.
const PRESETS: [number, number][] = [
    [2025, 2030],
    [2030, 2040],
    [2030, 2050],
    [2040, 2050],
];
const HORIZONS = [2025, 2030, 2040, 2050];
const SPAN = MAX_ASSESSMENT_YEAR - MIN_ASSESSMENT_YEAR;
const offset = (year: number) => `${((year - MIN_ASSESSMENT_YEAR) / SPAN) * 100}%`;

/** Period end. */
const YearSelect: FC<{ label: string; value: number | null; onChange: (year: number) => void }> = ({
    label,
    value,
    onChange,
}) => {
    const years = value === null || ASSESSMENT_YEARS.includes(value) ? ASSESSMENT_YEARS : [value, ...ASSESSMENT_YEARS];
    return (
        <Select value={value === null ? undefined : String(value)} onValueChange={(next) => onChange(Number(next))}>
            <SelectTrigger
                aria-label={label}
                className="h-auto flex-1 justify-between rounded-xl border-border bg-card px-3 py-2 text-left shadow-sm transition-colors duration-150 hover:border-muted-foreground/40"
            >
                <div className="flex items-center gap-2.5">
                    <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col items-start">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                            <SelectValue placeholder="—" />
                        </span>
                    </div>
                </div>
            </SelectTrigger>
            <SelectContent className="max-h-64">
                {years.map((year) => (
                    <SelectItem key={year} value={String(year)} className="tabular-nums">
                        {year}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export const Layer1ModelInit: FC<{ ctx: ConfiguratorContext }> = ({ ctx }) => {
    const { t } = useTranslation();
    const { state, actions, handleModelNameChange } = ctx;
    const startYear = yearOf(state.fromDate);
    const endYear = yearOf(state.toDate);
    const years = periodYears(state.fromDate, state.toDate);
    const setPeriod = (start: number, end: number) =>
        actions.handleUpdateRange({ start: { year: start, month: 1, day: 1 }, end: { year: end, month: 12, day: 31 } });

    return (
        <LayerShell
            purpose={t("configurator.layer1.purpose", "Name this assessment and choose the years it covers.")}
            nextStepHint={t("configurator.layer1.nextStepHint", "Next you'll choose the CO₂ sources and sinks.")}
        >
            <div className="space-y-8">
                <QuestionSection
                    index={1}
                    title={t("configurator.layer1.modelNameQuestion", "What do you want to call this model?")}
                    description={t("configurator.layer1.modelNameHint", "So you can find it later.")}
                >
                    <div data-tour="model-name">
                        <input
                            id="layer-model-name"
                            type="text"
                            value={state.modelName}
                            onChange={handleModelNameChange}
                            placeholder={t("configurator.layer1.modelNamePlaceholder", "e.g. Rhine–Ruhr storage 2030–2040")}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-colors duration-150 hover:border-muted-foreground/40 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {!state.modelName.trim() && (
                            <div className="md-fade-in mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-muted-foreground">
                                    {t("configurator.layer1.suggestedNamesLabel", "Quick picks")}:
                                </span>
                                {[1, 2, 3, 4].map((n) => {
                                    const suggestion = t(`configurator.layer1.suggestedName${n}`);
                                    return (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => actions.setModelName(suggestion)}
                                            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors duration-150 hover:border-muted-foreground/40 hover:bg-muted hover:text-foreground"
                                        >
                                            {suggestion}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </QuestionSection>

                <QuestionSection
                    index={2}
                    title={t("configurator.layer1.periodQuestion", "Which period should it assess?")}
                    description={t(
                        "configurator.layer1.periodHint",
                        "Whole years. Sites count while they operate in the period, and capture costs follow STORE_CO2's 2025–2050 horizons.",
                    )}
                >
                    <div data-tour="date-range" className="space-y-2">
                        <span className="text-xs font-medium text-foreground">
                            {t("configurator.layer1.assessmentPeriod", "Assessment Period")} <span className="text-destructive">*</span>
                        </span>
                        <div className="flex items-center gap-2">
                            <YearSelect
                                label={t("configurator.layer1.startYear", "Start year")}
                                value={startYear}
                                onChange={(year) => setPeriod(year, Math.max(year, endYear ?? year))}
                            />
                            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                            <YearSelect
                                label={t("configurator.layer1.endYear", "End year")}
                                value={endYear}
                                onChange={(year) => setPeriod(Math.min(year, startYear ?? year), year)}
                            />
                        </div>

                        {startYear !== null && endYear !== null && (
                            <div className="px-1 pt-3" aria-hidden="true">
                                <div className="relative h-1.5 rounded-full bg-muted">
                                    <div
                                        className="absolute inset-y-0 rounded-full bg-primary transition-all duration-300"
                                        style={{
                                            left: offset(Math.max(startYear, MIN_ASSESSMENT_YEAR)),
                                            right: `calc(100% - ${offset(Math.min(endYear, MAX_ASSESSMENT_YEAR))})`,
                                            minWidth: "0.375rem",
                                        }}
                                    />
                                    {HORIZONS.map((year) => (
                                        <span
                                            key={year}
                                            className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-foreground/30"
                                            style={{ left: offset(year) }}
                                        />
                                    ))}
                                </div>
                                <div className="relative mt-1 h-3.5 text-[10px] tabular-nums text-muted-foreground">
                                    {HORIZONS.map((year) => (
                                        <span
                                            key={year}
                                            className={cn(
                                                "absolute",
                                                year === MIN_ASSESSMENT_YEAR
                                                    ? "translate-x-0"
                                                    : year === MAX_ASSESSMENT_YEAR
                                                      ? "-translate-x-full"
                                                      : "-translate-x-1/2",
                                            )}
                                            style={{ left: offset(year) }}
                                        >
                                            {year}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {PRESETS.map(([start, end]) => {
                                const active = startYear === start && endYear === end;
                                return (
                                    <button
                                        key={`${start}-${end}`}
                                        type="button"
                                        onClick={() => setPeriod(start, end)}
                                        aria-pressed={active}
                                        className={cn(
                                            "rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors duration-150",
                                            active
                                                ? "border-primary/40 bg-primary/10 text-primary"
                                                : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted hover:text-foreground",
                                        )}
                                    >
                                        {start}–{end}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="md-fade-in text-[11px] text-muted-foreground" data-tour="calculation-status">
                            {years > 0
                                ? t("configurator.layer1.periodSelected", {
                                      period: formatPeriod(state.fromDate, state.toDate),
                                      count: years,
                                      defaultValue: "{{period}} · {{count}} years",
                                  })
                                : t("configurator.layer1.periodMissing", "Choose a start and end year.")}
                        </p>
                    </div>
                </QuestionSection>
            </div>
        </LayerShell>
    );
};
