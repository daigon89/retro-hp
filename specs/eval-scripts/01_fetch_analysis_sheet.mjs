/**
 * Step 1: Fetch the analysis spreadsheet (ダッシュボード側) and inspect structure.
 * Run: cd sales-watch && node ../specs/eval-scripts/01_fetch_analysis_sheet.mjs
 */

import { google } from "googleapis";
import { readFileSync } from "fs";

const ANALYSIS_SHEET_ID = "1TGvNaGFosMiiY7m6CZi017XuMAIiD7at1N-1tm-m29k";

function getCredentials() {
  const env = readFileSync(".env.local", "utf-8");
  const m = env.match(/GOOGLE_SERVICE_ACCOUNT_JSON='([^']+)'/s);
  if (!m) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not found in .env.local");
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

async function main() {
  const sheets = await getSheets();

  // Fetch all target sheets
  const sheetNames = ["サマリー", "営業担当者別分析", "導線別分析", "導線種別×営業担当者マトリクス"];

  for (const sheet of sheetNames) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Sheet: ${sheet}`);
    console.log("=".repeat(60));

    // Get values
    const values = await fetchRange(sheets, ANALYSIS_SHEET_ID, `${sheet}!A1:AZ200`);
    if (values.length === 0) {
      console.log("(empty)");
      continue;
    }

    console.log(`Rows: ${values.length}, Cols: ${Math.max(...values.map(r => r.length))}`);
    console.log("\nFirst 5 rows:");
    for (let i = 0; i < Math.min(5, values.length); i++) {
      console.log(`  [${i}]: ${JSON.stringify(values[i])}`);
    }

    // Get formulas for row 2 (first data row)
    const formulas = await fetchRange(sheets, ANALYSIS_SHEET_ID, `${sheet}!A1:AZ200`, "FORMULA");
    if (formulas.length >= 2) {
      console.log("\nFormulas in row 2 (first data row):");
      const headers = values[0] ?? [];
      const formulaRow = formulas[1] ?? [];
      headers.forEach((h, i) => {
        if (formulaRow[i] && String(formulaRow[i]).startsWith("=")) {
          console.log(`  ${h}: ${formulaRow[i]}`);
        }
      });
    }
  }
}

main().catch(console.error);
