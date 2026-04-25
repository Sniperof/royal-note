import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  MessageCircleMore,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { usePublicRequest } from "@/context/PublicRequestContext";
import {
  buildMultiProductWhatsAppMessage,
  buildPublicWhatsAppUrl,
  publicInquiryUrl,
  publicWhatsAppTrackingUrl,
  type PublicInquiryItemPayload,
} from "@/lib/publicCatalog";

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

function genderLabel(g: string | null | undefined) {
  if (!g) return "";
  const map: Record<string, string> = {
    men: "Men",
    male: "Men",
    "for men": "Men",
    women: "Women",
    female: "Women",
    "for women": "Women",
    unisex: "Unisex",
  };
  return map[g.toLowerCase()] ?? g;
}

function itemMeta(item: {
  size: string | null;
  concentration: string | null;
  gender: string | null;
}) {
  return [item.size, item.concentration, genderLabel(item.gender)].filter(Boolean).join(" · ");
}

type PanelStep = "summary" | "form" | "success";

const labelClass = "text-xs font-semibold text-gray-400 uppercase tracking-wider";
const inputClass =
  "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10";

export default function PublicRequestPanel() {
  const [step, setStep] = useState<PanelStep>("summary");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const {
    items,
    totalItems,
    removeItem,
    setQty,
    clear,
    requestPanelOpen,
    openRequestPanel,
    closeRequestPanel,
  } = usePublicRequest();

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

  const payloadItems: PublicInquiryItemPayload[] = useMemo(
    () =>
      items.map((item) => ({
        product_id: item.product_id,
        qty: item.qty,
      })),
    [items],
  );

  const inquiryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(publicInquiryUrl(), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
          company_name: companyName.trim() || undefined,
          contact_name: contactName.trim(),
          whatsapp: whatsapp.trim(),
          email: email.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to send inquiry");
      }

      return res.json();
    },
    onSuccess: () => {
      setStep("success");
    },
  });

  function resetFormState() {
    setCompanyName("");
    setContactName("");
    setWhatsapp("");
    setEmail("");
    setNotes("");
    setStep("summary");
    inquiryMutation.reset();
  }

  function closePanel() {
    closeRequestPanel();
    resetFormState();
  }

  function completeAndClose() {
    clear();
    closePanel();
  }

  useEffect(() => {
    if (requestPanelOpen && items.length === 0) {
      closePanel();
    }
  }, [items.length, requestPanelOpen]);

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
                  openRequestPanel();
                  setStep("summary");
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
        {requestPanelOpen ? (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={step === "success" ? completeAndClose : closePanel}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", duration: 0.42, bounce: 0.06 }}
              className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl lg:inset-x-auto lg:right-auto lg:bottom-6 lg:left-1/2 lg:w-full lg:max-w-xl lg:-translate-x-1/2 lg:rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                    {step === "success" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <ClipboardList className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {step === "success" ? "Request Submitted" : "Request Quotation"}
                    </h2>
                    <p className="text-xs text-gray-400">
                      {step === "success"
                        ? "We received your public catalogue request"
                        : `${items.length} product${items.length !== 1 ? "s" : ""} selected`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={step === "success" ? completeAndClose : closePanel}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {step === "success" ? (
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Request Submitted</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                    Your quotation request was sent successfully. Royal Note will contact you soon with availability and commercial details.
                  </p>
                  <div className="mt-6 flex gap-2">
                    <button
                      type="button"
                      onClick={completeAndClose}
                      className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="max-h-[calc(92vh-148px)] overflow-y-auto px-6 py-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Selected Products
                    </p>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.product_id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900">{item.brand}</p>
                            <p className="truncate text-xs text-gray-500">
                              {item.product_name}
                              {itemMeta(item) ? <span className="ml-1">· {itemMeta(item)}</span> : null}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setQty(item.product_id, Math.max(1, item.qty - 1))}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-200"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-gray-900">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => setQty(item.product_id, item.qty + 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-200"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItem(item.product_id)}
                              className="ml-1 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4">
                      <label className={`mb-2 block ${labelClass}`}>
                        Notes (optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={2}
                        placeholder="Any special requirements or notes for this request..."
                        className={`${inputClass} resize-none`}
                      />
                    </div>

                    <AnimatePresence initial={false}>
                      {step === "form" ? (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="space-y-3 pt-4"
                        >
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="block">
                              <span className={labelClass}>Company Name</span>
                              <input
                                value={companyName}
                                onChange={(event) => setCompanyName(event.target.value)}
                                placeholder="e.g. Maison Parfums Ltd"
                                className={`${inputClass} mt-2`}
                              />
                            </label>
                            <label className="block">
                              <span className={labelClass}>Contact Name</span>
                              <input
                                value={contactName}
                                onChange={(event) => setContactName(event.target.value)}
                                placeholder="Your full name"
                                className={`${inputClass} mt-2`}
                                required
                              />
                            </label>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="block">
                              <span className={labelClass}>WhatsApp</span>
                              <input
                                value={whatsapp}
                                onChange={(event) => setWhatsapp(event.target.value)}
                                placeholder="+XX XXX XXX XXXX"
                                className={`${inputClass} mt-2`}
                                required
                              />
                            </label>
                            <label className="block">
                              <span className={labelClass}>Email</span>
                              <input
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="trade@example.com"
                                type="email"
                                className={`${inputClass} mt-2`}
                              />
                            </label>
                          </div>

                          {inquiryMutation.isError ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                              {inquiryMutation.error instanceof Error
                                ? inquiryMutation.error.message
                                : "Failed to send inquiry"}
                            </div>
                          ) : null}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  <div className="border-t border-gray-100 px-6 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-400">
                        {totalItems} total units · {items.length} products
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {step === "summary" ? (
                          <>
                            <button
                              type="button"
                              onClick={closePanel}
                              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <a
                              href={whatsappHref}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => items.forEach((item) => trackWhatsAppClick(item.product_id))}
                              className="inline-flex items-center gap-2 rounded-xl border border-[#25D366]/30 bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                            >
                              <MessageCircleMore className="h-4 w-4" />
                              WhatsApp
                            </a>
                            <button
                              type="button"
                              onClick={() => setStep("form")}
                              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700"
                            >
                              <FileText className="h-4 w-4" />
                              Continue
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                inquiryMutation.reset();
                                setStep("summary");
                              }}
                              disabled={inquiryMutation.isPending}
                              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                            >
                              Back
                            </button>
                            <button
                              type="button"
                              onClick={() => inquiryMutation.mutate()}
                              disabled={
                                inquiryMutation.isPending ||
                                payloadItems.length === 0 ||
                                !contactName.trim() ||
                                !whatsapp.trim()
                              }
                              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50"
                            >
                              {inquiryMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Submitting...
                                </>
                              ) : (
                                <>
                                  <FileText className="h-4 w-4" />
                                  Submit Request
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
