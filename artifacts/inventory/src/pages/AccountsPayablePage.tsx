import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Loader2, CreditCard } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface APRecord {
  id: number;
  purchase_order_id: number | null;
  invoice_item_id: number | null;
  supplier_id: number;
  supplier_name: string;
  description: string;
  amount_usd: string;
  due_date: string | null;
  status: "open" | "partially_paid" | "paid";
  amount_paid_usd: string;
  notes: string | null;
  created_at: string;
  po_number: string | null;
  invoice_id: number | null;
}

interface APSummary {
  supplier_id: number;
  supplier_name: string;
  record_count: string;
  total_amount: string;
  total_paid: string;
  total_outstanding: string;
}

function fmt(n: number | string) {
  return Math.abs(parseFloat(String(n))).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatusBadge({ status }: { status: APRecord["status"] }) {
  if (status === "paid")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">
        <CheckCircle className="w-3 h-3" /> Paid
      </span>
    );
  if (status === "partially_paid")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-200">
        <CreditCard className="w-3 h-3" /> Partial
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200">
      <AlertCircle className="w-3 h-3" /> Open
    </span>
  );
}

function PayModal({
  record,
  onClose,
}: {
  record: APRecord;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const outstanding =
    parseFloat(record.amount_usd) - parseFloat(record.amount_paid_usd);
  const [amount, setAmount] = useState(outstanding.toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${BASE_URL}/api/accounts-payable/${record.id}/pay`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            amount: parseFloat(amount),
            payment_method: paymentMethod,
            notes: notes || null,
          }),
        }
      );
      if (!res.ok) throw new Error("Payment failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-payable-summary"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Record Payment</h2>
          <p className="text-sm text-gray-500 mt-1">
            {record.supplier_name} — {record.description}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Outstanding Balance</p>
            <p className="text-xl font-bold text-orange-700">
              ${fmt(outstanding)}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Amount ($)
            </label>
            <input
              type="number"
              min="0.01"
              max={outstanding}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Check">Check</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment reference, etc."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending || parseFloat(amount) <= 0}
            className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccountsPayablePage() {
  const [selectedRecord, setSelectedRecord] = useState<APRecord | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "partially_paid" | "paid">("open");

  const { data: records = [], isLoading } = useQuery<APRecord[]>({
    queryKey: ["accounts-payable"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/accounts-payable`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: summary = [] } = useQuery<APSummary[]>({
    queryKey: ["accounts-payable-summary"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/accounts-payable/summary`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
  });

  const filtered = records.filter((r) =>
    filterStatus === "all" ? true : r.status === filterStatus
  );

  const totalOutstanding = summary.reduce(
    (sum, s) => sum + parseFloat(s.total_outstanding),
    0
  );

  return (
    <div className="flex-1 bg-[#FAFAFA]">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Accounts Payable
              </h1>
              <p className="text-sm text-gray-500">
                Credit purchases and consignment obligations
              </p>
            </div>
          </div>
          {totalOutstanding > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Total Outstanding</p>
              <p className="text-xl font-bold text-orange-700">
                ${fmt(totalOutstanding)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary by Supplier */}
        {summary.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.map((s) => (
              <div
                key={s.supplier_id}
                className="bg-white rounded-2xl border border-orange-100 p-4"
              >
                <p className="font-semibold text-gray-900 text-sm mb-3">
                  {s.supplier_name}
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Total</span>
                    <span className="font-medium">${fmt(s.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Paid</span>
                    <span className="font-medium text-green-600">
                      ${fmt(s.total_paid)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-gray-100 pt-1.5 mt-1.5">
                    <span className="text-gray-700 font-semibold">
                      Outstanding
                    </span>
                    <span className="font-bold text-orange-700">
                      ${fmt(s.total_outstanding)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden w-fit">
          {(
            [
              { value: "open", label: "Open" },
              { value: "partially_paid", label: "Partial" },
              { value: "paid", label: "Paid" },
              { value: "all", label: "All" },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filterStatus === value
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center">
            <CheckCircle className="w-10 h-10 text-green-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No {filterStatus === "all" ? "" : filterStatus} records</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Supplier</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Paid</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-orange-600 uppercase tracking-wide">Outstanding</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((record) => {
                  const outstanding =
                    parseFloat(record.amount_usd) -
                    parseFloat(record.amount_paid_usd);
                  const isConsignment = record.invoice_item_id !== null;
                  return (
                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {record.supplier_name}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 max-w-[200px]">
                        <div className="truncate">{record.description}</div>
                        {record.po_number && (
                          <div className="text-xs text-gray-400 mt-0.5 font-mono">
                            {record.po_number}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${
                            isConsignment
                              ? "bg-violet-50 text-violet-700 border-violet-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {isConsignment ? "Consignment" : "Credit Purchase"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-gray-800">
                        ${fmt(record.amount_usd)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-green-600">
                        ${fmt(record.amount_paid_usd)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-orange-700">
                        ${fmt(outstanding)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {record.status !== "paid" && (
                          <button
                            onClick={() => setSelectedRecord(record)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRecord && (
        <PayModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}
