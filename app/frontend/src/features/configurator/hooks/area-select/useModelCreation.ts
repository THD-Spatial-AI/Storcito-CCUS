import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { modelService } from "@/features/model-dashboard";
import {
  useCreateModelMutation,
  useUpdateModelMutation2,
} from "@/features/model-dashboard";
import { useWorkspaceStore } from "@/components/workspace";
import { clampBuffer } from "@/features/configurator/constants/buffer-distance";
import { dateRangeHasOnlyAvailableDates } from "@/features/configurator/utils/dateAvailability";
import type { AreaData, UseAreaSelectProps } from "@/features/configurator/types/area-select";
import {
  asRecord,
  getDateInputValue,
  getSelectedNodeIdsFromConfig,
} from "./utils";
import type { AreaSelectStateApi } from "./useAreaSelectState";

const SAVE_DELAY_MS = 1200;
const DASHBOARD_ROUTE = "/app/model-dashboard";

export interface UseModelCreationOptions extends Pick<
  UseAreaSelectProps,
  "onAreaSelected" | "onCancel" | "editMode" | "existingModelId"
> {
  state: AreaSelectStateApi;
  onError?: (message: string) => void;
  /** Translated fallbacks. */
  errorMessages?: {
    save?: string;
    create?: string;
    uploadInputs?: string;
    startCalculation?: string;
  };
}

const describeError = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { data?: { error?: string; message?: string } } })
    ?.response;
  const serverMessage = response?.data?.error ?? response?.data?.message;
  if (typeof serverMessage === "string" && serverMessage.trim()) return serverMessage.trim();
  const message = (error as { message?: string })?.message;
  if (typeof message === "string" && message.trim()) return `${fallback} (${message.trim()})`;
  return fallback;
};

export const useModelCreation = ({
  state,
  onAreaSelected,
  onCancel,
  editMode = false,
  existingModelId,
  onError,
  errorMessages,
}: UseModelCreationOptions) => {
  const navigate = useNavigate();
  const params = useParams();
  const modelId = editMode ? existingModelId || Number.parseInt(params.id || "0", 10) : undefined;

  const createModelMutation = useCreateModelMutation();
  const updateModelMutation = useUpdateModelMutation2();
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  const {
    modelName,
    fromDate,
    toDate,
    bufferDistance,
    usePrecomputed,
    availablePrecomputedDates,
    availableDynamicDates,
    selectedNodeIds,
    originalConfig,
    stationDataFile,
    setModelName,
    setBufferDistanceRaw,
    setOriginalConfig,
    setSelectedNodeIds,
    setFromDate,
    setToDate,
    setStoredStationDataName,
  } = state;

  // Edit-mode load.
  useEffect(() => {
    if (!editMode || !modelId) return;
    let cancelled = false;
    setIsLoadingModel(true);
    (async () => {
      try {
        const response = await modelService.getModelById(modelId);
        if (cancelled || !response.success || !response.data) return;
        const model = response.data;
        if (model.title) setModelName(model.title);
        const cfg = asRecord(model.config);
        if (cfg) {
          setOriginalConfig(cfg);
          const rawBuffer = cfg.buffer_distance;
          if (typeof rawBuffer === "number") {
            setBufferDistanceRaw(clampBuffer(rawBuffer));
          }
        }
        const loadedNodeIds = cfg ? getSelectedNodeIdsFromConfig(cfg) : [];
        if (loadedNodeIds.length) setSelectedNodeIds(loadedNodeIds);
        const loadedUserInputs = cfg ? asRecord(cfg.user_inputs) : undefined;
        if (loadedUserInputs) {
          if (typeof loadedUserInputs.station_data === "string") {
            setStoredStationDataName(loadedUserInputs.station_data);
          }
        }
        const loadedFromDate = getDateInputValue(model.from_date);
        if (loadedFromDate) setFromDate(loadedFromDate);
        const loadedToDate = getDateInputValue(model.to_date);
        if (loadedToDate) setToDate(loadedToDate);
      } catch {
        /* ignore load errors */
      } finally {
        if (!cancelled) setIsLoadingModel(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, modelId]);

  // Save / cancel.────────────────
  const handleCancel = useCallback((): void => {
    if (onCancel) {
      onCancel();
      return;
    }
    navigate(DASHBOARD_ROUTE);
  }, [onCancel, navigate]);

  const handleSave = useCallback(
    async (opts?: { runAfterSave?: boolean }): Promise<void> => {
      if (!fromDate || !toDate || !modelName.trim() || selectedNodeIds.length === 0) return;
      if (fromDate > toDate) return;
      if (!dateRangeHasOnlyAvailableDates(fromDate, toDate, availableDynamicDates)) return;
      setIsSaving(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, SAVE_DELAY_MS));
        const areaData: AreaData = {
          fromDate,
          toDate,
          bufferDistance,
          usePrecomputed,
          modelName: modelName.trim(),
          timestamp: new Date().toISOString(),
          selectedNodeIds,
        };

        if (onAreaSelected) {
          onAreaSelected(areaData);
          return;
        }

        const originalParameters = asRecord(originalConfig?.parameters);

        const modelData = {
          title: areaData.modelName,
          from_date: areaData.fromDate,
          to_date: areaData.toDate,
          workspace_id: currentWorkspace?.id,
          config: {
            ...(originalConfig ?? {}),
            buffer_distance: areaData.bufferDistance,
            parameters: {
              ...(originalParameters ?? {}),
              calculation_mode: "dynamic",
              co2_node_ids: selectedNodeIds,
              // Off: compute fresh.
              force_compute: !(
                areaData.usePrecomputed &&
                fromDate === toDate &&
                availablePrecomputedDates.includes(fromDate)
              ),
            },
          } as Record<string, unknown>,
        };

        let savedModelId: number | undefined;
        if (editMode && modelId) {
          await updateModelMutation.mutateAsync({ id: modelId, data: modelData });
          savedModelId = modelId;
        } else {
          const created = await createModelMutation.mutateAsync(modelData);
          savedModelId = created?.data?.id;
        }

        // Upload optional inputs.
        if (savedModelId && stationDataFile) {
          try {
            await modelService.uploadModelInputs(savedModelId, {
              stationData: stationDataFile,
            });
          } catch (error) {
            onError?.(
              describeError(
                error,
                errorMessages?.uploadInputs ??
                  "The model was saved, but its input files could not be uploaded."
              )
            );
          }
        }

        if (opts?.runAfterSave && savedModelId) {
          try {
            await modelService.startCalculation(savedModelId);
          } catch (error) {
            onError?.(
              describeError(
                error,
                errorMessages?.startCalculation ??
                  "The model was saved, but the calculation could not be started."
              )
            );
          }
        }

        navigate(DASHBOARD_ROUTE, { state: { workspaceId: currentWorkspace?.id } });
      } catch (error) {
        // Surface save errors.
        onError?.(
          describeError(
            error,
            editMode
              ? errorMessages?.save ?? "The model could not be saved. Please try again."
              : errorMessages?.create ?? "The model could not be created. Please try again."
          )
        );
      } finally {
        setIsSaving(false);
      }
    },
    [
      fromDate,
      toDate,
      modelName,
      selectedNodeIds,
      bufferDistance,
      usePrecomputed,
      availablePrecomputedDates,
      availableDynamicDates,
      editMode,
      modelId,
      onAreaSelected,
      currentWorkspace?.id,
      originalConfig,
      stationDataFile,
      updateModelMutation,
      createModelMutation,
      navigate,
      onError,
      errorMessages,
    ]
  );

  return {
    isSaving,
    isLoadingModel,
    handleSave,
    handleCancel,
  };
};

export type ModelCreationApi = ReturnType<typeof useModelCreation>;
