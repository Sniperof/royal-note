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

type BrandSummary = {
  brand: string;
  product_count: number;
};

const inputClass =
  "w-full rounded-[10px] border-[1.5px] border-[#EEEEEE] bg-white px-3 py-[13px] text-[13px] text-[#141413] placeholder:text-[#949494] outline-none transition focus:border-[#141413]";

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

function BrandCards({
  value,
  brands,
  onChange,
}: {
  value: string[];
  brands: BrandSummary[];
  onChange: (next: string[]) => void;
}) {
  const totalProducts = brands.reduce((sum, brand) => sum + brand.product_count, 0);

  function toggleBrand(brand: string) {
    onChange(
      value.includes(brand)
        ? value.filter((entry) => entry !== brand)
        : [...value, brand],
    );
  }

  if (brands.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#949494]">
          Brands
        </p>
        {value.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#141413] underline-offset-4 transition hover:underline"
          >
            Clear Brands
          </button>
        ) : null}
      </div>

      <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-2 pt-1">
        <button
          type="button"
          onClick={() => onChange([])}
          className={`flex min-h-[86px] min-w-[150px] flex-col justify-between rounded-[12px] border px-4 py-3 text-left transition ${
            value.length === 0
              ? "border-[#141413] bg-[#141413] text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)]"
              : "border-[#EEEEEE] bg-[#FAF9F5] text-[#141413] hover:border-[#141413] hover:bg-white"
          }`}
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-70">
            {totalProducts} product{totalProducts === 1 ? "" : "s"}
          </span>
          <span className="rn-display text-[20px] font-semibold tracking-[-0.02em]">
            All Brands
          </span>
        </button>

        {brands.map((brand) => {
          const selected = value.includes(brand.brand);
          return (
            <button
              key={brand.brand}
              type="button"
              onClick={() => toggleBrand(brand.brand)}
              className={`flex min-h-[86px] min-w-[170px] flex-col justify-between rounded-[12px] border px-4 py-3 text-left transition ${
                selected
                  ? "border-[#141413] bg-[#141413] text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)]"
                  : "border-[#EEEEEE] bg-[#FAF9F5] text-[#141413] hover:border-[#141413] hover:bg-white"
              }`}
            >
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] opacity-70">
                {brand.product_count} product{brand.product_count === 1 ? "" : "s"}
              </span>
              <span className="rn-display break-words text-[20px] font-semibold leading-[1.05] tracking-[-0.02em]">
                {brand.brand}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PublicCatalogFilters({
  filters,
  onChange,
  filterOptions,
  brandSummaries,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  filterOptions: {
    brands: string[];
    sizes: string[];
    concentrations: string[];
  };
  brandSummaries: BrandSummary[];
}) {
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  const brandCards = useMemo(() => {
    const counts = new Map(brandSummaries.map((brand) => [brand.brand, brand.product_count]));
    const allBrandNames = new Set([
      ...brandSummaries.map((brand) => brand.brand),
      ...filterOptions.brands,
    ]);

    return Array.from(allBrandNames)
      .map((brand) => ({
        brand,
        product_count: counts.get(brand) ?? 0,
      }))
      .sort((a, b) => b.product_count - a.product_count || a.brand.localeCompare(b.brand));
  }, [brandSummaries, filterOptions.brands]);

  return (
    <section
      id="catalogue-filters"
      className="rounded-[14px] border border-[#EEEEEE] bg-white p-3 sm:p-4"
    >
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#949494]">
        Filter Catalogue
      </p>

      <div className="grid gap-3 xl:grid-cols-[1.8fr_0.9fr_0.9fr]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#949494]" />
          <input
            value={filters.q}
            onChange={(event) => update("q", event.target.value)}
            placeholder="Search brand, product, or description"
            className={`${inputClass} pl-10`}
          />
        </label>

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

      <BrandCards
        value={filters.brand}
        brands={brandCards}
        onChange={(next) => update("brand", next)}
      />

      <div className="mt-3 grid gap-3 xl:grid-cols-[0.9fr_0.9fr_auto] xl:justify-end">
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
          className="rounded-[10px] border-[1.5px] border-[#EEEEEE] px-5 py-[13px] text-[11px] font-bold uppercase tracking-[0.12em] text-[#141413] transition hover:border-[#141413] xl:min-w-[160px]"
        >
          Reset Filters
        </button>
      </div>
    </section>
  );
}
