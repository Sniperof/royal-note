import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, Eye, Loader2, MessageCircleMore, Search, Send } from "lucide-react";
import {
  publicCatalogAnalyticsUrl,
  type PublicCatalogAnalyticsResponse,
} from "@/lib/publicCatalog";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value.toLocaleString("en-US")}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function PublicCatalogAnalyticsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery<PublicCatalogAnalyticsResponse>({
    queryKey: ["public-catalog-analytics"],
    queryFn: async () => {
      const res = await fetch(publicCatalogAnalyticsUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load public catalogue analytics");
      return res.json();
    },
  });

  const topProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data?.top_products ?? [];

    return (data?.top_products ?? []).filter((product) =>
      [product.product_name, product.brand]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [data?.top_products, search]);

  const recentInquiries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data?.recent_inquiries ?? [];

    return (data?.recent_inquiries ?? []).filter((entry) =>
      [
        entry.product_name,
        entry.brand,
        entry.company_name,
        entry.contact_name,
        entry.whatsapp,
        entry.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [data?.recent_inquiries, search]);

  return (
    <div className="flex-1 bg-[#FAFAFA]">
      <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <BarChart2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Public Catalogue Analytics</h1>
              <p className="text-sm text-gray-500">Views, WhatsApp clicks, and inquiry activity from the public B2B catalogue.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Product Views"
            value={data?.summary.total_views ?? 0}
            icon={Eye}
            accent="bg-slate-900"
          />
          <SummaryCard
            label="WhatsApp Clicks"
            value={data?.summary.total_whatsapp_clicks ?? 0}
            icon={MessageCircleMore}
            accent="bg-emerald-600"
          />
          <SummaryCard
            label="Inquiry Submissions"
            value={data?.summary.total_inquiry_submissions ?? 0}
            icon={Send}
            accent="bg-violet-600"
          />
        </div>

        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Search analytics</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search top products or recent inquiries"
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-red-200 bg-white px-6 py-16 text-center text-sm text-red-700">
            Failed to load public catalogue analytics.
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Top Products</p>
                <h2 className="mt-1 text-lg font-bold text-gray-900">Most engaged public products</h2>
              </div>

              {topProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center text-sm text-gray-500">
                  No tracked product activity yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        <th className="py-3 pr-4">Product</th>
                        <th className="py-3 pr-4">Views</th>
                        <th className="py-3 pr-4">WhatsApp</th>
                        <th className="py-3 pr-4">Inquiries</th>
                        <th className="py-3">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {topProducts.map((product) => (
                        <tr key={`${product.product_id}-${product.product_name}`} className="align-top">
                          <td className="py-3 pr-4">
                            <div className="font-semibold text-gray-900">{product.product_name || "Unknown Product"}</div>
                            <div className="text-xs text-gray-500">{product.brand || "-"}</div>
                          </td>
                          <td className="py-3 pr-4 font-medium text-gray-700">{product.views}</td>
                          <td className="py-3 pr-4 font-medium text-emerald-700">{product.whatsapp_clicks}</td>
                          <td className="py-3 pr-4 font-medium text-violet-700">{product.inquiries}</td>
                          <td className="py-3 font-semibold text-gray-900">{product.total_events}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Recent Inquiries</p>
                <h2 className="mt-1 text-lg font-bold text-gray-900">Latest public leads</h2>
              </div>

              {recentInquiries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-6 py-14 text-center text-sm text-gray-500">
                  No inquiries found.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentInquiries.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {entry.brand ? `${entry.brand} ` : ""}{entry.product_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {entry.contact_name}{entry.company_name ? ` · ${entry.company_name}` : ""}
                          </p>
                        </div>
                        <span className="text-[11px] text-gray-400">{formatDateTime(entry.created_at)}</span>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        WhatsApp: {entry.whatsapp}
                        {entry.email ? ` · ${entry.email}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
