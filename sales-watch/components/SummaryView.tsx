"use client";

import { useState } from "react";
import { SalesSummary, formatYen, formatRate, formatCount } from "@/lib/summaryUtils";

interface SummaryViewProps {
  summary: SalesSummary;
  ym: string;
}

interface KpiRow {
  label: string;
  value: string;
  subLabel?: string;
}

interface KpiSection {
  title: string;
  rows: KpiRow[];
  accent?: "blue" | "green" | "purple" | "orange" | "red" | "slate";
}

function buildSections(s: SalesSummary): KpiSection[] {
  return [
    {
      title: "売上（計上日基準）",
      accent: "blue",
      rows: [
        { label: "計上売上", value: `¥${formatYen(s.keijo_keijo_sales)}` },
        { label: "入金済売上", value: `¥${formatYen(s.keijo_paid_sales)}` },
        { label: "未入金売上", value: `¥${formatYen(s.keijo_unpaid_sales)}` },
      ],
    },
    {
      title: "売上（アポ日基準）",
      accent: "purple",
      rows: [
        { label: "計上売上", value: `¥${formatYen(s.apo_keijo_sales)}` },
        { label: "入金済売上", value: `¥${formatYen(s.apo_paid_sales)}` },
        { label: "未入金売上", value: `¥${formatYen(s.apo_unpaid_sales)}` },
      ],
    },
    {
      title: "入金",
      accent: "green",
      rows: [
        { label: "入金率", value: formatRate(s.payment_rate) },
      ],
    },
    {
      title: "アポ",
      accent: "orange",
      rows: [
        { label: "アポ予定数", value: formatCount(s.apo_scheduled) },
        { label: "アポ消化件数", value: formatCount(s.apo_processed) },
        { label: "アポ着座件数", value: formatCount(s.apo_seated) },
        { label: "アポ着座率", value: formatRate(s.apo_seated_rate) },
      ],
    },
    {
      title: "状態",
      accent: "slate",
      rows: [
        { label: "無効アポ数", value: formatCount(s.invalid_apo) },
        { label: "ブリッジ数", value: formatCount(s.bridge_count) },
        { label: "残ブリッジ数", value: formatCount(s.remaining_bridge) },
      ],
    },
    {
      title: "決着・成約",
      accent: "red",
      rows: [
        { label: "決着数", value: formatCount(s.settled_count) },
        { label: "成約件数", value: formatCount(s.contract_count) },
        { label: "決着成約率", value: formatRate(s.settlement_rate) },
      ],
    },
    {
      title: "売上見込",
      accent: "blue",
      rows: [
        { label: "計上売上見込", value: `¥${formatYen(s.keijo_sales_forecast)}` },
        { label: "入金売上見込", value: `¥${formatYen(s.payment_sales_forecast)}` },
      ],
    },
    {
      title: "クーリングオフ",
      accent: "red",
      rows: [
        { label: "クーリングオフ件数", value: formatCount(s.cooling_off_count) },
        { label: "クーリングオフ込み成約件数", value: formatCount(s.contract_with_cooling_off) },
        { label: "クーリングオフ率", value: formatRate(s.cooling_off_rate) },
      ],
    },
  ];
}

const ACCENT_STYLES: Record<string, { header: string; border: string }> = {
  blue: {
    header: "bg-blue-50 text-blue-800 border-blue-200",
    border: "border-blue-200",
  },
  purple: {
    header: "bg-purple-50 text-purple-800 border-purple-200",
    border: "border-purple-200",
  },
  green: {
    header: "bg-green-50 text-green-800 border-green-200",
    border: "border-green-200",
  },
  orange: {
    header: "bg-orange-50 text-orange-800 border-orange-200",
    border: "border-orange-200",
  },
  red: {
    header: "bg-red-50 text-red-800 border-red-200",
    border: "border-red-200",
  },
  slate: {
    header: "bg-slate-100 text-slate-700 border-slate-200",
    border: "border-slate-200",
  },
};

function KpiCard({ section }: { section: KpiSection }) {
  const [isOpen, setIsOpen] = useState(true);
  const accent = section.accent ?? "slate";
  const styles = ACCENT_STYLES[accent];

  return (
    <div className={`rounded-lg border overflow-hidden shadow-sm ${styles.border}`}>
      {/* Header - clickable on mobile for collapse */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 font-semibold text-sm md:cursor-default ${styles.header}`}
        aria-expanded={isOpen}
      >
        <span>{section.title}</span>
        <span
          className="text-xs ml-2 select-none md:hidden"
          aria-hidden="true"
        >
          {isOpen ? "▲" : "▼"}
        </span>
      </button>
      {/* Rows - collapsible on mobile */}
      <div className={`divide-y divide-gray-100 bg-white ${isOpen ? "block" : "hidden md:block"}`}>
        {section.rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-600 pr-4">{row.label}</span>
            <span className="text-base font-semibold text-slate-900 tabular-nums text-right">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SummaryView({ summary, ym }: SummaryViewProps) {
  const sections = buildSections(summary);

  const ymLabel = ym
    ? `${ym.slice(0, 4)}年${ym.slice(5, 7)}月`
    : "全期間";

  return (
    <div>
      <p className="text-sm text-slate-500 mb-6">
        集計期間: <span className="font-medium text-slate-700">{ymLabel}</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sections.map((section) => (
          <KpiCard key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}
