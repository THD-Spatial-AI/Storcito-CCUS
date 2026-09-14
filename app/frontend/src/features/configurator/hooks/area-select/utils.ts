export const asRecord = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;

export const getDateInputValue = (value: unknown): string | undefined => {
    if (typeof value !== 'string' && !(value instanceof Date)) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0];
};

// Config node ids.
export const getSelectedNodeIdsFromConfig = (config: Record<string, unknown>): number[] => {
    const parameters = asRecord(config.parameters);
    const raw = parameters?.co2_node_ids;
    if (!Array.isArray(raw)) return [];
    return raw.filter((id): id is number => typeof id === 'number');
};
