import { useState } from "react";
import { X, FileText, Loader2, CheckCircle2, Minus, Plus, ClipboardList } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export interface QuoteItem {
  id: number;
  brand: string;
  name: string;
  size: string | null;
  concentration: string | null;
  gender: string | null;
  description?: string | null;
}

interface QuotationModalProps {
  items: QuoteItem[];
  onClose: () => void;
}

function genderLabel(g: string | null | undefined) {
  if (!g) return "";
  const map: Record<string, string> = {
    men: "Men", male: "Men", "for men": "Men",
    women: "Women", female: "Women", "for women": "Women",
    unisex: "Unisex",
  };
  return map[g.toLowerCase()] ?? g;
}

export default function QuotationModal({ items, onClose }: QuotationModalProps) {
  const queryClient = useQueryClient();
  const [qtys, setQtys] = useState<Record<number, number>>(
    Object.fromEntries(items.map((i) => [i.id, 1]))
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ refNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function adjustQty(id: number, delta: number) {
    setQtys((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] ?? 1) + delta) }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/quotations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.trim() || undefined,
          items: items.map((item) => ({
            inventory_id: item.id,
            qty_requested: qtys[item.id] ?? 1,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to submit");
      }
      const data = await res.json() as { ref_number: string };
      setSubmitted({ refNumber: data.ref_number });
      queryClient.invalidateQueries({ queryKey: ["my-quotations"] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Request Quotation</h2>
              <p className="text-xs text-gray-400">{items.length} product{items.length !== 1 ? "s" : ""} selected</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success state */}
        {submitted ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Request Submitted!</h3>
            <p className="text-gray-500 mb-4">
              Your quotation request has been sent to the admin for pricing.
            </p>
            <div className="bg-gray-50 rounded-2xl px-6 py-4 mb-6 inline-block">
              <p className="text-xs text-gray-400 mb-1">Reference Number</p>
              <p className="text-xl font-bold text-gray-900 font-mono">{submitted.refNumber}</p>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              You'll receive a notification once the admin has reviewed and priced your request.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Items list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Selected Products</p>
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{item.brand}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.name}
                      {item.size && <span className="ml-1">· {item.size}</span>}
                      {item.concentration && <span className="ml-1">· {item.concentration}</span>}
                      {item.gender && <span className="ml-1">· {genderLabel(item.gender)}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => adjustQty(item.id, -1)}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-gray-900">
                      {qtys[item.id] ?? 1}
                    </span>
                    <button
                      onClick={() => adjustQty(item.id, 1)}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Notes */}
              <div className="pt-3">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any special requirements or notes for this request…"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-gray-400">
                  {Object.values(qtys).reduce((s, q) => s + q, 0)} total units · {items.length} products
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    disabled={submitting}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-all disabled:opacity-50"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    ) : (
                      <><FileText className="w-4 h-4" /> Submit Request</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
