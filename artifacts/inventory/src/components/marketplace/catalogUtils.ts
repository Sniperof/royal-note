import type { CatalogItem } from "./catalogTypes";

const GENDER_MAP: Record<string, string> = {
  men: "Men",
  male: "Men",
  "for men": "Men",
  women: "Women",
  female: "Women",
  "for women": "Women",
  unisex: "Unisex",
};

export function genderLabel(gender: string | null | undefined) {
  if (!gender) return null;
  return GENDER_MAP[gender.toLowerCase()] ?? gender;
}

export function categoryLabel(category: string | null | undefined) {
  if (category === "perfume") return "Perfume";
  if (category === "makeup") return "Makeup";
  if (category === "skin_care") return "Skin Care";
  return category ?? "Other";
}

export function resolveLocation(item: CatalogItem): string {
  if (item.product_type === "price_list_only") {
    const locs = (item.price_list_offers ?? [])
      .map(o => o.availability_location)
      .filter(Boolean) as string[];
    return [...new Set(locs)].join(" · ");
  }
  const locs = (item.available_locations ?? []).filter(Boolean);
  return locs.join(" · ");
}

export function resolveAvailabilityMode(item: CatalogItem) {
  if (item.availability_mode) return item.availability_mode;
  const hasStock = Number(item.qty ?? 0) > 0;
  const hasSources = (item.assigned_source_ids?.length ?? 0) > 0;
  const hasIncoming = Number(item.incoming_qty ?? 0) > 0;
  if (hasStock && hasSources) return "stock_and_source";
  if (hasStock) return "stock_only";
  if (hasSources) return "source_only";
  if (hasIncoming) return "incoming";
  return "unavailable";
}

export function marketNote(item: CatalogItem) {
  const mode = resolveAvailabilityMode(item);
  const locations = (item.available_locations ?? []).map(l => l.toLowerCase());
  const hasDubai = locations.some(l => l.includes("dubai"));
  const hasSyria = locations.some(l => l.includes("syria"));

  if (mode === "stock_only") {
    return {
      eyebrow: "Fast lane",
      summary: hasDubai ? "Ready from Dubai" : "Ready for broker dispatch",
      detail: hasDubai ? "Same-day dispatch when confirmed" : "Quick release from available stock",
      tone: "bg-emerald-50 text-emerald-700 border-emerald-100",
    };
  }

  if (mode === "stock_and_source") {
    return {
      eyebrow: "Flexible supply",
      summary: hasDubai ? "Direct stock plus Dubai sourcing" : "Limited stock with broker follow-up",
      detail: hasDubai ? "Useful for urgent requests and repeat pricing" : "Quoted from stock first, then sourced if needed",
      tone: "bg-amber-50 text-amber-700 border-amber-100",
    };
  }

  if (mode === "incoming") {
    return {
      eyebrow: "Incoming stock",
      summary: "On confirmed order — available to quote",
      detail: "Goods are with the supplier and en route",
      tone: "bg-violet-50 text-violet-700 border-violet-100",
    };
  }

  if (mode === "source_only") {
    if (hasDubai && hasSyria) {
      return {
        eyebrow: "Broker sourcing",
        summary: "Dubai and Syria sourcing",
        detail: "Quoted after source confirmation",
        tone: "bg-sky-50 text-sky-700 border-sky-100",
      };
    }

    if (hasDubai) {
      return {
        eyebrow: "Broker sourcing",
        summary: "Dubai sourcing route",
        detail: "Usually confirmed within 1-3 days",
        tone: "bg-sky-50 text-sky-700 border-sky-100",
      };
    }

    if (hasSyria) {
      return {
        eyebrow: "Broker sourcing",
        summary: "Syria sourcing route",
        detail: "Usually confirmed within 7-15 days",
        tone: "bg-indigo-50 text-indigo-700 border-indigo-100",
      };
    }
  }

  return {
    eyebrow: "Quote first",
    summary: "Availability confirmed after request",
    detail: "Broker checks source before pricing",
    tone: "bg-slate-100 text-slate-600 border-slate-200",
  };
}

export function productMetaLine(item: CatalogItem) {
  return [categoryLabel(item.main_category), item.concentration, item.size, item.sub_category]
    .filter(Boolean)
    .join(" · ");
}
