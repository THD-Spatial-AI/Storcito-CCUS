import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Step } from "react-joyride";
import { TourController } from "./TourController";
import { useTranslation } from "@/i18n";
import {
  TourStepHeader,
  TourStepContent,
  TourTipBox,
  TourDescription,
  TourIcons,
} from "./TourStepComponents";

interface AreaSelectTourProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
  onConfiguratorStepChange?: (step: number) => void;
}

const CONFIGURATOR_STEP_BY_TOUR_INDEX: Array<number | null> = [
  null,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  4,
  5,
  5,
];

const useAreaSelectSteps = (): Step[] => {
  const { t } = useTranslation();

  return useMemo((): Step[] => {
    const steps: Step[] = [
      {
        target: "body",
        content: (
          <TourStepContent spacing="large">
            <TourStepHeader
              icon={TourIcons.map("w-5 h-5 text-foreground")}
              title={t("tour.areaSelect.welcome.title")}
              variant="large"
            />
            <TourDescription variant="muted">
              {t("tour.areaSelect.welcome.description")}
            </TourDescription>
            <TourTipBox icon={TourIcons.info("w-4 h-4 text-muted-foreground")}>
              {t("tour.areaSelect.welcome.tip")}
            </TourTipBox>
          </TourStepContent>
        ),
        placement: "center",
        disableBeacon: true,
      },
      {
        target: '[data-tour="model-name"]',
        content: (
          <TourStepContent>
            <TourStepHeader
              icon={TourIcons.edit("w-4 h-4 text-background")}
              title={t("tour.areaSelect.modelName.title")}
            />
            <TourDescription>{t("tour.areaSelect.modelName.description")}</TourDescription>
            <TourTipBox icon={TourIcons.pencil("w-4 h-4 text-muted-foreground")} variant="compact">
              {t("tour.areaSelect.modelName.tip")}
            </TourTipBox>
          </TourStepContent>
        ),
        placement: "left",
      },
      {
        target: '[data-tour="date-range"]',
        content: (
          <TourStepContent>
            <TourStepHeader
              icon={TourIcons.calendar("w-4 h-4 text-background")}
              title={t("tour.areaSelect.dateRange.title")}
            />
            <TourDescription>{t("tour.areaSelect.dateRange.description")}</TourDescription>
            <TourTipBox
              icon={TourIcons.lightning("w-4 h-4 text-muted-foreground")}
              variant="compact"
            >
              {t("tour.areaSelect.dateRange.tip")}
            </TourTipBox>
          </TourStepContent>
        ),
        placement: "left",
      },
      {
        target: '[data-tour="calculation-status"]',
        content: (
          <TourStepContent>
            <TourStepHeader
              icon={TourIcons.info("w-4 h-4 text-background")}
              title={t("tour.areaSelect.calculationStatus.title", "Calculation status")}
            />
            <TourDescription>
              {t(
                "tour.areaSelect.calculationStatus.description",
                "This line tells you whether available dates are loading, unavailable, errored, or ready for selection."
              )}
            </TourDescription>
            <TourTipBox
              icon={TourIcons.checkCircle("w-4 h-4 text-muted-foreground")}
              variant="compact"
            >
              {t(
                "tour.areaSelect.calculationStatus.tip",
                "If this shows a blocker, the continue button stays disabled until the date selection is valid."
              )}
            </TourTipBox>
          </TourStepContent>
        ),
        placement: "left",
      },
      {
        target: '[data-tour="node-selection"]',
        content: (
          <TourStepContent>
            <TourStepHeader
              icon={TourIcons.location("w-4 h-4 text-background")}
              title={t("tour.areaSelect.nodes.title", "Node selection")}
            />
            <TourDescription>
              {t(
                "tour.areaSelect.nodes.description",
                "Choose the CO2 sources and sinks the model routes between."
              )}
            </TourDescription>
            <TourTipBox
              icon={TourIcons.info("w-4 h-4 text-muted-foreground")}
              variant="compact"
            >
              {t(
                "tour.areaSelect.nodes.tip",
                "At least one node is required before the model can continue."
              )}
            </TourTipBox>
          </TourStepContent>
        ),
        placement: "right",
      },
      {
        target: '[data-tour="precomputed-map"]',
        content: (
          <TourStepContent>
            <TourStepHeader
              icon={TourIcons.lightning("w-4 h-4 text-background")}
              title={t("tour.areaSelect.precomputed.title", "Precomputed regional map")}
            />
            <TourDescription>
              {t(
                "tour.areaSelect.precomputed.description",
                "Every night the whole region is analysed with all risk layers enabled. If your single dynamic date is covered, this switch clips your area's result from that map and returns it in seconds."
              )}
            </TourDescription>
            <TourTipBox icon={TourIcons.info("w-4 h-4 text-muted-foreground")} variant="compact">
              {t(
                "tour.areaSelect.precomputed.tip",
                "When the switch is unavailable, the text below it explains why, and the model computes every step for your area instead."
              )}
            </TourTipBox>
          </TourStepContent>
        ),
        placement: "right",
      },
      {
        target: '[data-tour="custom-data"]',
        content: (
          <TourStepContent>
            <TourStepHeader
              icon={TourIcons.chart("w-4 h-4 text-background")}
              title={t("tour.areaSelect.customData.title", "Custom data")}
            />
            <TourDescription>
              {t(
                "tour.areaSelect.customData.description",
                "Optionally upload weather station data (Excel or CSV) for this area; it is used to compute the weather index. If left empty, the bundled regional data is used."
              )}
            </TourDescription>
          </TourStepContent>
        ),
        placement: "right",
      },
      {
        target: '[data-tour="final-review"]',
        content: (
          <TourStepContent>
            <TourStepHeader
              icon={TourIcons.checkCircle("w-4 h-4 text-background")}
              title={t("tour.areaSelect.finalReview.title", "Validation status")}
            />
            <TourDescription>
              {t(
                "tour.areaSelect.finalReview.description",
                "The review step checks the model name, date, AOI, risk components, and buffer before the run can start."
              )}
            </TourDescription>
          </TourStepContent>
        ),
        placement: "right",
      },
      {
        target: '[data-tour="save-run-summary"]',
        content: (
          <TourStepContent>
            <TourStepHeader
              icon={TourIcons.clipboard("w-4 h-4 text-background")}
              title={t("tour.areaSelect.saveSummary.title", "Save summary")}
            />
            <TourDescription>
              {t(
                "tour.areaSelect.saveSummary.description",
                "This final summary shows the values that will be saved with the model and sent to the calculation workflow."
              )}
            </TourDescription>
          </TourStepContent>
        ),
        placement: "right",
      },
      {
        target: '[data-tour="save-button"]',
        content: (
          <TourStepContent>
            <TourStepHeader
              icon={TourIcons.save("w-4 h-4 text-background")}
              title={t("tour.areaSelect.save.title")}
            />
            <TourDescription>{t("tour.areaSelect.save.description")}</TourDescription>
            <TourTipBox
              icon={TourIcons.checkCircle("w-4 h-4 text-muted-foreground")}
              variant="compact"
            >
              {t("tour.areaSelect.save.tip")}
            </TourTipBox>
          </TourStepContent>
        ),
        placement: "top",
      },
    ];

    return steps.map((step) => ({ ...step, disableBeacon: true }));
  }, [t]);
};

export const AreaSelectTour: React.FC<AreaSelectTourProps> = ({
  isOpen,
  onComplete,
  onSkip,
  onConfiguratorStepChange,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isStepReady, setIsStepReady] = useState(true);
  const areaSelectSteps = useAreaSelectSteps();

  // Same batch as the step.
  const changeStep = useCallback((next: number) => {
    setIsStepReady(false);
    setStepIndex(next);
  }, []);

  // Reset on open.
  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const targetConfiguratorStep = CONFIGURATOR_STEP_BY_TOUR_INDEX[stepIndex] ?? null;

    setIsStepReady(false);
    if (targetConfiguratorStep) {
      onConfiguratorStepChange?.(targetConfiguratorStep);
    }

    const timeout = window.setTimeout(
      () => {
        setIsStepReady(true);
      },
      targetConfiguratorStep ? 220 : 0
    );

    return () => window.clearTimeout(timeout);
  }, [isOpen, onConfiguratorStepChange, stepIndex]);

  // Keep target visible.
  useEffect(() => {
    if (!isOpen || !isStepReady) return;
    const currentTarget = areaSelectSteps[stepIndex]?.target;
    if (typeof currentTarget !== "string" || currentTarget === "body") return;

    const timeout = window.setTimeout(() => {
      const target = document.querySelector(currentTarget);
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [areaSelectSteps, isOpen, isStepReady, stepIndex]);

  return (
    <TourController
      steps={areaSelectSteps}
      run={isOpen && isStepReady}
      stepIndex={stepIndex}
      setStepIndex={changeStep}
      onComplete={onComplete}
      onSkip={onSkip}
    />
  );
};
