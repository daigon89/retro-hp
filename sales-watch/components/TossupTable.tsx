"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { TossupRow } from "@/lib/sheets";

type SortDir = "asc" | "desc" | null;

interface SortState {
  key: keyof TossupRow | null;
  dir: SortDir;
}

const COLUMNS: { key: keyof TossupRow; label: string }[] = [
  { key: "トスアップNo", label: "トスアップNo" },
  { key: "アポNo", label: "アポNo" },
  { key: "導線種別", label: "導線種別" },
  { key: "イベント名", label: "イベント名" },
  { key: "アポ予定日", label: "アポ予定日" },
  { key: "アポ予定時間", label: "アポ予定時間" },
  { key: "姓", label: "姓" },
  { key: "名", label: "名" },
  { key: "メールアドレス", label: "メールアドレス" },
  { key: "営業担当者", label: "営業担当者" },
  { key: "トスアップステータス", label: "トスアップステータス" },
  { key: "成約要因", label: "成約要因" },
  { key: "失注要因", label: "失注要因" },
  { key: "無効アポ理由", label: "無効アポ理由" },
  { key: "レコーディング", label: "レコーディング" },
];

// トスアップステータスの色分け
const TOSSUP_STATUS_COLORS: Record<string, string> = {
  成約: "bg-green-100 text-green-800",
  失注: "bg-red-100 text-red-800",
  ブリッジ: "bg-yellow-100 text-yellow-800",
  アポ飛び: "bg-orange-100 text-orange-800",
  事前キャンセル: "bg-pink-100 text-pink-800",
  未対応: "bg-slate-100 text-slate-700",
  無効: "bg-gray-100 text-gray-600",
  トスアップ済: "bg-blue-100 text-blue-800",
};

function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="text-gray-400">-</span>;
  const colorClass = TOSSUP_STATUS_COLORS[status] ?? "bg-purple-100 text-purple-800";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorClass}`}
    >
      {status}
    </span>
  );
}

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === "asc") return <span aria-hidden="true" className="ml-1 text-blue-600">▲</span>;
  if (dir === "desc") return <span aria-hidden="true" className="ml-1 text-blue-600">▼</span>;
  return <span aria-hidden="true" className="ml-1 text-gray-300">⇅</span>;
}

function sortRows(rows: TossupRow[], key: keyof TossupRow | null, dir: SortDir): TossupRow[] {
  if (!key || !dir) return rows;
  return [...rows].sort((a, b) => {
    const av = a[key] ?? "";
    const bv = b[key] ?? "";
    const cmp = av.localeCompare(bv, "ja", { numeric: true, sensitivity: "base" });
    return dir === "asc" ? cmp : -cmp;
  });
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delay]);
  return debounced;
}

function filterRows(rows: TossupRow[], query: string): TossupRow[] {
  if (!query.trim()) return rows;
  const q = query.toLowerCase();
  return rows.filter((row) =>
    COLUMNS.some((col) => {
      const val = row[col.key];
      return val ? val.toLowerCase().includes(q) : false;
    })
  );
}

interface TossupTableProps {
  rows: TossupRow[];
}

export default function TossupTable({ rows }: TossupTableProps) {
  const [sort, setSort] = useState<SortState>({ key: null, dir: null });
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  function handleHeaderClick(key: keyof TossupRow) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      if (prev.dir === "desc") return { key: null, dir: null };
      return { key, dir: "asc" };
    });
  }

  const filtered = useMemo(() => filterRows(rows, debouncedSearch), [rows, debouncedSearch]);
  const sorted = useMemo(() => sortRows(filtered, sort.key, sort.dir), [filtered, sort]);

  return (
    <div>
      {/* 検索ボックス */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1 md:max-w-sm">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="検索..."
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 pr-8 text-sm shadow-sm placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
              aria-label="検索をクリア"
            >
              ×
            </button>
          )}
        </div>
        <span className="text-xs text-slate-500">
          {debouncedSearch
            ? `${sorted.length} 件 / ${rows.length} 件`
            : `${rows.length} 件`}
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-center text-gray-500 py-12">
          {rows.length === 0 ? "データがありません" : "検索結果がありません"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-max w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {COLUMNS.map((col) => {
                  const isActive = sort.key === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleHeaderClick(col.key)}
                      className="px-3 py-2.5 font-semibold whitespace-nowrap border-b border-gray-200 cursor-pointer select-none hover:bg-slate-200 transition-colors"
                      aria-sort={
                        isActive && sort.dir === "asc"
                          ? "ascending"
                          : isActive && sort.dir === "desc"
                          ? "descending"
                          : "none"
                      }
                    >
                      <span className="flex items-center">
                        {col.label}
                        <SortIcon dir={isActive ? sort.dir : null} />
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                      {col.key === "トスアップステータス" ? (
                        <StatusBadge status={row[col.key]} />
                      ) : (
                        <span>{row[col.key] || "-"}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
