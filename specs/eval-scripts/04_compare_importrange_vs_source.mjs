/**
 * Compare data fetched directly from source vs data in analysis sheet's IMPORTRANGE copies.
 * This detects data staleness in IMPORTRANGE.
 *
 * Run: cd sales-watch && NODE_PATH=./node_modules node --input-type=module < ../specs/eval-scripts/04_compare_importrange_vs_source.mjs
 */

import { google } from "googleapis";
import { readFileSync } from "fs";

const SOURCE_SHEET_ID = "1bWbzZRcxGpUlXFOlTZlzlPQjC4v6MYKM9MZHRb-WA3A";
const ANALYSIS_SHEET_ID = "1TGvNaGFosMiiY7m6CZi017XuMAIiD7at1N-1tm-m29k";

function getCredentials() {
  const env = readFileSync(".env.local", "utf-8");
  const m = env.match(/GOOGLE_SERVICE_ACCOUNT_JSON='([^']+)'/s);
  return JSON.parse(m[1]);
}

async function getSheets() {
  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  return google.sheets({ version: "v4", auth });
}

function serialToYM(serial) {
  if (typeof serial !== "number") return null;
  const intSerial = Math.trunc(serial);
  const d = new Date(1899, 11, 31);
  d.setDate(d.getDate() + intSerial);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function extractYearMonth(dateStr) {
  if (!dateStr) return "";
  const full = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-]\d{1,2}(?:\s[\d:]+)?$/);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}`;
  return "";
}

async function fetchSheetRaw(sheets, spreadsheetId, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values ?? [];
}

async function main() {
  const sheets = await getSheets();

  // ============================================================
  // 1. Compare 契約管理 (source) vs データシート(契約情報) (analysis)
  // ============================================================
  console.log("=== Comparing 契約管理 source vs analysis IMPORTRANGE ===");

  const [sourceContract, analysisContract] = await Promise.all([
    fetchSheetRaw(sheets, SOURCE_SHEET_ID, "契約管理!A:R"),
    fetchSheetRaw(sheets, ANALYSIS_SHEET_ID, "データシート(契約情報)!A:R"),
  ]);

  console.log(`Source 契約管理 rows (incl header): ${sourceContract.length}`);
  console.log(`Analysis データシート(契約情報) rows (incl header): ${analysisContract.length}`);

  // Compare row counts by month (using column F = 契約日, index 5)
  const sourceByMonth = {};
  const analysisByMonth = {};

  // Source
  for (let i = 1; i < sourceContract.length; i++) {
    const row = sourceContract[i];
    const dateVal = row[5]; // 契約日
    const status = String(row[11] ?? ""); // 成約後ステータス
    const amount = Number(row[6] ?? 0); // 契約金額
    
    let ym = "";
    if (typeof dateVal === "number") {
      ym = serialToYM(dateVal);
    } else if (typeof dateVal === "string") {
      ym = extractYearMonth(dateVal);
    }
    
    if (!ym) ym = "(no-date)";
    if (!sourceByMonth[ym]) sourceByMonth[ym] = { rows: 0, total: 0, active_total: 0 };
    sourceByMonth[ym].rows++;
    sourceByMonth[ym].total += amount;
    if (!["クーリングオフ","その他解約"].includes(status)) {
      sourceByMonth[ym].active_total += amount;
    }
  }

  // Analysis
  for (let i = 1; i < analysisContract.length; i++) {
    const row = analysisContract[i];
    const dateVal = row[5]; // 契約日
    const status = String(row[11] ?? ""); // 成約後ステータス
    const amount = Number(row[6] ?? 0); // 契約金額
    
    let ym = "";
    if (typeof dateVal === "number") {
      ym = serialToYM(dateVal);
    } else if (typeof dateVal === "string") {
      ym = extractYearMonth(dateVal);
    }
    
    if (!ym) ym = "(no-date)";
    if (!analysisByMonth[ym]) analysisByMonth[ym] = { rows: 0, total: 0, active_total: 0 };
    analysisByMonth[ym].rows++;
    analysisByMonth[ym].total += amount;
    if (!["クーリングオフ","その他解約"].includes(status)) {
      analysisByMonth[ym].active_total += amount;
    }
  }

  // Compare
  const allMonths = new Set([...Object.keys(sourceByMonth), ...Object.keys(analysisByMonth)]);
  const sortedMonths = Array.from(allMonths).sort();

  console.log("\nMonth-by-month comparison (source vs analysis):");
  console.log("Month      | Src rows | Ana rows | Src active ¥  | Ana active ¥  | Diff ¥");
  for (const ym of sortedMonths) {
    const s = sourceByMonth[ym] ?? { rows: 0, active_total: 0 };
    const a = analysisByMonth[ym] ?? { rows: 0, active_total: 0 };
    const diff = a.active_total - s.active_total;
    if (s.rows !== a.rows || Math.abs(diff) > 0) {
      console.log(`${ym.padEnd(10)} | ${String(s.rows).padStart(8)} | ${String(a.rows).padStart(8)} | ${s.active_total.toLocaleString().padStart(14)} | ${a.active_total.toLocaleString().padStart(14)} | ${diff !== 0 ? diff.toLocaleString() : ''}`);
    }
  }

  // Show full table for key months
  console.log("\nFull table for 2025-09 through 2026-04:");
  const keyMonths = ["2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04"];
  for (const ym of keyMonths) {
    const s = sourceByMonth[ym] ?? { rows: 0, active_total: 0 };
    const a = analysisByMonth[ym] ?? { rows: 0, active_total: 0 };
    const diff = a.active_total - s.active_total;
    console.log(`${ym}: source=${s.active_total.toLocaleString()} (${s.rows} rows), analysis=${a.active_total.toLocaleString()} (${a.rows} rows), diff=${diff.toLocaleString()}`);
  }

  // ============================================================
  // 2. Find specific contracts that differ between source and analysis
  // ============================================================
  console.log("\n=== Contracts in analysis but NOT in source (by アポNo) ===");

  const sourceApoNos = new Set();
  const sourceContractMap = {};
  for (let i = 1; i < sourceContract.length; i++) {
    const row = sourceContract[i];
    const apoNo = String(row[0] ?? "");
    if (apoNo) {
      sourceApoNos.add(apoNo);
      sourceContractMap[apoNo] = { rowIdx: i, date: row[5], amount: row[6], status: row[11] };
    }
  }

  const analysisApoNos = new Set();
  const analysisOnlyContracts = [];
  for (let i = 1; i < analysisContract.length; i++) {
    const row = analysisContract[i];
    const apoNo = String(row[0] ?? "");
    if (apoNo) {
      analysisApoNos.add(apoNo);
      if (!sourceApoNos.has(apoNo)) {
        analysisOnlyContracts.push({ rowIdx: i, apoNo, date: row[5], amount: row[6], status: row[11], month: serialToYM(Number(row[5])) });
      }
    }
  }

  console.log(`Source unique アポNo: ${sourceApoNos.size}`);
  console.log(`Analysis unique アポNo: ${analysisApoNos.size}`);
  console.log(`Contracts in analysis but not source: ${analysisOnlyContracts.length}`);
  for (const c of analysisOnlyContracts) {
    console.log(`  アポNo=${c.apoNo}, date=${c.date}, amount=${c.amount}, status=${c.status}, month=${c.month}`);
  }

  const sourceOnlyContracts = [];
  for (const apoNo of sourceApoNos) {
    if (!analysisApoNos.has(apoNo)) {
      sourceOnlyContracts.push({ apoNo, ...sourceContractMap[apoNo] });
    }
  }
  console.log(`\nContracts in source but not analysis: ${sourceOnlyContracts.length}`);
  for (const c of sourceOnlyContracts) {
    console.log(`  アポNo=${c.apoNo}, date=${c.date}, amount=${c.amount}, status=${c.status}`);
  }

  // ============================================================
  // 3. Compare 統合マスタ (source) vs データシート(統合マスタ) (analysis)
  // ============================================================
  console.log("\n=== Comparing 統合マスタ source vs analysis IMPORTRANGE ===");

  const [sourceApo, analysisApo] = await Promise.all([
    fetchSheetRaw(sheets, SOURCE_SHEET_ID, "統合マスタ!A:P"),
    fetchSheetRaw(sheets, ANALYSIS_SHEET_ID, "データシート(統合マスタ)!A:P"),
  ]);

  console.log(`Source 統合マスタ rows (incl header): ${sourceApo.length}`);
  console.log(`Analysis データシート(統合マスタ) rows (incl header): ${analysisApo.length}`);

  // Count by アポ予定日 month
  const sourceApoByMonth = {};
  const analysisApoByMonth = {};

  function countApoByMonth(rows, result) {
    const headers = rows[0];
    const dateIdx = headers.indexOf("アポ予定日");
    const statusIdx = headers.indexOf("アポステータス");
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const dateVal = row[dateIdx];
      const status = String(row[statusIdx] ?? "");
      let ym = "";
      if (typeof dateVal === "number") {
        ym = serialToYM(Math.trunc(dateVal));
      } else if (typeof dateVal === "string") {
        ym = extractYearMonth(dateVal);
      }
      if (!ym) ym = "(no-date)";
      if (!result[ym]) result[ym] = { total: 0, nonDup: 0 };
      result[ym].total++;
      if (status !== "重複") result[ym].nonDup++;
    }
  }

  countApoByMonth(sourceApo, sourceApoByMonth);
  countApoByMonth(analysisApo, analysisApoByMonth);

  console.log("\nApo count comparison (non-dup アポ予定数):");
  const apoMonths = new Set([...Object.keys(sourceApoByMonth), ...Object.keys(analysisApoByMonth)]);
  for (const ym of Array.from(apoMonths).sort()) {
    const s = sourceApoByMonth[ym] ?? { nonDup: 0 };
    const a = analysisApoByMonth[ym] ?? { nonDup: 0 };
    if (s.nonDup !== a.nonDup) {
      console.log(`  ${ym}: source=${s.nonDup}, analysis=${a.nonDup}, diff=${a.nonDup - s.nonDup}`);
    }
  }
  console.log("(Only showing months with differences)");

  // Show the key months
  console.log("\nFull non-dup counts for key months:");
  for (const ym of keyMonths) {
    const s = sourceApoByMonth[ym] ?? { nonDup: 0 };
    const a = analysisApoByMonth[ym] ?? { nonDup: 0 };
    console.log(`  ${ym}: source=${s.nonDup}, analysis=${a.nonDup}, diff=${a.nonDup - s.nonDup}`);
  }

  // Special: show all unparseable dates in source 統合マスタ
  const sourceApoHeaders = sourceApo[0];
  const apoDateIdx = sourceApoHeaders.indexOf("アポ予定日");
  const apoStatusIdx = sourceApoHeaders.indexOf("アポステータス");
  console.log("\nUnparseable アポ予定日 rows in source 統合マスタ:");
  for (let i = 1; i < sourceApo.length; i++) {
    const row = sourceApo[i];
    const dateVal = row[apoDateIdx];
    if (typeof dateVal === "string" && dateVal) {
      const ym = extractYearMonth(dateVal);
      if (!ym) {
        const status = row[apoStatusIdx];
        console.log(`  Row ${i}: date="${dateVal}", status="${status}"`);
      }
    } else if (!dateVal || dateVal === "") {
      // empty date - does the sheet count these?
    }
  }

  // Also check analysis unparseable
  const anaApoHeaders = analysisApo[0];
  const anaApoDateIdx = anaApoHeaders.indexOf("アポ予定日");
  let anaStringCount = 0, anaUnparseable = 0;
  for (let i = 1; i < analysisApo.length; i++) {
    const row = analysisApo[i];
    const dateVal = row[anaApoDateIdx];
    if (typeof dateVal === "string") {
      anaStringCount++;
      if (!extractYearMonth(dateVal)) anaUnparseable++;
    }
  }
  console.log(`\nAnalysis IMPORTRANGE string dates: ${anaStringCount}, unparseable: ${anaUnparseable}`);
}

main().catch(console.error);
