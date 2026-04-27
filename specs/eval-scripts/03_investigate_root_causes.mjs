/**
 * Root cause investigation script.
 * Run: cd sales-watch && NODE_PATH=./node_modules node --input-type=module < ../specs/eval-scripts/03_investigate_root_causes.mjs
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

  // ============================================================
  // 1. Investigate date boundary issue in 契約管理
  //    Fetch with UNFORMATTED_VALUE (what the app sees)
  // ============================================================
  console.log("\n=== RAW contract 契約日 values (UNFORMATTED_VALUE) ===");

  const contractRaw = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE_SHEET_ID,
    range: "契約管理",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const contractValues = contractRaw.data.values ?? [];
  const contractHeaders = contractValues[0];
  console.log("Headers:", JSON.stringify(contractHeaders));
  
  // Find 契約日 and アポ日 column indices
  const keijoColIdx = contractHeaders.indexOf("契約日");
  const apoColIdx = contractHeaders.indexOf("アポ日");
  const statusColIdx = contractHeaders.indexOf("成約後ステータス");
  const amountColIdx = contractHeaders.indexOf("契約金額");
  const staffColIdx = contractHeaders.indexOf("営業担当者");
  console.log(`契約日 col idx: ${keijoColIdx}, アポ日 col idx: ${apoColIdx}`);

  // Look for dates with fractional serials (time components)
  const monthBoundaryContracts = [];
  const stringDateContracts = [];

  for (let i = 1; i < contractValues.length; i++) {
    const row = contractValues[i];
    const keijoVal = row[keijoColIdx];
    const apoVal = row[apoColIdx];
    const status = row[statusColIdx] ?? "";
    const amount = row[amountColIdx] ?? 0;

    // Check for fractional serials (time components)
    if (typeof keijoVal === "number" && keijoVal !== Math.trunc(keijoVal)) {
      monthBoundaryContracts.push({
        rowIdx: i,
        keijoRaw: keijoVal,
        keijoDate: serialToFullDateStr(keijoVal),
        keijoTrunc: Math.trunc(keijoVal),
        status,
        amount,
      });
    }

    // Check for string dates
    if (typeof keijoVal === "string" && keijoVal) {
      const ym = extractYearMonth(keijoVal);
      stringDateContracts.push({
        rowIdx: i,
        keijoVal,
        parsedYm: ym || "(UNPARSEABLE)",
        status,
        amount,
      });
    }
  }

  console.log(`\nContracts with fractional serial (time component) in 契約日: ${monthBoundaryContracts.length}`);
  for (const c of monthBoundaryContracts.slice(0, 20)) {
    const serial = c.keijoRaw;
    const intPart = Math.trunc(serial);
    const fractPart = serial - intPart;
    // Check if the truncated date is the last day of a month
    const d = new Date(1899, 11, 31);
    d.setDate(d.getDate() + intPart);
    const isLastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() === d.getDate();
    console.log(`  Row ${c.rowIdx}: raw=${serial.toFixed(6)}, date=${c.keijoDate}, lastDay=${isLastDay}, status=${c.status}, amount=${c.amount}`);
  }

  console.log(`\nContracts with string 契約日: ${stringDateContracts.length}`);
  for (const c of stringDateContracts.slice(0, 10)) {
    console.log(`  Row ${c.rowIdx}: value="${c.keijoVal}", parsed="${c.parsedYm}", status=${c.status}`);
  }

  // ============================================================
  // 2. Investigate アポ予定数 discrepancy in 統合マスタ
  // ============================================================
  console.log("\n=== RAW アポ 統合マスタ date analysis ===");

  const apoRaw = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE_SHEET_ID,
    range: "統合マスタ",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const apoValues = apoRaw.data.values ?? [];
  const apoHeaders = apoValues[0];
  const apoDateColIdx = apoHeaders.indexOf("アポ予定日");
  const apoStatusColIdx = apoHeaders.indexOf("アポステータス");

  console.log(`アポ予定日 col idx: ${apoDateColIdx}`);

  // Look for boundary cases in known-discrepancy months
  // Sep 2025: app has 848, sheet has 859 (app is lower by 11)
  // This means app is EXCLUDING 11 rows that the sheet counts
  
  // Check for string dates that don't parse
  let stringApos = 0;
  let unparseableApos = 0;
  const monthCounts = {};

  for (let i = 1; i < apoValues.length; i++) {
    const row = apoValues[i];
    const dateVal = row[apoDateColIdx];
    const status = row[apoStatusColIdx] ?? "";

    if (typeof dateVal === "string") {
      stringApos++;
      const ym = extractYearMonth(dateVal);
      if (!ym) {
        unparseableApos++;
        if (i < 30) console.log(`  Unparseable string date row ${i}: "${dateVal}", status="${status}"`);
      }
    } else if (typeof dateVal === "number") {
      const dateStr = serialToFullDateStr(dateVal);
      const ym = extractYearMonth(dateStr);
      monthCounts[ym] = (monthCounts[ym] || 0) + 1;
    }
  }

  console.log(`String dates in アポ予定日: ${stringApos}`);
  console.log(`Unparseable string dates: ${unparseableApos}`);

  // Now check what the sheet counts vs app for Sep 2025
  // Sheet counts with EOMONTH-based boundary (exact integer serials)
  // App counts with string parsing after Math.trunc conversion

  // Let's see if there are any apo dates at month boundaries with fractional serials
  const aosBoundary = [];
  for (let i = 1; i < apoValues.length; i++) {
    const row = apoValues[i];
    const dateVal = row[apoDateColIdx];
    if (typeof dateVal === "number" && dateVal !== Math.trunc(dateVal)) {
      aosBoundary.push({ rowIdx: i, raw: dateVal, date: serialToFullDateStr(dateVal) });
    }
  }
  console.log(`\nApo rows with fractional date serials: ${aosBoundary.length}`);
  for (const a of aosBoundary.slice(0, 10)) {
    console.log(`  Row ${a.rowIdx}: raw=${a.raw.toFixed(6)}, date=${a.date}`);
  }

  // ============================================================
  // 3. Check channel names in source vs analysis sheet
  // ============================================================
  console.log("\n=== Channel names (導線種別) ===");

  const channelSet = new Set();
  for (let i = 1; i < apoValues.length; i++) {
    const row = apoValues[i];
    const ch = apoHeaders.indexOf("導線種別");
    if (row[ch]) channelSet.add(String(row[ch]));
  }
  console.log("Channels in 統合マスタ:", Array.from(channelSet).sort());

  // Contract channels
  const contractChannelSet = new Set();
  for (let i = 1; i < contractValues.length; i++) {
    const row = contractValues[i];
    const ch = contractHeaders.indexOf("導線種別");
    if (row[ch]) contractChannelSet.add(String(row[ch]));
  }
  console.log("Channels in 契約管理:", Array.from(contractChannelSet).sort());

  // Cross matrix channels
  const crossRaw = await sheets.spreadsheets.values.get({
    spreadsheetId: ANALYSIS_SHEET_ID,
    range: "導線種別×営業担当者マトリクス!A1:R20",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const crossValues = crossRaw.data.values ?? [];
  console.log("\nCross matrix header rows:");
  for (let i = 0; i < Math.min(5, crossValues.length); i++) {
    console.log(`  Row ${i}: ${JSON.stringify(crossValues[i])}`);
  }

  // ============================================================
  // 4. Investigate アポ date in プレ情報 for 残ブリッジ
  // ============================================================
  console.log("\n=== プレ情報 analysis for 残ブリッジ ===");
  
  const preRaw = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE_SHEET_ID,
    range: "プレ情報",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const preValues = preRaw.data.values ?? [];
  const preHeaders = preValues[0];
  const preApoDateIdx = preHeaders.indexOf("アポ日");
  const preStatusIdx = preHeaders.indexOf("プレステータス");
  console.log(`プレ情報 headers: ${JSON.stringify(preHeaders)}`);
  console.log(`アポ日 col idx: ${preApoDateIdx}, プレステータス col idx: ${preStatusIdx}`);

  // Count rows by アポ日 month where プレステータス is empty
  const preMonthBridge = {};
  let stringPreDates = 0;
  let unparseablePreDates = 0;

  for (let i = 1; i < preValues.length; i++) {
    const row = preValues[i];
    const dateVal = row[preApoDateIdx];
    const status = row[preStatusIdx] ?? "";

    let ym = "";
    if (typeof dateVal === "number") {
      ym = serialToFullDateStr(dateVal).substring(0, 7);
    } else if (typeof dateVal === "string") {
      stringPreDates++;
      ym = extractYearMonth(dateVal);
      if (!ym) {
        unparseablePreDates++;
        if (unparseablePreDates <= 5) {
          console.log(`  Unparseable pre date row ${i}: "${dateVal}"`);
        }
      }
    }

    if (ym && status === "") {
      preMonthBridge[ym] = (preMonthBridge[ym] || 0) + 1;
    }
  }

  console.log(`\nString dates in プレ情報.アポ日: ${stringPreDates}`);
  console.log(`Unparseable: ${unparseablePreDates}`);
  console.log("\n残ブリッジ (empty プレステータス, by アポ日 month):");
  for (const [m, c] of Object.entries(preMonthBridge).sort()) {
    console.log(`  ${m}: ${c}`);
  }

  // ============================================================
  // 5. Check the source spreadsheet 契約管理 raw data vs what analysis sees
  //    Try to identify which contracts are in Sep vs Oct
  // ============================================================
  console.log("\n=== Contract date analysis for Sep/Oct 2025 boundary ===");
  
  // Get contracts where 契約日 is in Sep or Oct 2025 (by app's parsing)
  const sepContracts = [], octContracts = [];
  for (let i = 1; i < contractValues.length; i++) {
    const row = contractValues[i];
    const keijoVal = row[keijoColIdx];
    const status = row[statusColIdx] ?? "";
    const amount = Number(row[amountColIdx] ?? 0);

    let dateStr = "";
    let rawSerial = null;
    if (typeof keijoVal === "number") {
      rawSerial = keijoVal;
      dateStr = serialToFullDateStr(keijoVal);
    } else if (typeof keijoVal === "string") {
      dateStr = keijoVal;
    }

    const ym = extractYearMonth(dateStr);
    if (ym === "2025-09") sepContracts.push({ rowIdx: i, dateStr, rawSerial, status, amount });
    if (ym === "2025-10") octContracts.push({ rowIdx: i, dateStr, rawSerial, status, amount });
  }

  console.log(`Sep 2025 contracts (by app): ${sepContracts.length}`);
  const sepTotal = sepContracts.filter(c => !["クーリングオフ","その他解約"].includes(c.status)).reduce((s,c) => s + c.amount, 0);
  console.log(`Sep 2025 active contract total: ${sepTotal.toLocaleString()}`);
  
  console.log(`Oct 2025 contracts (by app): ${octContracts.length}`);
  const octTotal = octContracts.filter(c => !["クーリングオフ","その他解約"].includes(c.status)).reduce((s,c) => s + c.amount, 0);
  console.log(`Oct 2025 active contract total: ${octTotal.toLocaleString()}`);

  // Check for contracts with fractional serials in these months (date boundary cases)
  const boundarySep = sepContracts.filter(c => c.rawSerial !== null && c.rawSerial !== Math.trunc(c.rawSerial));
  const boundaryOct = octContracts.filter(c => c.rawSerial !== null && c.rawSerial !== Math.trunc(c.rawSerial));
  console.log(`\nSep 2025 contracts with fractional date (boundary): ${boundarySep.length}`);
  for (const c of boundarySep) {
    console.log(`  Row ${c.rowIdx}: serial=${c.rawSerial.toFixed(6)}, date=${c.dateStr}, amount=${c.amount}, status=${c.status}`);
  }
  console.log(`Oct 2025 contracts with fractional date (boundary): ${boundaryOct.length}`);
  for (const c of boundaryOct) {
    console.log(`  Row ${c.rowIdx}: serial=${c.rawSerial.toFixed(6)}, date=${c.dateStr}, amount=${c.amount}, status=${c.status}`);
  }

  // Check if EOMONTH boundary would exclude any Sep contracts
  // Sep 30, 2025 = 45931
  const SEP30_SERIAL = 45931;  // EOMONTH Sep = Sep 30
  console.log(`\nContracts that would be EXCLUDED from Sep by sheet's EOMONTH (${SEP30_SERIAL}) but INCLUDED by app:`);
  let sheetSepTotal = 0;
  let appSepTotal = 0;
  for (const c of sepContracts) {
    if (!["クーリングオフ","その他解約"].includes(c.status)) {
      appSepTotal += c.amount;
      if (c.rawSerial !== null && c.rawSerial <= SEP30_SERIAL) {
        sheetSepTotal += c.amount;
      } else if (c.rawSerial !== null && c.rawSerial > SEP30_SERIAL) {
        console.log(`  Row ${c.rowIdx}: serial=${c.rawSerial.toFixed(6)} > ${SEP30_SERIAL}, excluded from sheet's Sep, amount=${c.amount}`);
      }
    }
  }
  console.log(`App Sep total: ${appSepTotal.toLocaleString()}, Sheet-compatible Sep total: ${sheetSepTotal.toLocaleString()}`);
  console.log(`Expected sheet Sep total (from comparison): 47,870,000`);

  // ============================================================
  // 6. Check the analysis sheet サマリー against FORMATTED data
  // ============================================================
  console.log("\n=== Analysis sheet サマリー raw data ===");
  
  const summaryRaw = await sheets.spreadsheets.values.get({
    spreadsheetId: ANALYSIS_SHEET_ID,
    range: "サマリー!A1:W5",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const summaryValues = summaryRaw.data.values ?? [];
  for (const row of summaryValues) {
    console.log(JSON.stringify(row));
  }

  // ============================================================
  // 7. Check what FORMATTED value shows for the year-month column
  // ============================================================
  console.log("\n=== Analysis sheet サマリー FORMATTED year-month column ===");
  
  const summaryFormatted = await sheets.spreadsheets.values.get({
    spreadsheetId: ANALYSIS_SHEET_ID,
    range: "サマリー!A1:A30",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const formattedYm = summaryFormatted.data.values ?? [];
  console.log(JSON.stringify(formattedYm.map(r => r[0])));
}

main().catch(console.error);
