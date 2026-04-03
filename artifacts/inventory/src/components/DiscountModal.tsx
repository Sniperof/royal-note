import { useState } from "react";
import { X, Tag, Loader2, Trash2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface DiscountModalProps {
  item: {
    id: number;
    brand: string;
    name: string;
    size?: string | null;
    discount_percent?: number | null;
  };
  onClose: () => void;
}

const QUICK_VALUES = [5, 10, 15, 20, 25, 30, 50];

export default function DiscountModal({ item, onClose }: DiscountModalProps) {
  const queryClient = useQueryClient();
  const currentDiscount = item.discount_percent ? Number(item.discount_percent) : null;
  const [value, setValue] = useState<string>(currentDiscount ? String(currentDiscount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(discountVal: number | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/inventory/${item.id}/discount`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount_percent: discountVal }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to save");
      }
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    const num = parseFloat(value);
    if (value === "" || isNaN(num) || num <= 0) {
      setError("Please enter a valid discount percentage (e.g. 10)");
      return;
    }
    if (num > 100) {
      setError("Discount cannot exceed 100%");
      return;
    }
    save(Math.round(num * 100) / 100);
  }

  function handleClear() {
    save(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Set Discount</p>
              <p className="text-xs text-gray-400 truncate max-w-[200px]">
                {item.brand} — {item.name}{item.size ? ` (${item.size})` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          {/* Quick picks */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Quick Select</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {QUICK_VALUES.map((v) => (
              <button
                key={v}
                onClick={() => setValue(String(v))}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                  value === String(v)
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-gray-50 text-gray-700 border-gray-200 hover:border-amber-300 hover:text-amber-700"
                }`}
              >
                {v}%
              </button>
            ))}
          </div>

          {/* Custom input */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Custom %</p>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(null); }}
                placeholder="e.g. 15"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 transition-all pr-8"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">%</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {/* Info */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4 flex gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              All wholesale traders will receive an instant notification and the product row will appear highlighted in <strong>gold</strong> in their catalog.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center gap-2">
          {currentDiscount && (
            <button
              onClick={handleClear}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove Discount
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !value}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-all disabled:opacity-50 shadow-md shadow-amber-200"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
            {saving ? "Saving…" : "Apply & Notify"}
          </button>
        </div>
      </div>
    </div>
  );
}
