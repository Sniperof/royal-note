import { useState, useEffect, useRef } from "react";
import {
  ShoppingCart, Package, Plus, X, Upload, Download,
  CheckCircle2, Trash2, FileSpreadsheet, AlertCircle,
  ChevronRight, Truck, Search, PenLine,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface POItem {
  id?: number;
  inventory_id?: number | null;
  barcode: string;
  brand: string;
  name: string;
  main_category?: string;
  sub_category?: string;
  size?: string;
  concentration?: string;
  gender?: string;
  qty: number;
  unit_cost: number;
  is_available_to_order?: boolean;
  is_received?: boolean;
}

interface InventoryItem {
  id: number;
  barcode: string;
  brand: string;
  name: string;
  size?: string | null;
  concentration?: string | null;
  gender?: string | null;
  qty: number;
  cost_usd: string;
  sale_price_aed: string;
  thumbnail_path?: string | null;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number | null;
  supplier_name: string | null;
  status: "draft" | "confirmed" | "received" | "cancelled";
  order_date: string;
  shipping_cost: string;
  notes: string | null;
  items: POItem[];
  created_at: string;
  po_type: "regular" | "capital_injection" | "consignment";
  payment_method: "cash" | "credit";
}

interface Supplier {
  id: number;
  name: string;
  supplier_type?: "regular" | "capital_owner" | "consignment";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcTotals(items: POItem[], shippingCost: number) {
  const totalItemCost = items.reduce((s, i) => s + i.unit_cost * i.qty, 0);
  return items.map((item) => {
    const itemTotal = item.unit_cost * item.qty;
    const shippingShare = totalItemCost > 0 ? (itemTotal / totalItemCost) * shippingCost : 0;
    const landedUnit = item.unit_cost + (item.qty > 0 ? shippingShare / item.qty : 0);
    return { ...item, landedUnit, shippingShare };
  });
}

function totalCost(items: POItem[]) {
  return items.reduce((s, i) => s + i.unit_cost * i.qty, 0);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    received: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

// ─── Smart Item Adder ──────────────────────────────────────────────────────────

interface SmartItemAdderProps {
  inventory: InventoryItem[];
  onAdd: (item: POItem) => void;
}

function SmartItemAdder({ inventory, onAdd }: SmartItemAdderProps) {
  const [mode, setMode] = useState<"search" | "manual">("search");

  // Search mode state
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Manual mode state
  const [mBarcode, setMBarcode] = useState("");
  const [mBrand, setMBrand] = useState("");
  const [mName, setMName] = useState("");
  const [mSize, setMSize] = useState("");
  const [mQty, setMQty] = useState("");
  const [mCost, setMCost] = useState("");

  const filtered = query.trim().length > 0
    ? inventory.filter(p => {
        const q = query.toLowerCase();
        return (
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.name && p.name.toLowerCase().includes(q))
        );
      }).slice(0, 10)
    : inventory.slice(0, 10);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current && !searchRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setHighlightedIdx(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && highlightedIdx >= 0) {
      e.preventDefault();
      selectProduct(filtered[highlightedIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightedIdx(-1);
    }
  }

  function selectProduct(p: InventoryItem) {
    setSelected(p);
    setQuery("");
    setOpen(false);
    setHighlightedIdx(-1);
    // Pre-fill cost with the item's landed cost as a starting point
    setCost(Number(p.cost_usd ?? 0).toFixed(2));
  }

  function clearSelection() {
    setSelected(null);
    setQty("");
    setCost("");
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function handleAdd() {
    if (mode === "search") {
      if (!selected) return;
      const qNum = parseInt(qty);
      const cNum = parseFloat(cost);
      if (isNaN(qNum) || qNum <= 0 || isNaN(cNum) || cNum < 0) return;
      onAdd({
        inventory_id: selected.id,
        barcode: selected.barcode,
        brand: selected.brand,
        name: selected.name,
        size: selected.size ?? undefined,
        concentration: selected.concentration ?? undefined,
        gender: selected.gender ?? undefined,
        qty: qNum,
        unit_cost: cNum,
      });
      setSelected(null);
      setQty("");
      setCost("");
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      const qNum = parseInt(mQty);
      const cNum = parseFloat(mCost);
      if (!mBarcode || !mBrand || !mName || isNaN(qNum) || isNaN(cNum)) return;
      onAdd({ barcode: mBarcode, brand: mBrand, name: mName, size: mSize || undefined, qty: qNum, unit_cost: cNum });
      setMBarcode(""); setMBrand(""); setMName(""); setMSize(""); setMQty(""); setMCost("");
    }
  }

  const canAdd = mode === "search"
    ? (selected !== null && parseInt(qty) > 0 && parseFloat(cost) >= 0)
    : (!!mBarcode && !!mBrand && !!mName && parseInt(mQty) > 0 && parseFloat(mCost) >= 0);

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("search")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "search" ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          <Search className="w-3 h-3" /> From Inventory
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === "manual" ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          <PenLine className="w-3 h-3" /> New Product
        </button>
      </div>

      {mode === "search" ? (
        <div className="space-y-2">
          {/* Hint */}
          <p className="text-xs text-gray-400">↑↓ to navigate · Enter to select · Esc to close</p>

          {selected ? (
            /* Selected product card */
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200 border border-gray-100">
                {selected.thumbnail_path ? (
                  <img src={`${BASE_URL}/api/storage${selected.thumbnail_path}`} alt={selected.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-4 h-4 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{selected.brand} {selected.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs font-mono text-gray-400">{selected.barcode}</span>
                  {selected.size && <span className="text-xs text-gray-500">{selected.size}</span>}
                  {selected.concentration && <span className="text-xs text-gray-500">{selected.concentration}</span>}
                  <span className="text-xs text-gray-400">Stock: {selected.qty}</span>
                </div>
              </div>
              <button onClick={clearSelection} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Search input with dropdown */
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setOpen(true); setHighlightedIdx(-1); }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search by brand, name or barcode..."
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              {open && filtered.length > 0 && (
                <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto">
                  {filtered.map((p, idx) => {
                    const isHighlighted = idx === highlightedIdx;
                    return (
                      <button
                        key={p.id}
                        onClick={() => selectProduct(p)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0 text-left transition-colors ${isHighlighted ? "bg-gray-100" : "hover:bg-gray-50"}`}
                      >
                        {/* Thumbnail */}
                        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100">
                          {p.thumbnail_path ? (
                            <img src={`${BASE_URL}/api/storage${p.thumbnail_path}`} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-3.5 h-3.5 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{p.brand} {p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono text-gray-400">{p.barcode}</span>
                            {p.size && <span className="text-xs text-gray-500">{p.size}</span>}
                            {p.concentration && <span className="text-xs text-gray-500">{p.concentration}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold text-gray-700">${Number(p.cost_usd ?? 0).toFixed(2)}</p>
                          <p className="text-xs text-gray-400">Stock: {p.qty}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Qty + Cost row (only shown when a product is selected) */}
          {selected && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">Qty *</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                  autoFocus
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">Unit Cost (USD) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={e => setCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={!canAdd}
                className="flex items-center gap-1 px-4 py-2 bg-black text-white rounded-xl text-xs font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Manual entry (new product not in inventory) */
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Enter details for a product not yet in inventory</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { placeholder: "Barcode *", value: mBarcode, setter: setMBarcode },
              { placeholder: "Brand *", value: mBrand, setter: setMBrand },
              { placeholder: "Name *", value: mName, setter: setMName },
              { placeholder: "Size", value: mSize, setter: setMSize },
              { placeholder: "Qty *", value: mQty, setter: setMQty, type: "number" },
              { placeholder: "Cost USD *", value: mCost, setter: setMCost, type: "number" },
            ].map(({ placeholder, value, setter, type }) => (
              <input
                key={placeholder}
                type={type ?? "text"}
                placeholder={placeholder}
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-dashed border-gray-300 rounded-xl hover:border-gray-500 disabled:opacity-40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Excel Import (inline) ─────────────────────────────────────────────────────

const PO_REQUIRED_COLS = ["barcode", "brand", "name", "qty", "unit_cost"];
const PO_ALL_COLS = [...PO_REQUIRED_COLS, "main_category", "sub_category", "size", "concentration", "gender"];

const PO_CATEGORY_ALIASES: Record<string, string> = {
  perfume: "perfume", parfum: "perfume", fragrance: "perfume", fragrances: "perfume",
  makeup: "makeup", cosmetic: "makeup", cosmetics: "makeup",
  skin_care: "skin_care", skincare: "skin_care", "skin care": "skin_care",
};

const PO_HEADER_ALIASES: Record<string, string[]> = {
  barcode: ["barcode", "bar_code", "code", "product_code", "sku"],
  brand: ["brand", "brand_name", "manufacturer"],
  name: ["name", "product_name", "item_name", "title"],
  main_category: ["main_category", "category", "product_category"],
  sub_category: ["sub_category", "subcategory", "sub category", "product_type", "type"],
  size: ["size", "volume", "pack_size"],
  concentration: ["concentration", "variant", "shade"],
  gender: ["gender", "target_gender", "for"],
  qty: ["qty", "quantity", "stock"],
  unit_cost: ["unit_cost", "cost", "cost_usd", "cost_price", "buy_price", "purchase_price"],
};

function normalizeHeader(h: string) {
  return h.toLowerCase().trim().replace(/\s+/g, "_");
}

interface ExcelImportPanelProps {
  onImport: (rows: POItem[]) => void;
  onClose: () => void;
}

function ExcelImportPanel({ onImport, onClose }: ExcelImportPanelProps) {
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [rows, setRows] = useState<POItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      PO_ALL_COLS,
      ["BC001", "Dior", "Sauvage", 10, 45.00, "perfume", "men_fragrance", "100ml", "EDP", "For Men"],
      ["BC002", "Chanel", "No.5", 5, 60.00, "perfume", "women_fragrance", "50ml", "Parfum", "For Women"],
      ["BC003", "Huda Beauty", "Liquid Matte", 8, 18.00, "makeup", "lipstick", "4ml", "Bombshell", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Items");
    XLSX.writeFile(wb, "purchase_items_template.xlsx");
  };

  const parseFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const errs: string[] = [];
        const parsed: POItem[] = [];
        raw.forEach((row, idx) => {
          // Build a normalized source map from raw keys
          const normalizedSource: Record<string, string> = {};
          for (const k of Object.keys(row)) normalizedSource[normalizeHeader(k)] = String(row[k] ?? "").trim();
          // Resolve fields via aliases
          const norm: Record<string, string> = {};
          for (const [field, aliases] of Object.entries(PO_HEADER_ALIASES)) {
            for (const alias of aliases) {
              const val = normalizedSource[normalizeHeader(alias)];
              if (val !== undefined && val !== "") { norm[field] = val; break; }
            }
            if (!norm[field]) norm[field] = "";
          }
          const rowNum = idx + 2;
          const missing = PO_REQUIRED_COLS.filter((c) => !norm[c] && norm[c] !== "0");
          if (missing.length) { errs.push(`Row ${rowNum}: missing ${missing.join(", ")}`); return; }
          const qty = parseInt(norm.qty, 10);
          const unit_cost = parseFloat(norm.unit_cost);
          if (isNaN(qty)) { errs.push(`Row ${rowNum}: qty must be a number`); return; }
          if (isNaN(unit_cost)) { errs.push(`Row ${rowNum}: unit_cost must be a number`); return; }
          const rawCat = norm.main_category.toLowerCase().trim();
          const main_category = PO_CATEGORY_ALIASES[rawCat] ?? (rawCat || undefined);
          parsed.push({
            barcode: norm.barcode,
            brand: norm.brand,
            name: norm.name,
            main_category: main_category || undefined,
            sub_category: norm.sub_category || undefined,
            size: norm.size || undefined,
            concentration: norm.concentration || undefined,
            gender: norm.gender || undefined,
            qty,
            unit_cost,
          });
        });
        setRows(parsed);
        setErrors(errs);
        setStep("preview");
      } catch {
        setErrors(["Failed to parse file."]);
        setStep("preview");
      }
    };
    reader.readAsBinaryString(f);
  };

  return (
    <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-gray-900">Import from Excel</span>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>

      {step === "upload" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <p className="text-xs text-blue-700">Columns: <span className="font-mono">{PO_ALL_COLS.join(", ")}</span></p>
            <button onClick={downloadTemplate} className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-white border border-blue-200 px-2 py-1 rounded-lg">
              <Download className="w-3 h-3" /> Template
            </button>
          </div>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 hover:border-black rounded-xl p-8 flex flex-col items-center cursor-pointer transition-colors"
          >
            <Upload className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-700">Click to upload .xlsx / .xls</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-3">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.length} row(s) skipped</p>
              {errors.slice(0, 3).map((e, i) => <p key={i} className="text-xs text-red-600">• {e}</p>)}
            </div>
          )}
          {rows.length > 0 ? (
            <>
              <p className="text-xs text-gray-500">{rows.length} rows ready to add</p>
              <div className="border border-gray-100 rounded-lg overflow-auto max-h-48">
                <table className="w-full text-xs min-w-[650px]">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>{["Brand", "Name", "Category", "Subcategory", "Barcode", "Qty", "Unit Cost (USD)"].map(h => <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-medium">{r.brand}</td>
                        <td className="px-3 py-1.5 text-gray-600 max-w-[120px] truncate">{r.name}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.main_category || "-"}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.sub_category || "-"}</td>
                        <td className="px-3 py-1.5 font-mono text-gray-400">{r.barcode}</td>
                        <td className="px-3 py-1.5 text-right">{r.qty}</td>
                        <td className="px-3 py-1.5 text-right">${r.unit_cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between">
                <button onClick={() => { setStep("upload"); setRows([]); setErrors([]); }} className="text-xs text-gray-500 hover:text-gray-800">← Back</button>
                <button onClick={() => onImport(rows)} className="px-4 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800">Add {rows.length} Items</button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">No valid rows found.</p>
              <button onClick={() => setStep("upload")} className="text-xs text-blue-600 mt-1">Try again</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PurchasesPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showExcel, setShowExcel] = useState(false);

  // Create form state
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formShipping, setFormShipping] = useState("0");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<POItem[]>([]);
  const [formSaving, setFormSaving] = useState(false);
  const [formPaymentMethod, setFormPaymentMethod] = useState<"cash" | "credit">("cash");

  // Detail panel state
  const [detailShipping, setDetailShipping] = useState("0");
  const [detailNotes, setDetailNotes] = useState("");
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailShowExcel, setDetailShowExcel] = useState(false);

  const load = async () => {
    try {
      const [ordersRes, suppliersRes, inventoryRes] = await Promise.all([
        fetch("/api/purchases", { credentials: "include" }),
        fetch("/api/suppliers", { credentials: "include" }),
        fetch("/api/inventory", { credentials: "include" }),
      ]);
      setOrders(await ordersRes.json());
      setSuppliers(await suppliersRes.json());
      setInventory(await inventoryRes.json());
    } catch {
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setDetailShipping(selected.shipping_cost);
      setDetailNotes(selected.notes ?? "");
    }
  }, [selectedId]);

  // ── Stats ──
  const received = orders.filter((o) => o.status === "received");
  const drafts = orders.filter((o) => o.status === "draft");
  const confirmed = orders.filter((o) => o.status === "confirmed");
  // Only cash regular purchases count as actual cash spent
  const totalSpent = received
    .filter((o) => o.po_type === "regular" && o.payment_method === "cash")
    .reduce((s, o) => {
      const base = o.items.reduce((ss, i) => ss + i.unit_cost * i.qty, 0);
      return s + base + parseFloat(o.shipping_cost);
    }, 0);

  // ── Create PO ──
  const handleCreate = async () => {
    if (formItems.length === 0) { toast({ title: "Add at least one item", variant: "destructive" }); return; }
    setFormSaving(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supplier_id: formSupplierId ? parseInt(formSupplierId) : null,
          order_date: formDate,
          shipping_cost: parseFloat(formShipping) || 0,
          notes: formNotes || null,
          items: formItems,
          payment_method: formPaymentMethod,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const po = await res.json();
      setOrders((prev) => [po, ...prev]);
      setShowCreate(false);
      setFormItems([]);
      setFormSupplierId("");
      setFormShipping("0");
      setFormNotes("");
      setSelectedId(po.id);
      toast({ title: "Purchase order created" });
    } catch (e: any) {
      toast({ title: e.message ?? "Error", variant: "destructive" });
    } finally {
      setFormSaving(false);
    }
  };

  // ── Detail: update header ──
  const handleDetailSave = async () => {
    if (!selected) return;
    setDetailSaving(true);
    try {
      const res = await fetch(`/api/purchases/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ shipping_cost: parseFloat(detailShipping) || 0, notes: detailNotes || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally {
      setDetailSaving(false);
    }
  };

  // ── Detail: add item via SmartItemAdder ──
  const handleDetailAddItem = async (item: POItem) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/purchases/${selected.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: [item] }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => o.id === selected.id ? updated : o));
      toast({ title: "Item added" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  // ── Detail: import excel items ──
  const handleDetailExcelImport = async (rows: POItem[]) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/purchases/${selected.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: rows }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => o.id === selected.id ? updated : o));
      setDetailShowExcel(false);
      toast({ title: `${rows.length} items imported` });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  // ── Detail: remove item ──
  const handleDeleteItem = async (itemId: number) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/purchases/${selected.id}/items/${itemId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error);
      setOrders((prev) => prev.map((o) => o.id === selected.id ? { ...o, items: o.items.filter((i) => i.id !== itemId) } : o));
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  // ── Detail: confirm ──
  const handleConfirm = async () => {
    if (!selected) return;
    if (!confirm(`Confirm ${selected.po_number}? This commits the purchase. For credit POs, an accounts payable record will be created. Inventory quantities are updated when items are received.`)) return;
    try {
      const res = await fetch(`/api/purchases/${selected.id}/confirm`, { method: "PUT", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => o.id === selected.id ? updated : o));
      toast({ title: "Purchase order confirmed — mark items to display to wholesalers" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  // ── Detail: toggle item available to order ──
  const handleToggleAvailable = async (itemId: number) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/purchases/${selected.id}/items/${itemId}/toggle-available`, { method: "PUT", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error);
      const { is_available_to_order, inventory_id } = await res.json();
      setOrders((prev) => prev.map((o) =>
        o.id === selected.id
          ? { ...o, items: o.items.map((i) => i.id === itemId ? { ...i, is_available_to_order, inventory_id } : i) }
          : o
      ));
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  // ── Detail: receive single item ──
  const handleReceiveItem = async (itemId: number) => {
    if (!selected) return;
    if (!confirm("Mark this item as received? Its quantity will be added to inventory.")) return;
    try {
      const res = await fetch(`/api/purchases/${selected.id}/items/${itemId}/receive`, { method: "PUT", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => o.id === selected.id ? updated : o));
      toast({ title: "Item received — inventory updated" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  // ── Detail: receive ──
  const handleReceive = async () => {
    if (!selected) return;
    if (!confirm(`Mark ${selected.po_number} as received? This will update inventory quantities and costs.`)) return;
    try {
      const res = await fetch(`/api/purchases/${selected.id}/receive`, { method: "PUT", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => o.id === selected.id ? updated : o));
      toast({ title: "Purchase order received — inventory updated!" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  // ── Detail: delete PO ──
  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Delete ${selected.po_number}?`)) return;
    try {
      const res = await fetch(`/api/purchases/${selected.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error);
      setOrders((prev) => prev.filter((o) => o.id !== selected.id));
      setSelectedId(null);
      toast({ title: "Deleted" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const shippingNum = parseFloat(detailShipping) || 0;
  const itemsWithLanded = selected ? calcTotals(selected.items, shippingNum) : [];
  const grandTotal = selected ? totalCost(selected.items) + shippingNum : 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="flex-1 p-6 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage supplier purchases and landed costs</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setSelectedId(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> New PO
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Orders", value: orders.length, icon: ShoppingCart, color: "bg-gray-50" },
          { label: "Draft", value: drafts.length, icon: Package, color: "bg-yellow-50" },
          { label: "Confirmed", value: confirmed.length, icon: Truck, color: "bg-blue-50" },
          { label: "Received", value: received.length, icon: CheckCircle2, color: "bg-green-50" },
          { label: "Total Spent", value: `$${totalSpent.toFixed(2)}`, icon: ShoppingCart, color: "bg-gray-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`${color} rounded-2xl p-4`}>
            <Icon className="w-5 h-5 text-gray-400 mb-2" />
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">New Purchase Order</h2>
            <button onClick={() => setShowCreate(false)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"><X className="w-4 h-4" /></button>
          </div>

          {/* Header fields */}
          {(() => {
            const selectedSupplier = suppliers.find((s) => String(s.id) === formSupplierId);
            const supplierType = selectedSupplier?.supplier_type ?? "regular";
            const showPaymentMethod = supplierType === "regular";
            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Supplier</label>
                    <select value={formSupplierId} onChange={(e) => { setFormSupplierId(e.target.value); setFormPaymentMethod("cash"); }} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      <option value="">No supplier</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.supplier_type === "capital_owner" ? " ★" : s.supplier_type === "consignment" ? " ◆" : ""}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Order Date</label>
                    <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Shipping Cost (USD)</label>
                    <input type="number" min="0" step="0.01" value={formShipping} onChange={(e) => setFormShipping(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>

                {/* Payment Method (regular suppliers only) */}
                {showPaymentMethod && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1.5">Payment Method</label>
                    <div className="flex gap-3">
                      {(["cash", "credit"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setFormPaymentMethod(m)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${formPaymentMethod === m ? (m === "cash" ? "bg-green-600 text-white border-green-600" : "bg-amber-500 text-white border-amber-500") : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
                        >
                          {m === "cash" ? "كاش (Cash)" : "آجل (Credit / AP)"}
                        </button>
                      ))}
                    </div>
                    {formPaymentMethod === "credit" && (
                      <p className="text-xs text-amber-700 mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        سيُنشأ حساب دائن (AP) عند التأكيد — لن يُخصم من رصيد الكاش فوراً. يُعدَّل الرصيد النهائي عند الاستلام ليشمل تكلفة الشحن.
                      </p>
                    )}
                  </div>
                )}

                {/* Contextual info for capital_owner / consignment */}
                {supplierType === "capital_owner" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-xs text-amber-800 font-medium">★ هذا المورد هو صاحب رأس المال — البضاعة ستُسجَّل كحقن رأس مال عند الاستلام ولن تُنشئ مصروف شراء.</p>
                  </div>
                )}
                {supplierType === "consignment" && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <p className="text-xs text-violet-800 font-medium">◆ هذا مورد كونسينيمنت — المنتجات لن تدخل مستودعك ولا يوجد مصروف. يُنشأ حساب دائن عند البيع للتجار.</p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
                  <input type="text" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional notes" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
              </>
            );
          })()}

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</p>
              <button onClick={() => setShowExcel(!showExcel)} className="flex items-center gap-1 text-xs text-green-700 font-medium bg-green-50 border border-green-100 px-2.5 py-1 rounded-lg">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Import Excel
              </button>
            </div>

            {showExcel && (
              <ExcelImportPanel
                onImport={(rows) => { setFormItems((prev) => [...prev, ...rows]); setShowExcel(false); }}
                onClose={() => setShowExcel(false)}
              />
            )}

            {/* Smart Item Adder */}
            <SmartItemAdder
              inventory={inventory}
              onAdd={(item) => setFormItems((prev) => [...prev, item])}
            />

            {/* Items preview table */}
            {formItems.length > 0 && (
              <>
                <div className="border border-gray-100 rounded-xl overflow-auto">
                  <table className="w-full text-xs min-w-[560px]">
                    <thead className="bg-gray-50">
                      <tr>{["Product", "Barcode", "Qty", "Unit Cost", "Item Total", "Landed Cost/Unit", ""].map(h => <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {calcTotals(formItems, parseFloat(formShipping) || 0).map((item, i) => {
                        const invItem = inventory.find(p => p.barcode === item.barcode);
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100">
                                  {invItem?.thumbnail_path ? (
                                    <img src={`${BASE_URL}/api/storage${invItem.thumbnail_path}`} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="w-3 h-3 text-gray-300" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">{item.brand}</p>
                                  <p className="text-gray-500">{item.name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 font-mono text-gray-400">{item.barcode}</td>
                            <td className="px-3 py-2 text-right">{item.qty}</td>
                            <td className="px-3 py-2 text-right">${item.unit_cost.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">${(item.unit_cost * item.qty).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-green-700">${(item as any).landedUnit.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => setFormItems((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-100">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-500">Total</td>
                        <td />
                        <td className="px-3 py-2 text-right text-xs font-bold">${totalCost(formItems).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-blue-700">+${(parseFloat(formShipping) || 0).toFixed(2)} shipping</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-xs text-gray-500 text-right font-semibold">Grand Total: <span className="text-gray-900">${(totalCost(formItems) + (parseFloat(formShipping) || 0)).toFixed(2)}</span></p>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button onClick={handleCreate} disabled={formSaving || formItems.length === 0} className="px-5 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {formSaving ? "Saving..." : "Create Purchase Order"}
            </button>
          </div>
        </div>
      )}

      {/* Split view: list + detail */}
      <div className="flex gap-4">
        {/* PO List */}
        <div className={`${selected ? "hidden sm:flex sm:flex-col sm:w-72 lg:w-80 flex-shrink-0" : "flex flex-col w-full"} space-y-2`}>
          {orders.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
              <ShoppingCart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No purchase orders yet</p>
            </div>
          ) : (
            orders.map((po) => {
              const poTotal = po.items.reduce((s, i) => s + i.unit_cost * i.qty, 0) + parseFloat(po.shipping_cost);
              const isActive = po.id === selectedId;
              return (
                <button
                  key={po.id}
                  onClick={() => setSelectedId(isActive ? null : po.id)}
                  className={`w-full text-left bg-white border rounded-2xl p-4 transition-all ${isActive ? "border-gray-900 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-gray-900">{po.po_number}</p>
                        {po.po_type === "capital_injection" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">رأس مال</span>}
                        {po.po_type === "consignment" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">كونسينيمنت</span>}
                        {po.po_type === "regular" && po.payment_method === "credit" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">آجل</span>}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{po.supplier_name ?? "No supplier"}</p>
                    </div>
                    <StatusBadge status={po.status} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">{po.order_date} · {po.items.length} item{po.items.length !== 1 ? "s" : ""}</p>
                    <p className="text-sm font-bold text-gray-900">${poTotal.toFixed(2)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-5 space-y-5 min-w-0">
            {/* Detail header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedId(null)} className="sm:hidden text-gray-400 hover:text-gray-700"><ChevronRight className="w-4 h-4 rotate-180" /></button>
                  <h2 className="text-lg font-bold text-gray-900">{selected.po_number}</h2>
                  <StatusBadge status={selected.status} />
                  {selected.po_type === "capital_injection" && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">رأس مال</span>
                  )}
                  {selected.po_type === "consignment" && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">كونسينيمنت</span>
                  )}
                  {selected.po_type === "regular" && selected.payment_method === "credit" && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">آجل</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{selected.supplier_name ?? "No supplier"} · {selected.order_date}</p>
              </div>
              <div className="flex items-center gap-2">
                {selected.status === "draft" && (
                  <>
                    <button onClick={handleConfirm} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors">
                      <Truck className="w-3.5 h-3.5" /> Confirm
                    </button>
                    <button onClick={handleReceive} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 transition-colors">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Receive All
                    </button>
                    <button onClick={handleDelete} className="p-2 text-gray-300 hover:text-red-500 rounded-xl transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                {selected.status === "confirmed" && (
                  <>
                    <button onClick={handleReceive} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-semibold hover:bg-green-700 transition-colors">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Receive All
                    </button>
                    <button onClick={handleDelete} className="p-2 text-gray-300 hover:text-red-500 rounded-xl transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Editable header (draft or confirmed) */}
            {(selected.status === "draft" || selected.status === "confirmed") && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Shipping Cost (USD)</label>
                    <input type="number" min="0" step="0.01" value={detailShipping} onChange={(e) => setDetailShipping(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Notes</label>
                    <input type="text" value={detailNotes} onChange={(e) => setDetailNotes(e.target.value)} placeholder="Optional"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900" />
                  </div>
                </div>
                <button onClick={handleDetailSave} disabled={detailSaving} className="px-4 py-1.5 bg-gray-900 text-white rounded-xl text-xs font-medium hover:bg-gray-700 disabled:opacity-50">
                  {detailSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}

            {/* Items section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Items ({selected.items.length})</p>
                {(selected.status === "draft" || selected.status === "confirmed") && (
                  <button onClick={() => setDetailShowExcel(!detailShowExcel)} className="flex items-center gap-1 text-xs text-green-700 font-medium bg-green-50 border border-green-100 px-2.5 py-1 rounded-lg">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Import Excel
                  </button>
                )}
              </div>

              {detailShowExcel && (
                <ExcelImportPanel onImport={handleDetailExcelImport} onClose={() => setDetailShowExcel(false)} />
              )}

              {/* Smart Item Adder for detail panel */}
              {(selected.status === "draft" || selected.status === "confirmed") && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add Item</p>
                  <SmartItemAdder
                    inventory={inventory}
                    onAdd={handleDetailAddItem}
                  />
                </div>
              )}

              {/* Items table */}
              {itemsWithLanded.length > 0 ? (
                <div className="border border-gray-100 rounded-xl overflow-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead className="bg-gray-50">
                      <tr>
                        {[
                          "Product", "Barcode", "Size", "Qty", "Unit Cost", "Item Total", "Shipping Share", "Landed Cost/Unit",
                          ...(selected.status === "confirmed" ? ["Show to wholesalers", "Receive"] : []),
                          "",
                        ].map(h =>
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {itemsWithLanded.map((item: any) => {
                        const invItem = inventory.find(p => p.barcode === item.barcode);
                        return (
                          <tr key={item.id} className={`hover:bg-gray-50 ${item.is_received ? "bg-green-50/40" : item.is_available_to_order && selected.status === "confirmed" ? "bg-violet-50/40" : ""}`}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100">
                                  {invItem?.thumbnail_path ? (
                                    <img src={`${BASE_URL}/api/storage${invItem.thumbnail_path}`} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="w-3 h-3 text-gray-300" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{item.brand}</p>
                                  <p className="text-gray-500 max-w-[100px] truncate">{item.name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 font-mono text-gray-400">{item.barcode}</td>
                            <td className="px-3 py-2 text-gray-400">{item.size ?? "—"}</td>
                            <td className="px-3 py-2 text-right">{item.qty}</td>
                            <td className="px-3 py-2 text-right">${parseFloat(item.unit_cost).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">${(parseFloat(item.unit_cost) * item.qty).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-blue-600">+${item.shippingShare.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-bold text-green-700">${item.landedUnit.toFixed(2)}</td>
                            {selected.status === "confirmed" && (
                              <>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => item.id && handleToggleAvailable(item.id)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${item.is_available_to_order ? "bg-violet-600 text-white hover:bg-violet-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                                  >
                                    {item.is_available_to_order ? "Visible" : "Hidden"}
                                  </button>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {item.is_received ? (
                                    <span className="flex items-center gap-1 text-green-700 font-semibold text-xs">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Received
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => item.id && handleReceiveItem(item.id)}
                                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                                    >
                                      Receive
                                    </button>
                                  )}
                                </td>
                              </>
                            )}
                            <td className="px-3 py-2 text-right">
                              {(selected.status === "draft" || selected.status === "confirmed") && item.id && (
                                <button onClick={() => handleDeleteItem(item.id!)} className="text-gray-300 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-100">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-gray-500">Total</td>
                        <td className="px-3 py-2 text-right text-xs font-bold">${totalCost(selected.items).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-blue-600">+${shippingNum.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-gray-900">Grand: ${grandTotal.toFixed(2)}</td>
                        {selected.status === "confirmed" && <td />}
                        {selected.status === "confirmed" && <td />}
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                  <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">No items yet. Add from inventory or import from Excel.</p>
                </div>
              )}

              {/* Confirmed note */}
              {selected.status === "confirmed" && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-blue-800">Confirmed — goods still with supplier</p>
                  <p className="text-xs text-blue-600 mt-0.5">Toggle items to "Visible" to display them in the wholesaler catalog. Use "Receive" per item as goods arrive — or use the "Receive All" button in the header to receive the entire PO at once.</p>
                </div>
              )}

              {/* Received note */}
              {selected.status === "received" && (
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-green-800">Received — inventory updated</p>
                  <p className="text-xs text-green-600 mt-0.5">Landed costs (unit cost + shipping share) have been applied to inventory cost_usd for each product.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
