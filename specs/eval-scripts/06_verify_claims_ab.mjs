/**
 * Independent verification of Generator's claims A and B.
 * Claim A: 契約管理.契約日 has 0 fractional serial values
 * Claim B: クロス集計 決着数 formula matches summaryUtils.ts definition
 *
 * Run: cd sales-watch && NODE_PATH=./node_modules node --input-type=module < ../specs/eval-scripts/06_verify_claims_ab.mjs
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
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

async function main() {
  const sheets = await getSheets();

  // ============================================================
  // CLAIM A: 契約管理.契約日 has 0 fractional serial values
  // ============================================================
  console.log("=== CLAIM A: 契約管理 契約日 fractional serial check ===");

  const contractRaw = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE_SHEET_ID,
    range: "契約管理!A:R",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const contractData = contractRaw.data.values ?? [];
  const contractHeaders = contractData[0];
  const keiyakubiIdx = contractHeaders.indexOf("契約日");
  const apoNoIdx = contractHeaders.indexOf("アポNo");

  console.log(`契約管理 total rows (incl header): ${contractData.length}`);
  console.log(`契約日 column index: ${keiyakubiIdx}`);

  let intSerials = 0, fracSerials = 0, stringDates = 0, emptyDates = 0;
  const fracExamples = [];
  const stringExamples = [];

  for (let i = 1; i < contractData.length; i++) {
    const row = contractData[i];
    const dateVal = row[keiyakubiIdx];
    if (dateVal === null || dateVal === undefined || dateVal === "") {
      emptyDates++;
    } else if (typeof dateVal === "number") {
      if (dateVal !== Math.trunc(dateVal)) {
        fracSerials++;
        if (fracExamples.length < 5) {
          fracExamples.push({ row: i + 1, apoNo: row[apoNoIdx], serial: dateVal });
        }
      } else {
        intSerials++;
      }
    } else if (typeof dateVal === "string") {
      stringDates++;
      if (stringExamples.length < 5) {
        stringExamples.push({ row: i + 1, apoNo: row[apoNoIdx], val: dateVal });
      }
    }
  }

  console.log(`\n契約日 breakdown:`);
  console.log(`  Integer serial (no fractional part): ${intSerials}`);
  console.log(`  Fractional serial (has time component): ${fracSerials}`);
  console.log(`  String dates: ${stringDates}`);
  console.log(`  Empty: ${emptyDates}`);

  if (fracSerials === 0) {
    console.log(`\nCLAIM A: VERIFIED ✓ — No fractional serials in 契約日`);
  } else {
    console.log(`\nCLAIM A: REFUTED ✗ — ${fracSerials} fractional serials found:`);
    fracExamples.forEach(e => console.log(`  Row ${e.row}: アポNo=${e.apoNo}, serial=${e.serial}`));
  }

  if (stringDates > 0) {
    console.log(`\nNOTE: ${stringDates} string dates in 契約日 (not serials):`);
    stringExamples.forEach(e => console.log(`  Row ${e.row}: アポNo=${e.apoNo}, val="${e.val}"`));
  }

  // ============================================================
  // Also check 統合マスタ アポ予定日 for fractional serials
  // ============================================================
  console.log("\n=== Checking 統合マスタ アポ予定日 fractional serials ===");

  const apoRaw = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE_SHEET_ID,
    range: "統合マスタ!A:P",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const apoData = apoRaw.data.values ?? [];
  const apoHeaders = apoData[0];
  const apoDateIdx = apoHeaders.indexOf("アポ予定日");
  const apoStatusIdx = apoHeaders.indexOf("アポステータス");

  let apoInt = 0, apoFrac = 0, apoStr = 0, apoStrParseable = 0, apoStrUnparseable = 0;
  let apoFracMonthEnd = 0;
  const apoFracExamples = [];
  const apoStrUnparseableExamples = [];

  function extractYM_strict(s) {
    if (!s) return "";
    const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
    return "";
  }

  function extractYM_loose(s) {
    if (!s) return "";
    const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-]\d{1,2}/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
    return "";
  }

  function serialToYM(serial) {
    const int = Math.trunc(serial);
    const d = new Date(1899, 11, 31);
    d.setDate(d.getDate() + int);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function serialToYMDay(serial) {
    const int = Math.trunc(serial);
    const d = new Date(1899, 11, 31);
    d.setDate(d.getDate() + int);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Count by year-month discrepancy between strict and loose parsing
  const looseCountByMonth = {};
  const strictCountByMonth = {};

  for (let i = 1; i < apoData.length; i++) {
    const row = apoData[i];
    const dateVal = row[apoDateIdx];
    const status = String(row[apoStatusIdx] ?? "");
    if (status === "重複") continue;

    if (dateVal === null || dateVal === undefined || dateVal === "") continue;

    if (typeof dateVal === "number") {
      if (dateVal !== Math.trunc(dateVal)) {
        apoFrac++;
        if (apoFracExamples.length < 5) apoFracExamples.push({ row: i + 1, serial: dateVal, date: serialToYMDay(dateVal) });
        // Check if month-end boundary
        const ym = serialToYM(dateVal);
        const intSerial = Math.trunc(dateVal);
        const d = new Date(1899, 11, 31);
        d.setDate(d.getDate() + intSerial);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        if (d.getDate() === lastDay) apoFracMonthEnd++;
      } else {
        apoInt++;
      }
    } else if (typeof dateVal === "string") {
      apoStr++;
      const strictYm = extractYM_strict(dateVal);
      const looseYm = extractYM_loose(dateVal);
      if (strictYm) {
        apoStrParseable++;
        strictCountByMonth[strictYm] = (strictCountByMonth[strictYm] || 0) + 1;
      } else {
        apoStrUnparseable++;
        if (apoStrUnparseableExamples.length < 10) {
          apoStrUnparseableExamples.push({ row: i + 1, val: dateVal, status, looseYm });
        }
      }
      if (looseYm) {
        looseCountByMonth[looseYm] = (looseCountByMonth[looseYm] || 0) + 1;
      }
    }
  }

  console.log(`\nアポ予定日 breakdown (non-重複 rows only):`);
  console.log(`  Integer serial: ${apoInt}`);
  console.log(`  Fractional serial (has time): ${apoFrac}`);
  console.log(`    Of which on month-end day: ${apoFracMonthEnd}`);
  console.log(`  String dates: ${apoStr}`);
  console.log(`    Parseable by strict regex: ${apoStrParseable}`);
  console.log(`    Unparseable (Japanese day names, time ranges, etc.): ${apoStrUnparseable}`);

  if (apoFracExamples.length > 0) {
    console.log(`\nFractional serial examples:`);
    apoFracExamples.forEach(e => console.log(`  Row ${e.row}: serial=${e.serial.toFixed(6)}, date=${e.date}`));
  }

  console.log(`\nUnparseable string date examples (loose regex matches vs strict):`);
  apoStrUnparseableExamples.forEach(e => {
    console.log(`  Row ${e.row}: "${e.val}", status="${e.status}", looseYm="${e.looseYm}"`);
  });

  console.log(`\nMonth-by-month: rows counted by loose regex but NOT strict regex (potential app overcount):`);
  const allMonths = new Set([...Object.keys(looseCountByMonth)]);
  for (const ym of Array.from(allMonths).sort()) {
    const loose = looseCountByMonth[ym] || 0;
    const strict = strictCountByMonth[ym] || 0;
    if (loose !== strict) {
      console.log(`  ${ym}: loose=${loose}, strict=${strict}, extra=${loose - strict}`);
    }
  }

  // ============================================================
  // CLAIM B: クロス集計 H5 formula matches summaryUtils.ts
  // ============================================================
  console.log("\n=== CLAIM B: クロス集計 H5 formula verification ===");

  // Fetch formula from cross matrix sheet
  const formulaRes = await sheets.spreadsheets.values.get({
    spreadsheetId: ANALYSIS_SHEET_ID,
    range: "導線種別×営業担当者マトリクス!H5:H6",
    valueRenderOption: "FORMULA",
  });
  const formulaData = formulaRes.data.values ?? [];
  console.log(`H5 formula: ${formulaData[0]?.[0] || "(empty)"}`);
  console.log(`H6 formula: ${formulaData[1]?.[0] || "(empty)"}`);

  // Also fetch G5:R5 to see context
  const contextRes = await sheets.spreadsheets.values.get({
    spreadsheetId: ANALYSIS_SHEET_ID,
    range: "導線種別×営業担当者マトリクス!A1:R10",
    valueRenderOption: "FORMULA",
  });
  const contextData = contextRes.data.values ?? [];
  console.log(`\nRows 1-10 of cross matrix (formulas):`);
  for (let i = 0; i < contextData.length; i++) {
    console.log(`  Row ${i + 1}: ${contextData[i].join(" | ").substring(0, 200)}`);
  }

  // ============================================================
  // CLAIM D supplement: Compare source アポ予定数 vs sheet formula for 2026-04
  // ============================================================
  console.log("\n=== Source アポ予定数 vs sheet formula for key months ===");
  const summaryRaw = await sheets.spreadsheets.values.get({
    spreadsheetId: ANALYSIS_SHEET_ID,
    range: "サマリー!A1:I30",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const summaryData = summaryRaw.data.values ?? [];

  function serialToDate(serial) {
    const int = Math.trunc(serial);
    const d = new Date(1899, 11, 31);
    d.setDate(d.getDate() + int);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  console.log("\nMonth      | Sheet アポ予定数 | Source non-dup (standard) | App (loose) | Loose-Strict | Sheet-Source diff");
  for (let ri = 1; ri < summaryData.length; ri++) {
    const row = summaryData[ri];
    const ymSerial = row[0];
    if (!ymSerial || typeof ymSerial !== "number") continue;
    const ym = serialToDate(ymSerial);
    const sheetCount = Number(row[8] || 0);

    // Count from apoData: strict vs loose for this month
    let strictCount = 0, looseCount = 0;
    for (let i = 1; i < apoData.length; i++) {
      const arow = apoData[i];
      const dateVal = arow[apoDateIdx];
      const status = String(arow[apoStatusIdx] ?? "");
      if (status === "重複") continue;

      let looseYm = "", strictYm = "";
      if (typeof dateVal === "number") {
        const d = serialToDate(dateVal); // Math.trunc logic
        looseYm = d;
        strictYm = d;
      } else if (typeof dateVal === "string") {
        looseYm = extractYM_loose(dateVal);
        strictYm = extractYM_strict(dateVal);
      }

      if (looseYm === ym) looseCount++;
      if (strictYm === ym) strictCount++;
    }

    const looseDiff = looseCount - strictCount;
    const sheetDiff = sheetCount - strictCount;
    if (Math.abs(sheetCount - looseCount) > 2 || looseDiff > 0) {
      console.log(`${ym.padEnd(10)} | ${String(sheetCount).padStart(15)} | ${String(strictCount).padStart(26)} | ${String(looseCount).padStart(11)} | ${String(looseDiff).padStart(12)} | ${sheetDiff}`);
    }
  }
}

main().catch(console.error);
