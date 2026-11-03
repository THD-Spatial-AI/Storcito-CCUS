import type { ChangeEvent } from "react";
import type { AreaSelectState, AreaSelectActions } from "@/features/configurator/types/area-select";

export interface ConfiguratorContext {
    state: AreaSelectState;
    actions: AreaSelectActions;
    selectedNodeCount: number;
    modelId?: number;
    editMode: boolean;
    handleModelNameChange: (e: ChangeEvent<HTMLInputElement>) => void;
}
