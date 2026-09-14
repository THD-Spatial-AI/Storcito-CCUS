import { useEffect, useMemo, type ChangeEvent, type FC } from "react";
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2, Sparkles, X, Play } from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

import { Button } from "@spatialhub/ui";
import { dateRangeHasOnlyAvailableDates } from "@/features/configurator/utils/dateAvailability";
import type { AreaSelectState, AreaSelectActions } from "@/features/configurator/types/area-select";
import type { WizardStepsApi } from "@/features/configurator/hooks/area-select/useWizardSteps";
import { MAP_STEP_PANEL_WIDTH, SIDEBAR_PANEL_WIDTH_CSS } from "./wizard";

import {
    LAYERS,
    LAYER_COUNT,
    Layer1ModelInit,
    Layer2NodeSelect,
    Layer3Routes,
    Layer4Costs,
    Layer5FinalReview,
    Layer6SaveCalculate,
    type ConfiguratorContext,
    type DateBounds,
} from "./layers";

interface LayerStepperProps {
    state: AreaSelectState;
    actions: AreaSelectActions;
    selectedNodeCount: number;
    handleModelNameChange: (e: ChangeEvent<HTMLInputElement>) => void;
    getDateBounds: () => DateBounds;
    editMode: boolean;
    modelId?: number;
    onStepChange?: (step: number) => void;
    tourRequestedStep?: number | null;
    onTourStepHandled?: () => void;
    wizard: WizardStepsApi;
}

export const LayerStepper: FC<LayerStepperProps> = ({
    state,
    actions,
    selectedNodeCount,
    handleModelNameChange,
    getDateBounds,
    editMode,
    modelId,
    onStepChange,
    tourRequestedStep,
    onTourStepHandled,
    wizard,
}) => {
    const {
        step,
        hasStarted,
        introPreferenceLoading,
        dismissIntroCard,
        isSavingIntroPreference,
        goNext: advance,
        goBack,
        start,
        setDismissIntroCard,
        setStep,
    } = wizard;
    const { t } = useTranslation();

    useEffect(() => {
        onStepChange?.(hasStarted ? step : 0);
    }, [hasStarted, onStepChange, step]);

    useEffect(() => {
        if (tourRequestedStep == null) return;

        setStep(Math.min(Math.max(tourRequestedStep, 1), LAYER_COUNT));
        onTourStepHandled?.();
    }, [onTourStepHandled, setStep, tourRequestedStep]);

    const ctx: ConfiguratorContext = {
        state,
        actions,
        selectedNodeCount,
        modelId,
        editMode,
        handleModelNameChange,
        getDateBounds,
    };

    const blockingReason = useMemo<string | null>(() => {
        switch (step) {
            case 1: {
                const missing: string[] = [];
                if (!state.modelName.trim()) missing.push(t("configurator.blocking.modelName", "a model name"));
                if (!state.fromDate || !state.toDate) missing.push(t("configurator.blocking.dateRange", "a start and end date"));
                if (state.isLoadingDynamicDates) {
                    return t("configurator.blocking.dynamicLoading", "Loading available dynamic dates.");
                }
                if (state.dynamicDatesError) {
                    return state.dynamicDatesError;
                }
                if (state.availableDynamicDates.length === 0) {
                    return t("configurator.blocking.dynamicEmpty", "No dynamic dates are currently available.");
                }
                if (state.fromDate && state.toDate && state.fromDate > state.toDate) {
                    return t("configurator.blocking.dynamicOrder", "The start date must be before or equal to the end date.");
                }
                if (
                    state.fromDate &&
                    state.toDate &&
                    !dateRangeHasOnlyAvailableDates(state.fromDate, state.toDate, state.availableDynamicDates)
                ) {
                    return t("configurator.blocking.dynamicRange", "Select a fully available dynamic date range.");
                }
                return missing.length
                    ? t("configurator.blocking.missingFields", {
                        missing: missing.join(t("configurator.blocking.and", " and ")),
                        defaultValue: `Please add ${missing.join(" and ")} to continue.`,
                    })
                    : null;
            }
            case 2:
                if (selectedNodeCount === 0) {
                    return t(
                        "configurator.layer2.blockingSelectNodes",
                        "Select at least one node to continue.",
                    );
                }
                return null;
            default:
                return null;
        }
    }, [
        step,
        state.modelName,
        state.fromDate,
        state.toDate,
        state.availableDynamicDates,
        state.isLoadingDynamicDates,
        state.dynamicDatesError,
        selectedNodeCount,
        t,
    ]);

    const canAdvance = blockingReason === null;
    const finalDisabled =
        !state.fromDate ||
        !state.toDate ||
        !state.modelName.trim() ||
        state.fromDate > state.toDate ||
        state.isLoadingDynamicDates ||
        Boolean(state.dynamicDatesError) ||
        !dateRangeHasOnlyAvailableDates(state.fromDate, state.toDate, state.availableDynamicDates) ||
        state.isSaving ||
        selectedNodeCount === 0;

    const goNext = () => {
        if (!canAdvance) return;
        advance();
    };

    if (introPreferenceLoading && !hasStarted) {
        return null;
    }

    if (!hasStarted) {
        return (
            <IntroCard
                onStart={start}
                onCancel={actions.handleCancel}
                dismissIntroCard={dismissIntroCard}
                isSavingPreference={isSavingIntroPreference}
                onDismissIntroPreferenceChange={setDismissIntroCard}
            />
        );
    }

    const currentLayer = LAYERS[step - 1];

    const isMapStep = step === 2;
    // Map stays visible.
    const isMapSidebar = step > 2 && selectedNodeCount > 0;
    const showsMap = isMapStep || isMapSidebar;
    const panelWidth = isMapStep
        ? `${MAP_STEP_PANEL_WIDTH}px`
        : isMapSidebar
            ? SIDEBAR_PANEL_WIDTH_CSS
            : "100%";

    const body = (
        <>
            {/* One-line header. */}
            {isMapStep ? (
                <header className="md-rise mb-2 flex items-baseline gap-2">
                    <h2 className="text-sm font-semibold tracking-tight text-foreground">
                        {t(currentLayer.titleKey, currentLayer.title)}
                    </h2>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {t("configurator.stepper.stepOf", `Step ${step} of ${LAYER_COUNT}`, { step, total: LAYER_COUNT })}
                    </span>
                </header>
            ) : (
                <header className="md-rise mb-8 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("configurator.stepper.stepOf", `Step ${step} of ${LAYER_COUNT}`, { step, total: LAYER_COUNT })}
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                        {t(currentLayer.titleKey, currentLayer.title)}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t(currentLayer.subtitleKey, currentLayer.subtitle)}
                    </p>
                </header>
            )}

            {/* Keyed for motion. */}
            <section key={step} className="md-rise">
                {step === 1 && <Layer1ModelInit ctx={ctx} />}
                {step === 2 && <Layer2NodeSelect ctx={ctx} />}
                {step === 3 && <Layer3Routes ctx={ctx} />}
                {step === 4 && <Layer4Costs ctx={ctx} />}
                {step === 5 && <Layer5FinalReview ctx={ctx} />}
                {step === 6 && <Layer6SaveCalculate ctx={ctx} />}
            </section>
        </>
    );

    const footer = (
                <div className="border-t border-border bg-background px-4 py-3">
                    {blockingReason && (
                        <p
                            className="md-fade-in mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-700 dark:text-amber-300"
                            data-tour="blocking-status"
                        >
                            {blockingReason}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={goBack}
                            disabled={step === 1}
                            className="h-9 cursor-pointer text-xs transition-all duration-200 hover:shadow-md active:scale-[0.98] disabled:hover:shadow-none disabled:active:scale-100"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" /> {t("configurator.stepper.back", "Back")}
                        </Button>

                        {step < LAYER_COUNT ? (
                            <Button size="sm" onClick={goNext} disabled={!canAdvance} className="h-9 cursor-pointer text-xs transition-all duration-200 hover:shadow-md active:scale-[0.98] disabled:hover:shadow-none disabled:active:scale-100">
                                {t("configurator.stepper.continue", "Continue")} <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        ) : (
                            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => actions.handleSave({ runAfterSave: false })}
                                    disabled={finalDisabled}
                                    className="h-9 cursor-pointer text-xs transition-all duration-200 hover:shadow-md active:scale-[0.98] disabled:hover:shadow-none disabled:active:scale-100"
                                >
                                    {state.isSaving ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            {t("configurator.stepper.saving", "Saving...")}
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            {editMode ? t("configurator.stepper.update", "Update") : t("configurator.stepper.save", "Save")}
                                        </>
                                    )}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => actions.handleSave({ runAfterSave: true })}
                                    disabled={finalDisabled}
                                    className="h-9 cursor-pointer border-0 bg-primary text-xs text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-[0.98] disabled:hover:shadow-none disabled:active:scale-100"
                                    data-tour="save-button"
                                >
                                    {state.isSaving ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            {t("configurator.stepper.starting", "Starting...")}
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-3.5 h-3.5" />
                                            {t("configurator.stepper.saveAndRun", "Save & run")}
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
    );

    // Animated width.
    return (
        <div
            data-tour="configurator-panel"
            style={{ width: panelWidth }}
            className={cn(
                "md-scope pointer-events-auto absolute left-0 top-0 z-30 flex h-full max-w-full flex-col overflow-hidden bg-background",
                "transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                showsMap && "border-r border-border shadow-xl",
            )}
        >
            <div className="flex-1 overflow-y-auto">
                <div
                    className={cn(
                        "w-full",
                        isMapStep ? "px-4 py-4" : "mx-auto max-w-3xl px-5 py-8 sm:px-8",
                    )}
                >
                    {body}
                </div>
            </div>
            <div className={cn("w-full shrink-0", !isMapStep && "mx-auto max-w-3xl px-5 pb-4 sm:px-8")}>
                {footer}
            </div>
        </div>
    );
};

// Intro card.

const IntroCard: FC<{
    onStart: () => void;
    onCancel: () => void;
    dismissIntroCard: boolean;
    isSavingPreference: boolean;
    onDismissIntroPreferenceChange: (checked: boolean) => void;
}> = ({ onStart, onCancel, dismissIntroCard, isSavingPreference, onDismissIntroPreferenceChange }) => {
    const { t } = useTranslation();
    return (
    <div className="md-scope pointer-events-auto absolute inset-0 z-30 flex items-center justify-center px-4">
        <div className="md-fade-in absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onCancel} />
        <div className="md-rise relative w-[min(760px,100%)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">

            {/* Header */}
            <div className="relative px-7 pt-7 pb-5">
                <div className="flex items-start gap-4">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                        <Sparkles className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
                            {t("configurator.stepper.introTitle", "New model")}
                        </div>
                        <h2 className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight text-foreground">
                            {t("configurator.stepper.introSubtitle", "Let's set up your simulation")}
                        </h2>
                        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                            {t("configurator.stepper.introDesc", "Six guided steps to define your area, validate inputs and launch a simulation.")}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label={t("common.close", "Close")}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Steps grid */}
            <div className="relative border-t border-border/60 bg-muted/30 px-7 py-5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {LAYERS.map((l, idx) => (
                        <div
                            key={l.id}
                            style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                            className="md-row-in group relative flex items-start gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5 transition-colors duration-200 hover:border-foreground/40"
                        >
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                                {l.icon}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-[10px] font-semibold text-muted-foreground">
                                        {t("configurator.stepper.step", "STEP")} {l.id}
                                    </span>
                                </div>
                                <div className="truncate text-[13px] font-semibold leading-tight text-foreground">
                                    {t(l.titleKey, l.title)}
                                </div>
                                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                    {t(l.subtitleKey, l.subtitle)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="relative flex items-center justify-between gap-3 border-t border-border/60 px-7 py-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {t("configurator.stepper.introProgressSaved", "Your progress is saved as you go")}
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-foreground">
                        <input
                            type="checkbox"
                            checked={dismissIntroCard}
                            onChange={(event) => onDismissIntroPreferenceChange(event.target.checked)}
                            className="h-3.5 w-3.5 rounded border-border accent-foreground"
                        />
                        <span>{t("configurator.stepper.introDontShow", "Don't show this intro again")}</span>
                        {isSavingPreference && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </label>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={onCancel} className="cursor-pointer text-xs transition-all duration-200 active:scale-[0.98]">
                        {t("configurator.stepper.introCancel", "Cancel")}
                    </Button>
                    <Button
                        size="sm"
                        onClick={onStart}
                        className="cursor-pointer border-0 bg-primary text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-[0.98]"
                    >
                        {t("configurator.stepper.introStart", "Get started")} <ChevronRight className="ml-0.5 h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    </div>
);
};
