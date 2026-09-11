import { useMemo, type FC } from "react";
import { DateRangePicker, Dialog, Group, Label, Popover, Button as Trigger } from "react-aria-components";
import { parseDate } from "@internationalized/date";
import { CalendarIcon } from "lucide-react";
import { useTranslation } from "@/i18n";

import { DateInput } from "@/components/ui/datefield-rac";
import { DATE_INPUT_STYLE } from "@/components/ui/datefield-rac.consts";
import { RangeCalendar } from "@/components/ui/calendar-rac";
import { cn } from "@/lib/utils";
import { dateRangeHasOnlyAvailableDates } from "@/features/configurator/utils/dateAvailability";

import { LayerShell } from "./shared/LayerShell";
import { QuestionSection } from "../wizard";
import type { ConfiguratorContext } from "./types";

function formatDateValue(value: { year: number; month: number; day: number }) {
    return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function getDynamicDateStatus(
    dynamicDatesError: string | undefined,
    isLoadingDynamicDates: boolean,
    availableDynamicDates: string[],
    fromDate: string,
    toDate: string,
    days: number,
    t: (key: string, data?: any) => string
) {
    if (dynamicDatesError) return dynamicDatesError;
    if (isLoadingDynamicDates) return t("configurator.layer1.dynamicLoading", "Loading available dynamic dates...");
    if (availableDynamicDates.length === 0) return t("configurator.layer1.dynamicEmpty", "No dynamic dates available.");
    if (fromDate && toDate && dateRangeHasOnlyAvailableDates(fromDate, toDate, availableDynamicDates)) {
        if (days === 1) return t("configurator.layer1.dynamicSelectedOne", { start: fromDate, end: toDate, defaultValue: `Selected range: ${fromDate} to ${toDate} (1 day).` });
        return t("configurator.layer1.dynamicSelected", { start: fromDate, end: toDate, days, defaultValue: `Selected range: ${fromDate} to ${toDate} (${days} days).` });
    }
    if (fromDate || toDate) {
        return t("configurator.layer1.dynamicSelectInside", { start: availableDynamicDates[0], end: availableDynamicDates.at(-1), defaultValue: `Select a range inside available dynamic dates: ${availableDynamicDates[0]} to ${availableDynamicDates.at(-1)}` });
    }
    return t("configurator.layer1.dynamicAvailable", { start: availableDynamicDates[0], end: availableDynamicDates.at(-1), defaultValue: `Available dynamic dates: ${availableDynamicDates[0]} to ${availableDynamicDates.at(-1)}` });
}

export const Layer1ModelInit: FC<{ ctx: ConfiguratorContext }> = ({ ctx }) => {
    const { t } = useTranslation();
    const { state, actions, handleModelNameChange, getDateBounds } = ctx;
    const bounds = getDateBounds();
    const orderedDynamicDates = useMemo(() => [...state.availableDynamicDates].sort(), [state.availableDynamicDates]);
    const dynamicDateSet = useMemo(() => new Set(orderedDynamicDates), [orderedDynamicDates]);
    const dynamicBounds = useMemo(() => {
        if (orderedDynamicDates.length === 0) return bounds;
        const minValue = parseDate(orderedDynamicDates[0]);
        const maxValue = parseDate(orderedDynamicDates[orderedDynamicDates.length - 1]);
        return {
            minValue,
            maxValue,
            minYear: minValue.year,
            maxYear: maxValue.year,
        };
    }, [bounds, orderedDynamicDates]);
    const isDynamicDateUnavailable = useMemo(
        () => (dateValue: { year: number; month: number; day: number }) => !dynamicDateSet.has(formatDateValue(dateValue)),
        [dynamicDateSet],
    );
    const isDynamicPickerDisabled =
        state.isLoadingDynamicDates || Boolean(state.dynamicDatesError) || orderedDynamicDates.length === 0;
    const dynamicRangeValue =
        state.fromDate && state.toDate && dynamicDateSet.has(state.fromDate) && dynamicDateSet.has(state.toDate)
            ? { start: parseDate(state.fromDate), end: parseDate(state.toDate) }
            : null;
    const handleDynamicRangeChange = (range: {
        start: { year: number; month: number; day: number };
        end: { year: number; month: number; day: number };
    } | null) => {
        if (!range) return;
        const startDay = formatDateValue(range.start);
        const endDay = formatDateValue(range.end);
        if (!dateRangeHasOnlyAvailableDates(startDay, endDay, dynamicDateSet)) {
            return;
        }
        actions.handleUpdateRange({ start: range.start, end: range.end });
    };

    const days =
        state.fromDate && state.toDate
            ? Math.max(
                  1,
                  Math.floor(
                      (new Date(state.toDate).getTime() - new Date(state.fromDate).getTime()) / (1000 * 60 * 60 * 24),
                  ) + 1,
            )
            : 0;

    const dynamicDateStatus = getDynamicDateStatus(
        state.dynamicDatesError,
        state.isLoadingDynamicDates,
        orderedDynamicDates,
        state.fromDate,
        state.toDate,
        days,
        t
    );

    return (
        <LayerShell
            purpose={t("configurator.layer1.purpose", "Name this simulation and choose the date window you want to assess.")}
            nextStepHint={t("configurator.layer1.nextStepHint", "Next you'll outline the geographic area on the map.")}
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
                            placeholder={t("configurator.layer1.modelNamePlaceholder", "e.g. Summer 2026 Assessment")}
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
                >
                <div data-tour="date-range">
                        <DateRangePicker
                            value={dynamicRangeValue}
                            minValue={dynamicBounds.minValue}
                            maxValue={dynamicBounds.maxValue}
                            isDateUnavailable={isDynamicDateUnavailable}
                            allowsNonContiguousRanges={false}
                            isDisabled={isDynamicPickerDisabled}
                            onChange={handleDynamicRangeChange}
                            className="*:not-first:mt-1"
                        >
                            <Label className="text-foreground text-xs font-medium">
                                {t("simulation.simulationPeriod")} <span className="text-destructive">*</span>
                            </Label>
                            <div className="flex">
                                <Group className={cn(DATE_INPUT_STYLE, "xl:px-0 lg:px-2 relative")}>
                                    <DateInput slot="start" unstyled className="text-xs pl-2.5 pr-1 py-1.5 flex-1" />
                                    <span aria-hidden="true" className="text-muted-foreground/70 px-1.5 py-1.5">–</span>
                                    <DateInput slot="end" unstyled className="text-xs pl-1 pr-9 py-1.5 flex-1" />
                                    <Trigger className="text-muted-foreground/80 hover:text-foreground absolute inset-0 flex items-center justify-end pr-2.5 cursor-pointer">
                                        <CalendarIcon size={14} />
                                    </Trigger>
                                </Group>
                            </div>
                            <Popover className="bg-popover z-50 rounded-md border border-border shadow-lg outline-hidden" offset={4}>
                                <Dialog className="max-h-[inherit] overflow-auto p-2">
                                    <RangeCalendar
                                        onChange={handleDynamicRangeChange}
                                        minValue={dynamicBounds.minValue}
                                        maxValue={dynamicBounds.maxValue}
                                        minYear={dynamicBounds.minYear}
                                        maxYear={dynamicBounds.maxYear}
                                        isDateUnavailable={isDynamicDateUnavailable}
                                        allowsNonContiguousRanges={false}
                                    />
                                </Dialog>
                            </Popover>
                        </DateRangePicker>
                        <p className="md-fade-in mt-1 text-[11px] text-muted-foreground" data-tour="calculation-status">
                            {dynamicDateStatus}
                        </p>
                </div>
                </QuestionSection>
            </div>
        </LayerShell>
    );
};
