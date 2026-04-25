import { Suspense } from "react";
import { getCachedApoData } from "@/lib/dataCache";
import ApoTable from "@/components/ApoTable";
import YearMonthFilter from "@/components/YearMonthFilter";
import { buildYearMonthOptions, filterByYearMonth } from "@/lib/filterUtils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ ym?: string }>;
}

export default async function ApoPage({ searchParams }: PageProps) {
  const currentYm = new Date().toISOString().slice(0, 7);
  const { ym = currentYm } = await searchParams;

  let apo: import("@/lib/sheets").ApoRow[] = [];
  let errorMessage: string | null = null;

  try {
    apo = await getCachedApoData();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "データの取得に失敗しました";
  }

  const data = { apo };

  const ymOptions = buildYearMonthOptions(data.apo.map((r) => r.アポ予定日));
  const filtered = filterByYearMonth(data.apo, ym, (r) => r.アポ予定日);

  return (
    <main className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-slate-800">アポ一覧</h1>
        <div className="flex items-center gap-4">
          <Suspense>
            <YearMonthFilter options={ymOptions} currentValue={ym} />
          </Suspense>
          <span className="text-xs text-slate-400">
            {filtered.length} 件{ym && data.apo.length !== filtered.length ? ` / 全 ${data.apo.length} 件` : ""}
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <strong>エラー:</strong> {errorMessage}
        </div>
      )}

      <ApoTable rows={filtered} />
    </main>
  );
}
