import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, Search, Users, Wallet } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type InvoiceStatus = "CONFIRMED" | "VOIDED";
type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "VOIDED";

interface CustomerReceivableSummary {
  customer_id: number;
  customer_name: string;
  phone_numbers: string[] | null;
  neighborhood: string | null;
  invoice_count: number | string;
  total_invoiced: number | string;
  total_paid: number | string;
  outstanding_balance: number | string;
  last_invoice_date: string | null;
  last_payment_date: string | null;
}

interface CustomerPayment {
  id: number;
  invoice_id: number;
  payment_date: string;
  amount_aed: number | string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

interface CustomerStatementInvoice {
  id: number;
  invoice_number: string;
  date: string | null;
  status: InvoiceStatus;
  total: number | string;
  total_paid: number | string;
  remaining_balance: number | string;
  payment_status: PaymentStatus;
  payments: CustomerPayment[];
}

interface CustomerStatementDetail {
  customer: {
    id: number;
    name: string;
    neighborhood: string | null;
    address_detail: string | null;
    phone_numbers: string[] | null;
    notes: string | null;
  };
  summary: {
    invoice_count: number | string;
    total_invoiced: number | string;
    total_paid: number | string;
    outstanding_balance: number | string;
    last_invoice_date: string | null;
    last_payment_date: string | null;
  };
  invoices: CustomerStatementInvoice[];
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

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const styles =
    status === "PAID"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "PARTIALLY_PAID"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : status === "VOIDED"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-gray-200 bg-gray-50 text-gray-700";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>{status}</span>;
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const styles =
    status === "VOIDED"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>{status}</span>;
}

export default function CustomerReceivablesPage() {
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const { data: summaries = [], isLoading } = useQuery<CustomerReceivableSummary[]>({
    queryKey: ["customer-receivables"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/customer-receivables`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load customer receivables");
      return res.json();
    },
  });

  const filteredSummaries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return summaries;
    return summaries.filter((summary) => {
      const phones = Array.isArray(summary.phone_numbers) ? summary.phone_numbers.join(" ") : "";
      return (
        summary.customer_name.toLowerCase().includes(needle) ||
        String(summary.neighborhood ?? "").toLowerCase().includes(needle) ||
        phones.toLowerCase().includes(needle)
      );
    });
  }, [search, summaries]);

  const selectedSummary =
    filteredSummaries.find((summary) => summary.customer_id === selectedCustomerId) ??
    summaries.find((summary) => summary.customer_id === selectedCustomerId) ??
    null;

  const effectiveSelectedCustomerId =
    selectedSummary?.customer_id ?? filteredSummaries[0]?.customer_id ?? null;

  const { data: detail, isLoading: detailLoading } = useQuery<CustomerStatementDetail>({
    queryKey: ["customer-receivable-detail", effectiveSelectedCustomerId],
    enabled: effectiveSelectedCustomerId !== null,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/customer-receivables/${effectiveSelectedCustomerId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load customer statement");
      return res.json();
    },
  });

  const totals = useMemo(() => {
    return filteredSummaries.reduce(
      (acc, summary) => {
        acc.customerCount += 1;
        acc.totalInvoiced += money(summary.total_invoiced);
        acc.totalPaid += money(summary.total_paid);
        acc.totalOutstanding += money(summary.outstanding_balance);
        if (money(summary.outstanding_balance) > 0) {
          acc.customersWithBalance += 1;
        }
        return acc;
      },
      {
        customerCount: 0,
        customersWithBalance: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        totalOutstanding: 0,
      },
    );
  }, [filteredSummaries]);

  return (
    <div className="flex-1 bg-[#FAFAFA]">
      <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Customer Receivables</h1>
              <p className="text-sm text-gray-500">Customer-level outstanding balances built from invoices and recorded customer payments.</p>
            </div>
          </div>
          <div className="hidden text-right md:block">
            <p className="text-xs text-gray-400">Outstanding Across Visible Customers</p>
            <p className="text-2xl font-bold text-amber-700">${fmtCurrency(totals.totalOutstanding)}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Customers Shown</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{totals.customerCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
            <p className="text-xs text-gray-500">Customers With Balance</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">{totals.customersWithBalance}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total Invoiced</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">${fmtCurrency(totals.totalInvoiced)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-xs text-gray-500">Total Collected</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">${fmtCurrency(totals.totalPaid)}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Find Customer</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by customer, phone, or neighborhood"
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Customer Balances</h2>
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-3">
                {isLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
                  </div>
                ) : filteredSummaries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-12 text-center">
                    <Users className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-500">No customer receivables matched this search.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSummaries.map((summary) => {
                      const isSelected = effectiveSelectedCustomerId === summary.customer_id;
                      const outstanding = money(summary.outstanding_balance);
                      return (
                        <button
                          key={summary.customer_id}
                          onClick={() => setSelectedCustomerId(summary.customer_id)}
                          className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                            isSelected
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={`font-semibold ${isSelected ? "text-white" : "text-gray-900"}`}>{summary.customer_name}</p>
                              <p className={`mt-1 text-xs ${isSelected ? "text-gray-300" : "text-gray-500"}`}>
                                {summary.neighborhood || "No neighborhood"}
                                {Array.isArray(summary.phone_numbers) && summary.phone_numbers[0] ? ` | ${summary.phone_numbers[0]}` : ""}
                              </p>
                            </div>
                            {outstanding > 0 ? (
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isSelected ? "bg-white/15 text-white" : "bg-amber-50 text-amber-700"}`}>
                                Due
                              </span>
                            ) : (
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isSelected ? "bg-white/10 text-gray-100" : "bg-emerald-50 text-emerald-700"}`}>
                                Settled
                              </span>
                            )}
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className={isSelected ? "text-gray-300" : "text-gray-500"}>Outstanding</p>
                              <p className={`mt-1 text-sm font-bold ${isSelected ? "text-white" : "text-amber-700"}`}>${fmtCurrency(outstanding)}</p>
                            </div>
                            <div>
                              <p className={isSelected ? "text-gray-300" : "text-gray-500"}>Invoices</p>
                              <p className={`mt-1 text-sm font-bold ${isSelected ? "text-white" : "text-gray-900"}`}>{summary.invoice_count}</p>
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
            {!effectiveSelectedCustomerId ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center">
                <Wallet className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-500">Select a customer to view the receivables statement.</p>
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
                      <h2 className="text-lg font-bold text-gray-900">{detail.customer.name}</h2>
                      <div className="mt-2 space-y-1 text-sm text-gray-500">
                        <p>{detail.customer.neighborhood || "No neighborhood recorded"}</p>
                        {Array.isArray(detail.customer.phone_numbers) && detail.customer.phone_numbers.length > 0 ? (
                          <p>{detail.customer.phone_numbers.join(" | ")}</p>
                        ) : null}
                        {detail.customer.address_detail ? <p>{detail.customer.address_detail}</p> : null}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-right">
                      <p className="text-xs text-amber-700">Current Outstanding</p>
                      <p className="mt-1 text-2xl font-bold text-amber-700">${fmtCurrency(detail.summary.outstanding_balance)}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                      <p className="text-xs text-gray-500">Active Invoices</p>
                      <p className="mt-1 text-xl font-bold text-gray-900">{detail.summary.invoice_count}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                      <p className="text-xs text-gray-500">Total Invoiced</p>
                      <p className="mt-1 text-xl font-bold text-gray-900">${fmtCurrency(detail.summary.total_invoiced)}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <p className="text-xs text-gray-500">Collected</p>
                      <p className="mt-1 text-xl font-bold text-emerald-700">${fmtCurrency(detail.summary.total_paid)}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                      <p className="text-xs text-gray-500">Last Activity</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">{fmtDate(detail.summary.last_payment_date || detail.summary.last_invoice_date)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 px-5 py-4">
                    <h3 className="text-sm font-semibold text-gray-900">Customer Statement</h3>
                    <p className="mt-1 text-xs text-gray-500">VOIDED invoices stay visible for history but do not contribute to outstanding totals.</p>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {detail.invoices.length === 0 ? (
                      <div className="px-5 py-14 text-center">
                        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                        <p className="text-sm text-gray-500">No invoices found for this customer.</p>
                      </div>
                    ) : (
                      detail.invoices.map((invoice) => (
                        <div key={invoice.id} className="px-5 py-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-gray-900">{invoice.invoice_number}</p>
                                <InvoiceStatusBadge status={invoice.status} />
                                <PaymentStatusBadge status={invoice.payment_status} />
                              </div>
                              <p className="mt-1 text-xs text-gray-500">{fmtDate(invoice.date)}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-right text-sm">
                              <div>
                                <p className="text-xs text-gray-400">Invoice</p>
                                <p className="mt-1 font-semibold text-gray-900">${fmtCurrency(invoice.total)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Paid</p>
                                <p className="mt-1 font-semibold text-emerald-700">${fmtCurrency(invoice.total_paid)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Remaining</p>
                                <p className={`mt-1 font-semibold ${invoice.status === "VOIDED" ? "text-gray-500" : "text-amber-700"}`}>
                                  ${fmtCurrency(invoice.remaining_balance)}
                                </p>
                              </div>
                            </div>
                          </div>

                          {invoice.payments.length > 0 ? (
                            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Payment History</p>
                              <div className="space-y-3">
                                {invoice.payments.map((payment) => (
                                  <div key={payment.id} className="flex flex-col justify-between gap-2 rounded-xl border border-white bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-start">
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">${fmtCurrency(payment.amount_aed)}</p>
                                      <p className="mt-1 text-xs text-gray-500">
                                        {fmtDate(payment.payment_date)} | {payment.payment_method || "Cash"}
                                      </p>
                                      {payment.notes ? <p className="mt-1 text-sm text-gray-600">{payment.notes}</p> : null}
                                    </div>
                                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
                              No payments recorded on this invoice yet.
                            </div>
                          )}
                        </div>
                      ))
                    )}
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
