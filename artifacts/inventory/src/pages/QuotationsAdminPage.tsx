import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Package, X, Loader2, CheckCircle2, DollarSign, Send, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { resolveStorageUrl } from "@/lib/storage";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface QuotationItem {
  id: number;
  inventory_id: number;
  qty_requested: number;
  unit_price: string | null;
  brand: string;
  name: string;
  size: string | null;
  concentration: string | null;
  gender: string | null;
  thumbnail_path: string | null;
}

interface Quotation {
  id: number;
  ref_number: string;
  status: "pending" | "priced" | "sent" | "cancelled";
  trader_id: number;
  trader_name: string;
  trader_username: string;
  trader_phone: string | null;
  trader_notes: string | null;
  admin_notes: string | null;
  items_count: number;
  created_at: string;
  updated_at: string;
  items?: QuotationItem[];
}

const STATUS_CONFIG = {
  pending: { label: "Pending", badge: "bg-yellow-50 text-yellow-700 border-yellow-200", dot: "bg-yellow-400" },
  priced: { label: "Priced", badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  sent: { label: "Sent", badge: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  cancelled: { label: "Cancelled", badge: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-400" },
};

type StatusFilter = "all" | "pending" | "priced" | "sent" | "cancelled";

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildWhatsAppMessage(q: Quotation) {
  const items = q.items ?? [];
  const total = items.reduce((s, i) => s + (i.unit_price ? parseFloat(i.unit_price) * i.qty_requested : 0), 0);
  const lines = items.map((i, idx) => {
    const price = i.unit_price ? `$${parseFloat(i.unit_price).toFixed(2)} × ${i.qty_requested} = $${(parseFloat(i.unit_price) * i.qty_requested).toFixed(2)}` : "—";
    return `${idx + 1}. ${i.brand} ${i.name}${i.size ? ` (${i.size})` : ""}\n   ${price}`;
  }).join("\n");

  return `*Quotation ${q.ref_number}*\n📅 ${new Date(q.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}\n\nHello ${q.trader_name},\n\nHere is the pricing for your quotation request:\n\n${lines}\n\n*Total: $${total.toFixed(2)}*\n\n${q.admin_notes ? `Note: ${q.admin_notes}\n\n` : ""}Please confirm your order at your earliest convenience.`;
}

function buildPDF(q: Quotation) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const items = q.items ?? [];
  const total = items.reduce((s, i) => s + (i.unit_price ? parseFloat(i.unit_price) * i.qty_requested : 0), 0);

  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, 210, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.text("QUOTATION", 14, 18);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Royal Note", 14, 25);
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text(q.ref_number, 196, 14, { align: "right" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(new Date(q.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), 196, 21, { align: "right" });

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.text(`To: ${q.trader_name}`, 14, 50);
  doc.text(`Status: Priced`, 14, 57);

  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.4);
  doc.line(14, 64, 196, 64);

  autoTable(doc, {
    startY: 70,
    head: [["#", "Brand", "Product", "Size", "Type", "Qty", "Unit Price", "Total"]],
    body: items.map((item, idx) => [
      idx + 1,
      item.brand,
      item.name,
      item.size ?? "—",
      item.concentration ?? "—",
      item.qty_requested,
      item.unit_price ? `$${parseFloat(item.unit_price).toFixed(2)}` : "—",
      item.unit_price ? `$${(parseFloat(item.unit_price) * item.qty_requested).toFixed(2)}` : "—",
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 15, 15], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 0: { cellWidth: 8, halign: "center" }, 5: { halign: "center" }, 6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" } },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 140;
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 15, 15);
  doc.text(`Total: $${total.toFixed(2)}`, 196, finalY + 12, { align: "right" });
  if (q.admin_notes) {
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(130, 130, 130);
    doc.text(`Note: ${q.admin_notes}`, 14, finalY + 12);
  }
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.5);
  doc.rect(5, 5, 200, 287, "S");
  return doc;
}

// ── Pricing Modal ──────────────────────────────────────────────────────────────
function PricingModal({ quotation, onClose }: { quotation: Quotation; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [prices, setPrices] = useState<Record<number, string>>(
    Object.fromEntries((quotation.items ?? []).map((i) => [i.id, i.unit_price ?? ""]))
  );
  const [adminNotes, setAdminNotes] = useState(quotation.admin_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(quotation.status !== "pending");

  const items = quotation.items ?? [];
  const total = items.reduce((s, i) => {
    const p = parseFloat(prices[i.id] ?? "0") || 0;
    return s + p * i.qty_requested;
  }, 0);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/quotations/${quotation.id}/price`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_notes: adminNotes.trim() || undefined,
          items: items.map((i) => ({ id: i.id, unit_price: parseFloat(prices[i.id] ?? "0") || 0 })),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["admin-quotations"] });
      // Update local cache too
      Object.assign(quotation, { status: "priced", admin_notes: adminNotes });
      (quotation.items ?? []).forEach((i) => { i.unit_price = prices[i.id] ?? null; });
    } catch (e) {
      alert("Error saving prices. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: "sent" | "cancelled") {
    const res = await fetch(`${BASE_URL}/api/quotations/${quotation.id}/status`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["admin-quotations"] });
      onClose();
    }
  }

  function handleWhatsApp() {
    const msg = buildWhatsAppMessage({ ...quotation, items, admin_notes: adminNotes || quotation.admin_notes });
    const phone = quotation.trader_phone?.replace(/\D/g, "") ?? "";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function handleDownloadPDF() {
    const doc = buildPDF({ ...quotation, items, admin_notes: adminNotes || quotation.admin_notes });
    doc.save(`${quotation.ref_number}.pdf`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{quotation.ref_number}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${STATUS_CONFIG[quotation.status]?.badge}`}>
                {STATUS_CONFIG[quotation.status]?.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              From: {quotation.trader_name} {quotation.trader_phone && <span>· 📱 {quotation.trader_phone}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {quotation.trader_notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
              <span className="font-semibold">Trader note: </span>{quotation.trader_notes}
            </div>
          )}

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Set Prices</p>
          <div className="space-y-2 mb-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                {item.thumbnail_path ? (
                  <img src={resolveStorageUrl(item.thumbnail_path)} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{item.brand}</p>
                  <p className="text-xs text-gray-500">
                    {item.name}{item.size && ` · ${item.size}`}{item.concentration && ` · ${item.concentration}`}
                  </p>
                  <p className="text-xs text-gray-400">Qty requested: <strong>{item.qty_requested}</strong></p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-gray-400 font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prices[item.id] ?? ""}
                    onChange={(e) => setPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="0.00"
                    className="w-24 rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-right font-semibold outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                  />
                  {prices[item.id] && parseFloat(prices[item.id]) > 0 && (
                    <span className="text-xs text-gray-500 w-20 text-right">
                      = ${(parseFloat(prices[item.id]) * item.qty_requested).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="bg-gray-900 rounded-xl px-5 py-3 flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-200">Total</span>
            <span className="text-lg font-bold text-white">${total.toFixed(2)}</span>
          </div>

          {/* Admin notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Admin Notes</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              placeholder="Add notes for the trader (e.g. delivery terms, expiry date…)"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 resize-none"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-100 px-6 py-4">
          {!saved ? (
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => handleStatusChange("cancelled")}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-red-600 hover:bg-red-50 font-medium transition-all"
              >
                Cancel Quote
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-all disabled:opacity-50"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><DollarSign className="w-4 h-4" /> Save Pricing & Notify Trader</>}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Trader has been notified. You can now send the WhatsApp confirmation.
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
                >
                  <ClipboardList className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  onClick={handleWhatsApp}
                  disabled={!quotation.trader_phone}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: "#25D366" }}
                  title={!quotation.trader_phone ? "Trader has no phone number saved" : undefined}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white flex-shrink-0">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Send WhatsApp
                </button>
                {quotation.status !== "sent" && (
                  <button
                    onClick={() => handleStatusChange("sent")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Mark as Sent
                  </button>
                )}
              </div>
              {!quotation.trader_phone && (
                <p className="text-xs text-red-500 text-right">No phone number saved for this trader. Add it in User Management.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function QuotationsAdminPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, Quotation>>({});

  const { data: quotations = [], isLoading } = useQuery<Quotation[]>({
    queryKey: ["admin-quotations"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/quotations`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    refetchInterval: 30000,
  });

  async function openDetail(q: Quotation) {
    if (detailCache[q.id]) {
      setSelectedId(q.id);
      return;
    }
    const res = await fetch(`${BASE_URL}/api/quotations/${q.id}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json() as Quotation;
      setDetailCache((prev) => ({ ...prev, [data.id]: data }));
      setSelectedId(data.id);
    }
  }

  const filtered = statusFilter === "all" ? quotations : quotations.filter((q) => q.status === statusFilter);
  const pendingCount = quotations.filter((q) => q.status === "pending").length;

  const TABS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
    { value: "priced", label: "Priced" },
    { value: "sent", label: "Sent" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const selectedQuotation = selectedId ? detailCache[selectedId] : null;

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quotations</h1>
          <p className="text-sm text-gray-400">{quotations.length} total · {pendingCount} pending pricing</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 mb-5 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              statusFilter === t.value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <ClipboardList className="w-10 h-10 text-gray-200 mb-3" />
          <p className="text-gray-400">No quotations in this category</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((q) => {
          const cfg = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.pending;
          return (
            <motion.div
              key={q.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl border shadow-[0_2px_12px_rgb(0,0,0,0.04)] overflow-hidden cursor-pointer hover:shadow-md transition-all ${
                q.status === "pending" ? "border-yellow-200" : "border-gray-100"
              }`}
              onClick={() => openDetail(q)}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 font-mono">{q.ref_number}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${cfg.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="font-medium text-gray-700">{q.trader_name}</span>
                    {q.trader_phone && <span className="text-gray-400 ml-2">· {q.trader_phone}</span>}
                    <span className="text-gray-300 mx-1">·</span>
                    {q.items_count} item{q.items_count !== 1 ? "s" : ""}
                    <span className="text-gray-300 mx-1">·</span>
                    {timeAgo(q.created_at)}
                  </p>
                  {q.trader_notes && (
                    <p className="text-xs text-amber-700 mt-1 truncate max-w-md">
                      📝 {q.trader_notes}
                    </p>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {selectedQuotation && (
        <PricingModal
          quotation={selectedQuotation}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
