/**
 * Full data verification: compares the analysis spreadsheet values
 * against the app's computed values from raw source data.
 *
 * Run: cd sales-watch && NODE_PATH=./node_modules node --input-type=module < ../specs/eval-scripts/02_compare_all.mjs
 */

import { google } from "googleapis";
import { readFileSync, writeFileSync } from "fs";

const SOURCE_SHEET_ID = "1bWbzZRcxGpUlXFOlTZlzlPQjC4v6MYKM9MZHRb-WA3A";
const ANALYSIS_SHEET_ID = "1TGvNaGFosMiiY7m6CZi017XuMAIiD7at1N-1tm-m29k";

// ============================================================
// Auth
// ============================================================

function getCredentials() {
  const env = readFileSync(".env.local", "utf-8");
  const m = env.match(/GOOGLE_SERVICE_ACCOUNT_JSON='([^']+)'/s);
  if (!m) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not found");
  return JSON.parse(m[1]);
}

async function getSheets() {
  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

async function fetchRange(sheets, spreadsheetId, range, mode = "UNFORMATTED_VALUE") {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: mode,
  });
  return res.data.values ?? [];
}

// ============================================================
// Date helpers (replicating sheets.ts logic)
// ============================================================

function serialToDateStr(serial) {
  const intSerial = Math.trunc(serial);
  const d = new Date(1899, 11, 31);
  d.setDate(d.getDate() + intSerial);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** "serial of the 1st day of the month" → "YYYY-MM" */
function serialToYM(serial) {
  if (!serial || typeof serial !== "number") return null;
  return serialToDateStr(serial);
}

/** "YYYY/MM/DD" or "YYYY-MM-DD" → "YYYY-MM" */
function extractYearMonth(dateStr) {
  if (!dateStr) return "";
  const full = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-]\d{1,2}/);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}`;
  return "";
}

// ============================================================
// Raw data fetching from source sheet
// ============================================================

function rowsToObjects(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[String(h).trim()] = String(row[i] ?? "").trim();
    });
    return obj;
  });
}

const DATE_COLUMN_INDICES = {
  "統合マスタ": new Set([2, 3]),
  "プレ情報": new Set([5, 6]),
  "トスアップ管理": new Set([4]),
  "契約管理": new Set([5, 17]),
};

function serialToFullDateStr(serial) {
  const intSerial = Math.trunc(serial);
  const d = new Date(1899, 11, 31);
  d.setDate(d.getDate() + intSerial);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function normalizeRow(row, sheetName) {
  const dateColumns = DATE_COLUMN_INDICES[sheetName];
  return row.map((cell, colIndex) => {
    if (cell === null || cell === undefined) return "";
    if (typeof cell === "number") {
      if (dateColumns?.has(colIndex) && cell > 30000 && cell < 80000) {
        return serialToFullDateStr(cell);
      }
      return String(cell);
    }
    return String(cell);
  });
}

async function fetchSourceSheet(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE_SHEET_ID,
    range: sheetName,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const raw = res.data.values ?? [];
  if (raw.length < 2) return [];
  const headers = raw[0];
  return raw.slice(1).map((row) => {
    const normalized = normalizeRow(row, sheetName);
    const obj = {};
    headers.forEach((h, i) => {
      obj[String(h).trim()] = String(normalized[i] ?? "").trim();
    });
    return obj;
  });
}

// ============================================================
// App logic (replicated from summaryUtils.ts + crossUtils.ts)
// ============================================================

const INVALID_APO_STATUSES = ["無効アポ"];
const SEATED_STATUSES = ["成約", "失注", "ブリッジ", "トスアップ", "無効アポ"];
const SETTLED_STATUSES_SUMMARY = ["成約", "失注"];
const BRIDGE_STATUS = "ブリッジ";
const DUPLICATE_STATUS = "重複";
const PAID_STATUSES = ["入金済み", "クーリングオフ期間経過"];
const UNPAID_STATUS = "未入金";
const EXCLUDED_SALES_STATUSES = ["クーリングオフ", "その他解約"];

function parseAmount(val) {
  if (!val) return 0;
  const n = Number(String(val).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function getTenDaysAgo() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 10);
  return d;
}

function computeSummary(apoRows, contractRows, ym, preRows = []) {
  const filteredApo = ym
    ? apoRows.filter((r) => extractYearMonth(r["アポ予定日"]) === ym)
    : apoRows;

  const filteredPre = ym
    ? preRows.filter((r) => extractYearMonth(r["アポ日"]) === ym)
    : preRows;

  const contractByKeijo = ym
    ? contractRows.filter((r) => extractYearMonth(r["契約日"]) === ym)
    : contractRows;

  const contractByApo = ym
    ? contractRows.filter((r) => extractYearMonth(r["アポ日"]) === ym)
    : contractRows;

  const apo_scheduled = filteredApo.filter((r) => r["アポステータス"] !== DUPLICATE_STATUS).length;
  const apo_processed = filteredApo.filter(
    (r) => r["アポステータス"] !== "" && r["アポステータス"] !== DUPLICATE_STATUS
  ).length;
  const apo_seated = filteredApo.filter((r) => SEATED_STATUSES.includes(r["アポステータス"])).length;
  const apo_seated_rate = apo_processed > 0 ? apo_seated / apo_processed : null;

  const invalid_apo_from_apo = filteredApo.filter((r) => INVALID_APO_STATUSES.includes(r["アポステータス"])).length;
  const invalid_apo_from_pre = filteredPre.filter((r) => INVALID_APO_STATUSES.includes(r["プレステータス"])).length;
  const invalid_apo = invalid_apo_from_apo + invalid_apo_from_pre;

  const bridge_count = filteredApo.filter((r) => r["アポステータス"] === BRIDGE_STATUS).length;

  const remaining_bridge = filteredPre.filter((r) => r["プレステータス"] === "").length;

  const tenDaysAgo = getTenDaysAgo();
  const settled_count =
    filteredApo.filter((r) => SETTLED_STATUSES_SUMMARY.includes(r["アポステータス"])).length +
    filteredApo.filter((r) => {
      if (r["アポステータス"] !== BRIDGE_STATUS) return false;
      const d = parseDate(r["アポ予定日"]);
      return d !== null && d < tenDaysAgo;
    }).length;

  const contract_count_from_apo = filteredApo.filter((r) => r["アポステータス"] === "成約").length;
  const contract_count_from_pre = filteredPre.filter((r) => r["プレステータス"] === "成約").length;
  const contract_count = contract_count_from_apo + contract_count_from_pre;

  const settlement_rate = settled_count > 0 ? contract_count / settled_count : null;

  const activeContractsByKeijo = contractByKeijo.filter(
    (r) => !EXCLUDED_SALES_STATUSES.includes(r["成約後ステータス"])
  );

  let keijo_keijo_sales = 0, keijo_paid_sales = 0, keijo_unpaid_sales = 0;
  for (const row of activeContractsByKeijo) {
    const amount = parseAmount(row["契約金額"]);
    keijo_keijo_sales += amount;
    if (PAID_STATUSES.includes(row["成約後ステータス"])) keijo_paid_sales += amount;
    if (row["成約後ステータス"] === UNPAID_STATUS) keijo_unpaid_sales += amount;
  }

  const payment_rate = keijo_keijo_sales > 0 ? keijo_paid_sales / keijo_keijo_sales : null;

  const activeContractsByApo = contractByApo.filter(
    (r) => !EXCLUDED_SALES_STATUSES.includes(r["成約後ステータス"])
  );

  let apo_keijo_sales = 0, apo_paid_sales = 0, apo_unpaid_sales = 0;
  for (const row of activeContractsByApo) {
    const amount = parseAmount(row["契約金額"]);
    apo_keijo_sales += amount;
    if (PAID_STATUSES.includes(row["成約後ステータス"])) apo_paid_sales += amount;
    if (row["成約後ステータス"] === UNPAID_STATUS) apo_unpaid_sales += amount;
  }

  const unprocessed_apo = apo_scheduled - apo_processed;
  const keijo_sales_forecast =
    keijo_keijo_sales + (settlement_rate !== null ? unprocessed_apo * settlement_rate : 0);
  const payment_sales_forecast =
    payment_rate !== null ? keijo_sales_forecast * payment_rate : keijo_sales_forecast;

  const cooling_off_count = contractByKeijo.filter(
    (r) => r["成約後ステータス"] === "クーリングオフ"
  ).length;

  const contract_with_cooling_off = contract_count - cooling_off_count;
  const cooling_off_rate = contract_count > 0 ? cooling_off_count / contract_count : null;

  return {
    keijo_keijo_sales, keijo_paid_sales, keijo_unpaid_sales,
    apo_keijo_sales, apo_paid_sales, apo_unpaid_sales,
    payment_rate, apo_scheduled, apo_processed, apo_seated,
    apo_seated_rate, invalid_apo, bridge_count, remaining_bridge,
    settled_count, contract_count, settlement_rate,
    keijo_sales_forecast, payment_sales_forecast,
    cooling_off_count, contract_with_cooling_off, cooling_off_rate,
  };
}

// ============================================================
// Cross-matrix computation (from crossUtils.ts)
// ============================================================

function computeCrossMatrix(staffRows, apoRows, ym) {
  const filtered = ym
    ? apoRows.filter((r) => extractYearMonth(r["アポ予定日"]) === ym)
    : apoRows;

  let staffNames;
  if (staffRows.length > 0) {
    staffNames = staffRows.map((r) => r["担当者"]).filter(Boolean);
  } else {
    const nameSet = new Set();
    filtered.forEach((r) => { if (r["営業担当者"]) nameSet.add(r["営業担当者"]); });
    staffNames = Array.from(nameSet).sort();
  }

  const channelSet = new Set();
  filtered.forEach((r) => { if (r["導線種別"]) channelSet.add(r["導線種別"]); });
  const channelList = Array.from(channelSet).sort();

  const accumulator = new Map();
  for (const name of staffNames) {
    const channelMap = new Map();
    for (const ch of channelList) channelMap.set(ch, { contract_count: 0, settled_count: 0 });
    accumulator.set(name, channelMap);
  }

  const columnTotalsRaw = new Map();
  for (const ch of channelList) columnTotalsRaw.set(ch, { contract_count: 0, settled_count: 0 });
  const grandTotalRaw = { contract_count: 0, settled_count: 0 };

  for (const row of filtered) {
    const name = row["営業担当者"];
    const channel = row["導線種別"];
    const status = row["アポステータス"];
    const isSettled = ["成約", "失注"].includes(status);
    const isContract = status === "成約";
    if (!name || !channel) continue;

    const staffMap = accumulator.get(name);
    if (staffMap) {
      let cell = staffMap.get(channel);
      if (!cell) { cell = { contract_count: 0, settled_count: 0 }; staffMap.set(channel, cell); }
      if (isSettled) cell.settled_count++;
      if (isContract) cell.contract_count++;
    }

    let colTotal = columnTotalsRaw.get(channel);
    if (!colTotal) { colTotal = { contract_count: 0, settled_count: 0 }; columnTotalsRaw.set(channel, colTotal); }
    if (isSettled) colTotal.settled_count++;
    if (isContract) colTotal.contract_count++;
    if (isSettled) grandTotalRaw.settled_count++;
    if (isContract) grandTotalRaw.contract_count++;
  }

  const rows = staffNames.map((staffName) => {
    const staffMap = accumulator.get(staffName) ?? new Map();
    const cells = {};
    const rowTotal = { contract_count: 0, settled_count: 0 };
    for (const ch of channelList) {
      const raw = staffMap.get(ch) ?? { contract_count: 0, settled_count: 0 };
      cells[ch] = { ...raw, contract_rate: raw.settled_count > 0 ? raw.contract_count / raw.settled_count : null };
      rowTotal.settled_count += raw.settled_count;
      rowTotal.contract_count += raw.contract_count;
    }
    return {
      staffName,
      cells,
      total: { ...rowTotal, contract_rate: rowTotal.settled_count > 0 ? rowTotal.contract_count / rowTotal.settled_count : null },
    };
  });

  const columnTotals = {};
  for (const ch of channelList) {
    const raw = columnTotalsRaw.get(ch) ?? { contract_count: 0, settled_count: 0 };
    columnTotals[ch] = { ...raw, contract_rate: raw.settled_count > 0 ? raw.contract_count / raw.settled_count : null };
  }

  return {
    channels: channelList,
    rows,
    columnTotals,
    grandTotal: { ...grandTotalRaw, contract_rate: grandTotalRaw.settled_count > 0 ? grandTotalRaw.contract_count / grandTotalRaw.settled_count : null },
  };
}

// ============================================================
// Comparison utilities
// ============================================================

function toNum(v) {
  if (v === null || v === undefined || v === "" || v === "0" || v === 0) return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/,/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function numEq(a, b, tolerance = 1) {
  const na = toNum(a), nb = toNum(b);
  return Math.abs(na - nb) <= tolerance;
}

const DISCREPANCIES = [];

function check(view, ym, rowLabel, kpi, sheetVal, appVal, tolerance = 1) {
  const sv = toNum(sheetVal), av = toNum(appVal);
  if (!numEq(sv, av, tolerance)) {
    DISCREPANCIES.push({ view, ym, rowLabel, kpi, sheetVal: sv, appVal: av, diff: av - sv });
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("Fetching data...");
  const sheets = await getSheets();

  // Fetch source data
  const [apoRows, preRows, contractRows, staffRows] = await Promise.all([
    fetchSourceSheet(sheets, "統合マスタ"),
    fetchSourceSheet(sheets, "プレ情報"),
    fetchSourceSheet(sheets, "契約管理"),
    fetchSourceSheet(sheets, "営業担当者マスタ"),
  ]);
  console.log(`Source: apo=${apoRows.length}, pre=${preRows.length}, contract=${contractRows.length}, staff=${staffRows.length}`);

  // Fetch analysis sheet — サマリー
  const summaryRaw = await fetchRange(sheets, ANALYSIS_SHEET_ID, "サマリー!A1:W200");
  // Fetch analysis sheet — 営業担当者別分析
  const staffAnalysisRaw = await fetchRange(sheets, ANALYSIS_SHEET_ID, "営業担当者別分析!A1:V200");
  // Fetch analysis sheet — 導線別分析
  const channelAnalysisRaw = await fetchRange(sheets, ANALYSIS_SHEET_ID, "導線別分析!A1:T200");
  // Fetch analysis sheet — 導線種別×営業担当者マトリクス
  const crossRaw = await fetchRange(sheets, ANALYSIS_SHEET_ID, "導線種別×営業担当者マトリクス!A1:R200");

  // ===========================================================
  // Section 1: サマリー sheet comparison (all months)
  // ===========================================================

  console.log("\n--- Comparing: サマリー (all months) ---");

  const summaryHeaders = summaryRaw[0];
  // Headers: ["年月","計上売上","入金済売上","未入金売上","計上売上(アポ日基準)","入金済売上(アポ日基準)","未入金売上(アポ日基準)","入金率","アポ予定数","アポ消化件数","アポ着座件数","アポ着座率","無効アポ数","ブリッジ数","残ブリッジ数","決着数","成約件数","決着成約率","計上売上見込","入金売上見込","クーリングオフ件数","クーリングオフ込み成約件数","クーリングオフ率"]

  const summaryRows = summaryRaw.slice(1);

  const summaryResults = [];

  for (const row of summaryRows) {
    const ymSerial = row[0];
    if (!ymSerial) continue;
    const ym = serialToYM(ymSerial);
    if (!ym) continue;

    const app = computeSummary(apoRows, contractRows, ym, preRows);

    // Map sheet columns to app fields
    const sheet = {
      keijo_keijo_sales: row[1],       // B: 計上売上
      keijo_paid_sales: row[2],        // C: 入金済売上
      keijo_unpaid_sales: row[3],      // D: 未入金売上
      apo_keijo_sales: row[4],         // E: 計上売上(アポ日基準)
      apo_paid_sales: row[5],          // F: 入金済売上(アポ日基準)
      apo_unpaid_sales: row[6],        // G: 未入金売上(アポ日基準)
      payment_rate: row[7],            // H: 入金率
      apo_scheduled: row[8],           // I: アポ予定数
      apo_processed: row[9],           // J: アポ消化件数
      apo_seated: row[10],             // K: アポ着座件数
      apo_seated_rate: row[11],        // L: アポ着座率
      invalid_apo: row[12],            // M: 無効アポ数
      bridge_count: row[13],           // N: ブリッジ数
      remaining_bridge: row[14],       // O: 残ブリッジ数
      settled_count: row[15],          // P: 決着数
      contract_count: row[16],         // Q: 成約件数
      settlement_rate: row[17],        // R: 決着成約率
      keijo_sales_forecast: row[18],   // S: 計上売上見込
      payment_sales_forecast: row[19], // T: 入金売上見込
      cooling_off_count: row[20],      // U: クーリングオフ件数
      contract_with_cooling_off: row[21], // V: クーリングオフ込み成約件数
      cooling_off_rate: row[22],       // W: クーリングオフ率
    };

    const kpis = [
      ["計上売上", "keijo_keijo_sales"],
      ["入金済売上", "keijo_paid_sales"],
      ["未入金売上", "keijo_unpaid_sales"],
      ["計上売上(アポ日基準)", "apo_keijo_sales"],
      ["入金済売上(アポ日基準)", "apo_paid_sales"],
      ["未入金売上(アポ日基準)", "apo_unpaid_sales"],
      ["入金率", "payment_rate"],
      ["アポ予定数", "apo_scheduled"],
      ["アポ消化件数", "apo_processed"],
      ["アポ着座件数", "apo_seated"],
      ["アポ着座率", "apo_seated_rate"],
      ["無効アポ数", "invalid_apo"],
      ["ブリッジ数", "bridge_count"],
      ["残ブリッジ数", "remaining_bridge"],
      ["決着数", "settled_count"],
      ["成約件数", "contract_count"],
      ["決着成約率", "settlement_rate"],
      ["計上売上見込", "keijo_sales_forecast"],
      ["入金売上見込", "payment_sales_forecast"],
      ["クーリングオフ件数", "cooling_off_count"],
      ["クーリングオフ込み成約件数", "contract_with_cooling_off"],
      ["クーリングオフ率", "cooling_off_rate"],
    ];

    const rowResult = { ym };
    let rowOk = true;
    for (const [kpiName, field] of kpis) {
      const sv = toNum(sheet[field]);
      const av = toNum(app[field]);
      const diff = av - sv;
      const tol = ["keijo_keijo_sales", "keijo_paid_sales", "keijo_unpaid_sales",
                    "apo_keijo_sales", "apo_paid_sales", "apo_unpaid_sales",
                    "keijo_sales_forecast", "payment_sales_forecast"].includes(field) ? 1 : 0.001;
      const ok = Math.abs(diff) <= tol;
      if (!ok) {
        rowOk = false;
        DISCREPANCIES.push({
          view: "サマリー", ym, rowLabel: ym, kpi: kpiName,
          sheetVal: sv, appVal: av, diff,
        });
      }
      rowResult[kpiName] = { sheet: sv, app: av, diff, ok };
    }

    rowResult._allOk = rowOk;
    summaryResults.push(rowResult);
    console.log(`  ${ym}: ${rowOk ? "OK" : "MISMATCH"}`);
  }

  // ===========================================================
  // Section 2: 営業担当者別分析 comparison (single month)
  // ===========================================================

  console.log("\n--- Comparing: 営業担当者別分析 ---");

  // Structure: row0 = ["年月", serial, ...totals], row1 = headers, row2+ = per-staff data
  const staffSheetYmSerial = staffAnalysisRaw[0]?.[1];
  const staffSheetYm = staffSheetYmSerial ? serialToYM(staffSheetYmSerial) : null;
  console.log(`  Sheet shows month: ${staffSheetYm} (serial ${staffSheetYmSerial})`);

  if (staffSheetYm) {
    const staffHeaders = staffAnalysisRaw[1]; // row index 1

    // Compute app values
    let staffNames = staffRows.map((r) => r["担当者"]).filter(Boolean);
    if (!staffNames.length) {
      const ns = new Set();
      apoRows.forEach((r) => { if (r["営業担当者"]) ns.add(r["営業担当者"]); });
      staffNames = Array.from(ns).sort();
    }

    const targetMap = new Map();
    for (const r of staffRows) {
      if (r["担当者"]) targetMap.set(r["担当者"], parseAmount(r["目標売上"]));
    }

    const appStaffSummaries = {};
    for (const name of staffNames) {
      const fa = apoRows.filter((r) => r["営業担当者"] === name);
      const fc = contractRows.filter((r) => r["営業担当者"] === name);
      const fp = preRows.filter((r) => r["営業担当者"] === name);
      appStaffSummaries[name] = computeSummary(fa, fc, staffSheetYm, fp);
    }

    // Parse sheet staff rows (start at index 2)
    const staffDataRows = staffAnalysisRaw.slice(2).filter((r) => r[0]);
    const staffHeaderRow = staffHeaders ?? [];

    for (const sRow of staffDataRows) {
      const staffName = sRow[0];
      if (!staffName || staffName === "合計") continue;

      const appS = appStaffSummaries[staffName];
      if (!appS) {
        console.log(`  ${staffName}: NOT IN APP DATA (skipping)`);
        continue;
      }

      // Map columns
      // Headers: ["営業担当者","計上売上","入金済売上","未入金売上","入金率","アポ予定数","アポ消化件数","アポ着座件数","アポ着座率","無効アポ数","ブリッジ数","残ブリッジ数","決着数","成約件数","決着成約率","計上売上見込","入金売上見込","見込目標達成率","クーリングオフ件数","クーリングオフ込み成約件数","クーリングオフ率"]
      const sheetStaff = {
        keijo_keijo_sales: sRow[1],
        keijo_paid_sales: sRow[2],
        keijo_unpaid_sales: sRow[3],
        payment_rate: sRow[4],
        apo_scheduled: sRow[5],
        apo_processed: sRow[6],
        apo_seated: sRow[7],
        apo_seated_rate: sRow[8],
        invalid_apo: sRow[9],
        bridge_count: sRow[10],
        remaining_bridge: sRow[11],
        settled_count: sRow[12],
        contract_count: sRow[13],
        settlement_rate: sRow[14],
        keijo_sales_forecast: sRow[15],
        payment_sales_forecast: sRow[16],
        // sRow[17] = 見込目標達成率 (not in computeSummary — checked separately)
        cooling_off_count: sRow[18],
        contract_with_cooling_off: sRow[19],
        cooling_off_rate: sRow[20],
      };

      const kpis = [
        ["計上売上", "keijo_keijo_sales"],
        ["入金済売上", "keijo_paid_sales"],
        ["未入金売上", "keijo_unpaid_sales"],
        ["入金率", "payment_rate"],
        ["アポ予定数", "apo_scheduled"],
        ["アポ消化件数", "apo_processed"],
        ["アポ着座件数", "apo_seated"],
        ["アポ着座率", "apo_seated_rate"],
        ["無効アポ数", "invalid_apo"],
        ["ブリッジ数", "bridge_count"],
        ["残ブリッジ数", "remaining_bridge"],
        ["決着数", "settled_count"],
        ["成約件数", "contract_count"],
        ["決着成約率", "settlement_rate"],
        ["計上売上見込", "keijo_sales_forecast"],
        ["入金売上見込", "payment_sales_forecast"],
        ["クーリングオフ件数", "cooling_off_count"],
        ["クーリングオフ込み成約件数", "contract_with_cooling_off"],
        ["クーリングオフ率", "cooling_off_rate"],
      ];

      let rowOk = true;
      for (const [kpiName, field] of kpis) {
        const sv = toNum(sheetStaff[field]);
        const av = toNum(appS[field]);
        const diff = av - sv;
        const tol = ["keijo_keijo_sales", "keijo_paid_sales", "keijo_unpaid_sales",
                      "keijo_sales_forecast", "payment_sales_forecast"].includes(field) ? 1 : 0.001;
        if (Math.abs(diff) > tol) {
          rowOk = false;
          DISCREPANCIES.push({
            view: "担当者別", ym: staffSheetYm, rowLabel: staffName, kpi: kpiName,
            sheetVal: sv, appVal: av, diff,
          });
        }
      }
      console.log(`  ${staffName}: ${rowOk ? "OK" : "MISMATCH"}`);
    }
  }

  // ===========================================================
  // Section 3: 導線別分析 comparison (single month)
  // ===========================================================

  console.log("\n--- Comparing: 導線別分析 ---");

  const channelSheetYmSerial = channelAnalysisRaw[0]?.[1];
  const channelSheetYm = channelSheetYmSerial ? serialToYM(channelSheetYmSerial) : null;
  console.log(`  Sheet shows month: ${channelSheetYm} (serial ${channelSheetYmSerial})`);

  if (channelSheetYm) {
    // Structure: row0 = ["年月",serial,...], row1 = headers, row2+ = data
    const channelDataRows = channelAnalysisRaw.slice(2).filter((r) => r[0]);

    // Compute app channel summaries
    const channelSet = new Set();
    apoRows.forEach((r) => { if (r["導線種別"]) channelSet.add(r["導線種別"]); });
    contractRows.forEach((r) => { if (r["導線種別"]) channelSet.add(r["導線種別"]); });

    const appChannelSummaries = {};
    for (const ch of channelSet) {
      const fa = apoRows.filter((r) => r["導線種別"] === ch);
      const fc = contractRows.filter((r) => r["導線種別"] === ch);
      const fp = preRows.filter((r) => r["導線種別"] === ch);
      appChannelSummaries[ch] = computeSummary(fa, fc, channelSheetYm, fp);
    }

    for (const sRow of channelDataRows) {
      const channelName = sRow[0];
      if (!channelName || channelName === "合計") continue;

      const appC = appChannelSummaries[channelName];
      if (!appC) {
        console.log(`  ${channelName}: NOT IN APP DATA (skipping)`);
        continue;
      }

      // Headers: ["導線種別","計上売上","入金済売上","未入金売上","入金率","アポ予定数","アポ消化件数","アポ着座件数","アポ着座率","無効アポ数","ブリッジ数","残ブリッジ数","決着数","成約件数","決着成約率","計上売上見込","入金売上見込","クーリングオフ件数","クーリングオフ込み成約件数","クーリングオフ率"]
      const sheetC = {
        keijo_keijo_sales: sRow[1],
        keijo_paid_sales: sRow[2],
        keijo_unpaid_sales: sRow[3],
        payment_rate: sRow[4],
        apo_scheduled: sRow[5],
        apo_processed: sRow[6],
        apo_seated: sRow[7],
        apo_seated_rate: sRow[8],
        invalid_apo: sRow[9],
        bridge_count: sRow[10],
        remaining_bridge: sRow[11],
        settled_count: sRow[12],
        contract_count: sRow[13],
        settlement_rate: sRow[14],
        keijo_sales_forecast: sRow[15],
        payment_sales_forecast: sRow[16],
        cooling_off_count: sRow[17],
        contract_with_cooling_off: sRow[18],
        cooling_off_rate: sRow[19],
      };

      const kpis = [
        ["計上売上", "keijo_keijo_sales"],
        ["入金済売上", "keijo_paid_sales"],
        ["未入金売上", "keijo_unpaid_sales"],
        ["入金率", "payment_rate"],
        ["アポ予定数", "apo_scheduled"],
        ["アポ消化件数", "apo_processed"],
        ["アポ着座件数", "apo_seated"],
        ["アポ着座率", "apo_seated_rate"],
        ["無効アポ数", "invalid_apo"],
        ["ブリッジ数", "bridge_count"],
        ["残ブリッジ数", "remaining_bridge"],
        ["決着数", "settled_count"],
        ["成約件数", "contract_count"],
        ["決着成約率", "settlement_rate"],
        ["計上売上見込", "keijo_sales_forecast"],
        ["入金売上見込", "payment_sales_forecast"],
        ["クーリングオフ件数", "cooling_off_count"],
        ["クーリングオフ込み成約件数", "contract_with_cooling_off"],
        ["クーリングオフ率", "cooling_off_rate"],
      ];

      let rowOk = true;
      for (const [kpiName, field] of kpis) {
        const sv = toNum(sheetC[field]);
        const av = toNum(appC[field]);
        const diff = av - sv;
        const tol = ["keijo_keijo_sales", "keijo_paid_sales", "keijo_unpaid_sales",
                      "keijo_sales_forecast", "payment_sales_forecast"].includes(field) ? 1 : 0.001;
        if (Math.abs(diff) > tol) {
          rowOk = false;
          DISCREPANCIES.push({
            view: "導線別", ym: channelSheetYm, rowLabel: channelName, kpi: kpiName,
            sheetVal: sv, appVal: av, diff,
          });
        }
      }
      console.log(`  ${channelName}: ${rowOk ? "OK" : "MISMATCH"}`);
    }
  }

  // ===========================================================
  // Section 4: マトリクス comparison (single month)
  // ===========================================================

  console.log("\n--- Comparing: 導線種別×営業担当者マトリクス ---");

  const crossYmSerial = crossRaw[0]?.[1];
  const crossYm = crossYmSerial ? serialToYM(crossYmSerial) : null;
  console.log(`  Sheet shows month: ${crossYm} (serial ${crossYmSerial})`);

  if (crossYm) {
    const appCross = computeCrossMatrix(staffRows, apoRows, crossYm);
    console.log(`  App channels: ${appCross.channels.join(", ")}`);
    console.log(`  App staff count: ${appCross.rows.length}`);

    // Cross matrix structure (from earlier inspection):
    // Row 0: ["年月", serial]
    // Row 1: [] (empty)
    // Row 2: ["成約率","","","","","","決着数","","","","","","成約数",...]
    // Row 3: ["","インフルエンサー協業","AI×コンテンツ販売","広告","その他","","決着数","インフルエンサー協業",...]
    // Row 4+: per-staff data

    // Parse cross matrix from sheet
    const crossHeaderRow2 = crossRaw[2] ?? [];
    const crossHeaderRow3 = crossRaw[3] ?? [];

    // Find the channel columns from row 3
    // Layout: [staffName, ch1, ch2, ch3, ch4, "", "決着数_label", ch1, ch2, ch3, ch4, "", "成約数_label", ch1, ch2, ch3, ch4]
    // OR based on what we saw: ["","インフルエンサー協業","AI×コンテンツ販売","広告","その他","","決着数","インフルエンサー協業","AI×コンテンツ販売","広告","その他","","成約数","インフルエンサー協業","AI×コンテンツ販売","広告","その他"]
    // Col 0: staff name
    // Cols 1-4: 成約率 per channel  
    // Col 5: empty
    // Col 6: "決着数" label
    // Cols 7-10: 決着数 per channel
    // Col 11: empty
    // Col 12: "成約数" label
    // Cols 13-16: 成約数 per channel

    const sheetChannelsRate = crossHeaderRow3.slice(1, 5); // 成約率 columns
    const sheetChannelsSettled = crossHeaderRow3.slice(7, 11); // 決着数 columns
    const sheetChannelsContract = crossHeaderRow3.slice(13, 17); // 成約数 columns

    console.log(`  Sheet channels (成約率): ${sheetChannelsRate.join(", ")}`);

    const crossDataRows = crossRaw.slice(4).filter((r) => r[0] && r[0] !== "合計");

    for (const sRow of crossDataRows) {
      const staffName = sRow[0];
      if (!staffName) continue;

      const appStaffRow = appCross.rows.find((r) => r.staffName === staffName);
      if (!appStaffRow) {
        console.log(`  ${staffName}: NOT IN APP CROSS DATA (skipping)`);
        continue;
      }

      let rowOk = true;

      // Check settled_count per channel
      for (let i = 0; i < sheetChannelsSettled.length; i++) {
        const ch = sheetChannelsSettled[i];
        if (!ch) continue;
        const sv = toNum(sRow[7 + i]);
        const av = toNum(appStaffRow.cells[ch]?.settled_count ?? 0);
        if (Math.abs(av - sv) > 0.5) {
          rowOk = false;
          DISCREPANCIES.push({
            view: "クロス集計", ym: crossYm, rowLabel: staffName, kpi: `決着数(${ch})`,
            sheetVal: sv, appVal: av, diff: av - sv,
          });
        }
      }

      // Check contract_count per channel
      for (let i = 0; i < sheetChannelsContract.length; i++) {
        const ch = sheetChannelsContract[i];
        if (!ch) continue;
        const sv = toNum(sRow[13 + i]);
        const av = toNum(appStaffRow.cells[ch]?.contract_count ?? 0);
        if (Math.abs(av - sv) > 0.5) {
          rowOk = false;
          DISCREPANCIES.push({
            view: "クロス集計", ym: crossYm, rowLabel: staffName, kpi: `成約数(${ch})`,
            sheetVal: sv, appVal: av, diff: av - sv,
          });
        }
      }

      console.log(`  ${staffName}: ${rowOk ? "OK" : "MISMATCH"}`);
    }
  }

  // ===========================================================
  // Output results
  // ===========================================================

  console.log("\n" + "=".repeat(60));
  console.log(`TOTAL DISCREPANCIES: ${DISCREPANCIES.length}`);

  if (DISCREPANCIES.length > 0) {
    console.log("\nAll discrepancies:");
    for (const d of DISCREPANCIES) {
      console.log(`  [${d.view}] ${d.ym} / ${d.rowLabel} / ${d.kpi}: sheet=${d.sheetVal}, app=${d.appVal}, diff=${d.diff.toFixed(4)}`);
    }
  }

  // Save results to JSON for report generation
  const output = {
    timestamp: new Date().toISOString(),
    discrepancies: DISCREPANCIES,
    summaryResults,
    stats: {
      total: DISCREPANCIES.length,
      byView: {},
      byKpi: {},
    },
  };

  for (const d of DISCREPANCIES) {
    output.stats.byView[d.view] = (output.stats.byView[d.view] || 0) + 1;
    output.stats.byKpi[d.kpi] = (output.stats.byKpi[d.kpi] || 0) + 1;
  }

  writeFileSync("../specs/eval-scripts/comparison_results.json", JSON.stringify(output, null, 2));
  console.log("\nResults saved to specs/eval-scripts/comparison_results.json");
}

main().catch(console.error);
