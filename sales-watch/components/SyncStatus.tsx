"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { revalidateAllData } from "@/app/actions/revalidate";

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

type Props = {
  /** ISO string of last successful data fetch, or null if not yet fetched */
  fetchedAt: string | null;
  /** When true, hide the timestamp text and show only the refresh button */
  compact?: boolean;
};

function formatFetchedAt(iso: string | null): string {
  if (!iso) return "未取得";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

export default function SyncStatus({ fetchedAt, compact = false }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      startTransition(async () => {
        await revalidateAllData();
        router.refresh();
      });
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [router]);

  function handleManualRefresh() {
    startTransition(async () => {
      await revalidateAllData();
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {!compact && (
        isPending ? (
          <span className="text-xs text-slate-300 flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-white"
              aria-hidden="true"
            />
            読み込み中...
          </span>
        ) : (
          <span className="text-xs text-slate-400 whitespace-nowrap">
            最終更新: {formatFetchedAt(fetchedAt)}
          </span>
        )
      )}
      <button
        onClick={handleManualRefresh}
        disabled={isPending}
        title={compact ? `最終更新: ${formatFetchedAt(fetchedAt)}` : "データを再取得"}
        aria-label="データを再取得"
        className="flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`}
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
      </button>
    </div>
  );
}
