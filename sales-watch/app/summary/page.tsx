import { Suspense } from "react";
import { getCachedApoData, getCachedContractData, getCachedPreData } from "@/lib/dataCache";
import { buildYearMonthOptions } from "@/lib/filterUtils";
import { computeSummary } from "@/lib/summaryUtils";
import SummaryView from "@/components/SummaryView";
import YearMonthFilter from "@/components/YearMonthFilter";
import KpiHighlightCards from "@/components/KpiHighlightCards";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ ym?: string }>;
}

export default async function SummaryPage({ searchParams }: PageProps) {
  const currentYm = new Date().toISOString().slice(0, 7);
  const { ym = currentYm } = await searchParams;

  let errorMessage: string | null = null;
  let apoRows: import("@/lib/sheets").ApoRow[] = [];
  let contractRows: import("@/lib/sheets").ContractRow[] = [];
  let preRows: import("@/lib/sheets").PreRow[] = [];

  try {
    const [apo, contracts, pre] = await Promise.all([
      getCachedApoData(),
      getCachedContractData(),
      getCachedPreData(),
    ]);
    apoRows = apo;
    contractRows = contracts;
    preRows = pre;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "データの取得に失敗しました";
  }

  // Build year-month options from both date columns (apo date and contract date)
  const allDates = [
    ...apoRows.map((r) => r.アポ予定日),
    ...contractRows.map((r) => r.契約日),
    ...contractRows.map((r) => r.アポ日),
  ];
  const ymOptions = buildYearMonthOptions(allDates);

  const summary = computeSummary(apoRows, contractRows, ym, preRows);

  return (
    <main className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-slate-800">月別サマリー</h1>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Suspense>
            <YearMonthFilter options={ymOptions} currentValue={ym} />
          </Suspense>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <strong>エラー:</strong> {errorMessage}
        </div>
      )}

      {/* KPI highlight cards at top of summary view */}
      <div className="mb-6">
        <KpiHighlightCards summary={summary} variant="summary" />
      </div>

      <SummaryView summary={summary} ym={ym} />
    </main>
  );
}
