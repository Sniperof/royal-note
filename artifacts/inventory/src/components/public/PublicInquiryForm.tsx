import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, MessageCircleMore, Send } from "lucide-react";
import {
  buildPublicWhatsAppUrl,
  buildMultiProductWhatsAppMessage,
  publicInquiryUrl,
  publicWhatsAppTrackingUrl,
  type PublicInquiryItemPayload,
  type PublicProduct,
} from "@/lib/publicCatalog";

function buildWhatsAppUrl(product: PublicProduct) {
  return buildPublicWhatsAppUrl(`Hello Royal Note, I want a B2B quote for ${product.brand} ${product.name}.`);
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

type PublicInquiryFormItem = {
  product_id: number;
  brand: string;
  product_name: string;
  qty: number;
};

export default function PublicInquiryForm({
  product,
  items,
  onSuccess,
}: {
  product?: PublicProduct;
  items: PublicInquiryFormItem[];
  onSuccess?: () => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const payloadItems: PublicInquiryItemPayload[] = items.map((item) => ({
    product_id: item.product_id,
    qty: item.qty,
  }));

  const inquiryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(publicInquiryUrl(), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
          company_name: companyName,
          contact_name: contactName,
          whatsapp,
          email,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to send inquiry");
      }

      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      setCompanyName("");
      setContactName("");
      setWhatsapp("");
      setEmail("");
      setNotes("");
      onSuccess?.();
    },
  });

  const whatsappMessage = buildMultiProductWhatsAppMessage(items);
  const whatsappHref = product && items.length === 1 && items[0]?.product_id === product.id
    ? buildWhatsAppUrl(product)
    : buildPublicWhatsAppUrl(whatsappMessage);

  return (
    <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">B2B CTA</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">Request a Quote</h3>
          <p className="mt-2 text-sm text-slate-500">Share your contact details and we'll follow up with pricing and availability.</p>
        </div>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            items.forEach((item) => trackWhatsAppClick(item.product_id));
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95"
        >
          <MessageCircleMore className="h-4 w-4" />
          WhatsApp
        </a>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Request Items</p>
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.product_id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{item.brand} {item.product_name}</p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                Qty: {item.qty}
              </span>
            </div>
          ))}
        </div>
      </div>

      {submitted ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          Your inquiry was sent successfully. Royal Note will contact you soon.
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (payloadItems.length === 0) return;
          inquiryMutation.mutate();
        }}
        className="mt-5 space-y-3"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Company name"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
          />
          <input
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="Contact name"
            required
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
            placeholder="WhatsApp number"
            required
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            type="email"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </div>

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={items.length === 1
            ? `Tell us what you need for ${items[0].brand} ${items[0].product_name}`
            : "Tell us what you need for these products"}
          rows={4}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
        />

        {inquiryMutation.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {inquiryMutation.error instanceof Error ? inquiryMutation.error.message : "Failed to send inquiry"}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={inquiryMutation.isPending || payloadItems.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {inquiryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Request
        </button>
      </form>
    </div>
  );
}
