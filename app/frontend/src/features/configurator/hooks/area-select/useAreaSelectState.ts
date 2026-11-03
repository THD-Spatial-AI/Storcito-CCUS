import { useCallback, useEffect, useState } from "react";
import { settingsService } from "@/features/settings";
import {
  DEFAULT_END_YEAR,
  DEFAULT_START_YEAR,
  yearEnd,
  yearStart,
} from "@/features/configurator/utils/assessmentYears";
import type {
  DateRangeSelection,
} from "@/features/configurator/types/area-select";

export interface UseAreaSelectStateOptions {
  editMode: boolean;
}

export const useAreaSelectState = ({ editMode }: UseAreaSelectStateOptions) => {
  const [modelName, setModelName] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [usePrecomputed, setUsePrecomputed] = useState(true);
  const [originalConfig, setOriginalConfig] = useState<Record<string, unknown> | undefined>(
    undefined
  );

  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);

  const [showAreaSelectTour, setShowAreaSelectTour] = useState(false);

  const handleUpdateRange = useCallback((e: DateRangeSelection) => {
    const formatDate = ({ year, month, day }: { year: number; month: number; day: number }) =>
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setFromDate(formatDate(e.start));
    setToDate(formatDate(e.end));
  }, []);

  // Default 2030–2040.
  useEffect(() => {
    if (editMode || fromDate || toDate) return;
    setFromDate(yearStart(DEFAULT_START_YEAR));
    setToDate(yearEnd(DEFAULT_END_YEAR));
  }, [editMode, fromDate, toDate]);

  useEffect(() => {
    if (editMode) return;
    let cancelled = false;
    (async () => {
      try {
        const data = (await settingsService.getAllSettings()) as Record<string, unknown>;
        if (!cancelled && data && !data.area_select_tour_completed) {
          setTimeout(() => !cancelled && setShowAreaSelectTour(true), 1000);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editMode]);

  useEffect(() => {
    const handleRestartTour = () => setShowAreaSelectTour(true);
    globalThis.addEventListener("restart-area-select-tour", handleRestartTour);
    return () => globalThis.removeEventListener("restart-area-select-tour", handleRestartTour);
  }, []);

  const handleTourComplete = useCallback(() => {
    setShowAreaSelectTour(false);
    void settingsService.markAreaSelectTourCompleted();
  }, []);

  const handleTourSkip = useCallback(() => {
    setShowAreaSelectTour(false);
    void settingsService.markAreaSelectTourCompleted();
  }, []);

  return {
    // form fields
    modelName,
    setModelName,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    usePrecomputed,
    setUsePrecomputed,
    originalConfig,
    setOriginalConfig,
    // node input
    selectedNodeIds,
    setSelectedNodeIds,
    // Optional layers.
    // Optional uploads.
    // tour
    showAreaSelectTour,
    setShowAreaSelectTour,
    handleUpdateRange,
    handleTourComplete,
    handleTourSkip,
  };
};

export type AreaSelectStateApi = ReturnType<typeof useAreaSelectState>;
