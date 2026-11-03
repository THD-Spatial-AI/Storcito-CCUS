
interface DateParts {
	year: number;
	month: number;
	day: number;
}

export interface DateRangeSelection {
	start: DateParts;
	end: DateParts;
}

export interface AreaData {
	fromDate: string;
	toDate: string;
	usePrecomputed: boolean;
	modelName: string;
	timestamp: string;
	selectedNodeIds: number[];
}

export interface UseAreaSelectProps {
	onAreaSelected?: (areaData: AreaData) => void;
	onCancel?: () => void;
	editMode?: boolean;
	existingModelId?: number;
}

export interface AreaSelectState {
	modelName: string;
	fromDate: string;
	toDate: string;
	usePrecomputed: boolean;
	isSaving: boolean;
	isLoadingModel: boolean;
	showAreaSelectTour: boolean;
	selectedNodeIds: number[];
	// Optional uploads.
}

export interface AreaSelectActions {
	setModelName: (name: string) => void;
	setSelectedNodeIds: (ids: number[]) => void;
	setUsePrecomputed: (value: boolean) => void;
	handleUpdateRange: (range: DateRangeSelection) => void;
	setShowAreaSelectTour: (show: boolean) => void;
	handleTourComplete: () => void;
	handleTourSkip: () => void;
	handleSave: (opts?: { runAfterSave?: boolean }) => Promise<void>;
	handleCancel: () => void;
}
