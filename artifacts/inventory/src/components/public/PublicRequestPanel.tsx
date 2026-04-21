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

function availabilityLabel(label: "available" | "limited" | "coming_soon" | "unavailable") {
  if (label === "available") return "bg-[#141413] text-white";
  if (label === "limited") return "bg-[#4D49BE] text-white";
  if (label === "coming_soon") return "bg-white text-[#141413] ring-1 ring-[#EEEEEE]";
  return "bg-[#F5F5F5] text-[#949494]";
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
    <div className="rn-public">
      <AnimatePresence>
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-40 bg-[#141413] px-4 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.2)]"
        >
          <div className="mx-auto flex max-w-[1200px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg bg-[#4D49BE] px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-white">
                <ShoppingBag className="h-4 w-4" />
                {items.length} product{items.length === 1 ? "" : "s"}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-white">{totalItems} requested units</p>
                <p className="text-[11px] text-white/60">Build one B2B request and send it in seconds.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={clear}
                className="rounded-lg border-[1.5px] border-white/25 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/80 transition hover:border-white/70 hover:text-white"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  setShowForm(false);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#141413] transition hover:bg-[#FAF9F5]"
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
              className="absolute inset-0 bg-[rgba(0,0,0,0.85)]"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.08 }}
              className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[20px] border border-[#EEEEEE] bg-[#FAF9F5] shadow-2xl lg:left-1/2 lg:max-w-4xl lg:-translate-x-1/2"
            >
              <div className="border-b border-[#EEEEEE] bg-white px-5 py-4">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#4D49BE]/10 text-[#4D49BE]">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="rn-label">Public Request</p>
                      <h2 className="rn-display mt-1 text-[20px] font-semibold text-[#141413]">
                        {items.length} product{items.length === 1 ? "" : "s"} selected
                      </h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-2 text-[#949494] transition hover:bg-[#F5F5F5] hover:text-[#141413]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(88vh-80px)] overflow-y-auto px-4 py-4">
                <div className="mx-auto max-w-3xl">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#EEEEEE] bg-white px-4 py-3">
                    <div>
                      <p className="text-[13px] font-semibold text-[#141413]">
                        {items.length} products in your request
                      </p>
                      <p className="text-[12px] text-[#949494]">{totalItems} total units</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => items.forEach((item) => trackWhatsAppClick(item.product_id))}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white transition hover:brightness-95"
                      >
                        <MessageCircleMore className="h-4 w-4" />
                        WhatsApp
                      </a>
                      <button
                        type="button"
                        onClick={() => setShowForm((current) => !current)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#141413] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-[#262626]"
                      >
                        <FileText className="h-4 w-4" />
                        {showForm ? "Hide Form" : "Request Quote"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.product_id}
                        className="rounded-[14px] border border-[#EEEEEE] bg-white p-4"
                      >
                        <div className="flex gap-3">
                          <div className="h-20 w-16 overflow-hidden rounded-lg bg-[#F5F5F5]">
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
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#949494]">
                                  {item.brand}
                                </p>
                                <p className="rn-display mt-1 text-[15px] font-semibold text-[#141413]">
                                  {item.product_name}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeItem(item.product_id)}
                                className="rounded-lg p-2 text-[#949494] transition hover:bg-[#FAF9F5] hover:text-[#141413]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                              <span
                                className={`rounded-full px-[10px] py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${availabilityLabel(item.availability_label)}`}
                              >
                                {item.availability_label.replace("_", " ")}
                              </span>
                              <Link
                                href={`/catalog/${item.product_id}`}
                                className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#141413] transition hover:text-[#4D49BE]"
                              >
                                View Product
                              </Link>
                            </div>

                            <div className="mt-3 inline-flex items-center rounded-lg border border-[#EEEEEE] bg-[#FAF9F5] p-1">
                              <button
                                type="button"
                                onClick={() => setQty(item.product_id, Math.max(1, item.qty - 1))}
                                className="rounded-md p-2 text-[#141413] transition hover:bg-white"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="min-w-10 text-center text-[13px] font-semibold text-[#141413]">
                                {item.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQty(item.product_id, item.qty + 1)}
                                className="rounded-md p-2 text-[#141413] transition hover:bg-white"
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
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#4D49BE]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4D49BE]">
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
    </div>
  );
}
