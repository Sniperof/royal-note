import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ExternalLink, Loader2, MessageCircle, Search } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type PublicInquiry = {
  id: number;
  product_id: number | null;
  product_name: string;
  brand: string | null;
  company_name: string | null;
  contact_name: string;
  whatsapp: string;
  email: string | null;
  notes: string | null;
  created_at: string;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildContactWhatsAppUrl(phone: string, productName: string) {
  const normalizedPhone = phone.replace(/[^\d]/g, "");
  const text = encodeURIComponent(`Hello, this is Royal Note regarding your inquiry for ${productName}.`);
  return `https://wa.me/${normalizedPhone}?text=${text}`;
}

export default function PublicInquiriesPage() {
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery<PublicInquiry[]>({
    queryKey: ["public-inquiries"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/public-inquiries`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load public inquiries");
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((entry) =>
      [
        entry.product_name,
        entry.brand,
        entry.company_name,
        entry.contact_name,
        entry.whatsapp,
        entry.email,
        entry.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [data, search]);

  return (
    <div className="flex-1 bg-[#FAFAFA]">
      <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Public Inquiries</h1>
              <p className="text-sm text-gray-500">Lead requests submitted from the public product catalogue.</p>
            </div>
          </div>
          <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right md:block">
            <p className="text-xs text-slate-500">Visible Requests</p>
            <p className="text-xl font-bold text-slate-900">{filtered.length}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Search Inquiries</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by product, company, contact, WhatsApp, or note"
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center">
            <ClipboardList className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">No public inquiries matched this search.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                        Public Inquiry
                      </span>
                      <span className="text-xs text-gray-400">#{entry.id}</span>
                    </div>
                    <p className="mt-3 text-base font-semibold text-gray-900">
                      {entry.brand ? `${entry.brand} ` : ""}{entry.product_name}
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p><span className="font-medium text-gray-900">Contact:</span> {entry.contact_name}</p>
                      <p><span className="font-medium text-gray-900">Company:</span> {entry.company_name || "-"}</p>
                      <p><span className="font-medium text-gray-900">WhatsApp:</span> {entry.whatsapp}</p>
                      <p><span className="font-medium text-gray-900">Email:</span> {entry.email || "-"}</p>
                    </div>
                    {entry.notes ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                        {entry.notes}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <div className="text-sm text-gray-500">{formatDateTime(entry.created_at)}</div>
                    <a
                      href={buildContactWhatsAppUrl(entry.whatsapp, entry.product_name)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Contact on WhatsApp
                    </a>
                    {entry.product_id ? (
                      <a
                        href={`/inventory/${entry.product_id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Product
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
