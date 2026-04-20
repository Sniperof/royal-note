import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  MessageCircleMore,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import PublicInquiryForm from "@/components/public/PublicInquiryForm";
import { usePublicRequest } from "@/context/PublicRequestContext";
import {
  buildMultiProductWhatsAppMessage,
  buildPublicWhatsAppUrl,
  publicWhatsAppTrackingUrl,
} from "@/lib/publicCatalog";
import { resolveStorageUrl } from "@/lib/storage";

function availabilityClasses(label: "available" | "limited" | "coming_soon" | "unavailable") {
  if (label === "available") return "bg-emerald-50 text-emerald-700";
  if (label === "limited") return "bg-amber-50 text-amber-700";
  if (label === "coming_soon") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

function trackWhatsAppClick(productId: number) {
  const url = publicWhatsAppTrackingUrl(productId);
  const body = JSON.stringify({});

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(url, blob);
    return;
  }

  void fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export default function PublicRequestPanel() {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { items, totalItems, removeItem, setQty, clear } = usePublicRequest();

  const whatsappHref = useMemo(
    () =>
      buildPublicWhatsAppUrl(
        buildMultiProductWhatsAppMessage(
          items.map((item) => ({
            brand: item.brand,
            product_name: item.product_name,
            qty: item.qty,
          })),
        ),
      ),
    [items],
  );

  if (items.length === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-700 bg-[#141c2f] px-4 py-4 shadow-2xl"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-3 rounded-2xl bg-emerald-500 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/25">
                <ShoppingBag className="h-5 w-5" />
                {items.length} product{items.length === 1 ? "" : "s"} ready
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{totalItems} total requested units</p>
                <p className="text-xs text-slate-300">Build one B2B request and send it in a few seconds.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={clear}
                className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-400 hover:bg-slate-800"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  setShowForm(false);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-900 transition hover:bg-slate-100"
              >
                Continue Request
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.08 }}
              className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[30px] border border-slate-200 bg-[#FAFAFA] shadow-2xl lg:left-1/2 lg:max-w-4xl lg:-translate-x-1/2"
            >
              <div className="border-b border-gray-200 bg-white px-5 py-4">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Public Request</p>
                      <h2 className="mt-1 text-lg font-bold text-slate-950">
                        {items.length} product{items.length === 1 ? "" : "s"} selected
                      </h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(88vh-80px)] overflow-y-auto px-4 py-4">
                <div className="mx-auto max-w-3xl">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{items.length} products in your request</p>
                      <p className="text-xs text-slate-500">{totalItems} total units</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => items.forEach((item) => trackWhatsAppClick(item.product_id))}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                      >
                        <MessageCircleMore className="h-4 w-4" />
                        Send via WhatsApp
                      </a>
                      <button
                        type="button"
                        onClick={() => setShowForm((current) => !current)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <FileText className="h-4 w-4" />
                        {showForm ? "Hide Request Form" : "Open Request Quote Form"}
                      </button>
                    </div>
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

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${availabilityClasses(item.availability_label)}`}>
                                {item.availability_label.replace("_", " ")}
                              </span>
                              <Link
                                href={`/catalog/${item.product_id}`}
                                className="text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                              >
                                View product
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

                  <AnimatePresence initial={false}>
                    {showForm ? (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        className="mt-5 pb-4"
                      >
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Request Quote Form
                        </div>
                        <PublicInquiryForm
                          items={items}
                          showWhatsAppCta={false}
                          onSuccess={() => {
                            clear();
                            setShowForm(false);
                            setOpen(false);
                          }}
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
