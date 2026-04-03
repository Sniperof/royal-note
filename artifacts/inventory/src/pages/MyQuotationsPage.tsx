import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock3,
  Loader2,
  Package,
  Send,
  Wallet,
  X,
} from "lucide-react";
import TraderChrome from "@/components/TraderChrome";
import { TraderEmptyState, TraderPanelCard, TraderStatChip } from "@/components/TraderUI";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface QuotationItem {
  id: number;
  inventory_id: number;
  qty_requested: number;
  unit_price: string | null;
  brand: string;
  name: string;
  size: string | null;
  concentration: string | null;
  gender: string | null;
  thumbnail_path: string | null;
}

interface Quotation {
  id: number;
  ref_number: string;
  status: "pending" | "priced" | "sent" | "cancelled";
  trader_notes: string | null;
  admin_notes: string | null;
  items_count: number;
  created_at: string;
  updated_at: string;
  items?: QuotationItem[];
}

const STATUS_CONFIG = {
  pending: { label: "Pending Review", badge: "bg-yellow-50 text-yellow-700 border-yellow-200", dot: "bg-yellow-400" },
  priced: { label: "Priced - Ready", badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  sent: { label: "Sent via WhatsApp", badge: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  cancelled: { label: "Cancelled", badge: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-400" },
} as const;

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function genderLabel(gender: string | null | undefined) {
  if (!gender) return null;
  const map: Record<string, string> = {
    men: "Men",
    male: "Men",
    "for men": "Men",
    women: "Women",
    female: "Women",
    "for women": "Women",
    unisex: "Unisex",
  };
  return map[gender.toLowerCase()] ?? gender;
}

export default function MyQuotationsPage() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, Quotation>>({});

  const { data: quotations = [], isLoading } = useQuery<Quotation[]>({
    queryKey: ["my-quotations"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/quotations`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load quotations");
      return res.json();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE_URL}/api/quotations/${id}/status`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error("Failed to cancel quotation");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-quotations"] });
    },
  });

  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);
    if (detailCache[id]) return;

    setLoadingDetail(id);
    try {
      const res = await fetch(`${BASE_URL}/api/quotations/${id}`, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as Quotation;
      setDetailCache((prev) => ({ ...prev, [id]: data }));
    } finally {
      setLoadingDetail(null);
    }
  }

  const pricedTotal = (items: QuotationItem[]) =>
    items.reduce((sum, item) => {
      if (!item.unit_price) return sum;
      return sum + parseFloat(item.unit_price) * item.qty_requested;
    }, 0);

  const pendingCount = quotations.filter((q) => q.status === "pending").length;
  const pricedCount = quotations.filter((q) => q.status === "priced" || q.status === "sent").length;
  const sentCount = quotations.filter((q) => q.status === "sent").length;

  function handleQuotationRowKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, quotationId: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void toggleExpand(quotationId);
    }
  }

  return (
    <TraderChrome
      eyebrow="Pricing requests"
      title="Active Quotations"
      description="Track each pricing request from broker review to final quote, with item details ready when updates arrive."
      sideTitle="Quotation Status"
      sideSubtitle="Pricing pipeline"
      sideContent={
        <TraderPanelCard title="Request Summary">
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Awaiting review</span>
              <span className="font-semibold text-slate-950">{pendingCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Priced</span>
              <span className="font-semibold text-slate-950">{pricedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Sent</span>
              <span className="font-semibold text-slate-950">{sentCount}</span>
            </div>
          </div>
        </TraderPanelCard>
      }
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <TraderStatChip icon={<Clock3 className="h-4 w-4 text-slate-400" />} label={`Awaiting review ${pendingCount}`} />
          <TraderStatChip icon={<Wallet className="h-4 w-4 text-slate-400" />} label={`Ready with pricing ${pricedCount}`} />
          <TraderStatChip icon={<Send className="h-4 w-4 text-slate-400" />} label={`Sent ${sentCount}`} />
        </div>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        </div>
      ) : quotations.length === 0 ? (
        <TraderEmptyState
          icon={<ClipboardList className="h-8 w-8 text-gray-200" />}
          title="No pricing requests yet"
          description="Go to the marketplace, select products, then send your first quote request."
          className="py-16"
        />
      ) : (
        <div className="space-y-4">
          {quotations.map((quotation) => {
            const cfg = STATUS_CONFIG[quotation.status] ?? STATUS_CONFIG.pending;
            const isExpanded = expandedId === quotation.id;
            const detail = detailCache[quotation.id];

            return (
              <motion.div
                key={quotation.id}
                layout
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-center gap-2 px-5 py-4 transition-colors hover:bg-gray-50/50">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                    onClick={() => toggleExpand(quotation.id)}
                    onKeyDown={(event) => handleQuotationRowKeyDown(event, quotation.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`quotation-panel-${quotation.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">{quotation.ref_number}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {quotation.items_count} product{quotation.items_count !== 1 ? "s" : ""} - {timeAgo(quotation.created_at)}
                      </p>
                    </div>

                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {quotation.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => cancelMutation.mutate(quotation.id)}
                            disabled={cancelMutation.isPending}
                            className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                            title="Cancel this request"
                          >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                <AnimatePresence>
                  {isExpanded ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                      id={`quotation-panel-${quotation.id}`}
                    >
                      <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                        {loadingDetail === quotation.id ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                          </div>
                        ) : null}

                        {detail ? (
                          <>
                            <div className="mb-4 space-y-2">
                              {detail.items?.map((item) => {
                                const isPriced = item.unit_price !== null;
                                const lineTotal = isPriced ? parseFloat(item.unit_price!) * item.qty_requested : null;
                                return (
                                  <div key={item.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3.5 py-3">
                                    {item.thumbnail_path ? (
                                      <img
                                        src={`${BASE_URL}/api/storage${item.thumbnail_path}`}
                                        alt={item.name}
                                        className="h-10 w-10 flex-shrink-0 rounded-lg border border-gray-100 object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                                        <Package className="h-4 w-4 text-gray-300" />
                                      </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-slate-900">{item.brand}</p>
                                      <p className="text-xs text-slate-500">
                                        {item.name}
                                        {item.size ? <span className="ml-1">- {item.size}</span> : null}
                                        {item.concentration ? <span className="ml-1">- {item.concentration}</span> : null}
                                      </p>
                                      {genderLabel(item.gender) ? (
                                        <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                                          {genderLabel(item.gender)}
                                        </p>
                                      ) : null}
                                    </div>

                                    <div className="flex-shrink-0 text-right">
                                      <p className="text-sm font-bold text-slate-900">x{item.qty_requested}</p>
                                      {isPriced ? (
                                        <>
                                          <p className="text-xs text-slate-500">${parseFloat(item.unit_price!).toFixed(2)} / unit</p>
                                          <p className="text-xs font-semibold text-indigo-700">${lineTotal!.toFixed(2)}</p>
                                        </>
                                      ) : (
                                          <p className="text-xs text-yellow-600">Pricing in progress</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {detail.status === "priced" || detail.status === "sent" ? (
                              <div className="mb-3 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3">
                                 <span className="text-sm font-medium text-indigo-700">Quoted total</span>
                                <span className="text-lg font-bold text-indigo-700">
                                  ${pricedTotal(detail.items ?? []).toFixed(2)}
                                </span>
                              </div>
                            ) : null}

                            {detail.trader_notes ? (
                              <div className="mb-2 text-xs text-slate-500">
                                <span className="font-medium text-slate-700">Your note: </span>
                                {detail.trader_notes}
                              </div>
                            ) : null}

                            {detail.admin_notes ? (
                              <div className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-800">
                                <span className="font-semibold">Broker note: </span>
                                {detail.admin_notes}
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </TraderChrome>
  );
}
