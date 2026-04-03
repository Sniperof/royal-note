import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Search, Plus, Edit2, Trash2, X, FileSpreadsheet, Tag,
  Eye, Package, LayoutGrid, List, ChevronUp, ChevronDown,
  ChevronsUpDown, TrendingUp, AlertTriangle, DollarSign,
  Boxes, ChevronDown as ChevronDownIcon, MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetInventory, type InventoryItem } from "@workspace/api-client-react";
import { InventoryModal } from "../components/InventoryModal";
import { DeleteConfirmModal } from "../components/DeleteConfirmModal";
import { ExcelImportModal } from "../components/ExcelImportModal";
import DiscountModal from "../components/DiscountModal";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── Types ──────────────────────────────────────────────────────────────────

type ExtItem = InventoryItem & {
  thumbnail_path?: string | null;
  discount_percent?: number | null;
  description?: string | null;
  main_category?: string;
  sub_category?: string | null;
  assigned_source_ids?: number[];
  available_locations?: string[];
  availability_mode?: "stock_only" | "source_only" | "stock_and_source" | "incoming" | "unavailable";
  incoming_qty?: number;
};
type ViewMode = "grid" | "list";
type StockFilter = "all" | "instock" | "low" | "out";
type GenderFilter = "all" | "men" | "women" | "unisex";
type SortField = "brand" | "name" | "qty" | "cost" | "price" | "margin" | "date";
type SortDir = "asc" | "desc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GENDER_MAP: Record<string, string> = {
  male: "Men", female: "Women", unisex: "Unisex",
  men: "Men", women: "Women",
  "for men": "Men", "for women": "Women",
};
function genderKey(g: string | null | undefined): GenderFilter {
  const v = g?.toLowerCase();
  if (!v) return "all";
  if (v === "male" || v === "men" || v === "for men") return "men";
  if (v === "female" || v === "women" || v === "for women") return "women";
  if (v === "unisex") return "unisex";
  return "all";
}
function genderLabel(g: string | null | undefined) {
  if (!g) return null;
  return GENDER_MAP[g.toLowerCase()] ?? g;
}
function genderBadgeStyle(g: string | null | undefined) {
  const k = genderKey(g);
  if (k === "men") return "bg-blue-50 text-blue-700";
  if (k === "women") return "bg-pink-50 text-pink-700";
  if (k === "unisex") return "bg-violet-50 text-violet-700";
  return "bg-gray-100 text-gray-600";
}
function stockBadge(qty: number) {
  if (qty === 0) return { label: "Out of Stock", cls: "bg-red-50 text-red-700" };
  if (qty <= 10) return { label: "Low Stock", cls: "bg-yellow-50 text-yellow-700" };
  return { label: "In Stock", cls: "bg-green-50 text-green-700" };
}
function margin(item: ExtItem) {
  const cost = parseFloat(item.cost_usd ?? "0");
  const price = parseFloat(item.sale_price_aed ?? "0");
  if (cost <= 0 || price <= 0) return null;
  return ((price - cost) / cost) * 100;
}
function fmtMargin(m: number | null) {
  if (m === null) return "—";
  return `${m >= 0 ? "+" : ""}${m.toFixed(1)}%`;
}
function marginColor(m: number | null) {
  if (m === null) return "text-gray-400";
  if (m < 0) return "text-red-600";
  if (m < 20) return "text-yellow-600";
  return "text-green-600";
}
function categoryLabel(category: string | null | undefined) {
  if (!category) return "Uncategorized";
  if (category === "skin_care") return "Skin Care";
  return category.charAt(0).toUpperCase() + category.slice(1);
}
function resolveAvailabilityMode(item: ExtItem) {
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
function availabilityModeLabel(mode: ReturnType<typeof resolveAvailabilityMode>) {
  if (mode === "stock_only") return "Own Stock";
  if (mode === "source_only") return "Source Network";
  if (mode === "stock_and_source") return "Hybrid";
  if (mode === "incoming") return "Incoming";
  return "Unavailable";
}

// ─── Sort icon ───────────────────────────────────────────────────────────────

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 text-gray-300" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 text-black" />
    : <ChevronDown className="w-3 h-3 text-black" />;
}

// ─── Thumbnail ───────────────────────────────────────────────────────────────

function Thumb({ path, size = "sm" }: { path?: string | null; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "w-full aspect-square" : size === "md" ? "w-12 h-12" : "w-10 h-10";
  const iconSize = size === "lg" ? "w-10 h-10" : size === "md" ? "w-5 h-5" : "w-4 h-4";
  return path ? (
    <img
      src={`${BASE_URL}/api/storage${path}`}
      className={`${dims} object-cover rounded-xl border border-gray-100 flex-shrink-0`}
      alt=""
    />
  ) : (
    <div className={`${dims} rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0`}>
      <Package className={`${iconSize} text-gray-300`} />
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-[0_2px_12px_rgb(0,0,0,0.04)]">
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${accent} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] sm:text-xs text-gray-400 font-medium truncate">{label}</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [, navigate] = useLocation();

  // ── View & Filter state ──
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [brandDropOpen, setBrandDropOpen] = useState(false);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Modal state ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [discountItem, setDiscountItem] = useState<ExtItem | null>(null);
  const [openActionId, setOpenActionId] = useState<number | null>(null);

  const { data: rawData = [], isLoading, isError } = useGetInventory();
  const allData = rawData as ExtItem[];

  // ── Derived lists ──
  const brands = useMemo(() => {
    const set = new Set(allData.map(i => i.brand).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [allData]);

  const filtered = useMemo(() => {
    let data = allData;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(i =>
        i.barcode?.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q) ||
        i.name?.toLowerCase().includes(q) ||
        i.main_category?.toLowerCase().includes(q) ||
        i.sub_category?.toLowerCase().includes(q) ||
        i.concentration?.toLowerCase().includes(q) ||
        i.size?.toLowerCase().includes(q)
      );
    }
    if (brandFilter !== "all") data = data.filter(i => i.brand === brandFilter);
    if (genderFilter !== "all") data = data.filter(i => genderKey(i.gender) === genderFilter);
    if (stockFilter === "instock") data = data.filter(i => i.qty > 10);
    else if (stockFilter === "low") data = data.filter(i => i.qty > 0 && i.qty <= 10);
    else if (stockFilter === "out") data = data.filter(i => i.qty === 0);

    return [...data].sort((a, b) => {
      let cmp = 0;
      if (sortField === "brand") cmp = (a.brand ?? "").localeCompare(b.brand ?? "");
      else if (sortField === "name") cmp = (a.name ?? "").localeCompare(b.name ?? "");
      else if (sortField === "qty") cmp = (a.qty ?? 0) - (b.qty ?? 0);
      else if (sortField === "cost") cmp = parseFloat(a.cost_usd ?? "0") - parseFloat(b.cost_usd ?? "0");
      else if (sortField === "price") cmp = parseFloat(a.sale_price_aed ?? "0") - parseFloat(b.sale_price_aed ?? "0");
      else if (sortField === "margin") cmp = (margin(a) ?? -999) - (margin(b) ?? -999);
      else if (sortField === "date") cmp = new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allData, search, brandFilter, genderFilter, stockFilter, sortField, sortDir]);

  // ── KPI Calculations ──
  const kpis = useMemo(() => {
    const totalValue = allData.reduce((s, i) => s + (i.qty ?? 0) * parseFloat(i.cost_usd ?? "0"), 0);
    const lowStock = allData.filter(i => i.qty > 0 && i.qty <= 10).length;
    const outStock = allData.filter(i => i.qty === 0).length;
    return { totalValue, lowStock, outStock };
  }, [allData]);

  // ── Sort toggle ──
  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  // ── Helpers ──
  const activeFilterCount =
    (brandFilter !== "all" ? 1 : 0) +
    (genderFilter !== "all" ? 1 : 0) +
    (stockFilter !== "all" ? 1 : 0);
  const clearAll = () => {
    setSearch(""); setBrandFilter("all"); setGenderFilter("all"); setStockFilter("all");
  };
  const openAdd = () => { setEditingItem(null); setIsModalOpen(true); };
  const openEdit = (item: InventoryItem) => { setEditingItem(item); setIsModalOpen(true); };
  const openDelete = (item: InventoryItem) => { setDeletingItem(item); setIsDeleteOpen(true); };

  const GENDER_OPTS: { value: GenderFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "men", label: "Men" },
    { value: "women", label: "Women" },
    { value: "unisex", label: "Unisex" },
  ];
  const STOCK_OPTS: { value: StockFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "instock", label: "In Stock" },
    { value: "low", label: "Low" },
    { value: "out", label: "Out" },
  ];
  const SORT_OPTS: { value: SortField; label: string }[] = [
    { value: "date", label: "Date Added" },
    { value: "brand", label: "Brand A–Z" },
    { value: "name", label: "Name A–Z" },
    { value: "qty", label: "Qty" },
    { value: "cost", label: "Cost" },
    { value: "price", label: "Price" },
    { value: "margin", label: "Margin %" },
  ];

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">

      {/* ── KPI Cards ── */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <KpiCard icon={Boxes} label="Total SKUs" value={allData.length} sub={`${filtered.length} shown`} accent="bg-black" />
          <KpiCard icon={DollarSign} label="Inventory Value" value={`$${kpis.totalValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} sub="at cost price" accent="bg-emerald-600" />
          <KpiCard icon={AlertTriangle} label="Low Stock" value={kpis.lowStock} sub="1–10 units" accent="bg-yellow-500" />
          <KpiCard icon={TrendingUp} label="Out of Stock" value={kpis.outStock} sub="needs restocking" accent="bg-red-500" />
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="space-y-3 mb-4">
        {/* Row 1: Search + View + Import + Add */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search brand, name, barcode…"
              className="w-full pl-10 pr-8 py-2.5 bg-white border border-gray-200 rounded-2xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* View toggle */}
            <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setView("list")}
                className={`p-2.5 transition-colors ${view === "list" ? "bg-black text-white" : "text-gray-400 hover:text-gray-700"}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView("grid")}
                className={`p-2.5 transition-colors ${view === "grid" ? "bg-black text-white" : "text-gray-400 hover:text-gray-700"}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 shadow-md shadow-black/10 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Add Product</span>
            </button>
          </div>
        </div>

        {/* Row 2: Filters + Sort */}
        <div className="flex flex-wrap gap-2 items-center">

          {/* Brand dropdown */}
          <div className="relative">
            <button
              onClick={() => setBrandDropOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${brandFilter !== "all" ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
            >
              {brandFilter === "all" ? "All Brands" : brandFilter}
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
            {brandDropOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 min-w-[160px] max-h-64 overflow-y-auto">
                {brands.map(b => (
                  <button
                    key={b}
                    onClick={() => { setBrandFilter(b); setBrandDropOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${brandFilter === b ? "font-semibold text-black" : "text-gray-700"}`}
                  >
                    {b === "all" ? "All Brands" : b}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Gender pills */}
          <div className="flex items-center gap-1">
            {GENDER_OPTS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setGenderFilter(opt.value)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${genderFilter === opt.value ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Stock pills */}
          <div className="flex items-center gap-1">
            {STOCK_OPTS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStockFilter(opt.value)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${stockFilter === opt.value ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Sort:</span>
            <select
              value={sortField}
              onChange={e => { setSortField(e.target.value as SortField); }}
              className="text-xs border border-gray-200 rounded-xl px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black/5"
            >
              {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
              className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-black transition-colors"
              title={sortDir === "asc" ? "Ascending" : "Descending"}
            >
              {sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Active filter chips ── */}
      {(search || activeFilterCount > 0) && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-xs text-gray-400">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          {search && (
            <span className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
              "{search}" <button onClick={() => setSearch("")} className="ml-0.5 hover:text-red-500"><X className="w-3 h-3" /></button>
            </span>
          )}
          {brandFilter !== "all" && (
            <span className="flex items-center gap-1 bg-black text-white text-xs px-2.5 py-1 rounded-full">
              {brandFilter} <button onClick={() => setBrandFilter("all")} className="ml-0.5 hover:text-red-300"><X className="w-3 h-3" /></button>
            </span>
          )}
          {genderFilter !== "all" && (
            <span className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full">
              {GENDER_OPTS.find(o => o.value === genderFilter)?.label}
              <button onClick={() => setGenderFilter("all")} className="ml-0.5 hover:text-red-500"><X className="w-3 h-3" /></button>
            </span>
          )}
          {stockFilter !== "all" && (
            <span className="flex items-center gap-1 bg-yellow-50 text-yellow-700 text-xs px-2.5 py-1 rounded-full">
              {STOCK_OPTS.find(o => o.value === stockFilter)?.label}
              <button onClick={() => setStockFilter("all")} className="ml-0.5 hover:text-red-500"><X className="w-3 h-3" /></button>
            </span>
          )}
          <button onClick={clearAll} className="text-xs text-gray-400 hover:text-red-500 underline">Clear all</button>
        </div>
      )}

      {/* ── Loading / Error / Empty ── */}
      {isLoading && (
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
      )}
      {isError && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Failed to load inventory. Please refresh.</p>
        </div>
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">
            {search || activeFilterCount > 0 ? "No products match your filters" : "Inventory is empty"}
          </p>
          {!search && activeFilterCount === 0 && (
            <button onClick={openAdd} className="mt-4 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800">
              + Add First Product
            </button>
          )}
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <>
          {/* ══════════════════════════════════════════════════════ */}
          {/* GRID VIEW                                              */}
          {/* ══════════════════════════════════════════════════════ */}
          {view === "grid" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              <AnimatePresence mode="popLayout">
                {filtered.map((item, idx) => {
                  const stock = stockBadge(item.qty ?? 0);
                  const hasDiscount = Boolean(item.discount_percent && Number(item.discount_percent) > 0);
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                      className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgb(0,0,0,0.04)] overflow-hidden group hover:shadow-[0_4px_20px_rgb(0,0,0,0.08)] transition-shadow"
                    >
                      {/* Image area */}
                      <div className="relative bg-gray-50">
                        {item.thumbnail_path ? (
                          <img
                            src={`${BASE_URL}/api/storage${item.thumbnail_path}`}
                            alt={item.name}
                            className="w-full aspect-square object-cover"
                          />
                        ) : (
                          <div className="w-full aspect-square flex items-center justify-center">
                            <Package className="w-10 h-10 text-gray-200" />
                          </div>
                        )}
                        {/* Badges overlay */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {resolveAvailabilityMode(item) === "incoming" ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700">
                              +{item.incoming_qty ?? 0}
                            </span>
                          ) : (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${stock.cls}`}>
                              {item.qty}
                            </span>
                          )}
                          {hasDiscount && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">
                              <Tag className="w-2.5 h-2.5" />{Number(item.discount_percent)}%
                            </span>
                          )}
                        </div>
                        {/* Action overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100">
                          <div className="flex gap-1">
                            <button onClick={() => navigate(`/inventory/${item.id}`)} className="p-1.5 bg-white rounded-lg shadow text-gray-600 hover:text-violet-600 transition-colors" title="View">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDiscountItem(item)} className="p-1.5 bg-white rounded-lg shadow text-gray-600 hover:text-amber-600 transition-colors" title="Discount">
                              <Tag className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openEdit(item)} className="p-1.5 bg-white rounded-lg shadow text-gray-600 hover:text-black transition-colors" title="Edit">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openDelete(item)} className="p-1.5 bg-white rounded-lg shadow text-gray-600 hover:text-red-600 transition-colors" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Info area */}
                      <div className="p-3">
                        {/* Brand */}
                        <p className="text-xs font-bold text-gray-900 truncate">{item.brand}</p>
                        {/* Category - Sub-category */}
                        {(item.main_category || item.sub_category) && (
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">
                            {categoryLabel(item.main_category)}{item.sub_category ? ` · ${item.sub_category}` : ""}
                          </p>
                        )}
                        {/* Name . Size . Concentration */}
                        <p className="text-[11px] text-gray-500 truncate leading-tight mt-0.5">
                          {[item.name, item.size, item.concentration].filter(Boolean).join(" · ")}
                        </p>
                        {/* Gender */}
                        {item.gender && (
                          <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-md mt-1 ${genderBadgeStyle(item.gender)}`}>
                            {genderLabel(item.gender)}
                          </span>
                        )}
                        {/* Cost | Price */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                          <span className="text-[11px] text-gray-400">Cost: ${parseFloat(item.cost_usd ?? "0").toFixed(0)}</span>
                          <span className="text-xs font-bold text-gray-900">${parseFloat(item.sale_price_aed ?? "0").toFixed(0)}</span>
                        </div>
                        {/* Availability */}
                        <div className="mt-1.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                            {availabilityModeLabel(resolveAvailabilityMode(item))}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════ */}
          {/* LIST VIEW                                             */}
          {/* ══════════════════════════════════════════════════════ */}
          {view === "list" && (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                <AnimatePresence mode="popLayout">
                  {filtered.map((item, idx) => {
                    const m = margin(item);
                    const stock = stockBadge(item.qty ?? 0);
                    const hasDiscount = Boolean(item.discount_percent && Number(item.discount_percent) > 0);
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.15) }}
                        className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgb(0,0,0,0.04)] overflow-hidden"
                      >
                        <div className="flex items-center gap-3 px-3.5 py-3">
                          <Thumb path={item.thumbnail_path} size="md" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-sm text-gray-900 truncate">{item.brand}</span>
                              {item.gender && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${genderBadgeStyle(item.gender)}`}>{genderLabel(item.gender)}</span>
                              )}
                              {hasDiscount && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-700 bg-amber-100">
                                  <Tag className="w-2.5 h-2.5" />{Number(item.discount_percent)}%
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{item.name}{item.size ? ` · ${item.size}` : ""}{item.concentration ? ` · ${item.concentration}` : ""}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                  {categoryLabel(item.main_category)}
                                </span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                                  {availabilityModeLabel(resolveAvailabilityMode(item))}
                                </span>
                                {item.sub_category && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">
                                    {item.sub_category}
                                  </span>
                              )}
                                <span className="text-[10px] text-gray-400">
                                  {item.assigned_source_ids?.length ?? 0} source{(item.assigned_source_ids?.length ?? 0) === 1 ? "" : "s"}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              {resolveAvailabilityMode(item) === "incoming"
                                ? <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700">+{item.incoming_qty ?? 0} incoming</span>
                                : <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${stock.cls}`}>Qty: {item.qty}</span>
                              }
                              <span className="text-xs text-gray-500">Cost: ${parseFloat(item.cost_usd ?? "0").toFixed(2)}</span>
                              <span className="text-xs font-medium text-gray-900">${parseFloat(item.sale_price_aed ?? "0").toFixed(2)}</span>
                              {m !== null && <span className={`text-xs font-semibold ${marginColor(m)}`}>{fmtMargin(m)}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button onClick={() => navigate(`/inventory/${item.id}`)} className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => setDiscountItem(item)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><Tag className="w-4 h-4" /></button>
                            <button onClick={() => openEdit(item)} className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => openDelete(item)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block bg-white rounded-2xl shadow-[0_4px_24px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse" style={{ minWidth: "920px" }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                        <th className="px-4 py-3.5 w-16">Photo</th>
                        {[
                          { label: "Brand", field: "brand" as SortField, width: "w-[10%]" },
                          { label: "Category", field: null, width: "w-[12%]" },
                          { label: "Name", field: "name" as SortField, width: "w-[22%]" },
                          { label: "Gender", field: null, width: "" },
                          { label: "Qty", field: "qty" as SortField, width: "" },
                          { label: "Cost", field: "cost" as SortField, width: "" },
                          { label: "Price", field: "price" as SortField, width: "" },
                          { label: "Availability", field: null, width: "" },
                          { label: "", field: null, width: "w-10" },
                        ].map(col => (
                          <th
                            key={col.label}
                            className={`px-4 py-3.5 ${col.width} uppercase tracking-wider ${col.field ? "cursor-pointer hover:text-black select-none" : ""}`}
                            onClick={col.field ? () => toggleSort(col.field!) : undefined}
                          >
                            <span className="flex items-center gap-1">
                              {col.label}
                              {col.field && <SortIcon field={col.field} sortField={sortField} sortDir={sortDir} />}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                      <AnimatePresence mode="popLayout">
                        {filtered.map((item, idx) => {
                          const stock = stockBadge(item.qty ?? 0);
                          const hasDiscount = Boolean(item.discount_percent && Number(item.discount_percent) > 0);
                          return (
                            <motion.tr
                              key={item.id}
                              layout
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ delay: Math.min(idx * 0.015, 0.2) }}
                              className="hover:bg-gray-50/60 transition-colors"
                            >
                              {/* Photo */}
                              <td className="px-4 py-3">
                                <Thumb path={item.thumbnail_path} size="md" />
                              </td>
                              {/* Brand */}
                              <td className="px-4 py-3.5 font-semibold text-sm text-gray-900 align-middle">
                                {item.brand}
                              </td>
                              {/* Category - Sub-category */}
                              <td className="px-4 py-3.5 align-middle">
                                <div className="text-xs text-gray-700 font-medium leading-snug">{categoryLabel(item.main_category)}</div>
                                {item.sub_category && (
                                  <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">{item.sub_category}</div>
                                )}
                              </td>
                              {/* Name . Size . Concentration */}
                              <td className="px-4 py-3.5 align-middle">
                                <span className="text-sm text-gray-700">
                                  {[item.name, item.size, item.concentration].filter(Boolean).join(" · ")}
                                </span>
                              </td>
                              {/* Gender */}
                              <td className="px-4 py-3.5 align-middle">
                                {item.gender
                                  ? <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${genderBadgeStyle(item.gender)}`}>{genderLabel(item.gender)}</span>
                                  : <span className="text-gray-300 text-xs">—</span>
                                }
                              </td>
                              {/* Qty */}
                              <td className="px-4 py-3.5 align-middle">
                                {resolveAvailabilityMode(item) === "incoming" ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                                    +{item.incoming_qty ?? 0} incoming
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${stock.cls}`}>
                                    {item.qty ?? 0}
                                  </span>
                                )}
                              </td>
                              {/* Cost */}
                              <td className="px-4 py-3.5 text-gray-700 font-medium text-sm align-middle">
                                ${parseFloat(item.cost_usd ?? "0").toFixed(2)}
                              </td>
                              {/* Price */}
                              <td className="px-4 py-3.5 font-semibold text-gray-900 text-sm align-middle">
                                ${parseFloat(item.sale_price_aed ?? "0").toFixed(2)}
                              </td>
                              {/* Availability */}
                              <td className="px-4 py-3.5 align-middle">
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 whitespace-nowrap">
                                  {availabilityModeLabel(resolveAvailabilityMode(item))}
                                </span>
                              </td>
                              {/* Actions dropdown */}
                              <td className="px-4 py-3.5 align-middle">
                                <div className="relative inline-block">
                                  <button
                                    onClick={() => setOpenActionId(openActionId === item.id ? null : (item.id ?? null))}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                  {openActionId === item.id && (
                                    <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
                                      {hasDiscount && (
                                        <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-1.5">
                                          <Tag className="w-3 h-3 text-amber-600" />
                                          <span className="text-[11px] font-bold text-amber-700">{Number(item.discount_percent)}% OFF</span>
                                        </div>
                                      )}
                                      <button onClick={() => { navigate(`/inventory/${item.id}`); setOpenActionId(null); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                        <Eye className="w-3.5 h-3.5" /> View
                                      </button>
                                      <button onClick={() => { setDiscountItem(item); setOpenActionId(null); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                        <Tag className="w-3.5 h-3.5" /> Discount
                                      </button>
                                      <button onClick={() => { openEdit(item); setOpenActionId(null); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                      </button>
                                      <div className="border-t border-gray-100 my-1" />
                                      <button onClick={() => { openDelete(item); setOpenActionId(null); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>

                    {/* Table footer summary */}
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                        <td colSpan={5} className="px-5 py-3 font-medium">
                          {filtered.length} product{filtered.length !== 1 ? "s" : ""} · {filtered.reduce((s, i) => s + (i.qty ?? 0), 0)} total units
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-700">
                          {filtered.reduce((s, i) => s + (i.qty ?? 0), 0)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-700">
                          ${filtered.reduce((s, i) => s + parseFloat(i.cost_usd ?? "0") * (i.qty ?? 0), 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-700">
                          ${filtered.reduce((s, i) => s + parseFloat(i.sale_price_aed ?? "0") * (i.qty ?? 0), 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </td>
                        <td colSpan={2} className="px-4 py-3" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Modals ── */}
      <InventoryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} item={editingItem} />
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        itemId={deletingItem?.id ?? null}
        itemName={deletingItem ? `${deletingItem.brand} ${deletingItem.name}` : undefined}
      />
      <ExcelImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      {discountItem && <DiscountModal item={discountItem} onClose={() => setDiscountItem(null)} />}
    </div>
  );
}
