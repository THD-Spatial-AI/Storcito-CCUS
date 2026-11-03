// Whole-year periods.
export const MIN_ASSESSMENT_YEAR = 2025;
export const MAX_ASSESSMENT_YEAR = 2050;
export const DEFAULT_START_YEAR = 2030;
export const DEFAULT_END_YEAR = 2040;

export const ASSESSMENT_YEARS: number[] = Array.from(
  { length: MAX_ASSESSMENT_YEAR - MIN_ASSESSMENT_YEAR + 1 },
  (_, index) => MIN_ASSESSMENT_YEAR + index,
);

/** Year of date. */
export const yearOf = (date: string): number | null => {
  const year = Number(date.slice(0, 4));
  return /^\d{4}-/.test(date) && Number.isInteger(year) ? year : null;
};

export const yearStart = (year: number): string => `${year}-01-01`;
export const yearEnd = (year: number): string => `${year}-12-31`;

/** Period label. */
export const formatPeriod = (fromDate: string, toDate: string): string => {
  const start = yearOf(fromDate);
  const end = yearOf(toDate);
  if (start === null || end === null) return "";
  return start === end ? String(start) : `${start}–${end}`;
};

export const periodYears = (fromDate: string, toDate: string): number => {
  const start = yearOf(fromDate);
  const end = yearOf(toDate);
  return start === null || end === null ? 0 : end - start + 1;
};
