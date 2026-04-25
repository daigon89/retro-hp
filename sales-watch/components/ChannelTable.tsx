"use client";

import { useState } from "react";
import {
  ChannelSummaryRow,
  EventSummaryRow,
  formatYen,
  formatRate,
  formatCount,
} from "@/lib/summaryUtils";

interface ChannelTableProps {
  rows: ChannelSummaryRow[];
  total: ChannelSummaryRow;
}

interface ColDef {
  label: string;
  formatChannel: (row: ChannelSummaryRow) => string;
  formatEvent: (row: EventSummaryRow) => string;
  group: string;
}

const COLUMNS: ColDef[] = [
  {
    label: "計上売上",
    formatChannel: (r) => `¥${formatYen(r.keijo_keijo_sales)}`,
    formatEvent: (r) => `¥${formatYen(r.keijo_keijo_sales)}`,
    group: "売上（計上日）",
  },
  {
    label: "入金済売上",
    formatChannel: (r) => `¥${formatYen(r.keijo_paid_sales)}`,
    formatEvent: (r) => `¥${formatYen(r.keijo_paid_sales)}`,
    group: "売上（計上日）",
  },
  {
    label: "未入金売上",
    formatChannel: (r) => `¥${formatYen(r.keijo_unpaid_sales)}`,
    formatEvent: (r) => `¥${formatYen(r.keijo_unpaid_sales)}`,
    group: "売上（計上日）",
  },
  {
    label: "入金率",
    formatChannel: (r) => formatRate(r.payment_rate),
    formatEvent: (r) => formatRate(r.payment_rate),
    group: "入金",
  },
  {
    label: "アポ予定数",
    formatChannel: (r) => formatCount(r.apo_scheduled),
    formatEvent: (r) => formatCount(r.apo_scheduled),
    group: "アポ",
  },
  {
    label: "アポ消化件数",
    formatChannel: (r) => formatCount(r.apo_processed),
    formatEvent: (r) => formatCount(r.apo_processed),
    group: "アポ",
  },
  {
    label: "アポ着座件数",
    formatChannel: (r) => formatCount(r.apo_seated),
    formatEvent: (r) => formatCount(r.apo_seated),
    group: "アポ",
  },
  {
    label: "アポ着座率",
    formatChannel: (r) => formatRate(r.apo_seated_rate),
    formatEvent: (r) => formatRate(r.apo_seated_rate),
    group: "アポ",
  },
  {
    label: "無効アポ数",
    formatChannel: (r) => formatCount(r.invalid_apo),
    formatEvent: (r) => formatCount(r.invalid_apo),
    group: "状態",
  },
  {
    label: "ブリッジ数",
    formatChannel: (r) => formatCount(r.bridge_count),
    formatEvent: (r) => formatCount(r.bridge_count),
    group: "状態",
  },
  {
    label: "残ブリッジ数",
    formatChannel: (r) => formatCount(r.remaining_bridge),
    formatEvent: (r) => formatCount(r.remaining_bridge),
    group: "状態",
  },
  {
    label: "決着数",
    formatChannel: (r) => formatCount(r.settled_count),
    formatEvent: (r) => formatCount(r.settled_count),
    group: "決着・成約",
  },
  {
    label: "成約件数",
    formatChannel: (r) => formatCount(r.contract_count),
    formatEvent: (r) => formatCount(r.contract_count),
    group: "決着・成約",
  },
  {
    label: "決着成約率",
    formatChannel: (r) => formatRate(r.settlement_rate),
    formatEvent: (r) => formatRate(r.settlement_rate),
    group: "決着・成約",
  },
  {
    label: "計上売上見込",
    formatChannel: (r) => `¥${formatYen(r.keijo_sales_forecast)}`,
    formatEvent: (r) => `¥${formatYen(r.keijo_sales_forecast)}`,
    group: "売上見込",
  },
  {
    label: "入金売上見込",
    formatChannel: (r) => `¥${formatYen(r.payment_sales_forecast)}`,
    formatEvent: (r) => `¥${formatYen(r.payment_sales_forecast)}`,
    group: "売上見込",
  },
  {
    label: "クーリングオフ件数",
    formatChannel: (r) => formatCount(r.cooling_off_count),
    formatEvent: (r) => formatCount(r.cooling_off_count),
    group: "クーリングオフ",
  },
  {
    label: "クーリングオフ込み成約件数",
    formatChannel: (r) => formatCount(r.contract_with_cooling_off),
    formatEvent: (r) => formatCount(r.contract_with_cooling_off),
    group: "クーリングオフ",
  },
  {
    label: "クーリングオフ率",
    formatChannel: (r) => formatRate(r.cooling_off_rate),
    formatEvent: (r) => formatRate(r.cooling_off_rate),
    group: "クーリングオフ",
  },
];

interface GroupSpan {
  label: string;
  span: number;
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
    spans.push({ label: group, span });
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

// Primary labels (indices in COLUMNS) shown at top of card
const PRIMARY_LABELS = ["計上売上", "成約件数", "アポ予定数"];

function ChannelDataRow({
  row,
  isExpanded,
  onToggle,
  isTotal,
}: {
  row: ChannelSummaryRow;
  isExpanded: boolean;
  onToggle: () => void;
  isTotal?: boolean;
}) {
  const baseClass = isTotal
    ? "bg-slate-100 font-semibold border-t-2 border-slate-400"
    : "bg-white hover:bg-slate-50";

  return (
    <tr className={`${baseClass} border-b border-slate-200`}>
      <td
        className={`sticky left-0 z-10 px-3 py-2 text-sm whitespace-nowrap border-r border-slate-300 ${isTotal ? "bg-slate-100 font-bold" : "bg-white"}`}
      >
        {!isTotal && row.subRows.length > 0 ? (
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 text-left hover:text-slate-600 transition-colors"
            aria-expanded={isExpanded}
          >
            <span
              className="inline-block w-4 h-4 text-center text-xs font-bold text-slate-500 select-none"
              aria-hidden="true"
            >
              {isExpanded ? "▼" : "▶"}
            </span>
            <span>{row.channel}</span>
          </button>
        ) : (
          <span className={`${!isTotal && row.subRows.length === 0 ? "pl-5" : ""}`}>
            {isTotal ? row.channel : row.channel}
          </span>
        )}
      </td>
      {COLUMNS.map((col, i) => (
        <td
          key={i}
          className={`px-3 py-2 text-sm text-right whitespace-nowrap tabular-nums border-r border-slate-100 ${isTotal ? "bg-slate-100" : ""}`}
        >
          {col.formatChannel(row)}
        </td>
      ))}
    </tr>
  );
}

function ChannelRowGroup({
  row,
  isExpanded,
  onToggle,
}: {
  row: ChannelSummaryRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <ChannelDataRow row={row} isExpanded={isExpanded} onToggle={onToggle} />
      {isExpanded &&
        row.subRows.map((subRow) => (
          <EventSubRow key={`${row.channel}-${subRow.eventName}`} row={subRow} />
        ))}
    </>
  );
}

function EventSubRow({ row }: { row: EventSummaryRow }) {
  return (
    <tr className="bg-slate-50 border-b border-slate-100 hover:bg-slate-100">
      <td className="sticky left-0 z-10 bg-slate-50 px-3 py-1.5 text-xs whitespace-nowrap border-r border-slate-200 hover:bg-slate-100">
        <span className="pl-7 text-slate-600">{row.eventName}</span>
      </td>
      {COLUMNS.map((col, i) => (
        <td
          key={i}
          className="px-3 py-1.5 text-xs text-right whitespace-nowrap tabular-nums border-r border-slate-100 text-slate-600"
        >
          {col.formatEvent(row)}
        </td>
      ))}
    </tr>
  );
}

// Mobile card for channel
function ChannelCard({
  row,
  isTotal,
}: {
  row: ChannelSummaryRow;
  isTotal?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubExpanded, setIsSubExpanded] = useState(false);

  const primaryCols = COLUMNS.filter((col) => PRIMARY_LABELS.includes(col.label));
  const detailCols = COLUMNS.filter((col) => !PRIMARY_LABELS.includes(col.label));

  const cardClass = isTotal
    ? "rounded-lg border border-slate-400 bg-slate-100 shadow-sm"
    : "rounded-lg border border-slate-200 bg-white shadow-sm";

  return (
    <div className={cardClass}>
      {/* Header */}
      <div className={`px-4 py-3 rounded-t-lg ${isTotal ? "bg-slate-200" : "bg-slate-700"}`}>
        <span className={`font-bold text-base ${isTotal ? "text-slate-800" : "text-white"}`}>
          {row.channel}
        </span>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        {primaryCols.map((col) => (
          <div key={col.label} className="px-2 py-3 flex flex-col items-center">
            <span className="text-xs text-slate-500 mb-1 text-center">{col.label}</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums text-center">{col.formatChannel(row)}</span>
          </div>
        ))}
      </div>

      {/* Expand detail button */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full px-4 py-2 text-xs text-slate-500 flex items-center justify-center gap-1 hover:bg-slate-50 transition-colors border-b border-slate-100"
        aria-expanded={isExpanded}
      >
        {isExpanded ? "詳細を閉じる ▲" : "詳細を表示 ▼"}
      </button>

      {/* Detail KPIs grouped */}
      {isExpanded && (
        <div className="border-b border-slate-100">
          {GROUP_SPANS.map((g) => {
            const groupCols = detailCols.filter((col) => col.group === g.label);
            if (groupCols.length === 0) return null;
            return (
              <div key={g.label} className="border-b border-slate-100 last:border-0">
                <div className={`px-4 py-1.5 text-xs font-semibold ${GROUP_COLORS[g.label] ?? "bg-slate-100 text-slate-700"}`}>
                  {g.label}
                </div>
                <div className="divide-y divide-slate-50">
                  {groupCols.map((col) => (
                    <div key={col.label} className="flex items-center justify-between px-4 py-2">
                      <span className="text-sm text-slate-600">{col.label}</span>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">{col.formatChannel(row)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-events expand */}
      {!isTotal && row.subRows.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setIsSubExpanded((v) => !v)}
            className="w-full px-4 py-2 text-xs text-slate-500 flex items-center justify-center gap-1 hover:bg-slate-50 transition-colors"
            aria-expanded={isSubExpanded}
          >
            {isSubExpanded ? `イベント一覧を閉じる ▲` : `イベント別内訳を表示 (${row.subRows.length}件) ▼`}
          </button>
          {isSubExpanded && (
            <div className="border-t border-slate-100 divide-y divide-slate-100">
              {row.subRows.map((subRow) => (
                <div key={subRow.eventName} className="px-4 py-2 bg-slate-50">
                  <div className="text-xs font-semibold text-slate-600 mb-1 pl-2 border-l-2 border-slate-400">
                    {subRow.eventName}
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs text-slate-600">
                    <div>売上: {`¥${formatYen(subRow.keijo_keijo_sales)}`}</div>
                    <div>成約: {formatCount(subRow.contract_count)}</div>
                    <div>アポ: {formatCount(subRow.apo_scheduled)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ChannelTable({ rows, total }: ChannelTableProps) {
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  function toggleChannel(channel: string) {
    setExpandedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <ChannelCard key={row.channel} row={row} />
        ))}
        <ChannelCard row={total} isTotal />
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-300 shadow-sm">
        <table className="min-w-max border-collapse text-slate-800">
          <thead>
            <tr className="border-b border-slate-300">
              <th
                className="sticky left-0 z-20 bg-slate-800 text-white px-3 py-2 text-sm font-semibold whitespace-nowrap border-r border-slate-600"
                rowSpan={2}
              >
                導線種別
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
            <tr className="border-b-2 border-slate-400">
              {COLUMNS.map((col, i) => (
                <th
                  key={i}
                  className={`px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap text-right border-r border-slate-200 ${COL_HEADER_COLORS[col.group] ?? "bg-slate-50"}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isExpanded = expandedChannels.has(row.channel);
              return (
                <ChannelRowGroup
                  key={row.channel}
                  row={row}
                  isExpanded={isExpanded}
                  onToggle={() => toggleChannel(row.channel)}
                />
              );
            })}
            <ChannelDataRow
              row={total}
              isExpanded={false}
              onToggle={() => {}}
              isTotal
            />
          </tbody>
        </table>
      </div>
    </>
  );
}
