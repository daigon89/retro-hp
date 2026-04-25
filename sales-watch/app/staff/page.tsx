import { Suspense } from "react";
import { getCachedApoData, getCachedContractData, getCachedPreData, getCachedStaffData } from "@/lib/dataCache";
import { buildYearMonthOptions } from "@/lib/filterUtils";
import { computeStaffSummaries } from "@/lib/summaryUtils";
import StaffTable from "@/components/StaffTable";
import YearMonthFilter from "@/components/YearMonthFilter";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ ym?: string }>;
}

export default async function StaffPage({ searchParams }: PageProps) {
  const currentYm = new Date().toISOString().slice(0, 7);
  const { ym = currentYm } = await searchParams;

  let errorMessage: string | null = null;
  let apoRows: import("@/lib/sheets").ApoRow[] = [];
  let contractRows: import("@/lib/sheets").ContractRow[] = [];
  let preRows: import("@/lib/sheets").PreRow[] = [];
  let staffRows: import("@/lib/sheets").StaffRow[] = [];

  try {
    const [apo, contracts, pre, staff] = await Promise.all([
      getCachedApoData(),
      getCachedContractData(),
      getCachedPreData(),
      getCachedStaffData(),
    ]);
    apoRows = apo;
    contractRows = contracts;
    preRows = pre;
    staffRows = staff;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "データの取得に失敗しました";
  }

  // Build year-month options from all date columns
  const allDates = [
    ...apoRows.map((r) => r.アポ予定日),
    ...contractRows.map((r) => r.契約日),
    ...contractRows.map((r) => r.アポ日),
  ];
  const ymOptions = buildYearMonthOptions(allDates);

  const { rows, total } = computeStaffSummaries(staffRows, apoRows, contractRows, ym, preRows);

  const ymLabel = ym
    ? `${ym.slice(0, 4)}年${ym.slice(5, 7)}月`
    : "全期間";

  return (
    <main className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-slate-800">担当者別ビュー</h1>
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

      <p className="text-sm text-slate-500 mb-4">
        集計期間: <span className="font-medium text-slate-700">{ymLabel}</span>
        　担当者数: <span className="font-medium text-slate-700">{rows.length}名</span>
      </p>

      <StaffTable rows={rows} total={total} />
    </main>
  );
}
