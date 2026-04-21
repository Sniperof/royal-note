import { Search } from "lucide-react";

type Filters = {
  q: string;
  brand: string;
  main_category: string;
  sub_category: string;
  gender: string;
};

const inputClass =
  "w-full rounded-md border-[1.5px] border-[#EEEEEE] bg-[#FAF9F5] px-3 py-2.5 text-[13px] text-[#141413] placeholder:text-[#949494] outline-none transition focus:border-[#141413] focus:bg-white";

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
    <div className="rounded-[14px] border border-[#EEEEEE] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]">
      <p className="rn-label mb-3">Filter Catalogue</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="relative block xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#949494]" />
          <input
            value={filters.q}
            onChange={(event) => update("q", event.target.value)}
            placeholder="Search brand, product, or description"
            className={`${inputClass} pl-10`}
          />
        </label>

        <input
          value={filters.brand}
          onChange={(event) => update("brand", event.target.value)}
          placeholder="Brand"
          className={inputClass}
        />

        <select
          value={filters.main_category}
          onChange={(event) => update("main_category", event.target.value)}
          className={inputClass}
        >
          <option value="">All Categories</option>
          <option value="perfume">Perfume</option>
          <option value="makeup">Makeup</option>
          <option value="skin_care">Skin Care</option>
        </select>

        <select
          value={filters.gender}
          onChange={(event) => update("gender", event.target.value)}
          className={inputClass}
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
          className={inputClass}
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
          className="rounded-lg border-[1.5px] border-[#EEEEEE] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#141413] transition hover:border-[#141413]"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
}
