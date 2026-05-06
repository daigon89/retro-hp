/**
 * Monthly summary aggregation utilities.
 *
 * Data sources:
 * - ApoRow (統合マスタ): appointment data
 * - PreRow (プレ情報): pre-appointment follow-up data
 * - ContractRow (契約管理): contract/sales data
 *
 * Two date bases:
 * - 計上日基準 (keijo): based on 契約日 (contract date)
 * - アポ日基準 (apo): based on アポ日 in contract sheet, or アポ予定日 in apo sheet
 */

import { ApoRow, ContractRow, PreRow, StaffRow } from "@/lib/sheets";
import { extractYearMonth } from "@/lib/filterUtils";

// ---------------------------------------------------------------------------
// Apo status constants
// ---------------------------------------------------------------------------

/** Statuses that count as 「無効アポ」 in 統合マスタ */
const INVALID_APO_STATUSES = ["無効アポ"];

/** Statuses that count as 「着座」 (the appointment was held) */
const SEATED_STATUSES = ["成約", "失注", "ブリッジ", "トスアップ", "無効アポ"];

/** Statuses that are a final outcome (決着) */
const SETTLED_STATUSES = ["成約", "失注"];

/** ブリッジ status */
const BRIDGE_STATUS = "ブリッジ";

/** 重複 status — excluded from scheduled and processed counts */
const DUPLICATE_STATUS = "重複";

// ---------------------------------------------------------------------------
// Contract status constants
// ---------------------------------------------------------------------------

/** 入金済み statuses */
const PAID_STATUSES = ["入金済み", "クーリングオフ期間経過"];

/** 未入金 status */
const UNPAID_STATUS = "未入金";

/** Statuses excluded from sales totals (cancelled contracts) */
const EXCLUDED_SALES_STATUSES = ["クーリングオフ", "その他解約"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAmount(val: string): number {
  if (!val) return 0;
  const n = Number(val.replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * Returns a Date object for 10 days ago (today minus 10 days), at midnight local time.
 */
function getTenDaysAgo(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 10);
  return d;
}

/**
 * Parse a date string of the form "YYYY/MM/DD" or "YYYY-MM-DD" into a Date (local midnight).
 * Returns null if the string is empty or unparseable.
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d;
}

// ---------------------------------------------------------------------------
// Summary types
// ---------------------------------------------------------------------------

export interface SalesSummary {
  /** 計上売上（計上日基準） */
  keijo_keijo_sales: number;
  /** 入金済売上（計上日基準） */
  keijo_paid_sales: number;
  /** 未入金売上（計上日基準） */
  keijo_unpaid_sales: number;

  /** 計上売上（アポ日基準） */
  apo_keijo_sales: number;
  /** 入金済売上（アポ日基準） */
  apo_paid_sales: number;
  /** 未入金売上（アポ日基準） */
  apo_unpaid_sales: number;

  /** 入金率 (paid / keijo_keijo_sales) */
  payment_rate: number | null;

  /** アポ予定数（重複除外） */
  apo_scheduled: number;
  /** アポ消化件数（ステータスが空でない かつ 重複でないもの） */
  apo_processed: number;
  /** アポ着座件数（成約+失注+ブリッジ+トスアップ+無効アポ） */
  apo_seated: number;
  /** アポ着座率 (seated / processed) */
  apo_seated_rate: number | null;

  /** 無効アポ数（統合マスタ + プレ情報） */
  invalid_apo: number;
  /** ブリッジ数 */
  bridge_count: number;
  /** 残ブリッジ数（プレ情報でプレ予定日が月内かつプレステータスが空） */
  remaining_bridge: number;

  /** 決着数（成約+失注+10日以上前のブリッジ） */
  settled_count: number;
  /** 成約件数（統合マスタの成約 + プレ情報の月内成約） */
  contract_count: number;
  /** 決着成約率 (contracts / settled) */
  settlement_rate: number | null;

  /** 計上売上見込（計上売上 + 未消化アポ数 × 決着成約率） */
  keijo_sales_forecast: number;
  /** 入金売上見込（計上売上見込 × 入金率） */
  payment_sales_forecast: number;

  /** クーリングオフ件数 */
  cooling_off_count: number;
  /**
   * クーリングオフ込み成約件数 — 正味の成約件数（クーリングオフ解約を差し引いた実質成約）
   *
   * "込み" は「クーリングオフが込み（含まれた状態）の成約件数を取り出す」という意味ではなく、
   * 「クーリングオフ件数を考慮した上での正味成約件数」を指す。
   * 実装: contract_count（アポ基準成約）− cooling_off_count（クーリングオフ件数）
   * シートの数式も同様に引き算（= 成約件数 − クーリングオフ件数）で一致している。
   */
  contract_with_cooling_off: number;
  /** クーリングオフ率 (cooling_off / contract_with_cooling_off) */
  cooling_off_rate: number | null;
}

// ---------------------------------------------------------------------------
// Main aggregation
// ---------------------------------------------------------------------------

/**
 * Compute the monthly summary for a given year-month (or all months if ym is "").
 *
 * @param apoRows      Rows from 統合マスタ
 * @param contractRows Rows from 契約管理
 * @param ym           "YYYY-MM" or "" for all months
 * @param preRows      Rows from プレ情報 (optional, defaults to [])
 */
export function computeSummary(
  apoRows: ApoRow[],
  contractRows: ContractRow[],
  ym: string,
  preRows: PreRow[] = []
): SalesSummary {
  // -------------------------------------------------------------------------
  // Filter rows by year-month
  // -------------------------------------------------------------------------

  const filteredApo = ym
    ? apoRows.filter((r) => extractYearMonth(r.アポ予定日) === ym)
    : apoRows;

  // プレ情報: filter by プレ予定日 (the month the presentation actually took place)
  const filteredPre = ym
    ? preRows.filter((r) => extractYearMonth(r.プレ予定日) === ym)
    : preRows;

  // For contract rows we need two filtered sets:
  // - 計上日基準: filter by 契約日
  // - アポ日基準: filter by アポ日 (the appointment date stored in contract sheet)
  const contractByKeijo = ym
    ? contractRows.filter((r) => extractYearMonth(r.契約日) === ym)
    : contractRows;

  const contractByApo = ym
    ? contractRows.filter((r) => extractYearMonth(r.アポ日) === ym)
    : contractRows;

  // -------------------------------------------------------------------------
  // Appointment-based KPIs (from 統合マスタ, filtered by アポ予定日)
  // -------------------------------------------------------------------------

  // I列: アポ予定数 = 重複を除外したカウント
  const apo_scheduled = filteredApo.filter(
    (r) => r.アポステータス !== DUPLICATE_STATUS
  ).length;

  // J列: アポ消化件数 = ステータスが空でない かつ 重複でないもの
  const apo_processed = filteredApo.filter(
    (r) => r.アポステータス !== "" && r.アポステータス !== DUPLICATE_STATUS
  ).length;

  // K列: アポ着座件数 = 成約 + 失注 + ブリッジ + トスアップ + 無効アポ の合計
  const apo_seated = filteredApo.filter((r) =>
    SEATED_STATUSES.includes(r.アポステータス)
  ).length;

  // L列: アポ着座率 = 着座件数 / 消化件数
  const apo_seated_rate =
    apo_processed > 0 ? apo_seated / apo_processed : null;

  // M列: 無効アポ数 = 統合マスタの無効アポ + プレ情報の無効アポ
  const invalid_apo_from_apo = filteredApo.filter((r) =>
    INVALID_APO_STATUSES.includes(r.アポステータス)
  ).length;
  const invalid_apo_from_pre = filteredPre.filter((r) =>
    INVALID_APO_STATUSES.includes(r.プレステータス)
  ).length;
  const invalid_apo = invalid_apo_from_apo + invalid_apo_from_pre;

  // ブリッジ数 = rows with ブリッジ status in 統合マスタ
  const bridge_count = filteredApo.filter(
    (r) => r.アポステータス === BRIDGE_STATUS
  ).length;

  // O列: 残ブリッジ数 = プレ情報でプレ予定日が月内かつプレステータスが空のもの
  const remaining_bridge = filteredPre.filter(
    (r) => r.プレステータス === ""
  ).length;

  // P列: 決着数 = 成約 + 失注 + (ブリッジ かつ アポ予定日 < Today()-10)
  const tenDaysAgo = getTenDaysAgo();
  const settled_count =
    filteredApo.filter((r) => SETTLED_STATUSES.includes(r.アポステータス)).length +
    filteredApo.filter((r) => {
      if (r.アポステータス !== BRIDGE_STATUS) return false;
      const d = parseDate(r.アポ予定日);
      return d !== null && d < tenDaysAgo;
    }).length;

  // Q列: 成約件数 = 統合マスタの成約 + プレ情報でプレ予定日が月内かつプレステータス="成約"
  const contract_count_from_apo = filteredApo.filter(
    (r) => r.アポステータス === "成約"
  ).length;
  const contract_count_from_pre = filteredPre.filter(
    (r) => r.プレステータス === "成約"
  ).length;
  const contract_count = contract_count_from_apo + contract_count_from_pre;

  // R列: 決着成約率
  const settlement_rate =
    settled_count > 0 ? contract_count / settled_count : null;

  // -------------------------------------------------------------------------
  // Sales KPIs — 計上日基準 (filtered by 契約日)
  // -------------------------------------------------------------------------

  let keijo_keijo_sales = 0;
  let keijo_paid_sales = 0;
  let keijo_unpaid_sales = 0;

  // Exclude cancelled contracts (クーリングオフ, その他解約) from sales totals
  const activeContractsByKeijo = contractByKeijo.filter(
    (r) => !EXCLUDED_SALES_STATUSES.includes(r.成約後ステータス)
  );

  for (const row of activeContractsByKeijo) {
    const amount = parseAmount(row.契約金額);
    keijo_keijo_sales += amount;
    if (PAID_STATUSES.includes(row.成約後ステータス)) {
      keijo_paid_sales += amount;
    }
    if (row.成約後ステータス === UNPAID_STATUS) {
      keijo_unpaid_sales += amount;
    }
  }

  // H列: 入金率 (paid / keijo_keijo_sales)
  const payment_rate =
    keijo_keijo_sales > 0 ? keijo_paid_sales / keijo_keijo_sales : null;

  // -------------------------------------------------------------------------
  // Sales KPIs — アポ日基準 (filtered by アポ日 in contract sheet)
  // -------------------------------------------------------------------------

  let apo_keijo_sales = 0;
  let apo_paid_sales = 0;
  let apo_unpaid_sales = 0;

  // Exclude cancelled contracts from apo-based sales too
  const activeContractsByApo = contractByApo.filter(
    (r) => !EXCLUDED_SALES_STATUSES.includes(r.成約後ステータス)
  );

  for (const row of activeContractsByApo) {
    const amount = parseAmount(row.契約金額);
    apo_keijo_sales += amount;
    if (PAID_STATUSES.includes(row.成約後ステータス)) {
      apo_paid_sales += amount;
    }
    if (row.成約後ステータス === UNPAID_STATUS) {
      apo_unpaid_sales += amount;
    }
  }

  // -------------------------------------------------------------------------
  // Forecast KPIs (計上日基準)
  // -------------------------------------------------------------------------

  // S列: 計上売上見込 = 計上売上(B) + (アポ予定数(I) - アポ消化件数(J)) × 決着成約率(R)
  const unprocessed_apo = apo_scheduled - apo_processed;
  const keijo_sales_forecast =
    keijo_keijo_sales +
    (settlement_rate !== null ? unprocessed_apo * settlement_rate : 0);

  // T列: 入金売上見込 = 計上売上見込(S) × 入金率(H)
  const payment_sales_forecast =
    payment_rate !== null ? keijo_sales_forecast * payment_rate : keijo_sales_forecast;

  // -------------------------------------------------------------------------
  // Cooling-off KPIs (from 契約管理 filtered by 計上日基準)
  // -------------------------------------------------------------------------

  // クーリングオフ件数 = contracts with status === "クーリングオフ"
  const cooling_off_count = contractByKeijo.filter(
    (r) => r.成約後ステータス === "クーリングオフ"
  ).length;

  // 正味成約件数 = 成約件数(アポ基準) − クーリングオフ件数（クーリングオフを除いた実質成約）
  // 命名が "込み" だが実装は引き算であることに注意。シート側も同じ計算（引き算）で一致。
  const contract_with_cooling_off = contract_count - cooling_off_count;

  // クーリングオフ率 = クーリングオフ件数 / 成約件数（アポ基準）
  const cooling_off_rate =
    contract_count > 0 ? cooling_off_count / contract_count : null;

  return {
    keijo_keijo_sales,
    keijo_paid_sales,
    keijo_unpaid_sales,
    apo_keijo_sales,
    apo_paid_sales,
    apo_unpaid_sales,
    payment_rate,
    apo_scheduled,
    apo_processed,
    apo_seated,
    apo_seated_rate,
    invalid_apo,
    bridge_count,
    remaining_bridge,
    settled_count,
    contract_count,
    settlement_rate,
    keijo_sales_forecast,
    payment_sales_forecast,
    cooling_off_count,
    contract_with_cooling_off,
    cooling_off_rate,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format number as Japanese Yen with comma separators */
export function formatYen(value: number): string {
  return value.toLocaleString("ja-JP");
}

/** Format ratio as percentage string, e.g. 0.753 → "75.3%" */
export function formatRate(value: number | null): string {
  if (value === null) return "-";
  return `${(value * 100).toFixed(2)}%`;
}

/** Format integer count */
export function formatCount(value: number): string {
  return value.toLocaleString("ja-JP");
}

// ---------------------------------------------------------------------------
// Per-staff summary
// ---------------------------------------------------------------------------

export interface StaffSummaryRow extends SalesSummary {
  /** 担当者名 */
  name: string;
  /** 目標売上（マスタから） */
  target_sales: number;
  /** 見込目標達成率 (keijo_sales_forecast / target_sales) */
  forecast_achievement_rate: number | null;
}

/**
 * Compute per-staff summaries for a given year-month.
 * Returns one row per staff member found in the master list, plus a total row.
 *
 * @param staffRows    Rows from 営業担当者マスタ
 * @param apoRows      Rows from 統合マスタ
 * @param contractRows Rows from 契約管理
 * @param ym           "YYYY-MM" or "" for all months
 * @param preRows      Rows from プレ情報 (optional, defaults to [])
 */
export function computeStaffSummaries(
  staffRows: StaffRow[],
  apoRows: ApoRow[],
  contractRows: ContractRow[],
  ym: string,
  preRows: PreRow[] = []
): { rows: StaffSummaryRow[]; total: StaffSummaryRow } {
  // Build a list of staff names from the master. If master is empty, fall
  // back to the union of names found in the raw data.
  let staffNames: string[];
  if (staffRows.length > 0) {
    staffNames = staffRows.map((r) => r.担当者).filter(Boolean);
  } else {
    const nameSet = new Set<string>();
    apoRows.forEach((r) => { if (r.営業担当者) nameSet.add(r.営業担当者); });
    contractRows.forEach((r) => { if (r.営業担当者) nameSet.add(r.営業担当者); });
    staffNames = Array.from(nameSet).sort();
  }

  // Build a lookup map: name → target_sales
  const targetMap = new Map<string, number>();
  for (const r of staffRows) {
    if (r.担当者) {
      const t = parseAmount(r.目標売上);
      targetMap.set(r.担当者, t);
    }
  }

  const rows: StaffSummaryRow[] = staffNames.map((name) => {
    const filteredApo = apoRows.filter((r) => r.営業担当者 === name);
    const filteredContract = contractRows.filter((r) => r.営業担当者 === name);
    const filteredPre = preRows.filter((r) => r.営業担当者 === name);
    const summary = computeSummary(filteredApo, filteredContract, ym, filteredPre);
    const target_sales = targetMap.get(name) ?? 0;
    const forecast_achievement_rate =
      target_sales > 0 ? summary.keijo_sales_forecast / target_sales : null;
    return { ...summary, name, target_sales, forecast_achievement_rate };
  });

  // Total row: sum numeric fields, recompute rates
  const total = sumStaffRows(rows);

  return { rows, total };
}

function sumStaffRows(rows: StaffSummaryRow[]): StaffSummaryRow {
  const init: StaffSummaryRow = {
    name: "合計",
    target_sales: 0,
    forecast_achievement_rate: null,
    keijo_keijo_sales: 0,
    keijo_paid_sales: 0,
    keijo_unpaid_sales: 0,
    apo_keijo_sales: 0,
    apo_paid_sales: 0,
    apo_unpaid_sales: 0,
    payment_rate: null,
    apo_scheduled: 0,
    apo_processed: 0,
    apo_seated: 0,
    apo_seated_rate: null,
    invalid_apo: 0,
    bridge_count: 0,
    remaining_bridge: 0,
    settled_count: 0,
    contract_count: 0,
    settlement_rate: null,
    keijo_sales_forecast: 0,
    payment_sales_forecast: 0,
    cooling_off_count: 0,
    contract_with_cooling_off: 0,
    cooling_off_rate: null,
  };

  for (const r of rows) {
    init.target_sales += r.target_sales;
    init.keijo_keijo_sales += r.keijo_keijo_sales;
    init.keijo_paid_sales += r.keijo_paid_sales;
    init.keijo_unpaid_sales += r.keijo_unpaid_sales;
    init.apo_keijo_sales += r.apo_keijo_sales;
    init.apo_paid_sales += r.apo_paid_sales;
    init.apo_unpaid_sales += r.apo_unpaid_sales;
    init.apo_scheduled += r.apo_scheduled;
    init.apo_processed += r.apo_processed;
    init.apo_seated += r.apo_seated;
    init.invalid_apo += r.invalid_apo;
    init.bridge_count += r.bridge_count;
    init.remaining_bridge += r.remaining_bridge;
    init.settled_count += r.settled_count;
    init.contract_count += r.contract_count;
    init.keijo_sales_forecast += r.keijo_sales_forecast;
    init.payment_sales_forecast += r.payment_sales_forecast;
    init.cooling_off_count += r.cooling_off_count;
    init.contract_with_cooling_off += r.contract_with_cooling_off;
  }

  // Recompute derived rates from totals
  init.payment_rate =
    init.keijo_keijo_sales > 0 ? init.keijo_paid_sales / init.keijo_keijo_sales : null;
  init.apo_seated_rate =
    init.apo_processed > 0 ? init.apo_seated / init.apo_processed : null;
  init.settlement_rate =
    init.settled_count > 0 ? init.contract_count / init.settled_count : null;
  init.cooling_off_rate =
    init.contract_count > 0
      ? init.cooling_off_count / init.contract_count
      : null;
  init.forecast_achievement_rate =
    init.target_sales > 0 ? init.keijo_sales_forecast / init.target_sales : null;

  return init;
}

// ---------------------------------------------------------------------------
// Per-event summary
// ---------------------------------------------------------------------------

export interface EventSummaryRow extends SalesSummary {
  /** イベント名 */
  eventName: string;
}

/**
 * Compute per-event summaries for a given year-month.
 * Groups by the イベント名 column in 統合マスタ and 契約管理.
 * Returns rows for events that have data, plus a total row.
 *
 * @param apoRows      Rows from 統合マスタ
 * @param contractRows Rows from 契約管理
 * @param ym           "YYYY-MM" or "" for all months
 * @param preRows      Rows from プレ情報 (optional, defaults to [])
 */
export function computeEventSummaries(
  apoRows: ApoRow[],
  contractRows: ContractRow[],
  ym: string,
  preRows: PreRow[] = []
): { rows: EventSummaryRow[]; total: EventSummaryRow } {
  // Collect distinct event names from both sources
  const eventSet = new Set<string>();
  apoRows.forEach((r) => { if (r.イベント名) eventSet.add(r.イベント名); });
  contractRows.forEach((r) => { if (r.イベント名) eventSet.add(r.イベント名); });

  const eventNames = Array.from(eventSet).sort();

  const rows: EventSummaryRow[] = eventNames.map((eventName) => {
    const filteredApo = apoRows.filter((r) => r.イベント名 === eventName);
    const filteredContract = contractRows.filter((r) => r.イベント名 === eventName);
    const filteredPre = preRows.filter((r) => r.イベント名 === eventName);
    const summary = computeSummary(filteredApo, filteredContract, ym, filteredPre);
    return { ...summary, eventName };
  }).filter((r) => r.apo_scheduled > 0 || r.keijo_keijo_sales > 0 || r.contract_with_cooling_off > 0);

  // Total row
  const total = sumEventRows(rows);
  return { rows, total };
}

function sumEventRows(rows: EventSummaryRow[]): EventSummaryRow {
  const init: EventSummaryRow = {
    eventName: "合計",
    keijo_keijo_sales: 0,
    keijo_paid_sales: 0,
    keijo_unpaid_sales: 0,
    apo_keijo_sales: 0,
    apo_paid_sales: 0,
    apo_unpaid_sales: 0,
    payment_rate: null,
    apo_scheduled: 0,
    apo_processed: 0,
    apo_seated: 0,
    apo_seated_rate: null,
    invalid_apo: 0,
    bridge_count: 0,
    remaining_bridge: 0,
    settled_count: 0,
    contract_count: 0,
    settlement_rate: null,
    keijo_sales_forecast: 0,
    payment_sales_forecast: 0,
    cooling_off_count: 0,
    contract_with_cooling_off: 0,
    cooling_off_rate: null,
  };

  for (const r of rows) {
    init.keijo_keijo_sales += r.keijo_keijo_sales;
    init.keijo_paid_sales += r.keijo_paid_sales;
    init.keijo_unpaid_sales += r.keijo_unpaid_sales;
    init.apo_keijo_sales += r.apo_keijo_sales;
    init.apo_paid_sales += r.apo_paid_sales;
    init.apo_unpaid_sales += r.apo_unpaid_sales;
    init.apo_scheduled += r.apo_scheduled;
    init.apo_processed += r.apo_processed;
    init.apo_seated += r.apo_seated;
    init.invalid_apo += r.invalid_apo;
    init.bridge_count += r.bridge_count;
    init.remaining_bridge += r.remaining_bridge;
    init.settled_count += r.settled_count;
    init.contract_count += r.contract_count;
    init.keijo_sales_forecast += r.keijo_sales_forecast;
    init.payment_sales_forecast += r.payment_sales_forecast;
    init.cooling_off_count += r.cooling_off_count;
    init.contract_with_cooling_off += r.contract_with_cooling_off;
  }

  init.payment_rate =
    init.keijo_keijo_sales > 0 ? init.keijo_paid_sales / init.keijo_keijo_sales : null;
  init.apo_seated_rate =
    init.apo_processed > 0 ? init.apo_seated / init.apo_processed : null;
  init.settlement_rate =
    init.settled_count > 0 ? init.contract_count / init.settled_count : null;
  init.cooling_off_rate =
    init.contract_count > 0
      ? init.cooling_off_count / init.contract_count
      : null;

  return init;
}

// ---------------------------------------------------------------------------
// Per-channel summary
// ---------------------------------------------------------------------------

export interface ChannelSummaryRow extends SalesSummary {
  /** 導線種別 */
  channel: string;
  /** イベント名別サブ集計 */
  subRows: EventSummaryRow[];
}

/**
 * Compute per-channel (導線種別) summaries for a given year-month.
 * Each channel row also contains per-event sub-rows for expand/collapse.
 *
 * @param apoRows      Rows from 統合マスタ
 * @param contractRows Rows from 契約管理
 * @param ym           "YYYY-MM" or "" for all months
 * @param preRows      Rows from プレ情報 (optional, defaults to [])
 */
export function computeChannelSummaries(
  apoRows: ApoRow[],
  contractRows: ContractRow[],
  ym: string,
  preRows: PreRow[] = []
): { rows: ChannelSummaryRow[]; total: ChannelSummaryRow } {
  // Collect distinct channels from both sources
  const channelSet = new Set<string>();
  apoRows.forEach((r) => { if (r.導線種別) channelSet.add(r.導線種別); });
  contractRows.forEach((r) => { if (r.導線種別) channelSet.add(r.導線種別); });

  const channels = Array.from(channelSet).sort();

  const rows: ChannelSummaryRow[] = channels.map((channel) => {
    const apoForChannel = apoRows.filter((r) => r.導線種別 === channel);
    const contractForChannel = contractRows.filter((r) => r.導線種別 === channel);
    const preForChannel = preRows.filter((r) => r.導線種別 === channel);
    const summary = computeSummary(apoForChannel, contractForChannel, ym, preForChannel);

    // Build event sub-rows for this channel
    const { rows: subRows } = computeEventSummaries(apoForChannel, contractForChannel, ym, preForChannel);

    return { ...summary, channel, subRows };
  }).filter((r) => r.apo_scheduled > 0 || r.keijo_keijo_sales > 0 || r.contract_with_cooling_off > 0);

  const total = sumChannelRows(rows);
  return { rows, total };
}

function sumChannelRows(rows: ChannelSummaryRow[]): ChannelSummaryRow {
  const init: ChannelSummaryRow = {
    channel: "合計",
    subRows: [],
    keijo_keijo_sales: 0,
    keijo_paid_sales: 0,
    keijo_unpaid_sales: 0,
    apo_keijo_sales: 0,
    apo_paid_sales: 0,
    apo_unpaid_sales: 0,
    payment_rate: null,
    apo_scheduled: 0,
    apo_processed: 0,
    apo_seated: 0,
    apo_seated_rate: null,
    invalid_apo: 0,
    bridge_count: 0,
    remaining_bridge: 0,
    settled_count: 0,
    contract_count: 0,
    settlement_rate: null,
    keijo_sales_forecast: 0,
    payment_sales_forecast: 0,
    cooling_off_count: 0,
    contract_with_cooling_off: 0,
    cooling_off_rate: null,
  };

  for (const r of rows) {
    init.keijo_keijo_sales += r.keijo_keijo_sales;
    init.keijo_paid_sales += r.keijo_paid_sales;
    init.keijo_unpaid_sales += r.keijo_unpaid_sales;
    init.apo_keijo_sales += r.apo_keijo_sales;
    init.apo_paid_sales += r.apo_paid_sales;
    init.apo_unpaid_sales += r.apo_unpaid_sales;
    init.apo_scheduled += r.apo_scheduled;
    init.apo_processed += r.apo_processed;
    init.apo_seated += r.apo_seated;
    init.invalid_apo += r.invalid_apo;
    init.bridge_count += r.bridge_count;
    init.remaining_bridge += r.remaining_bridge;
    init.settled_count += r.settled_count;
    init.contract_count += r.contract_count;
    init.keijo_sales_forecast += r.keijo_sales_forecast;
    init.payment_sales_forecast += r.payment_sales_forecast;
    init.cooling_off_count += r.cooling_off_count;
    init.contract_with_cooling_off += r.contract_with_cooling_off;
  }

  init.payment_rate =
    init.keijo_keijo_sales > 0 ? init.keijo_paid_sales / init.keijo_keijo_sales : null;
  init.apo_seated_rate =
    init.apo_processed > 0 ? init.apo_seated / init.apo_processed : null;
  init.settlement_rate =
    init.settled_count > 0 ? init.contract_count / init.settled_count : null;
  init.cooling_off_rate =
    init.contract_count > 0
      ? init.cooling_off_count / init.contract_count
      : null;

  return init;
}
