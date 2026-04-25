"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface YearMonthOption {
  value: string; // "YYYY-MM" or ""
  label: string;
}

interface YearMonthFilterProps {
  options: YearMonthOption[];
  currentValue: string;
}

export default function YearMonthFilter({ options, currentValue }: YearMonthFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      if (e.target.value) {
        params.set("ym", e.target.value);
      } else {
        params.delete("ym");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex items-center gap-2 w-full md:w-auto">
      <label htmlFor="ym-filter" className="text-sm font-medium text-slate-600 whitespace-nowrap">
        年月:
      </label>
      <select
        id="ym-filter"
        value={currentValue}
        onChange={handleChange}
        className="flex-1 md:flex-none text-sm border border-gray-300 rounded-md px-3 py-2 md:py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        <option value="">すべて</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
