import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Trash2, Search, User, Calendar, FileText,
  Package, Loader2
} from "lucide-react";
import {
  getCustomers,
  getInventory,
  createInvoice,
} from "@workspace/api-client-react";
import type { InventoryItem } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Props { onClose: () => void; }

interface LineItem {
  tempId: string;
  inventory_id: number;
  barcode: string;
  brand: string;
  name: string;
  size: string;
  concentration: string;
  gender: string;
  cost_usd: number;
  max_qty: number;
  qty: number;
  unit_price_usd: number;
  thumbnail_path?: string | null;
}

const GENDER_MAP: Record<string, string> = {
  male: "Men", female: "Women", unisex: "Unisex",
  men: "Men", women: "Women",
  "for men": "Men", "for women": "Women",
};
function genderLabel(g: string | null | undefined) {
  if (!g) return "";
  return GENDER_MAP[g.toLowerCase()] ?? g;
}

export default function InvoiceForm({ onClose }: Props) {
  const [customerMode, setCustomerMode] = useState<"select" | "free">("select");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerFree, setCustomerFree] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

  const [productSearch, setProductSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => getCustomers(),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => getInventory(),
  });

  const filteredProducts = productSearch.trim().length > 0
    ? (inventory as InventoryItem[]).filter(p => {
        const q = productSearch.toLowerCase();
        return (
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.name && p.name.toLowerCase().includes(q))
        );
      }).slice(0, 10)
    : (inventory as InventoryItem[]).slice(0, 10);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen || filteredProducts.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, filteredProducts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0) {
        const product = filteredProducts[highlightedIndex];
        if (product && (product.qty ?? 0) > 0) addProduct(product);
      }
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  }

  function addProduct(product: InventoryItem) {
    if (!product.id) return;
    const existing = items.find(i => i.inventory_id === product.id);
    if (existing) {
      const newQty = Math.min(existing.qty + 1, product.qty ?? 999);
      setItems(prev => prev.map(i =>
        i.inventory_id === product.id ? { ...i, qty: newQty } : i
      ));
    } else {
      setItems(prev => [...prev, {
        tempId: `${product.id}-${Date.now()}`,
        inventory_id: product.id!,
        barcode: product.barcode ?? "",
        brand: product.brand ?? "",
        name: product.name ?? "",
        size: product.size ?? "",
        concentration: product.concentration ?? "",
        gender: product.gender ?? "",
        cost_usd: Number(product.cost_usd ?? 0),
        max_qty: product.qty ?? 999,
        qty: 1,
        unit_price_usd: Number(product.sale_price_aed ?? 0),
        thumbnail_path: (product as InventoryItem & { thumbnail_path?: string | null }).thumbnail_path ?? null,
      }]);
    }
    setProductSearch("");
    setDropdownOpen(false);
    setHighlightedIndex(-1);
    searchRef.current?.focus();
  }

  function removeItem(tempId: string) {
    setItems(prev => prev.filter(i => i.tempId !== tempId));
  }

  function updateItem(tempId: string, field: "qty" | "unit_price_usd", value: number) {
    setItems(prev => prev.map(i => {
      if (i.tempId !== tempId) return i;
      if (field === "qty") {
        const clamped = Math.max(1, Math.min(value, i.max_qty));
        return { ...i, qty: clamped };
      }
      return { ...i, [field]: value };
    }));
  }

  const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price_usd, 0);
  const total = Math.max(0, subtotal - discount);
  const totalCost = items.reduce((s, i) => s + i.qty * i.cost_usd, 0);
  const estimatedProfit = total - totalCost;

  const createMutation = useMutation({
    mutationFn: () => createInvoice({
      customer_id: customerMode === "select" ? customerId : null,
      customer_name: customerMode === "select"
        ? (customers.find(c => c.id === customerId)?.name ?? null)
        : (customerFree.trim() || null),
      date,
      discount: discount || null,
      notes: notes.trim() || null,
      items: items.map(i => ({
        inventory_id: i.inventory_id,
        qty: i.qty,
        unit_price_aed: i.unit_price_usd,
      })),
    }),
    onSuccess: () => onClose(),
  });

  const canSubmit = items.length > 0 && !createMutation.isPending;

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Sales Invoice</h1>
          <p className="text-sm text-gray-400 mt-0.5">Add products — quantities will be deducted from inventory automatically</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Info */}
        <div className="space-y-5">
          {/* Customer */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <User className="w-4 h-4" />
              <span>Customer</span>
            </div>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setCustomerMode("select")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${customerMode === "select" ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                From list
              </button>
              <button
                onClick={() => setCustomerMode("free")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${customerMode === "free" ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                Free text
              </button>
            </div>
            {customerMode === "select" ? (
              <select
                value={customerId ?? ""}
                onChange={e => setCustomerId(e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                <option value="">— Walk-in customer —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={customerFree}
                onChange={e => setCustomerFree(e.target.value)}
                placeholder="Customer name..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            )}
          </div>

          {/* Date */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Calendar className="w-4 h-4" />
              <span>Date</span>
            </div>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          {/* Notes */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <FileText className="w-4 h-4" />
              <span>Notes</span>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          {/* Totals Summary */}
          <div className="bg-black text-white rounded-2xl p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-white/60 flex-shrink-0">Discount</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-white/60">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount || ""}
                  onChange={e => setDiscount(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-20 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
            </div>
            <div className="border-t border-white/20 pt-3 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold">${total.toFixed(2)}</span>
            </div>
            {totalCost > 0 && (
              <div className="border-t border-white/10 pt-2 flex justify-between text-xs">
                <span className="text-white/50">Est. Profit</span>
                <span className={estimatedProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  ${estimatedProfit.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
            className="w-full py-3 bg-black text-white rounded-2xl font-semibold text-sm hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {createMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              "✓ Save Invoice"
            )}
          </button>
          {createMutation.isError && (
            <p className="text-rose-600 text-xs text-center">
              {(createMutation.error as Error).message}
            </p>
          )}
        </div>

        {/* Right — Products */}
        <div className="lg:col-span-2 space-y-5">
          {/* Search */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
              <Package className="w-4 h-4" />
              <span>Add Products</span>
              <span className="ml-auto text-xs text-gray-400 font-normal">↑↓ to navigate · Enter to add · Esc to close</span>
            </div>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setDropdownOpen(true);
                    setHighlightedIndex(-1);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search by brand, name or barcode..."
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
              {dropdownOpen && filteredProducts.length > 0 && (
                <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
                  {filteredProducts.map((product, idx) => {
                    const alreadyAdded = items.some(i => i.inventory_id === product.id);
                    const outOfStock = (product.qty ?? 0) === 0;
                    const isHighlighted = idx === highlightedIndex;
                    const thumb = (product as InventoryItem & { thumbnail_path?: string | null }).thumbnail_path;
                    return (
                      <button
                        key={product.id}
                        onClick={() => !outOfStock && addProduct(product)}
                        disabled={outOfStock}
                        className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 text-left transition-colors ${
                          outOfStock
                            ? "opacity-40 cursor-not-allowed"
                            : isHighlighted
                            ? "bg-gray-100"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100">
                          {thumb ? (
                            <img
                              src={`${BASE_URL}/api/storage${thumb}`}
                              alt={product.name ?? ""}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900 truncate">{product.brand} {product.name}</span>
                            {alreadyAdded && (
                              <span className="text-xs bg-black text-white rounded-full px-2 py-0.5 flex-shrink-0">Added</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {product.barcode && <span className="text-xs text-gray-400 font-mono">{product.barcode}</span>}
                            {(product.size || product.concentration) && (
                              <span className="text-xs text-gray-500">{product.size} {product.concentration}</span>
                            )}
                            {product.gender && <span className="text-xs text-violet-600">{genderLabel(product.gender)}</span>}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold text-gray-900">
                            ${Number(product.sale_price_aed ?? 0).toFixed(2)}
                          </div>
                          <div className={`text-xs ${outOfStock ? "text-rose-500 font-medium" : "text-gray-400"}`}>
                            {outOfStock ? "Out of stock" : `Stock: ${product.qty}`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Items List */}
          {items.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No products added yet</p>
              <p className="text-gray-400 text-xs mt-1">Search for a product above to add it</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Product</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 hidden sm:table-cell">Details</th>
                      <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500">Qty</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Unit Price</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Total</th>
                      <th className="py-3 px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const lineTotal = item.qty * item.unit_price_usd;
                      const profit = lineTotal - item.qty * item.cost_usd;
                      return (
                        <tr key={item.tempId} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              {/* Thumbnail in line item */}
                              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100 hidden sm:block">
                                {item.thumbnail_path ? (
                                  <img
                                    src={`${BASE_URL}/api/storage${item.thumbnail_path}`}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-4 h-4 text-gray-300" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900">{item.brand}</div>
                                <div className="text-xs text-gray-500 truncate max-w-[120px]">{item.name}</div>
                                {item.barcode && <div className="text-xs font-mono text-gray-400">{item.barcode}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 hidden sm:table-cell">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1 flex-wrap">
                                {item.size && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{item.size}</span>}
                                {item.concentration && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{item.concentration}</span>}
                              </div>
                              {item.gender && <span className="text-xs text-violet-600">{genderLabel(item.gender)}</span>}
                              {item.cost_usd > 0 && (
                                <span className={`text-xs ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                  Profit: ${profit.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => updateItem(item.tempId, "qty", item.qty - 1)}
                                className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center transition-colors"
                              >−</button>
                              <input
                                type="number"
                                min="1"
                                max={item.max_qty}
                                value={item.qty}
                                onChange={e => updateItem(item.tempId, "qty", Number(e.target.value))}
                                className="w-10 border border-gray-200 rounded-md px-1 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-black/20"
                              />
                              <button
                                onClick={() => updateItem(item.tempId, "qty", item.qty + 1)}
                                disabled={item.qty >= item.max_qty}
                                className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center transition-colors disabled:opacity-30"
                              >+</button>
                            </div>
                            <div className="text-center text-xs text-gray-400 mt-1">/ {item.max_qty}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-gray-500">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price_usd}
                                onChange={e => updateItem(item.tempId, "unit_price_usd", Number(e.target.value))}
                                className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                              />
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-gray-900 whitespace-nowrap">
                            ${lineTotal.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-3">
                            <button onClick={() => removeItem(item.tempId)} className="p-1.5 rounded-lg hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Footer totals */}
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-gray-500">{items.length} product{items.length !== 1 ? "s" : ""} · {items.reduce((s, i) => s + i.qty, 0)} units</span>
                <div className="text-sm font-semibold text-gray-900">
                  Subtotal: ${subtotal.toFixed(2)}
                  {discount > 0 && <span className="text-rose-600 font-medium ml-2">— discount ${discount.toFixed(2)}</span>}
                  {discount > 0 && <span className="text-emerald-700 ml-2">= ${total.toFixed(2)}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
