import { useState } from "react";
import { Link } from "wouter";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import PublicInquiryForm from "@/components/public/PublicInquiryForm";
import { usePublicRequest } from "@/context/PublicRequestContext";
import { resolveStorageUrl } from "@/lib/storage";

function availabilityClasses(label: "available" | "limited" | "coming_soon" | "unavailable") {
  if (label === "available") return "bg-emerald-50 text-emerald-700";
  if (label === "limited") return "bg-amber-50 text-amber-700";
  if (label === "coming_soon") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

export default function PublicRequestPanel() {
  const [open, setOpen] = useState(false);
  const { items, totalItems, removeItem, setQty, clear } = usePublicRequest();

  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(15,23,42,0.24)] transition hover:bg-slate-800"
      >
        <ShoppingBag className="h-4 w-4" />
        Request List
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{totalItems}</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[28px] border border-slate-200 bg-[#FAFAFA] shadow-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[520px] lg:rounded-none lg:rounded-l-[28px]">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Public Request</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">Selected products</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(88vh-72px)] overflow-y-auto px-4 py-4 lg:max-h-screen">
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{items.length} product{items.length === 1 ? "" : "s"} selected</p>
                  <p className="text-xs text-slate-500">{totalItems} total requested units</p>
                </div>
                <button
                  type="button"
                  onClick={clear}
                  className="text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.product_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex gap-3">
                      <div className="h-20 w-16 overflow-hidden rounded-2xl bg-slate-100">
                        {item.thumbnail_path ? (
                          <img
                            src={resolveStorageUrl(item.thumbnail_path)}
                            alt={item.product_name}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{item.brand}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-950">{item.product_name}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.product_id)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${availabilityClasses(item.availability_label)}`}>
                            {item.availability_label.replace("_", " ")}
                          </span>
                          <Link
                            href={`/catalog/${item.product_id}`}
                            className="text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                          >
                            View
                          </Link>
                        </div>

                        <div className="mt-3 inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1">
                          <button
                            type="button"
                            onClick={() => setQty(item.product_id, Math.max(1, item.qty - 1))}
                            className="rounded-xl p-2 text-slate-600 transition hover:bg-white hover:text-slate-900"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-10 text-center text-sm font-semibold text-slate-900">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => setQty(item.product_id, item.qty + 1)}
                            className="rounded-xl p-2 text-slate-600 transition hover:bg-white hover:text-slate-900"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pb-4">
                <PublicInquiryForm
                  items={items}
                  onSuccess={() => {
                    clear();
                    setOpen(false);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
