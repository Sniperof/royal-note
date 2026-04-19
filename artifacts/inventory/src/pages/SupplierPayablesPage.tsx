import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, CreditCard, Loader2, Search, Truck } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type PayableStatus = "open" | "partially_paid" | "paid";
type PayableType = "purchase" | "consignment";

interface SupplierPayablesSummary {
  supplier_id: number;
  supplier_name: string;
  neighborhood: string | null;
  phone_numbers: string[] | null;
  record_count: number | string;
  total_amount: number | string;
  total_settled: number | string;
  total_outstanding: number | string;
  purchase_total: number | string;
  purchase_settled: number | string;
  purchase_outstanding: number | string;
  consignment_total: number | string;
  consignment_settled: number | string;
  consignment_outstanding: number | string;
  last_record_at: string | null;
  last_settlement_at: string | null;
}

interface SupplierPayableRecord {
  id: number;
  purchase_order_id: number | null;
  invoice_item_id: number | null;
  supplier_id: number;
  supplier_name: string;
  description: string;
  amount_usd: number | string;
  amount_paid_usd: number | string;
  outstanding_usd: number | string;
  due_date: string | null;
  status: PayableStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  po_number: string | null;
  invoice_id: number | null;
  payable_type: PayableType;
}

interface SupplierPayablesDetail {
  supplier: {
    id: number;
    name: string;
    neighborhood: string | null;
    address_detail: string | null;
    phone_numbers: string[] | null;
    notes: string | null;
    supplier_type: string | null;
  };
  summary: {
    record_count: number | string;
    total_amount: number | string;
    total_settled: number | string;
    total_outstanding: number | string;
    purchase_total: number | string;
    purchase_settled: number | string;
    purchase_outstanding: number | string;
    consignment_total: number | string;
    consignment_settled: number | string;
    consignment_outstanding: number | string;
  };
  records: SupplierPayableRecord[];
  settlement_history_note: string;
}

function money(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function fmtCurrency(value: number | string | null | undefined) {
  return money(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function StatusBadge({ status }: { status: PayableStatus }) {
  if (status === "paid") {
    return <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">PAID</span>;
  }
  if (status === "partially_paid") {
    return <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">PARTIAL</span>;
  }
  return <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">OPEN</span>;
}

function TypeBadge({ type }: { type: PayableType }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        type === "consignment"
          ? "border-violet-200 bg-violet-50 text-violet-700"
          : "border-blue-200 bg-blue-50 text-blue-700"
      }`}
    >
      {type === "consignment" ? "Consignment" : "Purchase"}
    </span>
  );
}

export default function SupplierPayablesPage() {
  const [search, setSearch] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);

  const { data: summaries = [], isLoading } = useQuery<SupplierPayablesSummary[]>({
    queryKey: ["supplier-payables"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/supplier-payables`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load supplier payables");
      return res.json();
    },
  });

  const filteredSummaries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return summaries;
    return summaries.filter((summary) => {
      const phones = Array.isArray(summary.phone_numbers) ? summary.phone_numbers.join(" ") : "";
      return (
        summary.supplier_name.toLowerCase().includes(needle) ||
        String(summary.neighborhood ?? "").toLowerCase().includes(needle) ||
        phones.toLowerCase().includes(needle)
      );
    });
  }, [search, summaries]);

  const selectedSummary =
    filteredSummaries.find((summary) => summary.supplier_id === selectedSupplierId) ??
    summaries.find((summary) => summary.supplier_id === selectedSupplierId) ??
    null;

  const effectiveSelectedSupplierId =
    selectedSummary?.supplier_id ?? filteredSummaries[0]?.supplier_id ?? null;

  const { data: detail, isLoading: detailLoading } = useQuery<SupplierPayablesDetail>({
    queryKey: ["supplier-payable-detail", effectiveSelectedSupplierId],
    enabled: effectiveSelectedSupplierId !== null,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/supplier-payables/${effectiveSelectedSupplierId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load supplier statement");
      return res.json();
    },
  });

  const totals = useMemo(() => {
    return filteredSummaries.reduce(
      (acc, summary) => {
        acc.supplierCount += 1;
        acc.totalAmount += money(summary.total_amount);
        acc.totalSettled += money(summary.total_settled);
        acc.totalOutstanding += money(summary.total_outstanding);
        acc.purchaseOutstanding += money(summary.purchase_outstanding);
        acc.consignmentOutstanding += money(summary.consignment_outstanding);
        return acc;
      },
      {
        supplierCount: 0,
        totalAmount: 0,
        totalSettled: 0,
        totalOutstanding: 0,
        purchaseOutstanding: 0,
        consignmentOutstanding: 0,
      },
    );
  }, [filteredSummaries]);

  return (
    <div className="flex-1 bg-[#FAFAFA]">
      <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Supplier Payables</h1>
              <p className="text-sm text-gray-500">Supplier-level view of total owed, cumulative settled amount, and current outstanding balance.</p>
            </div>
          </div>
          <div className="hidden text-right md:block">
            <p className="text-xs text-gray-400">Outstanding Across Visible Suppliers</p>
            <p className="text-2xl font-bold text-orange-700">${fmtCurrency(totals.totalOutstanding)}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Suppliers Shown</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{totals.supplierCount}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total Payables</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">${fmtCurrency(totals.totalAmount)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-xs text-gray-500">Settled</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">${fmtCurrency(totals.totalSettled)}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
            <p className="text-xs text-gray-500">Purchase Outstanding</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">${fmtCurrency(totals.purchaseOutstanding)}</p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
            <p className="text-xs text-gray-500">Consignment Outstanding</p>
            <p className="mt-1 text-2xl font-bold text-violet-700">${fmtCurrency(totals.consignmentOutstanding)}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Find Supplier</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by supplier, phone, or neighborhood"
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Supplier Balances</h2>
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-3">
                {isLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
                  </div>
                ) : filteredSummaries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-12 text-center">
                    <Truck className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-500">No supplier payables matched this search.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSummaries.map((summary) => {
                      const isSelected = effectiveSelectedSupplierId === summary.supplier_id;
                      const outstanding = money(summary.total_outstanding);
                      return (
                        <button
                          key={summary.supplier_id}
                          onClick={() => setSelectedSupplierId(summary.supplier_id)}
                          className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                            isSelected
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={`font-semibold ${isSelected ? "text-white" : "text-gray-900"}`}>{summary.supplier_name}</p>
                              <p className={`mt-1 text-xs ${isSelected ? "text-gray-300" : "text-gray-500"}`}>
                                {summary.neighborhood || "No neighborhood"}
                                {Array.isArray(summary.phone_numbers) && summary.phone_numbers[0] ? ` | ${summary.phone_numbers[0]}` : ""}
                              </p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isSelected ? "bg-white/15 text-white" : outstanding > 0 ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}>
                              {outstanding > 0 ? "Due" : "Settled"}
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className={isSelected ? "text-gray-300" : "text-gray-500"}>Outstanding</p>
                              <p className={`mt-1 text-sm font-bold ${isSelected ? "text-white" : "text-orange-700"}`}>${fmtCurrency(outstanding)}</p>
                            </div>
                            <div>
                              <p className={isSelected ? "text-gray-300" : "text-gray-500"}>Records</p>
                              <p className={`mt-1 text-sm font-bold ${isSelected ? "text-white" : "text-gray-900"}`}>{summary.record_count}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {!effectiveSelectedSupplierId ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center">
                <Truck className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-500">Select a supplier to view the payables statement.</p>
              </div>
            ) : detailLoading || !detail ? (
              <div className="rounded-2xl border border-gray-200 bg-white px-6 py-20">
                <div className="flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{detail.supplier.name}</h2>
                      <div className="mt-2 space-y-1 text-sm text-gray-500">
                        <p>{detail.supplier.neighborhood || "No neighborhood recorded"}</p>
                        {Array.isArray(detail.supplier.phone_numbers) && detail.supplier.phone_numbers.length > 0 ? (
                          <p>{detail.supplier.phone_numbers.join(" | ")}</p>
                        ) : null}
                        {detail.supplier.address_detail ? <p>{detail.supplier.address_detail}</p> : null}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-right">
                      <p className="text-xs text-orange-700">Current Outstanding</p>
                      <p className="mt-1 text-2xl font-bold text-orange-700">${fmtCurrency(detail.summary.total_outstanding)}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {detail.settlement_history_note}
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                      <p className="text-xs text-gray-500">Payable Records</p>
                      <p className="mt-1 text-xl font-bold text-gray-900">{detail.summary.record_count}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                      <p className="text-xs text-gray-500">Total Amount</p>
                      <p className="mt-1 text-xl font-bold text-gray-900">${fmtCurrency(detail.summary.total_amount)}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <p className="text-xs text-gray-500">Settled</p>
                      <p className="mt-1 text-xl font-bold text-emerald-700">${fmtCurrency(detail.summary.total_settled)}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                      <p className="text-xs text-gray-500">Outstanding</p>
                      <p className="mt-1 text-xl font-bold text-orange-700">${fmtCurrency(detail.summary.total_outstanding)}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                      <p className="text-sm font-semibold text-blue-900">Purchase Payables</p>
                      <div className="mt-3 space-y-1.5 text-sm">
                        <div className="flex justify-between"><span className="text-blue-700">Total</span><span className="font-semibold text-blue-900">${fmtCurrency(detail.summary.purchase_total)}</span></div>
                        <div className="flex justify-between"><span className="text-blue-700">Settled</span><span className="font-semibold text-emerald-700">${fmtCurrency(detail.summary.purchase_settled)}</span></div>
                        <div className="flex justify-between"><span className="text-blue-700">Outstanding</span><span className="font-semibold text-orange-700">${fmtCurrency(detail.summary.purchase_outstanding)}</span></div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
                      <p className="text-sm font-semibold text-violet-900">Consignment Payables</p>
                      <div className="mt-3 space-y-1.5 text-sm">
                        <div className="flex justify-between"><span className="text-violet-700">Total</span><span className="font-semibold text-violet-900">${fmtCurrency(detail.summary.consignment_total)}</span></div>
                        <div className="flex justify-between"><span className="text-violet-700">Settled</span><span className="font-semibold text-emerald-700">${fmtCurrency(detail.summary.consignment_settled)}</span></div>
                        <div className="flex justify-between"><span className="text-violet-700">Outstanding</span><span className="font-semibold text-orange-700">${fmtCurrency(detail.summary.consignment_outstanding)}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div className="border-b border-gray-100 px-5 py-4">
                    <h3 className="text-sm font-semibold text-gray-900">Supplier Statement</h3>
                    <p className="mt-1 text-xs text-gray-500">Settled reflects the current cumulative settled amount on each payable record.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/70">
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Description</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Origin</th>
                          <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Total</th>
                          <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Settled</th>
                          <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-orange-600">Outstanding</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detail.records.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50/50">
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-gray-900">{record.description}</p>
                              <p className="mt-1 text-xs text-gray-500">{fmtDate(record.created_at)}</p>
                              {record.notes ? <p className="mt-1 text-xs text-gray-500">{record.notes}</p> : null}
                            </td>
                            <td className="px-4 py-3.5">
                              <TypeBadge type={record.payable_type} />
                            </td>
                            <td className="px-4 py-3.5 text-xs text-gray-500">
                              {record.po_number ? <p className="font-mono text-gray-700">{record.po_number}</p> : null}
                              {record.invoice_id ? <p>Invoice #{record.invoice_id}</p> : null}
                              {!record.po_number && !record.invoice_id ? <p>-</p> : null}
                            </td>
                            <td className="px-4 py-3.5 text-right font-medium text-gray-900">${fmtCurrency(record.amount_usd)}</td>
                            <td className="px-4 py-3.5 text-right font-medium text-emerald-700">${fmtCurrency(record.amount_paid_usd)}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-orange-700">${fmtCurrency(record.outstanding_usd)}</td>
                            <td className="px-4 py-3.5">
                              <StatusBadge status={record.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
