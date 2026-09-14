import { useCallback, useEffect, useState } from "react";
import { settingsService } from "@/features/settings";
import {
  DEFAULT_BUFFER_DISTANCE,
  clampBuffer,
} from "@/features/configurator/constants/buffer-distance";
import {
  DUMMY_DYNAMIC_DATES,
  DUMMY_PRECOMPUTED_DATES,
  dummyDatesEnabled,
} from "@/features/configurator/utils/dummyDates";
import { webservicesService } from "@/features/admin-dashboard";
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
  const [bufferDistance, setBufferDistanceRaw] = useState<number>(DEFAULT_BUFFER_DISTANCE);
  const [usePrecomputed, setUsePrecomputed] = useState(true);
  const [availableDynamicDates, setAvailableDynamicDates] = useState<string[]>([]);
  const [availablePrecomputedDates, setAvailablePrecomputedDates] = useState<string[]>([]);
  const [isLoadingDynamicDates, setIsLoadingDynamicDates] = useState(true);
  const [dynamicDatesError, setDynamicDatesError] = useState<string | undefined>();
  const [originalConfig, setOriginalConfig] = useState<Record<string, unknown> | undefined>(
    undefined
  );

  // Optional uploads.
  const [stationDataFile, setStationDataFileRaw] = useState<File | null>(null);
  const [stationDataName, setStationDataName] = useState<string | undefined>();
  const [stationDataError, setStationDataError] = useState<string | undefined>();

  const setStationDataFile = useCallback((file: File | null) => {
    if (!file) {
      setStationDataFileRaw(null);
      setStationDataName(undefined);
      setStationDataError(undefined);
      return;
    }
    if (!/\.(xlsx|xls|csv|txt)$/i.test(file.name)) {
      setStationDataError("Use an Excel (.xlsx/.xls) or CSV (.csv) file.");
      return;
    }
    setStationDataError(undefined);
    setStationDataFileRaw(file);
    setStationDataName(file.name);
  }, []);

  const setStoredStationDataName = useCallback((name?: string) => {
    setStationDataFileRaw(null);
    setStationDataName(name);
    setStationDataError(undefined);
  }, []);

  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);

  const [showAreaSelectTour, setShowAreaSelectTour] = useState(false);

  const setBufferDistance = useCallback((value: number) => {
    setBufferDistanceRaw(clampBuffer(value));
  }, []);

  const handleUpdateRange = useCallback((e: DateRangeSelection) => {
    const formatDate = ({ year, month, day }: { year: number; month: number; day: number }) =>
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setFromDate(formatDate(e.start));
    setToDate(formatDate(e.end));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoadingDynamicDates(true);
        setDynamicDatesError(undefined);
        const [dynamicDates, precomputedDates] = await Promise.all([
          webservicesService.getAvailableDynamicDates(),
          webservicesService.getAvailablePrecomputedDates().catch(() => []),
        ]);
        if (!cancelled) {
          const useDummy = dummyDatesEnabled();
          const withFallback = (dates: string[], fallback: () => string[]) =>
            dates.length === 0 && useDummy ? fallback() : dates;

          setAvailableDynamicDates([...new Set(withFallback(dynamicDates, DUMMY_DYNAMIC_DATES))].sort());
          setAvailablePrecomputedDates(
            [...new Set(withFallback(precomputedDates, DUMMY_PRECOMPUTED_DATES))].sort(),
          );
        }
      } catch {
        if (!cancelled) {
          if (dummyDatesEnabled()) {
            setAvailableDynamicDates(DUMMY_DYNAMIC_DATES());
            setAvailablePrecomputedDates(DUMMY_PRECOMPUTED_DATES());
          } else {
            setAvailableDynamicDates([]);
            setDynamicDatesError("Unable to load available dynamic dates.");
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDynamicDates(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Preselect dummy date.
  useEffect(() => {
    if (editMode || !dummyDatesEnabled() || fromDate || toDate) return;
    const start = availableDynamicDates.at(-3) ?? availableDynamicDates[0];
    const end = availableDynamicDates.at(-1);
    if (start && end) {
      setFromDate(start);
      setToDate(end);
    }
  }, [availableDynamicDates, editMode, fromDate, toDate]);

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
    bufferDistance,
    setBufferDistance,
    setBufferDistanceRaw,
    usePrecomputed,
    setUsePrecomputed,
    availablePrecomputedDates,
    availableDynamicDates,
    isLoadingDynamicDates,
    dynamicDatesError,
    originalConfig,
    setOriginalConfig,
    // node input
    selectedNodeIds,
    setSelectedNodeIds,
    // Optional layers.
    // Optional uploads.
    stationDataFile,
    stationDataName,
    stationDataError,
    setStationDataFile,
    setStoredStationDataName,
    // tour
    showAreaSelectTour,
    setShowAreaSelectTour,
    handleUpdateRange,
    handleTourComplete,
    handleTourSkip,
  };
};

export type AreaSelectStateApi = ReturnType<typeof useAreaSelectState>;
