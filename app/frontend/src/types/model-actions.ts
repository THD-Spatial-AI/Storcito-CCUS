import type { ModelStatus } from "@/types/models";

/** Model with actions. */
export type ActionableModel = { id: number; status: ModelStatus; user_id?: string };

/** Shared model-action props. */
export interface ModelActionHandlers<T extends ActionableModel> {
	readonly model: T;
	readonly currentUserId?: string;
	readonly userAccessLevel?: string;
	readonly onView?: (model: T) => void;
	readonly onEdit?: (model: T) => void;
	readonly onDownload?: (model: T) => void;
	readonly onCopy?: (model: T) => void;
	readonly onCalculate?: (model: T) => void;
	readonly onDelete?: (model: T) => void;
	readonly onShare?: (model: T) => void;
	readonly onMoveToWorkspace?: (model: T) => void;
	readonly disableDelete?: boolean;
	readonly deleteTooltip?: string;
	readonly disableMoveToWorkspace?: boolean;
	readonly moveToWorkspaceTooltip?: string;
	readonly disableShare?: boolean;
	readonly shareTooltip?: string;
	readonly hasAvailableWebservice?: boolean;
}
