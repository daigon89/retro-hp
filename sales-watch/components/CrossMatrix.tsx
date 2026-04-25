"use client";

import { useState } from "react";
import { CrossMatrixData, CrossCell } from "@/lib/crossUtils";

interface CrossMatrixProps {
  data: CrossMatrixData;
}

type MetricKey = "contract_count" | "settled_count" | "contract_rate";

const TABS: { key: MetricKey; label: string }[] = [
  { key: "contract_count", label: "成約数" },
  { key: "contract_rate", label: "成約率" },
  { key: "settled_count", label: "決着数" },
];

function formatCell(cell: CrossCell, metric: MetricKey): string {
  if (metric === "contract_count") {
    return cell.contract_count.toLocaleString("ja-JP");
  }
  if (metric === "settled_count") {
    return cell.settled_count.toLocaleString("ja-JP");
  }
  // contract_rate
  if (cell.contract_rate === null) return "-";
  return `${(cell.contract_rate * 100).toFixed(1)}%`;
}

/** Determine cell background for heat-map style coloring on rate */
function rateCellBg(cell: CrossCell, metric: MetricKey): string {
  if (metric !== "contract_rate") return "";
  if (cell.contract_rate === null || cell.settled_count === 0) return "";
  const r = cell.contract_rate;
  if (r >= 0.5) return "bg-green-100";
  if (r >= 0.3) return "bg-yellow-50";
  return "bg-red-50";
}

export default function CrossMatrix({ data }: CrossMatrixProps) {
  const [activeTab, setActiveTab] = useState<MetricKey>("contract_count");

  const { channels, rows, columnTotals, grandTotal } = data;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              activeTab === tab.key
                ? "bg-white border border-b-white border-slate-200 text-slate-900 -mb-px"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-sm">
        <table className="min-w-max border-collapse text-slate-800">
          <thead>
            <tr className="border-b-2 border-slate-400">
              {/* Sticky staff name column header */}
              <th className="sticky left-0 z-20 bg-slate-800 text-white px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-r border-slate-600 min-w-[120px]">
                担当者
              </th>
              {channels.map((ch) => (
                <th
                  key={ch}
                  className="bg-slate-700 text-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-center border-r border-slate-600 min-w-[100px]"
                >
                  {ch}
                </th>
              ))}
              {/* Row total column */}
              <th className="bg-slate-600 text-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-center border-r border-slate-500 min-w-[80px]">
                合計
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.staffName}
                className={`border-b border-slate-200 ${
                  idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                } hover:bg-blue-50 transition-colors`}
              >
                {/* Sticky staff name cell */}
                <td
                  className={`sticky left-0 z-10 px-4 py-2 text-sm font-medium whitespace-nowrap border-r border-slate-300 ${
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                  }`}
                  style={{ minWidth: "120px" }}
                >
                  {row.staffName}
                </td>
                {channels.map((ch) => {
                  const cell = row.cells[ch] ?? {
                    contract_count: 0,
                    settled_count: 0,
                    contract_rate: null,
                  };
                  return (
                    <td
                      key={ch}
                      className={`px-3 py-2 text-sm text-center whitespace-nowrap tabular-nums border-r border-slate-100 ${rateCellBg(cell, activeTab)}`}
                    >
                      {formatCell(cell, activeTab)}
                    </td>
                  );
                })}
                {/* Row total */}
                <td className="px-3 py-2 text-sm text-center whitespace-nowrap tabular-nums border-r border-slate-200 font-semibold bg-slate-50">
                  {formatCell(row.total, activeTab)}
                </td>
              </tr>
            ))}

            {/* Column totals row */}
            <tr className="border-t-2 border-slate-400 bg-slate-100 font-semibold">
              <td className="sticky left-0 z-10 px-4 py-2 text-sm font-bold whitespace-nowrap border-r border-slate-400 bg-slate-100">
                合計
              </td>
              {channels.map((ch) => {
                const cell = columnTotals[ch] ?? {
                  contract_count: 0,
                  settled_count: 0,
                  contract_rate: null,
                };
                return (
                  <td
                    key={ch}
                    className={`px-3 py-2 text-sm text-center whitespace-nowrap tabular-nums border-r border-slate-300 ${rateCellBg(cell, activeTab)}`}
                  >
                    {formatCell(cell, activeTab)}
                  </td>
                );
              })}
              {/* Grand total */}
              <td className="px-3 py-2 text-sm text-center whitespace-nowrap tabular-nums border-r border-slate-300 bg-slate-200">
                {formatCell(grandTotal, activeTab)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend for rate view */}
      {activeTab === "contract_rate" && (
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-200" />
            50%以上
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-yellow-50 border border-yellow-200" />
            30〜50%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-red-50 border border-red-200" />
            30%未満
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-white border border-slate-200" />
            データなし
          </span>
        </div>
      )}
    </div>
  );
}
