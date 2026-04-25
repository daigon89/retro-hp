"use client";

import { useState, useMemo } from "react";
import {
  StaffSummaryRow,
  formatYen,
  formatRate,
  formatCount,
} from "@/lib/summaryUtils";

interface StaffTableProps {
  rows: StaffSummaryRow[];
  total: StaffSummaryRow;
}

type SortDir = "asc" | "desc" | null;

interface SortState {
  key: keyof StaffSummaryRow | "name" | "target_sales" | null;
  dir: SortDir;
}

interface ColDef {
  key: keyof StaffSummaryRow;
  label: string;
  format: (row: StaffSummaryRow) => string;
  group: string;
}

const COLUMNS: ColDef[] = [
  // 計上日基準売上
  { key: "keijo_keijo_sales", label: "計上売上", format: (r) => `¥${formatYen(r.keijo_keijo_sales)}`, group: "売上（計上日）" },
  { key: "keijo_paid_sales", label: "入金済売上", format: (r) => `¥${formatYen(r.keijo_paid_sales)}`, group: "売上（計上日）" },
  { key: "keijo_unpaid_sales", label: "未入金売上", format: (r) => `¥${formatYen(r.keijo_unpaid_sales)}`, group: "売上（計上日）" },
  { key: "payment_rate", label: "入金率", format: (r) => formatRate(r.payment_rate), group: "入金" },
  // アポ
  { key: "apo_scheduled", label: "アポ予定数", format: (r) => formatCount(r.apo_scheduled), group: "アポ" },
  { key: "apo_processed", label: "アポ消化件数", format: (r) => formatCount(r.apo_processed), group: "アポ" },
  { key: "apo_seated", label: "アポ着座件数", format: (r) => formatCount(r.apo_seated), group: "アポ" },
  { key: "apo_seated_rate", label: "アポ着座率", format: (r) => formatRate(r.apo_seated_rate), group: "アポ" },
  { key: "invalid_apo", label: "無効アポ数", format: (r) => formatCount(r.invalid_apo), group: "状態" },
  { key: "bridge_count", label: "ブリッジ数", format: (r) => formatCount(r.bridge_count), group: "状態" },
  { key: "remaining_bridge", label: "残ブリッジ数", format: (r) => formatCount(r.remaining_bridge), group: "状態" },
  // 決着
  { key: "settled_count", label: "決着数", format: (r) => formatCount(r.settled_count), group: "決着・成約" },
  { key: "contract_count", label: "成約件数", format: (r) => formatCount(r.contract_count), group: "決着・成約" },
  { key: "settlement_rate", label: "決着成約率", format: (r) => formatRate(r.settlement_rate), group: "決着・成約" },
  // 見込
  { key: "keijo_sales_forecast", label: "計上売上見込", format: (r) => `¥${formatYen(r.keijo_sales_forecast)}`, group: "売上見込" },
  { key: "payment_sales_forecast", label: "入金売上見込", format: (r) => `¥${formatYen(r.payment_sales_forecast)}`, group: "売上見込" },
  { key: "forecast_achievement_rate", label: "見込目標達成率", format: (r) => formatRate(r.forecast_achievement_rate), group: "売上見込" },
  // クーリングオフ
  { key: "cooling_off_count", label: "クーリングオフ件数", format: (r) => formatCount(r.cooling_off_count), group: "クーリングオフ" },
  { key: "contract_with_cooling_off", label: "クーリングオフ込み成約件数", format: (r) => formatCount(r.contract_with_cooling_off), group: "クーリングオフ" },
  { key: "cooling_off_rate", label: "クーリングオフ率", format: (r) => formatRate(r.cooling_off_rate), group: "クーリングオフ" },
];

// Build group spans for the header row
interface GroupSpan {
  label: string;
  span: number;
  startIdx: number;
}

function buildGroupSpans(): GroupSpan[] {
  const spans: GroupSpan[] = [];
  let i = 0;
  while (i < COLUMNS.length) {
    const group = COLUMNS[i].group;
    let span = 0;
    while (i + span < COLUMNS.length && COLUMNS[i + span].group === group) {
      span++;
    }
    spans.push({ label: group, span, startIdx: i });
    i += span;
  }
  return spans;
}

const GROUP_SPANS = buildGroupSpans();

const GROUP_COLORS: Record<string, string> = {
  "売上（計上日）": "bg-blue-50 text-blue-800",
  "入金": "bg-green-50 text-green-800",
  "アポ": "bg-orange-50 text-orange-800",
  "状態": "bg-slate-100 text-slate-700",
  "決着・成約": "bg-red-50 text-red-800",
  "売上見込": "bg-purple-50 text-purple-800",
  "クーリングオフ": "bg-rose-50 text-rose-800",
};

const COL_HEADER_COLORS: Record<string, string> = {
  "売上（計上日）": "bg-blue-50",
  "入金": "bg-green-50",
  "アポ": "bg-orange-50",
  "状態": "bg-slate-50",
  "決着・成約": "bg-red-50",
  "売上見込": "bg-purple-50",
  "クーリングオフ": "bg-rose-50",
};

type SortKey = keyof StaffSummaryRow | "name" | "target_sales";

function getValue(row: StaffSummaryRow, key: SortKey): number | string {
  if (key === "name") return row.name;
  if (key === "target_sales") return row.target_sales;
  return row[key as keyof StaffSummaryRow] as number;
}

function sortRows(rows: StaffSummaryRow[], key: SortKey | null, dir: SortDir): StaffSummaryRow[] {
  if (!key || !dir) return rows;
  return [...rows].sort((a, b) => {
    const av = getValue(a, key);
    const bv = getValue(b, key);
    let cmp: number;
    if (typeof av === "string" && typeof bv === "string") {
      cmp = av.localeCompare(bv, "ja");
    } else {
      cmp = (av as number) - (bv as number);
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === "asc") return <span aria-hidden="true" className="ml-1 text-blue-400 text-xs">▲</span>;
  if (dir === "desc") return <span aria-hidden="true" className="ml-1 text-blue-400 text-xs">▼</span>;
  return <span aria-hidden="true" className="ml-1 text-gray-400 text-xs">⇅</span>;
}

function DataRow({
  row,
  isTotal,
}: {
  row: StaffSummaryRow;
  isTotal?: boolean;
}) {
  const baseClass = isTotal
    ? "bg-slate-100 font-semibold border-t-2 border-slate-400"
    : "bg-white hover:bg-slate-50";

  return (
    <tr className={`${baseClass} border-b border-slate-200`}>
      {/* 担当者名 */}
      <td className={`sticky left-0 z-10 px-3 py-2 text-sm whitespace-nowrap border-r border-slate-300 ${isTotal ? "bg-slate-100 font-bold" : "bg-white"}`}>
        {row.name}
      </td>
      {/* 目標売上 */}
      <td className={`px-3 py-2 text-sm text-right whitespace-nowrap tabular-nums border-r border-slate-200 ${isTotal ? "bg-slate-100" : ""}`}>
        {row.target_sales > 0 ? `¥${formatYen(row.target_sales)}` : "-"}
      </td>
      {/* KPI columns */}
      {COLUMNS.map((col) => (
        <td
          key={String(col.key)}
          className={`px-3 py-2 text-sm text-right whitespace-nowrap tabular-nums border-r border-slate-100 ${isTotal ? "bg-slate-100" : ""}`}
        >
          {col.format(row)}
        </td>
      ))}
    </tr>
  );
}

// Mobile card for a single staff row
function StaffCard({
  row,
  isTotal,
}: {
  row: StaffSummaryRow;
  isTotal?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Primary KPIs shown always
  const primaryKpis = [
    { label: "計上売上", value: `¥${formatYen(row.keijo_keijo_sales)}` },
    { label: "成約件数", value: formatCount(row.contract_count) },
    { label: "決着成約率", value: formatRate(row.settlement_rate) },
  ];

  // Secondary KPIs shown when expanded
  const secondaryKpis = COLUMNS.filter(
    (col) => !["keijo_keijo_sales", "contract_count", "settlement_rate"].includes(String(col.key))
  );

  const cardClass = isTotal
    ? "rounded-lg border border-slate-400 bg-slate-100 shadow-sm"
    : "rounded-lg border border-slate-200 bg-white shadow-sm";

  return (
    <div className={cardClass}>
      {/* Card header */}
      <div className={`px-4 py-3 flex items-center justify-between ${isTotal ? "bg-slate-200 rounded-t-lg" : "bg-slate-700 rounded-t-lg"}`}>
        <span className={`font-bold text-base ${isTotal ? "text-slate-800" : "text-white"}`}>
          {row.name}
        </span>
        {row.target_sales > 0 && (
          <span className={`text-xs ${isTotal ? "text-slate-600" : "text-slate-300"}`}>
            目標: ¥{formatYen(row.target_sales)}
          </span>
        )}
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        {primaryKpis.map((kpi) => (
          <div key={kpi.label} className="px-3 py-3 flex flex-col items-center">
            <span className="text-xs text-slate-500 mb-1">{kpi.label}</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums text-center">{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* Expand button */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full px-4 py-2 text-xs text-slate-500 flex items-center justify-center gap-1 hover:bg-slate-50 transition-colors"
        aria-expanded={isExpanded}
      >
        {isExpanded ? "詳細を閉じる ▲" : "詳細を表示 ▼"}
      </button>

      {/* Secondary KPIs grouped */}
      {isExpanded && (
        <div className="border-t border-slate-100">
          {GROUP_SPANS.map((g) => {
            const groupCols = secondaryKpis.filter((col) => col.group === g.label);
            if (groupCols.length === 0) return null;
            return (
              <div key={g.label} className="border-b border-slate-100 last:border-0">
                <div className={`px-4 py-1.5 text-xs font-semibold ${GROUP_COLORS[g.label] ?? "bg-slate-100 text-slate-700"}`}>
                  {g.label}
                </div>
                <div className="divide-y divide-slate-50">
                  {groupCols.map((col) => (
                    <div key={String(col.key)} className="flex items-center justify-between px-4 py-2">
                      <span className="text-sm text-slate-600">{col.label}</span>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">{col.format(row)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StaffTable({ rows, total }: StaffTableProps) {
  const [sort, setSort] = useState<SortState>({ key: null, dir: null });

  function handleSort(key: SortKey) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      if (prev.dir === "desc") return { key: null, dir: null };
      return { key, dir: "asc" };
    });
  }

  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort]);

  function thClass(key: SortKey, base: string) {
    return `${base} cursor-pointer select-none hover:brightness-95 transition-all`;
  }

  function sortIconFor(key: SortKey) {
    return <SortIcon dir={sort.key === key ? sort.dir : null} />;
  }

  type MobileSortKey = "keijo_keijo_sales" | "contract_count";
  const mobileSortLabel: Record<MobileSortKey, string> = {
    keijo_keijo_sales: "成約金額順",
    contract_count: "成約数順",
  };

  function handleMobileSort(key: MobileSortKey) {
    setSort((prev) => {
      if (prev.key === key && prev.dir === "desc") return { key: null, dir: null };
      if (prev.key === key && prev.dir === "asc") return { key, dir: "desc" };
      return { key, dir: "desc" }; // default descending (top performers first)
    });
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {/* Sort buttons */}
        <div className="flex gap-2">
          {(["keijo_keijo_sales", "contract_count"] as MobileSortKey[]).map((key) => {
            const isActive = sort.key === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleMobileSort(key)}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                  isActive
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-700 border border-slate-300"
                }`}
              >
                {mobileSortLabel[key]}
                {isActive && (
                  <span className="text-xs">
                    {sort.dir === "desc" ? "↓" : "↑"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {sorted.map((row) => (
          <StaffCard key={row.name} row={row} />
        ))}
        <StaffCard row={total} isTotal />
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-300 shadow-sm">
        <table className="min-w-max border-collapse text-slate-800">
          <thead>
            {/* Group header row */}
            <tr className="border-b border-slate-300">
              <th
                className="sticky left-0 z-20 bg-slate-800 text-white px-3 py-2 text-sm font-semibold whitespace-nowrap border-r border-slate-600"
                rowSpan={2}
              >
                担当者
              </th>
              <th
                onClick={() => handleSort("target_sales")}
                className="bg-slate-700 text-white px-3 py-2 text-sm font-semibold whitespace-nowrap border-r border-slate-500 text-center cursor-pointer select-none hover:bg-slate-600 transition-colors"
                rowSpan={2}
              >
                <span className="flex items-center justify-center">
                  目標売上
                  {sortIconFor("target_sales")}
                </span>
              </th>
              {GROUP_SPANS.map((g) => (
                <th
                  key={g.label}
                  colSpan={g.span}
                  className={`px-3 py-1.5 text-xs font-bold text-center border-r border-slate-300 ${GROUP_COLORS[g.label] ?? "bg-slate-100 text-slate-700"}`}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            {/* Column header row */}
            <tr className="border-b-2 border-slate-400">
              {COLUMNS.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={() => handleSort(col.key)}
                  className={thClass(
                    col.key,
                    `px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap text-right border-r border-slate-200 ${COL_HEADER_COLORS[col.group] ?? "bg-slate-50"}`
                  )}
                  aria-sort={
                    sort.key === col.key && sort.dir === "asc"
                      ? "ascending"
                      : sort.key === col.key && sort.dir === "desc"
                      ? "descending"
                      : "none"
                  }
                >
                  <span className="flex items-center justify-end">
                    {col.label}
                    {sortIconFor(col.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <DataRow key={row.name} row={row} />
            ))}
            <DataRow row={total} isTotal />
          </tbody>
        </table>
      </div>
    </>
  );
}
