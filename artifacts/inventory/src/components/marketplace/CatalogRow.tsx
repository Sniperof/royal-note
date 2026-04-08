import { Heart, Package, ShoppingCart } from "lucide-react";
import type { CatalogItem } from "./catalogTypes";
import { categoryLabel, genderLabel, resolveLocation } from "./catalogUtils";
import { GRID } from "./QuickOrderTable";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function GenderBadge({ gender }: { gender: string | null }) {
  const label = genderLabel(gender);
  if (!label) return <span className="text-xs text-slate-400">—</span>;
  const tone =
    label === "Men"
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : label === "Women"
      ? "bg-pink-50 text-pink-700 border-pink-200"
      : "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-block rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function AvailabilityBadge({ item }: { item: CatalogItem }) {
  const loc = resolveLocation(item);
  const mode = item.availability_mode;
  const qty = item.qty ?? 0;

  // If we have a known location, show it
  if (loc) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap text-slate-600">
        {loc}
      </span>
    );
  }

  // Fallback: status-based label
  let label: string;
  let cls: string;

  if (mode === "incoming") {
    label = "Incoming";
    cls = "bg-violet-50 text-violet-700 border-violet-200";
  } else if (mode === "source_only" || (mode === "stock_and_source" && qty === 0)) {
    label = "Available";
    cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (qty === 0) {
    label = "Out of Stock";
    cls = "bg-red-50 text-red-700 border-red-200";
  } else if (qty === 1) {
    label = "Last Item";
    cls = "bg-orange-50 text-orange-700 border-orange-200";
  } else if (qty <= 10) {
    label = "Running Low";
    cls = "bg-amber-50 text-amber-700 border-amber-200";
  } else {
    label = "Available";
    cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

export default function CatalogRow({
  item,
  selected,
  favorite,
  onSelect,
  onFavorite,
}: {
  item: CatalogItem;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onFavorite: () => void;
}) {
  const hasDiscount = Number(item.discount_percent ?? 0) > 0;
  const nameLine = [item.name, item.size, item.concentration].filter(Boolean).join(" · ");

  return (
    <div
      className={`border-b border-slate-100 transition last:border-b-0 ${
        selected ? "bg-emerald-50/50" : "bg-white hover:bg-slate-50/60"
      }`}
    >
      {/* ── Desktop row ── */}
      <div className={`hidden lg:grid ${GRID} lg:items-center lg:gap-4 lg:px-5 lg:py-3`}>

        {/* Checkbox */}
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-slate-900"
          />
        </div>

        {/* Photo */}
        <div className="flex justify-center">
          {item.thumbnail_path ? (
            <img
              src={`${BASE_URL}/api/storage${item.thumbnail_path}`}
              alt={item.name}
              className="h-11 w-11 rounded-xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-slate-50">
              <Package className="h-4 w-4 text-slate-300" />
            </div>
          )}
        </div>

        {/* Brand */}
        <p className="truncate text-xs font-bold text-slate-800">{item.brand}</p>

        {/* Category - Sub-category */}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-700">{categoryLabel(item.main_category)}</p>
          {item.sub_category && (
            <p className="truncate text-[11px] text-slate-400 mt-0.5">{item.sub_category}</p>
          )}
        </div>

        {/* Name · Size · Concentration */}
        <p className="truncate text-sm text-slate-700">{nameLine}</p>

        {/* Gender */}
        <GenderBadge gender={item.gender} />

        {/* Availability + Discount */}
        <div className="flex flex-wrap items-center gap-1.5">
          <AvailabilityBadge item={item} />
          {hasDiscount && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 whitespace-nowrap">
              {Number(item.discount_percent)}% Off
            </span>
          )}
        </div>

        {/* Actions: Favourite + Cart icon */}
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onFavorite}
            aria-pressed={favorite}
            className={`grid h-8 w-8 place-items-center rounded-full transition ${
              favorite ? "text-rose-500" : "text-slate-300 hover:text-rose-400"
            }`}
          >
            <Heart className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={`grid h-8 w-8 place-items-center rounded-full transition ${
              selected
                ? "bg-slate-950 text-white hover:bg-slate-700"
                : "border border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:bg-slate-50"
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Mobile row ── */}
      <div className="flex items-center gap-3 px-4 py-3 lg:hidden">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="h-4 w-4 flex-shrink-0 cursor-pointer rounded border-slate-300 accent-slate-900"
        />

        {item.thumbnail_path ? (
          <img
            src={`${BASE_URL}/api/storage${item.thumbnail_path}`}
            alt={item.name}
            className="h-12 w-12 flex-shrink-0 rounded-xl border border-slate-200 object-cover"
          />
        ) : (
          <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50">
            <Package className="h-4 w-4 text-slate-300" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-slate-500">{item.brand}</p>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-900">{nameLine}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <AvailabilityBadge item={item} />
            {hasDiscount && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                {Number(item.discount_percent)}% Off
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onFavorite}
            className={`grid h-8 w-8 place-items-center rounded-full transition ${
              favorite ? "text-rose-500" : "text-slate-300 hover:text-rose-400"
            }`}
          >
            <Heart className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onSelect}
            className={`grid h-8 w-8 place-items-center rounded-full transition ${
              selected ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-500"
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
