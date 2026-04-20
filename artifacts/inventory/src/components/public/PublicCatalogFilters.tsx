import { Search } from "lucide-react";

type Filters = {
  q: string;
  brand: string;
  main_category: string;
  sub_category: string;
  gender: string;
};

export default function PublicCatalogFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="relative block xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.q}
            onChange={(event) => update("q", event.target.value)}
            placeholder="Search brand, product, or description"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </label>

        <input
          value={filters.brand}
          onChange={(event) => update("brand", event.target.value)}
          placeholder="Brand"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
        />

        <select
          value={filters.main_category}
          onChange={(event) => update("main_category", event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
        >
          <option value="">All Categories</option>
          <option value="perfume">Perfume</option>
          <option value="makeup">Makeup</option>
          <option value="skin_care">Skin Care</option>
        </select>

        <select
          value={filters.gender}
          onChange={(event) => update("gender", event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
        >
          <option value="">All Buyers</option>
          <option value="men">Men</option>
          <option value="women">Women</option>
          <option value="unisex">Unisex</option>
        </select>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <input
          value={filters.sub_category}
          onChange={(event) => update("sub_category", event.target.value)}
          placeholder="Sub-category"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
        />
        <button
          type="button"
          onClick={() =>
            onChange({
              q: "",
              brand: "",
              main_category: "",
              sub_category: "",
              gender: "",
            })
          }
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
}
