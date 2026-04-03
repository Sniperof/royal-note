import { Search, X } from "lucide-react";
import type { BrandCard } from "./catalogTypes";

export default function CatalogBrandStrip({
  brandCards,
  brandFilter,
  brandSearch,
  onBrandFilterChange,
  onBrandSearchChange,
  onBrandSearchClear,
}: {
  brandCards: BrandCard[];
  brandFilter: string;
  brandSearch: string;
  onBrandFilterChange: (value: string) => void;
  onBrandSearchChange: (value: string) => void;
  onBrandSearchClear: () => void;
}) {
  if (brandCards.length === 0) return null;

  return (
    <div className="border-b border-slate-200 px-6 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex min-w-max items-center gap-3">
            <button
              onClick={() => onBrandFilterChange("all")}
              className={`rounded-2xl border px-4 py-2.5 transition ${
                brandFilter === "all"
                  ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <span className={`font-headline text-[11px] font-bold uppercase tracking-[0.18em] ${brandFilter === "all" ? "text-white" : "text-slate-700"}`}>
                All Brands
              </span>
            </button>

            {brandCards.map((brand) => {
              const active = brandFilter.toLowerCase() === brand.name.toLowerCase();
              return (
                <button
                  key={brand.id}
                  onClick={() => onBrandFilterChange(active ? "all" : brand.name)}
                  className={`rounded-2xl border px-4 py-2.5 transition ${
                    active
                      ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <span className={`font-headline text-[11px] font-bold uppercase tracking-[0.18em] ${active ? "text-white" : "text-slate-700"}`}>
                    {brand.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={brandSearch}
            onChange={(event) => onBrandSearchChange(event.target.value)}
            placeholder="Search brands..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-500 outline-none transition focus:border-slate-400"
          />
          {brandSearch ? (
            <button
              onClick={onBrandSearchClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
