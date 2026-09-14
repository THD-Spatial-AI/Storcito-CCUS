import { useNotification } from '@/features/notifications';
import { useTranslation } from '@/i18n';
import type {
    AreaSelectState,
    AreaSelectActions,
    UseAreaSelectProps,
} from '@/features/configurator/types/area-select';
import { useAreaSelectState } from './area-select/useAreaSelectState';
import { useModelCreation } from './area-select/useModelCreation';

export { type AreaData } from '@/features/configurator/types/area-select';

export const useAreaSelect = ({
    onAreaSelected,
    onCancel,
    editMode = false,
    existingModelId,
}: UseAreaSelectProps) => {
    const state = useAreaSelectState({ editMode });
    const { t } = useTranslation();
    const { notification, showSuccess, showError, hide } = useNotification();

    const creation = useModelCreation({
        state,
        onAreaSelected,
        onCancel,
        editMode,
        existingModelId,
        onError: showError,
        errorMessages: {
            create: t('configurator.save.createFailed', 'The model could not be created. Please try again.'),
            save: t('configurator.save.updateFailed', 'The model could not be saved. Please try again.'),
            uploadInputs: t('configurator.save.uploadFailed', 'The model was saved, but its input files could not be uploaded.'),
            startCalculation: t('configurator.save.calculationFailed', 'The model was saved, but the calculation could not be started.'),
        },
    });

    const exposedState: AreaSelectState = {
        modelName: state.modelName,
        fromDate: state.fromDate,
        toDate: state.toDate,
        bufferDistance: state.bufferDistance,
        usePrecomputed: state.usePrecomputed,
        availablePrecomputedDates: state.availablePrecomputedDates,
        availableDynamicDates: state.availableDynamicDates,
        isLoadingDynamicDates: state.isLoadingDynamicDates,
        dynamicDatesError: state.dynamicDatesError,
        isSaving: creation.isSaving,
        isLoadingModel: creation.isLoadingModel,
        showAreaSelectTour: state.showAreaSelectTour,
        selectedNodeIds: state.selectedNodeIds,
        stationDataName: state.stationDataName,
        stationDataError: state.stationDataError,
    };

    const actions: AreaSelectActions = {
        setModelName: state.setModelName,
        setSelectedNodeIds: state.setSelectedNodeIds,
        setBufferDistance: state.setBufferDistance,
        setUsePrecomputed: state.setUsePrecomputed,
        handleUpdateRange: state.handleUpdateRange,
        setShowAreaSelectTour: state.setShowAreaSelectTour,
        handleTourComplete: state.handleTourComplete,
        handleTourSkip: state.handleTourSkip,
        handleSave: creation.handleSave,
        handleCancel: creation.handleCancel,
        setStationDataFile: state.setStationDataFile,
    };

    return {
        state: exposedState,
        actions,
        notification: { data: notification, showSuccess, showError, hide },
    };
};
