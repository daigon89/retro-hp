import { Suspense } from "react";
import { getCachedTossupData } from "@/lib/dataCache";
import { TossupRow } from "@/lib/sheets";
import TossupTable from "@/components/TossupTable";
import YearMonthFilter from "@/components/YearMonthFilter";
import { buildYearMonthOptions, filterByYearMonth } from "@/lib/filterUtils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ ym?: string }>;
}

export default async function TossupPage({ searchParams }: PageProps) {
  const currentYm = new Date().toISOString().slice(0, 7);
  const { ym = currentYm } = await searchParams;

  let rows: TossupRow[];
  let errorMessage: string | null = null;

  try {
    rows = await getCachedTossupData();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "データの取得に失敗しました";
    rows = [];
  }

  const ymOptions = buildYearMonthOptions(rows.map((r) => r.アポ予定日));
  const filtered = filterByYearMonth(rows, ym, (r) => r.アポ予定日);

  return (
    <main className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-slate-800">トスアップ一覧</h1>
        <div className="flex items-center gap-4">
          <Suspense>
            <YearMonthFilter options={ymOptions} currentValue={ym} />
          </Suspense>
          <span className="text-xs text-slate-400">
            {filtered.length} 件{ym && rows.length !== filtered.length ? ` / 全 ${rows.length} 件` : ""}
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <strong>エラー:</strong> {errorMessage}
        </div>
      )}

      <TossupTable rows={filtered} />
    </main>
  );
}
