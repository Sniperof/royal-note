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

const fieldLabelClass =
  "text-[10px] font-bold uppercase tracking-[0.1em] text-[#141413]";
const inputClass =
  "w-full rounded-md border-[1.5px] border-[#EEEEEE] bg-[#FAF9F5] px-3.5 py-3 text-[13px] text-[#141413] placeholder:text-[#949494] outline-none transition focus:border-[#141413] focus:bg-white";

export default function PublicInquiryForm({
  product,
  items,
  onSuccess,
  showWhatsAppCta = true,
}: {
  product?: PublicProduct;
  items: PublicInquiryFormItem[];
  onSuccess?: () => void;
  showWhatsAppCta?: boolean;
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
    <div className="rounded-[16px] border border-[#EEEEEE] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="rn-label">B2B CTA</p>
          <h3 className="rn-display mt-2 text-[22px] font-semibold text-[#141413]">
            Request a Quote
          </h3>
          <p className="mt-2 text-[13px] leading-[1.6] text-[#949494]">
            Share your contact details and we will follow up with pricing and availability.
          </p>
        </div>
        {showWhatsAppCta ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              items.forEach((item) => trackWhatsAppClick(item.product_id));
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white transition hover:brightness-95"
          >
            <MessageCircleMore className="h-4 w-4" />
            WhatsApp
          </a>
        ) : null}
      </div>

      <div className="mt-5 rounded-[14px] border border-[#EEEEEE] bg-[#FAF9F5] px-4 py-4">
        <p className="rn-label">Request Items</p>
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.product_id}
              className="flex items-center justify-between gap-3 text-[13px]"
            >
              <p className="font-semibold text-[#141413]">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#949494]">
                  {item.brand}
                </span>{" "}
                · {item.product_name}
              </p>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#141413] ring-1 ring-[#EEEEEE]">
                Qty {item.qty}
              </span>
            </div>
          ))}
        </div>
      </div>

      {submitted ? (
        <div className="mt-5 rounded-[14px] border border-[#4D49BE]/30 bg-[#4D49BE]/5 px-4 py-4 text-[13px] text-[#4D49BE]">
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
          <label className="block">
            <span className={fieldLabelClass}>Company Name</span>
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="e.g. Maison Parfums Ltd"
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Contact Name</span>
            <input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Your full name"
              required
              className={`${inputClass} mt-1.5`}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className={fieldLabelClass}>WhatsApp</span>
            <input
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              placeholder="+XX XXX XXX XXXX"
              required
              className={`${inputClass} mt-1.5`}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="trade@example.com"
              type="email"
              className={`${inputClass} mt-1.5`}
            />
          </label>
        </div>

        <label className="block">
          <span className={fieldLabelClass}>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={items.length === 1
              ? `Tell us what you need for ${items[0].brand} ${items[0].product_name}`
              : "Tell us what you need for these products"}
            rows={4}
            className={`${inputClass} mt-1.5`}
          />
        </label>

        {inquiryMutation.isError ? (
          <div className="rounded-[14px] border border-[#EEEEEE] bg-[#FAF9F5] px-4 py-3 text-[13px] text-[#141413]">
            {inquiryMutation.error instanceof Error ? inquiryMutation.error.message : "Failed to send inquiry"}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={inquiryMutation.isPending || payloadItems.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#141413] px-5 py-3.5 text-[12px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-[#262626] disabled:opacity-50"
        >
          {inquiryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit Quote Request
        </button>
      </form>
    </div>
  );
}
