// Consolidated status type used across analysis models and other model types
export type ModelStatus = 
	| 'draft' 
	| 'queue' 
	| 'calculating' 
	| 'running' 
	| 'processing'
	| 'completed' 
	| 'published' 
	| 'failed' 
	| 'cancelled'
	| 'modified';

export type StatusColor = "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";

export type ChipVariant = "filled" | "outlined" | "gradient";

export type ChipSize = "small" | "medium";

export type IconSize = "small" | "medium";
