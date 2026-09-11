import type { ChangeEvent } from "react";
import type { DateValue } from "@internationalized/date";
import type { AreaSelectState, AreaSelectActions } from "@/features/configurator/types/area-select";

export interface DateBounds {
    minValue: DateValue;
    maxValue: DateValue;
    minYear: number;
    maxYear: number;
}

export interface ConfiguratorContext {
    state: AreaSelectState;
    actions: AreaSelectActions;
    selectedNodeCount: number;
    modelId?: number;
    editMode: boolean;
    handleModelNameChange: (e: ChangeEvent<HTMLInputElement>) => void;
    getDateBounds: () => DateBounds;
}
