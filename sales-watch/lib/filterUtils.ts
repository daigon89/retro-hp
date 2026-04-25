/**
 * Shared utilities for year-month filtering across all list views.
 */

/**
 * Extract "YYYY-MM" from a date string.
 * Accepts formats: "YYYY/MM/DD", "YYYY-MM-DD", "YYYY/MM/DD HH:MM", etc.
 * Returns "" if the date string is empty or unparseable.
 */
export function extractYearMonth(dateStr: string): string {
  if (!dateStr) return "";

  // 1. Standard full date: "YYYY-MM-DD ..." or "YYYY/MM/DD ..."
  //    Excludes text-formatted dates with parentheses like "2026/04/17(金)"
  const full = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-]\d{1,2}(?:\s[\d:]+)?$/);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}`;

  // 2. Short date: "M/DD" or "MM/DD" (Sheets interprets as current year)
  //    These are valid date serials displayed in short format
  const short = dateStr.match(/^(\d{1,2})\/\d{1,2}$/);
  if (short) {
    const month = short[1].padStart(2, "0");
    const year = new Date().getFullYear();
    return `${year}-${month}`;
  }

  return "";
}

export interface YearMonthOption {
  value: string; // "YYYY-MM"
  label: string; // "YYYY年MM月"
}

/**
 * Build a sorted (descending) list of unique year-month options from an array of date strings.
 */
export function buildYearMonthOptions(dateStrings: string[]): YearMonthOption[] {
  const set = new Set<string>();
  for (const d of dateStrings) {
    const ym = extractYearMonth(d);
    if (ym) set.add(ym);
  }
  return Array.from(set)
    .sort((a, b) => b.localeCompare(a))
    .map((ym) => {
      const [year, month] = ym.split("-");
      return { value: ym, label: `${year}年${month}月` };
    });
}

/**
 * Filter an array of rows by year-month, given a date key extractor.
 */
export function filterByYearMonth<T>(
  rows: T[],
  ym: string,
  getDate: (row: T) => string
): T[] {
  if (!ym) return rows;
  return rows.filter((row) => extractYearMonth(getDate(row)) === ym);
}
