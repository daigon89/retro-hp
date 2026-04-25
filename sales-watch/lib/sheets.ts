/**
 * Google Sheets data fetching module.
 *
 * Authentication strategy (in order of preference):
 *
 * 1. Service Account JSON (GOOGLE_SERVICE_ACCOUNT_JSON env var):
 *    Set this to the full JSON string of a service account key file.
 *    The service account must be granted "Viewer" access on the spreadsheet.
 *    This is the recommended approach for production use.
 *
 * 2. API Key (GOOGLE_SHEETS_API_KEY env var):
 *    Works only when the spreadsheet is shared publicly
 *    ("Anyone with the link can view").
 *
 * The spreadsheet is strictly read-only — no writes are ever performed.
 */

import { google } from "googleapis";

const SPREADSHEET_ID = "1bWbzZRcxGpUlXFOlTZlzlPQjC4v6MYKM9MZHRb-WA3A";

export type ApoRow = {
  アポNo: string;
  導線種別: string;
  申込日: string;
  アポ予定日: string;
  営業担当者: string;
  イベント名: string;
  姓: string;
  名: string;
  アポ予定時間: string;
  メールアドレス: string;
  登録経路: string;
  アポステータス: string;
  成約要因: string;
  失注要因: string;
  無効アポ理由: string;
  レコーディング: string;
} & Record<string, string>;

export type PreRow = {
  アポNo: string;
  トスアップNo: string;
  プレNo: string;
  導線種別: string;
  イベント名: string;
  アポ日: string;
  プレ予定日: string;
  プレ予定時間: string;
  姓: string;
  名: string;
  メールアドレス: string;
  営業担当者: string;
  プレステータス: string;
  成約要因: string;
  失注要因: string;
  無効アポ理由: string;
  レコーディング: string;
  登録経路: string;
} & Record<string, string>;

export type TossupRow = {
  アポNo: string;
  トスアップNo: string;
  導線種別: string;
  イベント名: string;
  アポ予定日: string;
  アポ予定時間: string;
  姓: string;
  名: string;
  メールアドレス: string;
  営業担当者: string;
  トスアップステータス: string;
  成約要因: string;
  失注要因: string;
  無効アポ理由: string;
  レコーディング: string;
} & Record<string, string>;

export type ContractRow = {
  アポNo: string;
  トスアップNo: string;
  プレNo: string;
  導線種別: string;
  イベント名: string;
  契約日: string;
  契約金額: string;
  姓: string;
  名: string;
  メールアドレス: string;
  営業担当者: string;
  成約後ステータス: string;
  備考: string;
  契約書: string;
  契約書送付日: string;
  契約書到着確認: string;
  登録経路: string;
  アポ日: string;
} & Record<string, string>;

export interface SheetsData {
  apo: ApoRow[];
  fetchedAt: string;
  error?: string;
}

export interface AllSheetsData {
  apo: ApoRow[];
  pre: PreRow[];
  tossup: TossupRow[];
  contract: ContractRow[];
  fetchedAt: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function getAuthClient() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    return { type: "serviceAccount" as const, auth };
  }

  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (apiKey) {
    return { type: "apiKey" as const, apiKey };
  }

  throw new Error(
    "Google Sheets credentials are not configured. " +
      "Set either GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEETS_API_KEY in .env.local"
  );
}

// ---------------------------------------------------------------------------
// Sheet fetching
// ---------------------------------------------------------------------------

/**
 * Convert a Google Sheets serial date number to "YYYY-MM-DD" string.
 * Google Sheets uses a 1900 date system where serial 1 = Jan 1, 1900.
 */
/**
 * Convert a Google Sheets serial date number to "YYYY-MM-DD" string.
 * Uses truncation (not floor) to match Sheets' EOMONTH-based date comparison:
 * Sheets compares the raw serial (including fractional time), so a value like
 * 46142.875 (April 30, 9:00 PM) is > 46142 (EOMONTH for April) and falls
 * OUTSIDE the month. We replicate this by using Math.trunc for conversion
 * but keeping the original serial precision for boundary comparisons.
 *
 * However, since we compare by YYYY-MM string prefix, we need to assign
 * dates with time components correctly. A serial of 46142.875 means
 * April 30 at 21:00 — it IS in April. But Sheets' <= comparison excludes it.
 * To match Sheets: we convert using the INTEGER part of the serial only
 * when the integer part maps to the LAST day of a month, we check if the
 * fractional part pushes it past midnight (which it shouldn't for dates).
 *
 * Simplest correct approach: use the raw serial for month boundary checks.
 * Store the serial number alongside the date string so filtering can use it.
 *
 * UPDATED: We just truncate to integer to get the date, matching Sheets' behavior
 * where dates with time components beyond the EOMONTH boundary are excluded.
 */
function serialToDateStr(serial: number): string {
  // Google Sheets serial: 1 = Jan 1, 1900 (with Lotus 123 bug at serial 60).
  // For modern dates (serial > 60), base = Dec 31, 1899 gives correct results.
  // Fractional part represents time of day (0.5 = noon).
  // Sheets' EOMONTH returns an integer serial for the last day of the month,
  // and "<=" comparison excludes fractional serials beyond that integer.
  // We truncate to integer to get the calendar date.
  const intSerial = Math.trunc(serial);
  // Google Sheets serial 1 = Jan 1, 1900. Using Dec 31, 1899 as base
  // correctly maps modern dates (serial > 60) accounting for the Lotus 123 bug.
  const d = new Date(1899, 11, 31);
  d.setDate(d.getDate() + intSerial);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Date column indices by sheet name, used to identify which columns
 * should be treated as dates during normalization.
 */
const DATE_COLUMN_INDICES: Record<string, Set<number>> = {
  "統合マスタ": new Set([2, 3]),       // C=申込日, D=アポ予定日
  "プレ情報": new Set([5, 6]),         // F=アポ日, G=プレ予定日
  "トスアップ管理": new Set([4]),       // E=アポ予定日
  "契約管理": new Set([5, 17]),        // F=契約日, R=アポ日
};

/**
 * Normalize cell values: convert serial date numbers in known date columns
 * to "YYYY-MM-DD" strings, keep everything else as strings.
 * Non-date numeric columns (e.g. 契約金額) are preserved as plain number strings.
 */
function normalizeRow(row: unknown[], sheetName: string): string[] {
  const dateColumns = DATE_COLUMN_INDICES[sheetName];
  return row.map((cell, colIndex) => {
    if (cell === null || cell === undefined) return "";
    if (typeof cell === "number") {
      // Only convert to date if this column is a known date column
      if (dateColumns?.has(colIndex) && cell > 30000 && cell < 80000) {
        return serialToDateStr(cell);
      }
      return String(cell);
    }
    return String(cell);
  });
}

async function fetchSheetRows(sheetName: string): Promise<string[][]> {
  const authConfig = getAuthClient();

  if (authConfig.type === "serviceAccount") {
    const sheets = google.sheets({ version: "v4", auth: authConfig.auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
    });
    return (response.data.values as string[][]) ?? [];
  } else {
    // API key path
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(
      sheetName
    )}?key=${authConfig.apiKey}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sheets API error for "${sheetName}": ${res.status} ${body}`);
    }
    const json = await res.json();
    return (json.values as string[][]) ?? [];
  }
}

// ---------------------------------------------------------------------------
// Row → object mapping
// ---------------------------------------------------------------------------

function rowsToObjects<T extends Record<string, string>>(rows: string[][]): T[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header.trim()] = (row[i] ?? "").trim();
    });
    return obj as T;
  });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

// Actual sheet names in the source spreadsheet
export const SHEET_NAMES = {
  apo: "統合マスタ",
  pre: "プレ情報",
  tossup: "トスアップ管理",
  contract: "契約管理",
  master: "マスタ",
  staff: "営業担当者マスタ",
} as const;

export async function fetchAllData(): Promise<SheetsData> {
  const apoRows = await fetchSheetRows(SHEET_NAMES.apo);
  const apo = rowsToObjects<ApoRow>(apoRows);

  return {
    apo,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchPreData(): Promise<PreRow[]> {
  const rows = await fetchSheetRows(SHEET_NAMES.pre);
  return rowsToObjects<PreRow>(rows);
}

export async function fetchTossupData(): Promise<TossupRow[]> {
  const rows = await fetchSheetRows(SHEET_NAMES.tossup);
  return rowsToObjects<TossupRow>(rows);
}

export async function fetchContractData(): Promise<ContractRow[]> {
  const rows = await fetchSheetRows(SHEET_NAMES.contract);
  return rowsToObjects<ContractRow>(rows);
}

export type StaffRow = {
  担当者: string;
  メールアドレス: string;
  目標売上: string;
} & Record<string, string>;

export async function fetchStaffData(): Promise<StaffRow[]> {
  const rows = await fetchSheetRows(SHEET_NAMES.staff);
  return rowsToObjects<StaffRow>(rows);
}
