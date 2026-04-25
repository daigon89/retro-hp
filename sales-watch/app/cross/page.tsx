import { Suspense } from "react";
import { getCachedApoData, getCachedContractData, getCachedStaffData } from "@/lib/dataCache";
import { buildYearMonthOptions } from "@/lib/filterUtils";
import { computeCrossMatrix } from "@/lib/crossUtils";
import CrossMatrix from "@/components/CrossMatrix";
import YearMonthFilter from "@/components/YearMonthFilter";

export const dynamic = "force-dynamic";

// Canonical channel list — matches the spec
const CHANNELS = [
  "インフルエンサー協業（セミナーなし）",
  "インフルエンサー協業（セミナーあり）",
  "AI×コンテンツ",
  "広告",
  "その他",
];

interface PageProps {
  searchParams: Promise<{ ym?: string }>;
}

export default async function CrossPage({ searchParams }: PageProps) {
  const currentYm = new Date().toISOString().slice(0, 7);
  const { ym = currentYm } = await searchParams;

  let errorMessage: string | null = null;
  let apoRows: import("@/lib/sheets").ApoRow[] = [];
  let staffRows: import("@/lib/sheets").StaffRow[] = [];

  try {
    const [apo, staff] = await Promise.all([
      getCachedApoData(),
      getCachedStaffData(),
    ]);
    apoRows = apo;
    staffRows = staff;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "データの取得に失敗しました";
  }

  // Build year-month options from アポ予定日
  const ymOptions = buildYearMonthOptions(apoRows.map((r) => r.アポ予定日));

  const matrixData = computeCrossMatrix(staffRows, apoRows, ym, CHANNELS);

  const ymLabel = ym
    ? `${ym.slice(0, 4)}年${ym.slice(5, 7)}月`
    : "全期間";

  return (
    <main className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-slate-800">クロス集計ビュー</h1>
        <div className="flex items-center gap-4">
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
        集計期間:{" "}
        <span className="font-medium text-slate-700">{ymLabel}</span>
        　担当者数:{" "}
        <span className="font-medium text-slate-700">
          {matrixData.rows.length}名
        </span>
        　導線種別:{" "}
        <span className="font-medium text-slate-700">
          {matrixData.channels.length}種
        </span>
      </p>

      <CrossMatrix data={matrixData} />
    </main>
  );
}
