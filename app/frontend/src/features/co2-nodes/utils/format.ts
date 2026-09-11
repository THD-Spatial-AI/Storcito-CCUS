/** Locale number. */
export const formatNumber = (value: unknown, digits = 2): string =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "—";
