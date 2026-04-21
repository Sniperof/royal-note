import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

type Filters = {
  q: string;
  brand: string[];
  main_category: string;
  gender: string;
  size: string[];
  concentration: string[];
};

const inputClass =
  "w-full rounded-md border-[1.5px] border-[#EEEEEE] bg-[#FAF9F5] px-3 py-2.5 text-[13px] text-[#141413] placeholder:text-[#949494] outline-none transition focus:border-[#141413] focus:bg-white";

function MultiSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => {
    if (value.length === 0) return label;
    if (value.length === 1) return value[0];
    return `${value.length} selected`;
  }, [label, value]);

  function toggleOption(option: string) {
    onChange(
      value.includes(option)
        ? value.filter((entry) => entry !== option)
        : [...value, option],
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`${inputClass} flex items-center justify-between gap-3 text-left`}
      >
        <span className={value.length === 0 ? "text-[#949494]" : "text-[#141413]"}>{summary}</span>
        <ChevronDown className={`h-4 w-4 text-[#949494] transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-[14px] border border-[#EEEEEE] bg-white p-2 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <div className="max-h-56 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-[#949494]">No options available</div>
            ) : (
              options.map((option) => {
                const checked = value.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleOption(option)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] text-[#141413] transition hover:bg-[#FAF9F5]"
                  >
                    <span>{option}</span>
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        checked ? "border-[#141413] bg-[#141413] text-white" : "border-[#DADADA] bg-white text-transparent"
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PublicCatalogFilters({
  filters,
  onChange,
  filterOptions,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  filterOptions: {
    brands: string[];
    sizes: string[];
    concentrations: string[];
  };
}) {
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="rounded-[14px] border border-[#EEEEEE] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]">
      <p className="rn-label mb-3">Filter Catalogue</p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative block xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#949494]" />
          <input
            value={filters.q}
            onChange={(event) => update("q", event.target.value)}
            placeholder="Search brand, product, or description"
            className={`${inputClass} pl-10`}
          />
        </label>

        <MultiSelect
          label="Brand"
          value={filters.brand}
          options={filterOptions.brands}
          onChange={(next) => update("brand", next)}
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
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

        <MultiSelect
          label="Size"
          value={filters.size}
          options={filterOptions.sizes}
          onChange={(next) => update("size", next)}
        />

        <MultiSelect
          label="Concentration"
          value={filters.concentration}
          options={filterOptions.concentrations}
          onChange={(next) => update("concentration", next)}
        />

        <button
          type="button"
          onClick={() =>
            onChange({
              q: "",
              brand: [],
              main_category: "",
              gender: "",
              size: [],
              concentration: [],
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
