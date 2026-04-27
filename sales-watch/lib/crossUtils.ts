/**
 * Cross-tab (クロス集計) utilities.
 *
 * Computes a matrix of:
 *   rows    = 担当者 (sales staff)
 *   columns = 導線種別 (channel/lead type)
 *
 * Metrics per cell:
 *   - 成約数   (contract_count): アポステータス === "成約" のアポ件数
 *   - 決着数   (settled_count): 成約 + 失注 + (ブリッジ かつ アポ予定日 < Today()-10日)
 *                                This matches the analysis sheet formula and summaryUtils.ts.
 *   - 成約率   (contract_rate): 成約数 / 決着数 (null if 決着数 === 0)
 *
 * Data source: 統合マスタ (ApoRow[]), filtered by アポ予定日 year-month when ym is set.
 */

import { ApoRow, StaffRow } from "@/lib/sheets";
import { extractYearMonth } from "@/lib/filterUtils";

// Statuses with a final terminal outcome (成約 / 失注).
// ブリッジ that are more than 10 days old are also counted as settled — see isBridgeSettled().
const TERMINAL_SETTLED_STATUSES = ["成約", "失注"];
const BRIDGE_STATUS = "ブリッジ";
const CONTRACT_STATUS = "成約";

/** Returns the Date 10 days ago at local midnight. */
function getTenDaysAgo(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 10);
  return d;
}

/** Parse "YYYY-MM-DD" or "YYYY/MM/DD" into a local-midnight Date (null if unparseable). */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export interface CrossCell {
  contract_count: number;
  settled_count: number;
  contract_rate: number | null; // contract_count / settled_count
}

export interface CrossMatrixRow {
  staffName: string;
  cells: Record<string, CrossCell>; // keyed by channel name
  total: CrossCell; // row total across all channels
}

export interface CrossMatrixData {
  channels: string[]; // column headers (ordered)
  rows: CrossMatrixRow[]; // one per staff member
  columnTotals: Record<string, CrossCell>; // totals per channel
  grandTotal: CrossCell; // overall total
}

function makeEmptyCell(): CrossCell {
  return { contract_count: 0, settled_count: 0, contract_rate: null };
}

function computeRate(cell: CrossCell): CrossCell {
  return {
    ...cell,
    contract_rate:
      cell.settled_count > 0 ? cell.contract_count / cell.settled_count : null,
  };
}

/**
 * Compute the cross-tab matrix for a given year-month (or all months if ym is "").
 *
 * @param staffRows    Rows from 営業担当者マスタ (used for the canonical staff name list)
 * @param apoRows      Rows from 統合マスタ
 * @param ym           "YYYY-MM" or "" for all months
 * @param channels     Optional fixed channel list. If omitted, channels are derived from data.
 */
export function computeCrossMatrix(
  staffRows: StaffRow[],
  apoRows: ApoRow[],
  ym: string,
  channels?: string[]
): CrossMatrixData {
  // 1. Filter apo rows by year-month (アポ予定日)
  const filtered = ym
    ? apoRows.filter((r) => extractYearMonth(r.アポ予定日) === ym)
    : apoRows;

  // 2. Determine staff names from master (or fall back to data)
  let staffNames: string[];
  if (staffRows.length > 0) {
    staffNames = staffRows.map((r) => r.担当者).filter(Boolean);
  } else {
    const nameSet = new Set<string>();
    filtered.forEach((r) => {
      if (r.営業担当者) nameSet.add(r.営業担当者);
    });
    staffNames = Array.from(nameSet).sort();
  }

  // 3. Determine channels (columns)
  let channelList: string[];
  if (channels && channels.length > 0) {
    channelList = channels;
  } else {
    const channelSet = new Set<string>();
    filtered.forEach((r) => {
      if (r.導線種別) channelSet.add(r.導線種別);
    });
    channelList = Array.from(channelSet).sort();
  }

  // 4. Build accumulator: staff x channel
  // Map<staffName, Map<channel, CrossCell>>
  const accumulator = new Map<string, Map<string, CrossCell>>();
  for (const name of staffNames) {
    const channelMap = new Map<string, CrossCell>();
    for (const ch of channelList) {
      channelMap.set(ch, makeEmptyCell());
    }
    accumulator.set(name, channelMap);
  }

  // Column-level totals
  const columnTotalsRaw = new Map<string, CrossCell>();
  for (const ch of channelList) {
    columnTotalsRaw.set(ch, makeEmptyCell());
  }
  const grandTotalRaw: CrossCell = makeEmptyCell();

  // 5. Accumulate data
  const tenDaysAgo = getTenDaysAgo();
  for (const row of filtered) {
    const name = row.営業担当者;
    const channel = row.導線種別;
    const status = row.アポステータス;

    // 決着 = 成約 or 失注 or (ブリッジ and アポ予定日 is more than 10 days ago)
    const isTerminalSettled = TERMINAL_SETTLED_STATUSES.includes(status);
    const isBridgeSettled =
      status === BRIDGE_STATUS &&
      (() => {
        const d = parseDate(row.アポ予定日);
        return d !== null && d < tenDaysAgo;
      })();
    const isSettled = isTerminalSettled || isBridgeSettled;
    const isContract = status === CONTRACT_STATUS;

    if (!name || !channel) continue;

    // Staff x channel cell (only accumulate for known staff + channel combos)
    const staffMap = accumulator.get(name);
    if (staffMap) {
      let cell = staffMap.get(channel);
      if (!cell) {
        // channel found in data but not in pre-defined channelList — add it
        cell = makeEmptyCell();
        staffMap.set(channel, cell);
      }
      if (isSettled) cell.settled_count++;
      if (isContract) cell.contract_count++;
    }

    // Column total
    let colTotal = columnTotalsRaw.get(channel);
    if (!colTotal) {
      colTotal = makeEmptyCell();
      columnTotalsRaw.set(channel, colTotal);
    }
    if (isSettled) colTotal.settled_count++;
    if (isContract) colTotal.contract_count++;

    // Grand total
    if (isSettled) grandTotalRaw.settled_count++;
    if (isContract) grandTotalRaw.contract_count++;
  }

  // 6. Build final channel list (may have grown if unknown channels were encountered)
  // Preserve the order of channelList first, then append any extra channels from data
  const finalChannelsSet = new Set<string>(channelList);
  for (const ch of columnTotalsRaw.keys()) {
    finalChannelsSet.add(ch);
  }
  const finalChannels = Array.from(finalChannelsSet);

  // 7. Build row results
  const rows: CrossMatrixRow[] = staffNames.map((staffName) => {
    const staffMap = accumulator.get(staffName) ?? new Map<string, CrossCell>();
    const cells: Record<string, CrossCell> = {};
    const rowTotal: CrossCell = makeEmptyCell();

    for (const ch of finalChannels) {
      const raw = staffMap.get(ch) ?? makeEmptyCell();
      cells[ch] = computeRate(raw);
      rowTotal.settled_count += raw.settled_count;
      rowTotal.contract_count += raw.contract_count;
    }

    return {
      staffName,
      cells,
      total: computeRate(rowTotal),
    };
  });

  // 8. Column totals
  const columnTotals: Record<string, CrossCell> = {};
  for (const ch of finalChannels) {
    const raw = columnTotalsRaw.get(ch) ?? makeEmptyCell();
    columnTotals[ch] = computeRate(raw);
  }

  return {
    channels: finalChannels,
    rows,
    columnTotals,
    grandTotal: computeRate(grandTotalRaw),
  };
}
