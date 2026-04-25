"use client";

import { SalesSummary, formatYen, formatRate, formatCount } from "@/lib/summaryUtils";

interface KpiHighlightCardsProps {
  summary: SalesSummary;
  variant?: "home" | "summary";
}

interface HighlightCard {
  label: string;
  displayValue: string;
  accent: "blue" | "green" | "orange" | "purple";
  description: string;
}

function buildCards(s: SalesSummary, variant: "home" | "summary"): HighlightCard[] {
  const fourthCard: HighlightCard =
    variant === "summary"
      ? {
          label: "アポ着座率",
          displayValue: formatRate(s.apo_seated_rate),
          accent: "purple",
          description: "アポのうち着座した割合",
        }
      : {
          label: "アポ予定数",
          displayValue: `${formatCount(s.apo_scheduled)} 件`,
          accent: "orange",
          description: "今月のアポ予定件数",
        };

  return [
    {
      label: "計上売上",
      displayValue: `¥${formatYen(s.keijo_keijo_sales)}`,
      accent: "blue",
      description: "計上日基準の今月売上",
    },
    {
      label: "成約件数",
      displayValue: `${formatCount(s.contract_count)} 件`,
      accent: "green",
      description: "今月の成約数",
    },
    {
      label: "決着成約率",
      displayValue: formatRate(s.settlement_rate),
      accent: "purple",
      description: "決着したアポの成約率",
    },
    fourthCard,
  ];
}

const ACCENT_STYLES: Record<
  HighlightCard["accent"],
  { card: string; label: string; value: string }
> = {
  blue: {
    card: "bg-blue-50 border-blue-200",
    label: "text-blue-700",
    value: "text-blue-900",
  },
  green: {
    card: "bg-green-50 border-green-200",
    label: "text-green-700",
    value: "text-green-900",
  },
  orange: {
    card: "bg-orange-50 border-orange-200",
    label: "text-orange-700",
    value: "text-orange-900",
  },
  purple: {
    card: "bg-purple-50 border-purple-200",
    label: "text-purple-700",
    value: "text-purple-900",
  },
};

export default function KpiHighlightCards({ summary, variant = "home" }: KpiHighlightCardsProps) {
  const cards = buildCards(summary, variant);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const styles = ACCENT_STYLES[card.accent];
        return (
          <div
            key={card.label}
            className={`rounded-xl border p-4 shadow-sm ${styles.card}`}
          >
            <p className={`text-xs font-semibold uppercase tracking-wide ${styles.label}`}>
              {card.label}
            </p>
            <p className={`text-2xl font-bold tabular-nums mt-2 ${styles.value}`}>
              {card.displayValue}
            </p>
            <p className="text-xs text-slate-500 mt-1">{card.description}</p>
          </div>
        );
      })}
    </div>
  );
}
