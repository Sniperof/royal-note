import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, MapPin, Package, ShoppingCart, Star, Trash2, Truck } from "lucide-react";
import QuotationModal, { type QuoteItem } from "@/components/QuotationModal";
import TraderChrome from "@/components/TraderChrome";
import { TraderEmptyState, TraderPanelCard, TraderStatChip } from "@/components/TraderUI";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface FavoriteItem extends QuoteItem {
  barcode: string;
  main_category: string;
  sub_category: string | null;
  qty: number;
  discount_percent: number | null;
  thumbnail_path: string | null;
  available_locations?: string[];
  availability_mode?: "stock_only" | "source_only" | "stock_and_source" | "unavailable";
}

function categoryLabel(category: string | null | undefined) {
  if (category === "perfume") return "Perfume";
  if (category === "makeup") return "Makeup";
  if (category === "skin_care") return "Skin Care";
  return category ?? "Other";
}

function locationLabel(location: string) {
  if (location === "syria") return "Syria availability";
  if (location === "dubai") return "Dubai availability";
  return location;
}

function buildAvailability(item: FavoriteItem) {
  const locations = item.available_locations ?? [];
  const hasSyria = locations.includes("syria");
  const hasDubai = locations.includes("dubai");

  if (item.availability_mode === "stock_and_source") {
    return {
      label: "Limited quantity",
      eta: hasDubai ? "Same-day dispatch available" : "Restock available within 15 days",
      tone: "bg-amber-100 text-amber-800",
    };
  }
  if (item.availability_mode === "stock_only") {
    return {
      label: "Ready to ship",
      eta: hasDubai ? "Same-day dispatch" : "Fast dispatch from stock",
      tone: "bg-emerald-100 text-emerald-800",
    };
  }
  if (item.availability_mode === "source_only") {
    if (hasDubai) {
      return {
        label: "Dubai availability",
        eta: hasSyria ? "Ships within 1-15 days" : "Ships within 1-3 days",
        tone: "bg-sky-100 text-sky-800",
      };
    }
    if (hasSyria) {
      return {
        label: "Syria availability",
        eta: "Ships within 7-15 days",
        tone: "bg-indigo-100 text-indigo-800",
      };
    }
  }
  return {
    label: "Available on request",
    eta: "Availability confirmed after quotation",
    tone: "bg-slate-200 text-slate-700",
  };
}

export default function MyFavoritesPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showQuotation, setShowQuotation] = useState(false);

  const { data: favorites = [], isLoading } = useQuery<FavoriteItem[]>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/favorites`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load favorites");
      return res.json();
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
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favorite-ids"] });
    },
  });

  const selectedItems = useMemo(
    () => favorites.filter((item) => selected.has(item.id)),
    [favorites, selected],
  );

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <TraderChrome
      eyebrow="Saved products"
      title="Favorites"
      description="Keep high-interest products in one place, review them quickly, and request pricing only when you are ready."
      sideTitle="Favorites"
      sideSubtitle="Saved shortlist"
      sideContent={
        <TraderPanelCard title="Favorites Summary">
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Saved items</span>
              <span className="font-semibold text-slate-950">{favorites.length}</span>
            </div>
            <div className="flex items-center justify-between">
                <span>Selected for request</span>
              <span className="font-semibold text-slate-950">{selected.size}</span>
            </div>
          </div>
        </TraderPanelCard>
      }
      actions={
        <TraderStatChip
          icon={<Heart className="h-4 w-4 fill-current text-rose-500" />}
          label={`${favorites.length} saved products`}
        />
      }
    >

      {selected.size > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-slate-700">
            <Star className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">{selected.size} saved items ready for a quote request</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              onClick={() => setShowQuotation(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <ShoppingCart className="h-4 w-4" />
              Request Pricing
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        </div>
      )}

      {!isLoading && favorites.length === 0 && (
        <TraderEmptyState
          icon={<Heart className="h-8 w-8 text-slate-300" />}
          title="No saved products yet"
          description="Save products from the marketplace to review them here later."
        />
      )}

      {!isLoading && favorites.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <AnimatePresence>
            {favorites.map((item) => {
              const availability = buildAvailability(item);
              const isSelected = selected.has(item.id);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className={`overflow-hidden rounded-[28px] border bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition ${
                    isSelected ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col gap-4 p-5 sm:flex-row">
                    <button
                      onClick={() => toggleSelect(item.id)}
                      className="relative h-36 w-full overflow-hidden rounded-2xl bg-slate-100 sm:h-32 sm:w-32 flex-shrink-0"
                    >
                      {item.thumbnail_path ? (
                        <img
                          src={`${BASE_URL}/api/storage${item.thumbnail_path}`}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center">
                          <Package className="h-8 w-8 text-slate-300" />
                        </div>
                      )}
                      <div className="absolute left-3 top-3">
                        <span className={`font-headline rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-[0.18em] ${availability.tone}`}>
                          {availability.label}
                        </span>
                      </div>
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-headline text-[11px] font-extrabold uppercase tracking-[0.24em] text-slate-900">{item.brand}</p>
                          <h3 className="font-headline mt-2 text-2xl font-extralight tracking-tight text-slate-950">{item.name}</h3>
                          <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
                            {categoryLabel(item.main_category)}
                            {item.concentration ? ` - ${item.concentration}` : ""}
                            {item.size ? ` - ${item.size}` : ""}
                            {item.sub_category ? ` - ${item.sub_category}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleSelect(item.id)}
                            className={`grid h-10 w-10 place-items-center rounded-xl border transition ${
                              isSelected ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {isSelected ? <ShoppingCart className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => removeFavorite.mutate(item.id)}
                            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-2 text-sm text-slate-600">
                        {(item.available_locations ?? []).slice(0, 2).map((availableLocation) => (
                          <div key={`${item.id}-${availableLocation}`} className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <span>{locationLabel(availableLocation)}</span>
                          </div>
                        ))}

                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-slate-400" />
                          <span>{availability.eta}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {showQuotation && (
        <QuotationModal items={selectedItems as QuoteItem[]} onClose={() => setShowQuotation(false)} />
      )}
    </TraderChrome>
  );
}
