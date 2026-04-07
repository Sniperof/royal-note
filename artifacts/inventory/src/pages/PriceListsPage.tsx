import { useState, useRef, useEffect } from "react";
import {
  ListOrdered, Plus, X, Trash2, Package, Search, Edit2,
  Upload, FileSpreadsheet, Save, ChevronLeft,
  Eye, EyeOff, ShoppingCart, Check,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PLItem {
  id?: number;
  inventory_id?: number | null;
  supplier_id?: number;
  barcode?: string;
  brand: string;
  name: string;
  main_category?: string;
  sub_category?: string;
  size?: string;
  concentration?: string;
  gender?: string;
  offered_qty: number;
  cost_usd: number;
  suggested_sale_price_aed: number;
  availability_location?: string;
  notes?: string;
  show_in_catalog?: boolean;
  inv_qty?: number;
  inv_product_type?: string;
}

interface Supplier {
  id: number;
  name: string;
  supplier_type?: string;
  item_count?: number;
  total_offered_qty?: number;
  total_cost_value?: string;
}

interface InventoryItem {
  id: number;
  barcode: string;
  brand: string;
  name: string;
  size?: string | null;
  cost_usd: string;
  sale_price_aed: string;
  qty: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function margin(cost: number, price: number): number | null {
  if (cost <= 0 || price <= 0) return null;
  return ((price - cost) / cost) * 100;
}

function fmtMargin(m: number | null) {
  if (m === null) return "—";
  return `${m >= 0 ? "+" : ""}${m.toFixed(1)}%`;
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ─── Excel Import — shared helpers (same as inventory import) ─────────────────

const PL_CATEGORY_ALIASES: Record<string, string> = {
  perfume: "perfume",
  parfum: "perfume",
  fragrance: "perfume",
  fragrances: "perfume",
  makeup: "makeup",
  cosmetic: "makeup",
  cosmetics: "makeup",
  skin_care: "skin_care",
  skincare: "skin_care",
  "skin care": "skin_care",
};

const PL_HEADER_ALIASES: Record<string, string[]> = {
  barcode:                  ["barcode", "bar_code", "code", "product_code", "sku"],
  brand:                    ["brand", "brand_name", "manufacturer", "make"],
  name:                     ["name", "product_name", "item_name", "title"],
  main_category:            ["main_category", "category", "product_category"],
  sub_category:             ["sub_category", "subcategory", "sub category", "product_type", "type"],
  size:                     ["size", "volume", "pack_size", "capacity"],
  concentration:            ["concentration", "variant", "shade", "finish", "skin_type", "key_active", "active"],
  gender:                   ["gender", "target_gender", "for"],
  offered_qty:              ["offered_qty", "qty", "quantity", "offered_quantity"],
  cost_usd:                 ["cost_usd", "cost", "cost_price", "buy_price", "purchase_price"],
  suggested_sale_price_aed: ["suggested_sale_price_aed", "sale_price_aed", "sale_price", "price", "selling_price"],
  availability_location:    ["availability_location", "location", "available_location"],
  notes:                    ["notes", "note", "remarks"],
};

const PL_TEMPLATE_COLUMNS = [
  "barcode", "brand", "name", "main_category", "sub_category",
  "size", "concentration", "gender",
  "offered_qty", "cost_usd", "suggested_sale_price_aed",
  "availability_location", "notes",
];

function plNormalizeHeader(h: string) {
  return h.toLowerCase().trim().replace(/\s+/g, "_");
}

function plGetField(row: Record<string, string>, aliases: string[]) {
  for (const a of aliases) {
    const v = row[plNormalizeHeader(a)];
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

function plBuildRow(raw: Record<string, unknown>): Record<string, string> {
  const src: Record<string, string> = {};
  for (const k of Object.keys(raw)) src[plNormalizeHeader(k)] = String(raw[k] ?? "").trim();
  const out: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(PL_HEADER_ALIASES)) out[field] = plGetField(src, aliases);
  return out;
}

function plNormalizeCategory(raw: string): string {
  return PL_CATEGORY_ALIASES[raw.toLowerCase().trim()] ?? "perfume";
}

// ─── Excel Import Panel ────────────────────────────────────────────────────────

interface ExcelImportPanelProps {
  onImport: (rows: PLItem[]) => void;
  onClose: () => void;
}

function ExcelImportPanel({ onImport, onClose }: ExcelImportPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
        const errors: string[] = [];
        const rows: PLItem[] = [];

        raw.forEach((r: any, idx: number) => {
          const row = plBuildRow(r);
          if (!row.brand || !row.name) {
            errors.push(`Row ${idx + 2}: brand and name are required`);
            return;
          }
          const offeredQty = parseInt(row.offered_qty) || 0;
          const costUsd = parseFloat(row.cost_usd) || 0;
          rows.push({
            barcode: row.barcode || undefined,
            brand: row.brand,
            name: row.name,
            main_category: plNormalizeCategory(row.main_category || "perfume"),
            sub_category: row.sub_category || undefined,
            size: row.size || undefined,
            concentration: row.concentration || undefined,
            gender: row.gender || undefined,
            offered_qty: offeredQty,
            cost_usd: costUsd,
            suggested_sale_price_aed: parseFloat(row.suggested_sale_price_aed) || 0,
            availability_location: row.availability_location || undefined,
            notes: row.notes || undefined,
          });
        });

        if (rows.length === 0 && errors.length === 0) {
          toast({ title: "No valid rows found in file", variant: "destructive" });
          return;
        }
        if (errors.length > 0) {
          toast({ title: `${errors.length} rows skipped — missing brand/name`, variant: "destructive" });
        }
        onImport(rows);
        toast({ title: `${rows.length} rows parsed from Excel` });
      } catch {
        toast({ title: "Failed to parse Excel file", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      PL_TEMPLATE_COLUMNS,
      ["BAR001", "Dior", "Sauvage", "perfume", "men_fragrance", "100ml", "EDP", "male", 10, 45, 250, "Dubai", ""],
      ["BAR002", "Huda Beauty", "Liquid Matte", "makeup", "lipstick", "4ml", "Bombshell", "", 5, 18, 95, "Dubai", ""],
      ["BAR003", "CeraVe", "Foaming Cleanser", "skin_care", "cleanser", "236ml", "Oily Skin", "", 8, 11, 55, "Syria", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Price List");
    XLSX.writeFile(wb, "price_list_template.xlsx");
  }

  const required = ["brand", "name", "offered_qty", "cost_usd"];
  const optional = PL_TEMPLATE_COLUMNS.filter(c => !required.includes(c));

  return (
    <div className="border border-gray-200 bg-gray-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-gray-500" />
          <p className="text-sm font-semibold text-gray-700">Import from Excel</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Column legend */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          {required.map(c => (
            <span key={c} className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-gray-900 text-white">{c} *</span>
          ))}
          {optional.map(c => (
            <span key={c} className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{c}</span>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">
          * Required · <span className="font-mono">main_category</span> accepts: perfume · makeup · skin_care (and aliases like fragrance, cosmetics, skincare)
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-xs text-gray-600 font-medium border border-gray-300 bg-white rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
          <DownloadIcon className="w-3.5 h-3.5" /> Download Template
        </button>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-xs bg-gray-900 text-white font-medium rounded-lg px-3 py-1.5 hover:bg-gray-800 transition-colors">
          <Upload className="w-3.5 h-3.5" /> Upload Excel
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// ─── Smart Item Adder ──────────────────────────────────────────────────────────

interface SmartItemAdderProps {
  inventory: InventoryItem[];
  onAdd: (item: PLItem) => void;
}

function SmartItemAdder({ inventory, onAdd }: SmartItemAdderProps) {
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [location, setLocation] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Manual mode
  const [mBarcode, setMBarcode] = useState("");
  const [mBrand, setMBrand] = useState("");
  const [mName, setMName] = useState("");
  const [mSize, setMSize] = useState("");
  const [mQty, setMQty] = useState("");
  const [mCost, setMCost] = useState("");
  const [mPrice, setMPrice] = useState("");
  const [mLocation, setMLocation] = useState("");

  const filtered = query.trim().length > 0
    ? inventory.filter(p => {
        const q = query.toLowerCase();
        return (p.barcode?.toLowerCase().includes(q)) || (p.brand?.toLowerCase().includes(q)) || (p.name?.toLowerCase().includes(q));
      }).slice(0, 8)
    : inventory.slice(0, 8);

  function selectProduct(p: InventoryItem) {
    setSelected(p);
    setQuery("");
    setOpen(false);
    setCost(Number(p.cost_usd ?? 0).toFixed(2));
    setSalePrice(Number(p.sale_price_aed ?? 0).toFixed(2));
  }

  function handleAdd() {
    if (mode === "search") {
      if (!selected) return;
      const qNum = parseInt(qty);
      const cNum = parseFloat(cost);
      const pNum = parseFloat(salePrice);
      if (isNaN(qNum) || qNum <= 0 || isNaN(cNum)) return;
      onAdd({
        inventory_id: selected.id,
        barcode: selected.barcode,
        brand: selected.brand,
        name: selected.name,
        size: selected.size ?? undefined,
        offered_qty: qNum,
        cost_usd: cNum,
        suggested_sale_price_aed: isNaN(pNum) ? 0 : pNum,
        availability_location: location.trim() || undefined,
      });
      setSelected(null); setQty(""); setCost(""); setSalePrice(""); setLocation("");
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      const qNum = parseInt(mQty);
      const cNum = parseFloat(mCost);
      const pNum = parseFloat(mPrice);
      if (!mBrand || !mName || isNaN(qNum) || isNaN(cNum)) return;
      onAdd({
        barcode: mBarcode.trim() || undefined,
        brand: mBrand, name: mName, size: mSize || undefined,
        offered_qty: qNum, cost_usd: cNum,
        suggested_sale_price_aed: isNaN(pNum) ? 0 : pNum,
        availability_location: mLocation.trim() || undefined,
      });
      setMBarcode(""); setMBrand(""); setMName(""); setMSize(""); setMQty(""); setMCost(""); setMPrice(""); setMLocation("");
    }
  }

  const canAdd = mode === "search"
    ? (selected !== null && parseInt(qty) > 0 && parseFloat(cost) >= 0)
    : (!!mBrand && !!mName && parseInt(mQty) > 0 && parseFloat(mCost) >= 0);

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";
  const labelCls = "text-xs font-medium text-gray-500 block mb-1";

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["search", "manual"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {m === "search" ? "From Inventory" : "Manual Entry"}
          </button>
        ))}
      </div>

      {mode === "search" ? (
        <div className="space-y-3">
          {!selected ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder="Search by barcode, brand, or name…"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              />
              {open && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {filtered.map(p => (
                    <button key={p.id} onClick={() => selectProduct(p)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 text-sm flex items-center justify-between gap-3 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        <span className="font-medium text-gray-900 truncate">{p.brand}</span>
                        <span className="text-gray-500 truncate">{p.name}</span>
                        {p.size && <span className="text-gray-400 flex-shrink-0">{p.size}</span>}
                      </div>
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0">{p.barcode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{selected.brand} {selected.name}</p>
                <p className="text-xs text-gray-400 font-mono">{selected.barcode} {selected.size && `· ${selected.size}`}</p>
              </div>
              <button onClick={() => { setSelected(null); setQty(""); setCost(""); setSalePrice(""); }}
                className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {selected && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Offered Qty</label>
                <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)}
                  className={inputCls} placeholder="0" autoFocus />
              </div>
              <div>
                <label className={labelCls}>Cost (USD)</label>
                <input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)}
                  className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <label className={labelCls}>Sale Price (AED)</label>
                <input type="number" min="0" step="0.01" value={salePrice} onChange={e => setSalePrice(e.target.value)}
                  className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <label className={labelCls}>Location</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                  className={inputCls} placeholder="Dubai…" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Barcode</label>
            <input type="text" value={mBarcode} onChange={e => setMBarcode(e.target.value)} className={inputCls} placeholder="Optional" />
          </div>
          <div>
            <label className={labelCls}>Brand *</label>
            <input type="text" value={mBrand} onChange={e => setMBrand(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Name *</label>
            <input type="text" value={mName} onChange={e => setMName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Size</label>
            <input type="text" value={mSize} onChange={e => setMSize(e.target.value)} className={inputCls} placeholder="100ml" />
          </div>
          <div>
            <label className={labelCls}>Offered Qty *</label>
            <input type="number" min="0" value={mQty} onChange={e => setMQty(e.target.value)} className={inputCls} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>Cost (USD) *</label>
            <input type="number" min="0" step="0.01" value={mCost} onChange={e => setMCost(e.target.value)} className={inputCls} placeholder="0.00" />
          </div>
          <div>
            <label className={labelCls}>Sale Price (AED)</label>
            <input type="number" min="0" step="0.01" value={mPrice} onChange={e => setMPrice(e.target.value)} className={inputCls} placeholder="0.00" />
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <input type="text" value={mLocation} onChange={e => setMLocation(e.target.value)} className={inputCls} placeholder="Dubai…" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleAdd} disabled={!canAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 transition-colors">
          <Plus className="w-4 h-4" /> Add Item
        </button>
        {cost && salePrice && mode === "search" && selected && (() => {
          const m = margin(parseFloat(cost), parseFloat(salePrice));
          if (m === null) return null;
          return (
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${m >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              Margin: {fmtMargin(m)}
            </span>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Edit Row Inline ───────────────────────────────────────────────────────────

interface EditRowProps {
  item: PLItem;
  onSave: (updated: Partial<PLItem>) => void;
  onCancel: () => void;
}

function EditRow({ item, onSave, onCancel }: EditRowProps) {
  const [qty, setQty] = useState(String(item.offered_qty));
  const [cost, setCost] = useState(String(item.cost_usd));
  const [price, setPrice] = useState(String(item.suggested_sale_price_aed));
  const [location, setLocation] = useState(item.availability_location ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");

  const cellInput = "border border-indigo-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white";

  return (
    <tr className="bg-indigo-50/70 border-l-2 border-indigo-400">
      <td className="px-4 py-2.5">
        <div>
          <p className="font-semibold text-sm text-gray-900">{item.brand}</p>
          <p className="text-xs text-gray-500">{item.name}{item.size && ` · ${item.size}`}</p>
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-xs text-gray-400">{item.barcode ?? "—"}</td>
      <td className="px-3 py-2">
        <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} className={`w-20 ${cellInput}`} />
      </td>
      <td className="px-3 py-2">
        <input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} className={`w-24 ${cellInput}`} />
      </td>
      <td className="px-3 py-2">
        <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className={`w-24 ${cellInput}`} />
      </td>
      <td className="px-3 py-2 text-xs text-gray-400">—</td>
      <td className="px-3 py-2">
        <input type="text" value={location} onChange={e => setLocation(e.target.value)} className={`w-24 ${cellInput}`} placeholder="Dubai…" />
      </td>
      <td className="px-3 py-2">
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className={`w-28 ${cellInput}`} />
      </td>
      <td className="px-3 py-2" />{/* catalog — not editable in row mode */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSave({ offered_qty: parseInt(qty)||0, cost_usd: parseFloat(cost)||0, suggested_sale_price_aed: parseFloat(price)||0, availability_location: location||undefined, notes: notes||undefined })}
            className="p-1.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
            <Save className="w-3.5 h-3.5" />
          </button>
          <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-700 bg-white border border-gray-200 hover:border-gray-300 rounded-lg transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Supplier Card ─────────────────────────────────────────────────────────────

function SupplierCard({ s, isSelected, onClick }: { s: Supplier; isSelected: boolean; onClick: () => void }) {
  const hasItems = (s.item_count ?? 0) > 0;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl px-3.5 py-3 border transition-all group ${
        isSelected
          ? "border-gray-900 bg-gray-900 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-sm font-semibold truncate ${isSelected ? "text-white" : "text-gray-900"}`}>
          {s.name}
        </p>
        {hasItems && (
          <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
          }`}>
            {s.item_count}
          </span>
        )}
      </div>
      {hasItems ? (
        <p className={`text-xs mt-0.5 ${isSelected ? "text-gray-300" : "text-gray-400"}`}>
          {s.total_offered_qty} units
          {s.total_cost_value && parseFloat(s.total_cost_value) > 0
            ? ` · $${parseFloat(s.total_cost_value).toFixed(0)}`
            : ""}
        </p>
      ) : (
        <p className={`text-xs mt-0.5 ${isSelected ? "text-gray-400" : "text-gray-300"}`}>No items yet</p>
      )}
    </button>
  );
}

// ─── Convert to PO Modal ───────────────────────────────────────────────────────

interface ConvertToPOModalProps {
  item: PLItem;
  onConfirm: (qty: number, paymentMethod: string) => Promise<void>;
  onClose: () => void;
}

function ConvertToPOModal({ item, onConfirm, onClose }: ConvertToPOModalProps) {
  const [qty, setQty] = useState(String(item.offered_qty));
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">("cash");
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    const q = parseInt(qty);
    if (isNaN(q) || q <= 0) return;
    setSaving(true);
    await onConfirm(q, paymentMethod);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
              <ShoppingCart className="w-4.5 h-4.5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Convert to Purchase Order</p>
              <p className="text-xs text-gray-400">{item.supplier_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product info */}
        <div className="bg-gray-50 rounded-xl px-3.5 py-3">
          <p className="text-sm font-semibold text-gray-900">{item.brand} — {item.name}</p>
          {item.size && <p className="text-xs text-gray-500 mt-0.5">{item.size}</p>}
          <p className="text-xs text-gray-400 mt-1">Cost: <span className="font-semibold text-gray-700">${Number(item.cost_usd).toFixed(2)}</span></p>
        </div>

        {/* Qty */}
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1.5">Quantity to order</label>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={e => setQty(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900"
            autoFocus
          />
        </div>

        {/* Payment method */}
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1.5">Payment method</label>
          <div className="flex gap-2">
            {(["cash", "credit"] as const).map(m => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                  paymentMethod === m
                    ? "bg-gray-900 text-white border-gray-900"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {m === "cash" ? "Cash" : "Credit (Deferred)"}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-2.5">
          <p className="text-xs text-indigo-700">
            A new PO will be created in <span className="font-bold">pending</span> status for
            {" "}<span className="font-bold">{item.supplier_name}</span> with{" "}
            <span className="font-bold">{qty || "?"} × ${Number(item.cost_usd).toFixed(2)}</span>
            {" "}= <span className="font-bold">${((parseInt(qty) || 0) * Number(item.cost_usd)).toFixed(2)}</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !parseInt(qty) || parseInt(qty) <= 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            Create PO
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PriceListsPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [items, setItems] = useState<PLItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showExcel, setShowExcel] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [convertItem, setConvertItem] = useState<PLItem | null>(null);
  const [editingQtyId, setEditingQtyId] = useState<number | null>(null);
  const [editingQtyVal, setEditingQtyVal] = useState("");

  const load = async () => {
    try {
      const [supRes, invRes] = await Promise.all([
        fetch("/api/price-lists/by-supplier", { credentials: "include" }),
        fetch("/api/inventory", { credentials: "include" }),
      ]);
      const supData = await supRes.json();
      const allSupRes = await fetch("/api/suppliers", { credentials: "include" });
      const allSup: Supplier[] = await allSupRes.json();
      const enrichedIds = new Set(supData.map((s: Supplier) => s.supplier_id));
      const combined = [
        ...supData.map((s: any) => ({ id: s.supplier_id, name: s.supplier_name, supplier_type: s.supplier_type, item_count: s.item_count, total_offered_qty: s.total_offered_qty, total_cost_value: s.total_cost_value })),
        ...allSup.filter((s: any) => !enrichedIds.has(s.id)),
      ];
      setSuppliers(combined.sort((a, b) => a.name.localeCompare(b.name)));
      setAllInventory(await invRes.json());
    } catch {
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (supplierId: number) => {
    setItemsLoading(true);
    try {
      const res = await fetch(`/api/price-lists?supplier_id=${supplierId}`, { credentials: "include" });
      setItems(await res.json());
    } catch {
      toast({ title: "Error loading price list", variant: "destructive" });
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId) ?? null;

  function selectSupplier(id: number) {
    setSelectedSupplierId(id);
    setShowAdd(false);
    setShowExcel(false);
    setEditingId(null);
    setSearchQ("");
    loadItems(id);
  }

  const handleAddItem = async (item: PLItem) => {
    if (!selectedSupplierId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/price-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...item, supplier_id: selectedSupplierId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created = await res.json();
      setItems(prev => [...prev, created]);
      await load();
      toast({ title: "Item added" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleExcelImport = async (rows: PLItem[]) => {
    if (!selectedSupplierId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/price-lists/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ supplier_id: selectedSupplierId, items: rows }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { inserted } = await res.json();
      await loadItems(selectedSupplierId);
      await load();
      setShowExcel(false);
      toast({ title: `${inserted} items imported` });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (id: number, updates: Partial<PLItem>) => {
    try {
      const res = await fetch(`/api/price-lists/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
      setEditingId(null);
      toast({ title: "Updated" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this item from the price list?")) return;
    try {
      const res = await fetch(`/api/price-lists/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error);
      setItems(prev => prev.filter(i => i.id !== id));
      await load();
      toast({ title: "Removed" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const handleToggleCatalog = async (item: PLItem) => {
    try {
      const res = await fetch(`/api/price-lists/${item.id}/toggle-catalog`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { show_in_catalog } = await res.json();
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, show_in_catalog } : i));
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const handleConvertToPO = async (item: PLItem, qty: number, paymentMethod: string) => {
    try {
      const res = await fetch(`/api/price-lists/${item.id}/convert-to-po`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ qty, payment_method: paymentMethod }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { po_number } = await res.json();
      setConvertItem(null);
      toast({ title: `PO ${po_number} created`, description: "Go to Purchase Orders to confirm it." });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const handleSaveQty = async (item: PLItem) => {
    const q = parseInt(editingQtyVal);
    if (isNaN(q) || q < 0) { setEditingQtyId(null); return; }
    try {
      const res = await fetch(`/api/price-lists/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ offered_qty: q }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updated } : i));
      await load();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setEditingQtyId(null);
    }
  };

  const filteredItems = items.filter(i => {
    if (!searchQ.trim()) return true;
    const q = searchQ.toLowerCase();
    return (
      i.brand?.toLowerCase().includes(q) ||
      i.name?.toLowerCase().includes(q) ||
      i.barcode?.toLowerCase().includes(q) ||
      i.size?.toLowerCase().includes(q) ||
      i.availability_location?.toLowerCase().includes(q)
    );
  });

  const suppliersWithList = suppliers.filter(s => (s.item_count ?? 0) > 0);
  const suppliersWithout = suppliers.filter(s => !(s.item_count ?? 0));

  // Summary stats
  const totalItems = suppliersWithList.reduce((s, sup) => s + (sup.item_count ?? 0), 0);
  const totalUnits = suppliersWithList.reduce((s, sup) => s + (sup.total_offered_qty ?? 0), 0);
  const totalValue = suppliersWithList.reduce((s, sup) => s + parseFloat(sup.total_cost_value ?? "0"), 0);

  if (loading) {
    return (
      <main className="flex-1 p-6 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-h-0">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <ListOrdered className="w-4.5 h-4.5 text-gray-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Price Lists</h1>
                  <p className="text-xs text-gray-400 mt-0.5">Supplier offers · visible in catalog · no financial obligation</p>
                </div>
              </div>
            </div>

            {/* Summary stats */}
            {suppliersWithList.length > 0 && (
              <div className="hidden sm:flex items-center gap-4">
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{totalItems}</p>
                  <p className="text-[11px] text-gray-400">products</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{totalUnits.toLocaleString()}</p>
                  <p className="text-[11px] text-gray-400">units offered</p>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">${totalValue.toFixed(0)}</p>
                  <p className="text-[11px] text-gray-400">total cost value</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 max-w-7xl mx-auto w-full">
        {/* Supplier sidebar */}
        <aside className={`${selectedSupplierId ? "hidden sm:flex" : "flex"} flex-col w-64 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto`}>
          <div className="p-4 space-y-1.5">
            {suppliersWithList.length > 0 && (
              <>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 py-1">Active Lists</p>
                {suppliersWithList.map(s => (
                  <SupplierCard key={s.id} s={s} isSelected={selectedSupplierId === s.id} onClick={() => selectSupplier(s.id)} />
                ))}
              </>
            )}
            {suppliersWithout.length > 0 && (
              <>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 py-1 mt-3">Other Suppliers</p>
                {suppliersWithout.map(s => (
                  <SupplierCard key={s.id} s={s} isSelected={selectedSupplierId === s.id} onClick={() => selectSupplier(s.id)} />
                ))}
              </>
            )}
            {suppliers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-gray-400">No suppliers found</p>
              </div>
            )}
          </div>
        </aside>

        {/* Detail panel */}
        {selectedSupplierId && selectedSupplier ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Panel top bar */}
            <div className="bg-white border-b border-gray-200 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setSelectedSupplierId(null)}
                    className="sm:hidden p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-gray-900 truncate">{selectedSupplier.name}</h2>
                      {(selectedSupplier.item_count ?? 0) > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                          {selectedSupplier.item_count} items · {selectedSupplier.total_offered_qty} units
                        </span>
                      )}
                    </div>
                    {selectedSupplier.total_cost_value && parseFloat(selectedSupplier.total_cost_value) > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Total cost value: <span className="font-semibold text-gray-600">${parseFloat(selectedSupplier.total_cost_value).toFixed(2)}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setShowExcel(!showExcel); setShowAdd(false); }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${showExcel ? "bg-gray-100 border-gray-300 text-gray-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                  </button>
                  <button
                    onClick={() => { setShowAdd(!showAdd); setShowExcel(false); }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${showAdd ? "bg-gray-900 text-white" : "bg-gray-900 text-white hover:bg-gray-800"}`}>
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>
              </div>
            </div>

            {/* Expandable add / excel panels */}
            {(showAdd || showExcel) && (
              <div className="bg-gray-50 border-b border-gray-200 px-5 py-4">
                {showAdd && (
                  <SmartItemAdder
                    inventory={allInventory}
                    onAdd={item => { handleAddItem(item); setShowAdd(false); }}
                  />
                )}
                {showExcel && (
                  <ExcelImportPanel onImport={handleExcelImport} onClose={() => setShowExcel(false)} />
                )}
              </div>
            )}

            {/* Search bar */}
            {items.length > 5 && (
              <div className="bg-white border-b border-gray-100 px-5 py-3">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="Filter items…"
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                  />
                </div>
              </div>
            )}

            {/* Items table */}
            <div className="flex-1 overflow-auto">
              {itemsLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
                </div>
              ) : filteredItems.length > 0 ? (
                <table className="w-full text-xs min-w-[720px]">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-gray-500 font-semibold">Product</th>
                      <th className="px-3 py-3 text-left text-gray-500 font-semibold">Barcode</th>
                      <th className="px-3 py-3 text-right text-gray-500 font-semibold">Offered Qty</th>
                      <th className="px-3 py-3 text-right text-gray-500 font-semibold">Cost (USD)</th>
                      <th className="px-3 py-3 text-right text-gray-500 font-semibold">Sale Price (AED)</th>
                      <th className="px-3 py-3 text-right text-gray-500 font-semibold">Margin</th>
                      <th className="px-3 py-3 text-left text-gray-500 font-semibold">Location</th>
                      <th className="px-3 py-3 text-center text-gray-500 font-semibold">Catalog</th>
                      <th className="px-3 py-3 w-28" />
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredItems.map(item => {
                      if (editingId === item.id) {
                        return (
                          <EditRow key={item.id} item={item}
                            onSave={updates => handleSaveEdit(item.id!, updates)}
                            onCancel={() => setEditingId(null)} />
                        );
                      }
                      const m = margin(item.cost_usd, item.suggested_sale_price_aed);
                      const isOwned = item.inv_product_type === 'owned' && (item.inv_qty ?? 0) > 0;
                      return (
                        <tr key={item.id} className={`hover:bg-gray-50/80 transition-colors ${isOwned ? "bg-emerald-50/40" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Package className="w-3.5 h-3.5 text-gray-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-gray-900">{item.brand}</span>
                                  {isOwned && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
                                      In Stock ({item.inv_qty})
                                    </span>
                                  )}
                                  {item.inv_product_type === 'price_list_only' && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 flex-shrink-0">
                                      Catalog only
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-500 truncate max-w-[160px]">
                                  {item.name}{item.size && <span className="text-gray-400"> · {item.size}</span>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-mono text-gray-400">{item.barcode ?? "—"}</td>
                          {/* Offered Qty — inline editable */}
                          <td className="px-3 py-3 text-right">
                            {editingQtyId === item.id ? (
                              <input
                                type="number"
                                min="0"
                                value={editingQtyVal}
                                onChange={e => setEditingQtyVal(e.target.value)}
                                onBlur={() => handleSaveQty(item)}
                                onKeyDown={e => { if (e.key === "Enter") handleSaveQty(item); if (e.key === "Escape") setEditingQtyId(null); }}
                                className="w-20 border border-indigo-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                autoFocus
                              />
                            ) : (
                              <button
                                onClick={() => { setEditingQtyId(item.id!); setEditingQtyVal(String(item.offered_qty)); }}
                                className="font-bold text-gray-900 hover:text-indigo-600 hover:underline cursor-pointer tabular-nums"
                                title="Click to edit quantity"
                              >
                                {item.offered_qty}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-semibold text-gray-800">${Number(item.cost_usd).toFixed(2)}</span>
                          </td>
                          <td className="px-3 py-3 text-right text-gray-600">
                            {item.suggested_sale_price_aed > 0 ? `${Number(item.suggested_sale_price_aed).toFixed(2)} AED` : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className={`font-semibold ${m === null ? "text-gray-300" : m >= 30 ? "text-emerald-600" : m >= 0 ? "text-amber-600" : "text-red-600"}`}>
                              {fmtMargin(m)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-500">{item.availability_location ?? <span className="text-gray-300">—</span>}</td>
                          {/* Catalog toggle */}
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() => handleToggleCatalog(item)}
                              title={item.show_in_catalog !== false ? "Visible in catalog — click to hide" : "Hidden from catalog — click to show"}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                                item.show_in_catalog !== false
                                  ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                  : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                              }`}
                            >
                              {item.show_in_catalog !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                          {/* Actions */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setConvertItem(item)}
                                title="Convert to Purchase Order"
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditingId(item.id!)}
                                title="Edit"
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(item.id!)}
                                title="Delete"
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200 sticky bottom-0">
                    <tr>
                      <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-gray-500">
                        {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
                        {searchQ && ` · filtered`}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-900">
                        {filteredItems.reduce((s, i) => s + i.offered_qty, 0).toLocaleString()} units
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-900">
                        ${filteredItems.reduce((s, i) => s + i.cost_usd * i.offered_qty, 0).toFixed(2)}
                      </td>
                      <td colSpan={6} />
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[280px] text-center px-8">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <ListOrdered className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-500">No items in this price list</p>
                  <p className="text-xs text-gray-400 mt-1">Add items manually or import from Excel using the buttons above</p>
                  <button
                    onClick={() => setShowAdd(true)}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-gray-800 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add First Item
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-gray-50/50">
            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-5">
              <ListOrdered className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-base font-semibold text-gray-600">Select a supplier</p>
            <p className="text-sm text-gray-400 mt-1 max-w-xs">
              Choose a supplier from the left panel to view or manage their price list
            </p>
            {suppliersWithList.length > 0 && (
              <div className="mt-6 grid grid-cols-3 gap-3 max-w-xs">
                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
                  <p className="text-xl font-bold text-gray-900">{suppliersWithList.length}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">suppliers</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
                  <p className="text-xl font-bold text-gray-900">{totalItems}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">products</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
                  <p className="text-xl font-bold text-gray-900">{totalUnits.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">units</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Convert to PO Modal */}
      {convertItem && (
        <ConvertToPOModal
          item={convertItem}
          onConfirm={(qty, pm) => handleConvertToPO(convertItem, qty, pm)}
          onClose={() => setConvertItem(null)}
        />
      )}
    </main>
  );
}
