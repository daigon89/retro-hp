"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import SyncStatus from "@/components/SyncStatus";

const NAV_ITEMS = [
  { href: "/", label: "ホーム" },
  { href: "/apo", label: "アポ一覧" },
  { href: "/tossup", label: "トスアップ一覧" },
  { href: "/pre", label: "プレ一覧" },
  { href: "/contract", label: "成約一覧" },
  { href: "/summary", label: "月別サマリー" },
  { href: "/staff", label: "担当者別ビュー" },
  { href: "/event", label: "イベント別ビュー" },
  { href: "/channel", label: "導線別ビュー" },
  { href: "/cross", label: "クロス集計" },
];

type Props = {
  fetchedAt?: string | null;
};

export default function Navigation({ fetchedAt }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLinkClick() {
    setMenuOpen(false);
  }

  return (
    <nav className="bg-slate-800 text-white">
      {/* Main bar */}
      <div className="max-w-screen-2xl mx-auto px-4 flex items-center h-14 gap-4">
        <span className="font-bold text-lg tracking-tight whitespace-nowrap">
          Sales Watch
        </span>

        {/* Desktop nav links (md and above: 768px+) */}
        <div className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-slate-600 text-white"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Desktop right section */}
        <div className="hidden md:flex items-center gap-3 ml-auto shrink-0">
          <SyncStatus fetchedAt={fetchedAt ?? null} />
        </div>

        {/* Mobile right section (below md: 767px and below) */}
        <div className="flex md:hidden items-center gap-2 ml-auto shrink-0">
          <SyncStatus fetchedAt={fetchedAt ?? null} compact />
          {/* Hamburger button */}
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={menuOpen}
            className="flex items-center justify-center w-9 h-9 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            {menuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden bg-slate-800 border-t border-slate-700 px-4 py-3 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className={`block px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-600 text-white"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
