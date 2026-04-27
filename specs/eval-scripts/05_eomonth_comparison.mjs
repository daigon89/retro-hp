/**
 * Direct EOMONTH-based comparison to match the sheet's COUNTIFS logic exactly.
 * Run: cd sales-watch && NODE_PATH=./node_modules node --input-type=module < ../specs/eval-scripts/05_eomonth_comparison.mjs
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

// Replicate Google Sheets EOMONTH function
function eomonth(serial, months) {
  // Convert serial to date
  const d = new Date(1899, 11, 31);
  d.setDate(d.getDate() + Math.round(serial));
  // Add months
  d.setMonth(d.getMonth() + months + 1); // go to next month
  d.setDate(0); // go to last day of previous month
  // Return serial
  const base = new Date(1899, 11, 31);
  const diffDays = Math.round((d - base) / (1000 * 60 * 60 * 24));
  return diffDays;
}

// App's date conversion
function serialToFullDateStr(serial) {
  const intSerial = Math.trunc(serial);
  const d = new Date(1899, 11, 31);
  d.setDate(d.getDate() + intSerial);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function extractYearMonth(dateStr) {
  if (!dateStr) return "";
  const full = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-]\d{1,2}(?:\s[\d:]+)?$/);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}`;
  return "";
}

async function main() {
  const sheets = await getSheets();

  // Get the year-month serial values from サマリー sheet
  const summaryValues = (await sheets.spreadsheets.values.get({
    spreadsheetId: ANALYSIS_SHEET_ID,
    range: "サマリー!A1:A30",
    valueRenderOption: "UNFORMATTED_VALUE",
  })).data.values ?? [];

  // Get ACTUAL computed values from サマリー
  const summaryData = (await sheets.spreadsheets.values.get({
    spreadsheetId: ANALYSIS_SHEET_ID,
    range: "サマリー!A1:W30",
    valueRenderOption: "UNFORMATTED_VALUE",
  })).data.values ?? [];

  // Get the analysis 統合マスタ data (IMPORTRANGE copy)
  const apoData = (await sheets.spreadsheets.values.get({
    spreadsheetId: ANALYSIS_SHEET_ID,
    range: "データシート(統合マスタ)!A:L",
    valueRenderOption: "UNFORMATTED_VALUE",
  })).data.values ?? [];

  const apoHeaders = apoData[0];
  const apoDateIdx = apoHeaders.indexOf("アポ予定日"); // D column = index 3
  const apoStatusIdx = apoHeaders.indexOf("アポステータス"); // L column = index 11
  console.log(`アポ予定日 idx: ${apoDateIdx}, アポステータス idx: ${apoStatusIdx}`);
  console.log(`Data rows in IMPORTRANGE: ${apoData.length - 1}`);

  // For each month in サマリー, compute EOMONTH bounds and count using EXACT sheet logic
  console.log("\n=== EOMONTH-based counting vs サマリー values vs App values ===");
  console.log("Month      | EOMONTH lo | EOMONTH hi | Sheet count | EOMONTH count | App count");

  const TARGET_MONTHS = ["2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04"];

  for (let rowIdx = 1; rowIdx < summaryData.length; rowIdx++) {
    const row = summaryData[rowIdx];
    const ymSerial = row[0];
    if (!ymSerial || typeof ymSerial !== "number") continue;

    const ymDate = serialToFullDateStr(ymSerial);
    const ym = ymDate.substring(0, 7);
    if (!TARGET_MONTHS.includes(ym)) continue;

    // Compute EOMONTH bounds
    const loBound = eomonth(ymSerial, -1) + 1;  // EOMONTH(A,-1)+1 = first day of month
    const hiBound = eomonth(ymSerial, 0);         // EOMONTH(A,0) = last day of month

    const sheetCount = Number(row[8] ?? 0); // アポ予定数 (column I, index 8)

    // Count using EOMONTH-based comparison (exact sheet logic)
    let eomonthCount = 0;
    let appCount = 0;
    const eomonthOnly = [];  // rows counted by EOMONTH but not by app
    const appOnly = [];      // rows counted by app but not EOMONTH

    for (let i = 1; i < apoData.length; i++) {
      const arow = apoData[i];
      const dateVal = arow[apoDateIdx];
      const status = String(arow[apoStatusIdx] ?? "");

      if (status === "重複") continue;

      // EOMONTH-based counting (sheet logic, raw numeric comparison)
      let inEomonth = false;
      if (typeof dateVal === "number") {
        inEomonth = dateVal >= loBound && dateVal <= hiBound;
      }
      // String dates: sheet's COUNTIFS would try to compare string to number
      // In Google Sheets, text compared to numeric criteria: USUALLY excluded

      // App-based counting (Math.trunc then year-month string comparison)
      let inApp = false;
      if (typeof dateVal === "number") {
        const dateStr = serialToFullDateStr(dateVal);
        inApp = extractYearMonth(dateStr) === ym;
      } else if (typeof dateVal === "string") {
        inApp = extractYearMonth(dateVal) === ym;
      }

      if (inEomonth) eomonthCount++;
      if (inApp) appCount++;

      if (inEomonth && !inApp) {
        eomonthOnly.push({ i, dateVal, status });
      }
      if (!inEomonth && inApp) {
        appOnly.push({ i, dateVal, status });
      }
    }

    const diff1 = sheetCount - eomonthCount;
    const diff2 = sheetCount - appCount;
    console.log(`${ym}: lo=${loBound}, hi=${hiBound}, sheet=${sheetCount}, eomonth=${eomonthCount}(diff=${diff1}), app=${appCount}(diff=${diff2})`);

    if (eomonthOnly.length > 0) {
      console.log(`  >> Rows in EOMONTH but NOT in App (${eomonthOnly.length} rows):`);
      for (const r of eomonthOnly.slice(0, 5)) {
        console.log(`     row ${r.i}: dateVal=${typeof r.dateVal === "number" ? r.dateVal.toFixed(6) : r.dateVal}, status=${r.status}`);
      }
    }
    if (appOnly.length > 0) {
      console.log(`  >> Rows in App but NOT in EOMONTH (${appOnly.length} rows):`);
      for (const r of appOnly.slice(0, 5)) {
        console.log(`     row ${r.i}: dateVal=${typeof r.dateVal === "number" ? r.dateVal.toFixed(6) : r.dateVal}, status=${r.status}`);
      }
    }
  }

  // ============================================================
  // Check: Do string dates in IMPORTRANGE affect COUNTIFS?
  // ============================================================
  console.log("\n=== String date behavior in analysis IMPORTRANGE ===");
  let numericCount = 0, stringCount = 0;
  for (let i = 1; i < apoData.length; i++) {
    const arow = apoData[i];
    const dateVal = arow[apoDateIdx];
    if (typeof dateVal === "number") numericCount++;
    else if (typeof dateVal === "string" && dateVal) stringCount++;
  }
  console.log(`Numeric date values: ${numericCount}`);
  console.log(`String date values: ${stringCount}`);

  // Sample of string dates
  console.log("Sample string dates in IMPORTRANGE:");
  let shown = 0;
  for (let i = 1; i < apoData.length && shown < 10; i++) {
    const arow = apoData[i];
    const dateVal = arow[apoDateIdx];
    if (typeof dateVal === "string" && dateVal) {
      const status = String(arow[apoStatusIdx] ?? "");
      console.log(`  Row ${i}: "${dateVal}", status="${status}"`);
      shown++;
    }
  }

  // ============================================================
  // Direct count using EOMONTH bounds on IMPORTRANGE アポ予定数
  // vs what the sheet formula computes
  // ============================================================
  console.log("\n=== Cross-check: fetch ACTUAL IMPORTRANGE column D values directly ===");
  
  const columnDRaw = (await sheets.spreadsheets.values.get({
    spreadsheetId: ANALYSIS_SHEET_ID,
    range: "データシート(統合マスタ)!D:L",
    valueRenderOption: "UNFORMATTED_VALUE",
  })).data.values ?? [];

  console.log(`Column D:L rows: ${columnDRaw.length}`);
  let fracInD = 0, intInD = 0, strInD = 0;
  for (let i = 1; i < columnDRaw.length; i++) {
    const v = columnDRaw[i][0];
    if (typeof v === "number") {
      if (v !== Math.trunc(v)) fracInD++;
      else intInD++;
    } else if (typeof v === "string") strInD++;
  }
  console.log(`Column D アポ予定日: integer serials=${intInD}, fractional serials=${fracInD}, strings=${strInD}`);

  // Sep bounds: 45901 to 45930
  const SEP_LO = 45901, SEP_HI = 45930;
  let sepExactCount = 0, sepFracExcluded = 0;
  for (let i = 1; i < columnDRaw.length; i++) {
    const v = columnDRaw[i][0];
    const status = String(columnDRaw[i][8] ?? ""); // column L is index 8 in D:L range (D=0,E=1,F=2,G=3,H=4,I=5,J=6,K=7,L=8)
    if (typeof v === "number" && status !== "重複") {
      if (v >= SEP_LO && v <= SEP_HI) sepExactCount++;
      else if (v > SEP_HI && v < SEP_HI + 1) sepFracExcluded++; // Sep 30 with time component
    }
  }
  console.log(`\nSep 2025 (${SEP_LO}-${SEP_HI}): exact COUNTIFS compatible count = ${sepExactCount}`);
  console.log(`Sep 30 with time component (excluded from sep, not in oct): ${sepFracExcluded}`);

  // Now check what the sheet reports as アポ予定数 for Sep
  console.log(`Sheet reports Sep アポ予定数 = 859`);
  console.log(`Our EOMONTH count = ${sepExactCount}`);
  console.log(`Difference = ${859 - sepExactCount}`);
}

main().catch(console.error);
