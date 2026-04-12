import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, ChevronUp, Heart, LayoutGrid, List, Package, Search, ShoppingCart, X } from "lucide-react";
import QuotationModal, { type QuoteItem } from "@/components/QuotationModal";
import TraderChrome from "@/components/TraderChrome";
import { TraderEmptyState } from "@/components/TraderUI";
import FilterChip from "@/components/marketplace/FilterChip";
import QuickOrderTable from "@/components/marketplace/QuickOrderTable";
import { useAuth } from "@/context/AuthContext";
import { resolveStorageUrl } from "@/lib/storage";
import type {
  BrandCard,
  CatalogItem,
  CategoryFilter,
  GenderFilter,
  SortOption,
  ViewMode,
} from "@/components/marketplace/catalogTypes";
import { categoryLabel, genderLabel, marketNote, productMetaLine } from "@/components/marketplace/catalogUtils";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function WholesaleCatalogPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [brandSearch, setBrandSearch] = useState("");
  const [discountOnly, setDiscountOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [brandAccordionOpen, setBrandAccordionOpen] = useState(true);
  const [brandShowAll, setBrandShowAll] = useState(false);
  const [categoryAccordionOpen, setCategoryAccordionOpen] = useState(true);
  const [buyerAccordionOpen, setBuyerAccordionOpen] = useState(true);
  const [discountAccordionOpen, setDiscountAccordionOpen] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showQuotation, setShowQuotation] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [viewMode, setViewMode] = useState<ViewMode>("quick");
  const deferredSearch = useDeferredValue(search.trim());
  const isSalesRep = user?.role === "sales_representative";

  const { data: items = [], isLoading } = useQuery<CatalogItem[]>({
    queryKey: ["catalog"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/inventory`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: brandCards = [] } = useQuery<BrandCard[]>({
    queryKey: ["brands", "catalog-cards"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/brands`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load brands");
      return res.json();
    },
  });

  const { data: favoriteIds = [] } = useQuery<number[]>({
    queryKey: ["favorite-ids"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/favorites/ids`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load favorites");
      return res.json();
    },
  });

  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const availableBrandCards = useMemo<BrandCard[]>(() => {
    const fromInventory = Array.from(
      new Set(
        items
          .map((item) => item.brand?.trim())
          .filter((brand): brand is string => Boolean(brand)),
      ),
    )
      .sort((a, b) => a.localeCompare(b))
      .map((name, index) => ({
        id: -(index + 1),
        name,
        image_path: null,
      }));

    const merged = new Map<string, BrandCard>();

    for (const brand of fromInventory) {
      merged.set(brand.name.toLowerCase(), brand);
    }

    for (const brand of brandCards) {
      merged.set(brand.name.toLowerCase(), brand);
    }

    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, brandCards]);

  const filteredBrandCards = useMemo(() => {
    const query = brandSearch.trim().toLowerCase();
    if (!query) return availableBrandCards;
    return availableBrandCards.filter((brand) => brand.name.toLowerCase().includes(query));
  }, [availableBrandCards, brandSearch]);

  const visibleBrandCards = useMemo(() => {
    if (brandShowAll || brandSearch.trim()) return filteredBrandCards;
    return filteredBrandCards.slice(0, 6);
  }, [filteredBrandCards, brandShowAll, brandSearch]);

  const brandCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = item.brand?.trim();
      if (!key) continue;
      counts.set(key.toLowerCase(), (counts.get(key.toLowerCase()) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const addFavorite = useMutation({
    mutationFn: async (inventoryId: number) => {
      const res = await fetch(`${BASE_URL}/api/favorites/${inventoryId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add favorite");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorite-ids"] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const removeFavorite = useMutation({
    mutationFn: async (inventoryId: number) => {
      const res = await fetch(`${BASE_URL}/api/favorites/${inventoryId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove favorite");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorite-ids"] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const updateSalePrice = useMutation({
    mutationFn: async ({ inventoryId, sale_price_aed }: { inventoryId: number; sale_price_aed: number | null }) => {
      const res = await fetch(`${BASE_URL}/api/inventory/${inventoryId}/sales-rep-price`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sale_price_aed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update sale price");
      }
      return res.json();
    },
    onSuccess: (updated: CatalogItem) => {
      queryClient.setQueryData<CatalogItem[]>(["catalog"], (current = []) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      );
    },
  });

  const filtered = useMemo(() => {
    let data = [...items];

    if (deferredSearch) {
      const query = deferredSearch.toLowerCase();
      data = data.filter((item) =>
        [
          item.brand,
          item.name,
          item.barcode,
          item.size,
          item.concentration,
          item.sub_category,
          item.description,
          categoryLabel(item.main_category),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }

    if (genderFilter !== "all") {
      data = data.filter((item) => genderLabel(item.gender)?.toLowerCase() === genderFilter);
    }
    if (categoryFilter !== "all") {
      data = data.filter((item) => item.main_category === categoryFilter);
    }
    if (selectedBrands.size > 0) {
      data = data.filter((item) => selectedBrands.has(item.brand.toLowerCase()));
    }
    if (discountOnly) {
      data = data.filter((item) => (item.discount_percent ?? 0) > 0);
    }

    data.sort((a, b) => {
      if (sortBy === "brand") return a.brand.localeCompare(b.brand);
      if (sortBy === "discount") return (Number(b.discount_percent) || 0) - (Number(a.discount_percent) || 0);
      return a.name.localeCompare(b.name);
    });

    return data;
  }, [items, deferredSearch, genderFilter, categoryFilter, selectedBrands, discountOnly, sortBy]);

  const selectedItems = items.filter((item) => selected.has(item.id));
  const selectedCount = selected.size;

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  }

  function resetFilters() {
    setGenderFilter("all");
    setCategoryFilter("all");
    setSelectedBrands(new Set());
    setDiscountOnly(false);
  }

  function toggleBrand(brandName: string) {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      const key = brandName.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleFavorite(id: number) {
    if (favorites.has(id)) {
      removeFavorite.mutate(id);
      return;
    }
    addFavorite.mutate(id);
  }

  return (
    <>
      <TraderChrome
        eyebrow=""
        title="Product Catalog"
        description={undefined}
        sideTitle="Inventory Filters"
        sideSubtitle="Refine your shortlist"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by brand, product, or barcode"
        sideContent={
          <div className="space-y-7">
            <div>
              <button
                type="button"
                onClick={() => setBrandAccordionOpen((prev) => !prev)}
                className="font-headline flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700"
              >
                Brand
                {brandAccordionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {brandAccordionOpen ? (
                <div className="mt-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={brandSearch}
                      onChange={(event) => {
                        setBrandSearch(event.target.value);
                        if (event.target.value.trim()) setBrandShowAll(true);
                      }}
                      placeholder="Search brand"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-500 outline-none transition focus:border-slate-400"
                    />
                    {brandSearch ? (
                      <button
                        onClick={() => {
                          setBrandSearch("");
                          setBrandShowAll(false);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    {visibleBrandCards.map((brand) => {
                      const key = brand.name.toLowerCase();
                      const checked = selectedBrands.has(key);
                      const count = brandCounts.get(key) ?? 0;
                      return (
                        <label key={brand.id} className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBrand(brand.name)}
                            className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                          />
                          <span className="flex-1 truncate">{brand.name}</span>
                          <span className="text-slate-400">({count})</span>
                        </label>
                      );
                    })}
                  </div>

                  {!brandSearch.trim() && filteredBrandCards.length > 6 ? (
                    <button
                      type="button"
                      onClick={() => setBrandShowAll((prev) => !prev)}
                      className="mt-4 text-sm font-medium text-slate-500 transition hover:text-slate-900"
                    >
                      {brandShowAll ? "Show fewer brands" : `Show ${filteredBrandCards.length - 6} more brands`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div>
              <button
                type="button"
                onClick={() => setCategoryAccordionOpen((prev) => !prev)}
                className="font-headline flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700"
              >
                Category
                {categoryAccordionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {categoryAccordionOpen ? (
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  {[
                    { label: "Perfume", value: "perfume" as CategoryFilter },
                    { label: "Makeup", value: "makeup" as CategoryFilter },
                    { label: "Skin Care", value: "skin_care" as CategoryFilter },
                  ].map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        name="catalog-category"
                        checked={categoryFilter === option.value}
                        onChange={() => setCategoryFilter(option.value)}
                        className="h-4 w-4 border-slate-300 accent-slate-900"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name="catalog-category"
                      checked={categoryFilter === "all"}
                      onChange={() => setCategoryFilter("all")}
                      className="h-4 w-4 border-slate-300 accent-slate-900"
                    />
                    <span>All categories</span>
                  </label>
                </div>
              ) : null}
            </div>

            <div>
              <button
                type="button"
                onClick={() => setBuyerAccordionOpen((prev) => !prev)}
                className="font-headline flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700"
              >
                Buyer Focus
                {buyerAccordionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {buyerAccordionOpen ? (
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  {[
                    { label: "Men", value: "men" as GenderFilter },
                    { label: "Women", value: "women" as GenderFilter },
                    { label: "Unisex", value: "unisex" as GenderFilter },
                  ].map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        name="catalog-gender"
                        checked={genderFilter === option.value}
                        onChange={() => setGenderFilter(option.value)}
                        className="h-4 w-4 border-slate-300 accent-slate-900"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name="catalog-gender"
                      checked={genderFilter === "all"}
                      onChange={() => setGenderFilter("all")}
                      className="h-4 w-4 border-slate-300 accent-slate-900"
                    />
                    <span>All buyers</span>
                  </label>
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-200 pt-7">
              <button
                type="button"
                onClick={() => setDiscountAccordionOpen((prev) => !prev)}
                className="font-headline flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700"
              >
                Discount only
                {discountAccordionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {discountAccordionOpen ? (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-slate-600">Show only discounted products</span>
                  <button
                    type="button"
                    onClick={() => setDiscountOnly((prev) => !prev)}
                    className={`relative h-7 w-12 rounded-full transition ${discountOnly ? "bg-slate-950" : "bg-slate-200"}`}
                    aria-pressed={discountOnly}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                        discountOnly ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              ) : null}
            </div>

            <button
              onClick={resetFilters}
              className="w-full rounded-none border border-slate-200 bg-white py-3 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500 transition hover:border-slate-400 hover:text-slate-900"
            >
              Reset filters
            </button>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                onClick={() => setViewMode("quick")}
                className={`flex items-center gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                  viewMode === "quick" ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <List className="h-4 w-4" />
                Quick Order
              </button>
              <button
                onClick={() => setViewMode("gallery")}
                className={`flex items-center gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                  viewMode === "gallery" ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Gallery
              </button>
            </div>

            <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
              <span>Sort by</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="bg-transparent text-slate-900 outline-none"
              >
                <option value="featured">Featured</option>
                <option value="brand">Brand</option>
                <option value="discount">Discount</option>
              </select>
            </div>
          </div>
        }
      >
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
          >
            <span>Filters and shortcuts</span>
            <ChevronDown className={`h-4 w-4 transition ${filtersOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {filtersOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="mt-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Perfume", value: "perfume" as CategoryFilter },
                      { label: "Makeup", value: "makeup" as CategoryFilter },
                      { label: "Skin Care", value: "skin_care" as CategoryFilter },
                    ].map((option) => (
                      <FilterChip
                        key={option.value}
                        label={option.label}
                        active={categoryFilter === option.value}
                        onClick={() => setCategoryFilter(categoryFilter === option.value ? "all" : option.value)}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <FilterChip
                      label="Men"
                      active={genderFilter === "men"}
                      onClick={() => setGenderFilter(genderFilter === "men" ? "all" : "men")}
                    />
                    <FilterChip
                      label="Women"
                      active={genderFilter === "women"}
                      onClick={() => setGenderFilter(genderFilter === "women" ? "all" : "women")}
                    />
                    <FilterChip
                      label="Discounted"
                      active={discountOnly}
                      onClick={() => setDiscountOnly((prev) => !prev)}
                    />
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
          </div>
        ) : null}

        {!isLoading && filtered.length === 0 ? (
          <TraderEmptyState
            icon={<Package className="h-8 w-8 text-slate-300" />}
            title="No products matched your filters"
            description="Try clearing a few filters or changing the search keywords."
          />
        ) : null}

        {!isLoading && filtered.length > 0 && viewMode === "quick" ? (
          <QuickOrderTable
            items={filtered}
            selectedIds={selected}
            favoriteIds={favorites}
            onSelect={toggleSelect}
            onFavorite={toggleFavorite}
            allSelected={filtered.length > 0 && filtered.every((i) => selected.has(i.id))}
            someSelected={filtered.some((i) => selected.has(i.id))}
            onSelectAll={toggleSelectAll}
            showSalesPrice={isSalesRep}
            onUpdateSalePrice={
              isSalesRep
                ? async (inventoryId, sale_price_aed) => {
                    await updateSalePrice.mutateAsync({ inventoryId, sale_price_aed });
                  }
                : undefined
            }
          />
        ) : null}

        {!isLoading && filtered.length > 0 && viewMode === "gallery" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filtered.map((item, index) => {
              const selectedItem = selected.has(item.id);
              const isFavorite = favorites.has(item.id);
              const hasDiscount = Number(item.discount_percent ?? 0) > 0;
              const qty = item.qty ?? 0;
              const mode = item.availability_mode;
              const nameLine = [item.name, item.size, item.concentration].filter(Boolean).join(" · ");

              let availLabel: string;
              let availCls: string;
              if (mode === "incoming") {
                availLabel = "Incoming"; availCls = "bg-violet-50 text-violet-700 border-violet-200";
              } else if (mode === "source_only" || (mode === "stock_and_source" && qty === 0)) {
                availLabel = "Available"; availCls = "bg-emerald-50 text-emerald-700 border-emerald-200";
              } else if (qty === 0) {
                availLabel = "Out of Stock"; availCls = "bg-red-50 text-red-700 border-red-200";
              } else if (qty === 1) {
                availLabel = "Last Item"; availCls = "bg-orange-50 text-orange-700 border-orange-200";
              } else if (qty <= 10) {
                availLabel = "Running Low"; availCls = "bg-amber-50 text-amber-700 border-amber-200";
              } else {
                availLabel = "Available"; availCls = "bg-emerald-50 text-emerald-700 border-emerald-200";
              }

              const gLabel = genderLabel(item.gender);
              const genderCls = gLabel === "Men"
                ? "bg-sky-50 text-sky-700 border-sky-200"
                : gLabel === "Women"
                ? "bg-pink-50 text-pink-700 border-pink-200"
                : "bg-slate-100 text-slate-600 border-slate-200";

              return (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(index * 0.02, 0.2) }}
                  className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_2px_12px_rgb(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgb(0,0,0,0.08)] transition-shadow ${
                    selectedItem ? "border-emerald-300 ring-2 ring-emerald-200" : "border-gray-100"
                  }`}
                >
                  {/* Image */}
                  <div className="relative bg-gray-50">
                    {item.thumbnail_path ? (
                      <img
                        src={resolveStorageUrl(item.thumbnail_path)}
                        alt={item.name}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center">
                        <Package className="w-10 h-10 text-gray-200" />
                      </div>
                    )}
                    {/* Discount badge top-left */}
                    {hasDiscount && (
                      <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">
                        {Number(item.discount_percent)}% Off
                      </span>
                    )}
                    {/* Favourite button top-right */}
                    <button
                      type="button"
                      onClick={() => toggleFavorite(item.id)}
                      aria-pressed={isFavorite}
                      className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full border backdrop-blur transition-colors ${
                        isFavorite ? "border-rose-400 bg-rose-500 text-white" : "border-white/60 bg-white/80 text-slate-400 hover:bg-white hover:text-rose-400"
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-current" : ""}`} />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex flex-col flex-1 px-3 pt-2.5 pb-3 gap-1">
                    {/* Brand */}
                    <p className="text-xs font-bold text-gray-900 truncate leading-none">{item.brand}</p>
                    {/* Category - Sub-category */}
                    {(item.main_category || item.sub_category) && (
                      <p className="text-[10px] text-gray-400 truncate leading-none">
                        {categoryLabel(item.main_category)}{item.sub_category ? ` · ${item.sub_category}` : ""}
                      </p>
                    )}
                    {/* Name · Size · Concentration */}
                    <p className="text-[11px] text-gray-600 truncate leading-none">{nameLine}</p>
                    {/* Gender + Availability */}
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {gLabel && (
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-semibold ${genderCls}`}>
                          {gLabel}
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold ${availCls}`}>
                        {availLabel}
                      </span>
                    </div>
                    {/* Add to Quote button — full width, bottom */}
                    {isSalesRep ? (
                      <GalleryPriceEditor
                        item={item}
                        onSave={async (sale_price_aed) => {
                          await updateSalePrice.mutateAsync({ inventoryId: item.id, sale_price_aed });
                        }}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleSelect(item.id)}
                      aria-pressed={selectedItem}
                      className={`mt-auto w-full flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-[11px] font-semibold transition-colors ${
                        selectedItem
                          ? "bg-slate-950 text-white hover:bg-slate-700"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      {selectedItem ? "Added" : "Add to Quote"}
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        ) : null}
      </TraderChrome>

      <AnimatePresence>
        {selectedCount > 0 ? (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-700 bg-[#141c2f] px-4 py-4 shadow-2xl"
          >
            <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-3 rounded-xl bg-emerald-500 px-4 py-3 text-base font-semibold text-white">
                  <ShoppingCart className="h-5 w-5" />
                  {selectedCount} items ready for quote request
                </div>
                <p className="hidden text-sm text-slate-300 lg:block">
                  Send one broker-led request and pricing will be confirmed item by item.
                </p>
              </div>

              <div className="flex gap-3 self-end lg:self-auto">
                <button
                  onClick={() => setSelected(new Set())}
                  className="rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:border-slate-400"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowQuotation(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-900 transition hover:bg-slate-100"
                >
                  Request Quote
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {showQuotation ? <QuotationModal items={selectedItems as QuoteItem[]} onClose={() => setShowQuotation(false)} /> : null}
    </>
  );
}

function GalleryPriceEditor({
  item,
  onSave,
}: {
  item: CatalogItem;
  onSave: (sale_price_aed: number | null) => Promise<void>;
}) {
  const effectiveSalePrice = Number(item.effective_sale_price_aed ?? item.sale_price_aed ?? 0);
  const hasOverride = item.sales_rep_sale_price_aed !== null && item.sales_rep_sale_price_aed !== undefined;
  const [price, setPrice] = useState(effectiveSalePrice > 0 ? effectiveSalePrice.toFixed(2) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrice(effectiveSalePrice > 0 ? effectiveSalePrice.toFixed(2) : "");
  }, [effectiveSalePrice]);

  async function submit(reset = false) {
    setSaving(true);
    try {
      if (reset) {
        await onSave(null);
        return;
      }

      const next = Number(price);
      if (!Number.isFinite(next) || next < 0) return;
      await onSave(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Sale Price</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-slate-400"
          placeholder="0.00"
        />
        <button
          type="button"
          onClick={() => void submit(false)}
          disabled={saving}
          className="rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
        <span>{effectiveSalePrice > 0 ? `${effectiveSalePrice.toFixed(2)} AED` : "No price set"}</span>
        {hasOverride ? (
          <button
            type="button"
            onClick={() => void submit(true)}
            disabled={saving}
            className="font-semibold text-slate-500 disabled:opacity-50"
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
