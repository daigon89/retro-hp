import Link from "next/link";
import { getCachedApoData, getCachedContractData } from "@/lib/dataCache";
import { computeSummary } from "@/lib/summaryUtils";
import KpiHighlightCards from "@/components/KpiHighlightCards";

export const dynamic = "force-dynamic";

const QUICK_LINKS = [
  { href: "/apo", label: "アポ一覧", description: "アポ予定・結果を確認" },
  { href: "/tossup", label: "トスアップ一覧", description: "トスアップ状況を確認" },
  { href: "/pre", label: "プレ一覧", description: "プレ情報を確認" },
  { href: "/contract", label: "成約一覧", description: "成約データを確認" },
  { href: "/summary", label: "月別サマリー", description: "月別KPIをまとめて確認" },
  { href: "/staff", label: "担当者別ビュー", description: "担当者ごとの実績" },
  { href: "/event", label: "イベント別ビュー", description: "イベントごとの実績" },
  { href: "/channel", label: "導線別ビュー", description: "導線ごとの実績" },
  { href: "/cross", label: "クロス集計", description: "多軸での集計分析" },
];

export default async function HomePage() {
  const currentYm = new Date().toISOString().slice(0, 7);

  let apoRows: import("@/lib/sheets").ApoRow[] = [];
  let contractRows: import("@/lib/sheets").ContractRow[] = [];
  let errorMessage: string | null = null;

  try {
    const [apo, contracts] = await Promise.all([
      getCachedApoData(),
      getCachedContractData(),
    ]);
    apoRows = apo;
    contractRows = contracts;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "データの取得に失敗しました";
  }

  const summary = computeSummary(apoRows, contractRows, currentYm);

  const ymLabel = `${currentYm.slice(0, 4)}年${currentYm.slice(5, 7)}月`;

  return (
    <main className="max-w-screen-2xl mx-auto px-4 py-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800">ダッシュボード</h1>
        <p className="text-sm text-slate-500 mt-1">
          {ymLabel}の主要KPI
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <strong>エラー:</strong> {errorMessage}
        </div>
      )}

      {/* KPI highlight cards */}
      <section className="mb-10">
        <KpiHighlightCards summary={summary} />
      </section>

      {/* Quick links grid */}
      <section>
        <h2 className="text-base font-semibold text-slate-700 mb-3">各ビューへ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-400 hover:shadow-md transition-all"
            >
              <span className="text-base font-semibold text-slate-800 group-hover:text-slate-900">
                {link.label}
              </span>
              <span className="text-sm text-slate-500 mt-1 leading-snug">
                {link.description}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
