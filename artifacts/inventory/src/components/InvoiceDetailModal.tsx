import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Printer, Wallet, X } from "lucide-react";
import type { Invoice } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type InvoiceStatus = "CONFIRMED" | "VOIDED";
type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "VOIDED";

interface CustomerPayment {
  id: number;
  invoice_id: number;
  payment_date: string;
  amount_aed: string | number;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

interface DetailedInvoice extends Invoice {
  total_paid?: string | number;
  remaining_balance?: string | number;
  payment_status?: PaymentStatus | string | null;
  payments?: CustomerPayment[];
}

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onChanged?: () => void;
}

const GENDER_MAP: Record<string, string> = {
  male: "Men",
  female: "Women",
  unisex: "Unisex",
  men: "Men",
  women: "Women",
  "for men": "Men",
  "for women": "Women",
};

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Credit Card", "Cheque"] as const;

function genderLabel(g: string | null | undefined) {
  if (!g) return "";
  return GENDER_MAP[g.toLowerCase()] ?? g;
}

function normalizeInvoiceStatus(status: string | null | undefined): InvoiceStatus {
  return String(status ?? "").toUpperCase() === "VOIDED" ? "VOIDED" : "CONFIRMED";
}

function normalizePaymentStatus(status: string | null | undefined, invoiceStatus: InvoiceStatus): PaymentStatus {
  if (invoiceStatus === "VOIDED") return "VOIDED";
  const value = String(status ?? "").toUpperCase();
  if (value === "PAID" || value === "PARTIALLY_PAID") return value;
  return "UNPAID";
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = normalizeInvoiceStatus(status);
  const badgeClass =
    normalized === "VOIDED"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
      {normalized}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const badgeClass =
    status === "PAID"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "PARTIALLY_PAID"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : status === "VOIDED"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-gray-200 bg-gray-50 text-gray-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
      {status}
    </span>
  );
}

function money(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

export default function InvoiceDetailModal({ invoice, onClose, onChanged }: Props) {
  const qc = useQueryClient();
  const invoiceId = Number(invoice.id);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: "Cash",
    notes: "",
  });
  const [paymentError, setPaymentError] = useState("");

  const { data: detailedInvoice, isLoading } = useQuery<DetailedInvoice>({
    queryKey: ["invoice", invoiceId],
    enabled: Number.isFinite(invoiceId),
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/invoices/${invoiceId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load invoice details");
      return res.json();
    },
    initialData: invoice as DetailedInvoice,
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(paymentForm.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Payment amount must be greater than 0");
      }

      const res = await fetch(`${BASE_URL}/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          payment_date: paymentForm.payment_date,
          payment_method: paymentForm.payment_method,
          notes: paymentForm.notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to record payment");
      }

      return (await res.json()) as DetailedInvoice;
    },
    onSuccess: (updated) => {
      qc.setQueryData(["invoice", invoiceId], updated);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      onChanged?.();
      setPaymentError("");
      setPaymentForm({
        amount: "",
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: "Cash",
        notes: "",
      });
    },
    onError: (error: Error) => {
      setPaymentError(error.message);
    },
  });

  const activeInvoice = detailedInvoice ?? (invoice as DetailedInvoice);
  const items = activeInvoice.items ?? [];
  const payments = activeInvoice.payments ?? [];
  const subtotal = money(activeInvoice.subtotal);
  const discount = money(activeInvoice.discount);
  const total = money(activeInvoice.total);
  const totalPaid = money(activeInvoice.total_paid);
  const remainingBalance = money(activeInvoice.remaining_balance ?? total - totalPaid);
  const invoiceStatus = normalizeInvoiceStatus(activeInvoice.status);
  const paymentStatus = normalizePaymentStatus(activeInvoice.payment_status, invoiceStatus);
  const canRecordPayment = invoiceStatus !== "VOIDED" && paymentStatus !== "PAID";
  const hasPayments = totalPaid > 0;

  const paymentHistory = useMemo(
    () =>
      [...payments].sort((a, b) => {
        const dateDiff = new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime();
        return dateDiff !== 0 ? dateDiff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }),
    [payments],
  );

  function handlePrint() {
    const printContent = document.getElementById("invoice-print-area");
    if (!printContent) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="en">
<head><meta charset="utf-8"><title>Invoice ${activeInvoice.invoice_number}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #111; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .info-item label { font-size: 11px; color: #888; display: block; margin-bottom: 2px; }
  .info-item span { font-size: 14px; color: #111; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f5f5f5; padding: 8px 12px; font-size: 11px; text-align: left; border-bottom: 1px solid #ddd; }
  td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  .totals { margin-left: auto; width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
  .totals-total { font-size: 18px; font-weight: bold; border-top: 2px solid #000; padding-top: 8px; margin-top: 4px; }
  .footer { margin-top: 40px; font-size: 11px; color: #888; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head><body>
${printContent.innerHTML}
<div class="footer">Thank you for your business</div>
</body></html>`);
    win.document.close();
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">Invoice Details</h2>
              <StatusBadge status={activeInvoice.status} />
              <PaymentStatusBadge status={paymentStatus} />
            </div>
            <p className="text-sm text-gray-400 font-mono">{activeInvoice.invoice_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
            </div>
          ) : (
            <div id="invoice-print-area" className="space-y-6">
              <div className="flex justify-between items-start border-b-2 border-black pb-5">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">Royal Note</h1>
                  <p className="text-sm text-gray-500">Sales Invoice</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{activeInvoice.invoice_number}</p>
                  <p className="text-sm text-gray-500 mt-1">{activeInvoice.date ? String(activeInvoice.date).slice(0, 10) : ""}</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <StatusBadge status={activeInvoice.status} />
                    <PaymentStatusBadge status={paymentStatus} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Customer</p>
                  <p className="text-sm font-medium text-gray-900">{activeInvoice.customer_name ?? "Walk-in"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Date</p>
                  <p className="text-sm font-medium text-gray-900">{activeInvoice.date ? String(activeInvoice.date).slice(0, 10) : ""}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Invoice Status</p>
                  <p className={`text-sm font-medium ${invoiceStatus === "VOIDED" ? "text-rose-700" : "text-emerald-700"}`}>
                    {invoiceStatus}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Payment Status</p>
                  <p
                    className={`text-sm font-medium ${
                      paymentStatus === "PAID"
                        ? "text-emerald-700"
                        : paymentStatus === "PARTIALLY_PAID"
                          ? "text-amber-700"
                          : paymentStatus === "VOIDED"
                            ? "text-rose-700"
                            : "text-gray-700"
                    }`}
                  >
                    {paymentStatus}
                  </p>
                </div>
                {activeInvoice.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                    <p className="text-sm text-gray-700">{activeInvoice.notes}</p>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="text-xs text-gray-500 mb-1">Invoice Total</p>
                  <p className="text-lg font-bold text-gray-900">${total.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <p className="text-xs text-gray-500 mb-1">Total Paid</p>
                  <p className="text-lg font-bold text-emerald-700">${totalPaid.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                  <p className="text-xs text-gray-500 mb-1">Remaining Balance</p>
                  <p className="text-lg font-bold text-amber-700">${remainingBalance.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                  <p className="text-xs text-gray-500 mb-1">Payment Status</p>
                  <div className="pt-1">
                    <PaymentStatusBadge status={paymentStatus} />
                  </div>
                </div>
              </div>

              {hasPayments && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  This invoice has recorded customer payments. Voiding is blocked in this phase until refund or reversal handling exists.
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Product</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Details</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500">Qty</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Unit Price</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id ?? i} className="border-b border-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{item.brand}</div>
                        <div className="text-xs text-gray-500">{item.name}</div>
                        {item.barcode && <div className="text-xs font-mono text-gray-400">{item.barcode}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {item.size && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{item.size}</span>}
                          {item.concentration && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{item.concentration}</span>}
                          {item.gender && <span className="text-xs text-violet-600">{genderLabel(item.gender)}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-medium">{item.qty}</td>
                      <td className="py-3 px-4">${Number(item.unit_price_aed ?? 0).toFixed(2)}</td>
                      <td className="py-3 px-4 font-semibold">
                        ${(Number(item.unit_price_aed ?? 0) * (item.qty ?? 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="rounded-2xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-gray-900">Payment History</h3>
                  </div>
                  <div className="p-4">
                    {paymentHistory.length === 0 ? (
                      <p className="text-sm text-gray-400">No payments recorded yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {paymentHistory.map((payment) => (
                          <div key={payment.id} className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">${money(payment.amount_aed).toFixed(2)}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {String(payment.payment_date).slice(0, 10)} · {payment.payment_method ?? "Cash"}
                                </p>
                                {payment.notes && <p className="text-sm text-gray-600 mt-1">{payment.notes}</p>}
                              </div>
                              <Wallet className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-gray-900">Record Payment</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    {canRecordPayment ? (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Amount (AED)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={paymentForm.amount}
                            onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                            placeholder={remainingBalance.toFixed(2)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Payment Date</label>
                          <input
                            type="date"
                            value={paymentForm.payment_date}
                            onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_date: e.target.value }))}
                            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Payment Method</label>
                          <select
                            value={paymentForm.payment_method}
                            onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 bg-white"
                          >
                            {PAYMENT_METHODS.map((method) => (
                              <option key={method} value={method}>
                                {method}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">Notes</label>
                          <textarea
                            rows={3}
                            value={paymentForm.notes}
                            onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 resize-none"
                            placeholder="Optional payment note"
                          />
                        </div>
                        {paymentError ? (
                          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {paymentError}
                          </div>
                        ) : null}
                        <button
                          onClick={() => paymentMutation.mutate()}
                          disabled={paymentMutation.isPending}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {paymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                          Record Payment
                        </button>
                      </>
                    ) : (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                        {invoiceStatus === "VOIDED"
                          ? "Payments cannot be recorded on a voided invoice."
                          : "This invoice is already fully paid."}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-72 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-rose-600">
                      <span>Discount</span>
                      <span>-${discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-emerald-700">
                    <span>Total Paid</span>
                    <span>${totalPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-amber-700">
                    <span>Remaining</span>
                    <span>${remainingBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-3 mt-2">
                    <span>Total</span>
                    <span className={invoiceStatus === "VOIDED" ? "text-gray-500" : "text-emerald-700"}>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
