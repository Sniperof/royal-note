import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  Layers,
  Loader2,
  Package,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface LedgerEntry {
  id: number;
  date: string;
  ref: string;
  party: string;
  amount: string;
  type: "credit" | "debit" | "obligation" | "noncash";
  category: string;
  source: "invoice" | "expense" | "purchase_order" | "capital_entry" | "accounts_payable" | "customer_payment";
  created_at: string;
}

interface LedgerData {
  summary: {
    totalCredits: number;
    totalDebits: number;
    netBalance: number;
    inventoryValue: number;
    accountsPayable: number;
    consignmentPayable: number;
    cashbox: {
      totalIncoming: number;
      totalOutgoing: number;
      currentBalance: number;
      invoicedSales: number;
      customerReceipts: number;
      externalCapital: number;
      capitalInjectionGoods: number;
      expenses: number;
      purchases: number;
      payableSettlements?: number;
    };
  };
  entries: LedgerEntry[];
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LedgerPage() {
  const [filter, setFilter] = useState<"all" | "credit" | "debit">("all");
  const [filterMonth, setFilterMonth] = useState("");

  const { data, isLoading } = useQuery<LedgerData>({
    queryKey: ["ledger"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/ledger`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load ledger");
      return res.json();
    },
  });

  const entries = data?.entries ?? [];
  const summary = data?.summary ?? {
    totalCredits: 0,
    totalDebits: 0,
    netBalance: 0,
    inventoryValue: 0,
    accountsPayable: 0,
    consignmentPayable: 0,
    cashbox: {
      totalIncoming: 0,
      totalOutgoing: 0,
      currentBalance: 0,
      invoicedSales: 0,
      customerReceipts: 0,
      externalCapital: 0,
      capitalInjectionGoods: 0,
      expenses: 0,
      purchases: 0,
      payableSettlements: 0,
    },
  };

  const months = [...new Set(entries.map((entry) => entry.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a));

  const filtered = entries.filter((entry) => {
    if (filter !== "all" && entry.type !== filter) return false;
    if (filterMonth && !entry.date.startsWith(filterMonth)) return false;
    return true;
  });

  const withBalance = (() => {
    const reversed = [...filtered].reverse();
    let balance = 0;
    const result = reversed.map((entry) => {
      const amount = parseFloat(entry.amount);
      // Obligations and non-cash entries stay visible without changing the cash balance.
      if (entry.type === "credit") balance += amount;
      else if (entry.type === "debit") balance -= amount;
      return { ...entry, runningBalance: balance };
    });
    return result.reverse();
  })();

  return (
    <div className="flex-1 bg-[#FAFAFA]">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">General Ledger</h1>
              <p className="text-sm text-gray-500">Cashbook and master ledger movements</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
              <div
                className={`bg-white rounded-2xl border p-5 col-span-2 xl:col-span-3 ${
                  summary.cashbox.currentBalance >= 0
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-red-200 bg-red-50/30"
                }`}
              >
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Actual Cashbox</p>
                    <p
                      className={`text-3xl font-bold mt-1 ${
                        summary.cashbox.currentBalance >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {summary.cashbox.currentBalance < 0 ? "-" : ""}${fmt(summary.cashbox.currentBalance)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Customer receipts and cash capital minus outgoing cash movements</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 xl:min-w-[320px]">
                    <div className="rounded-xl bg-white/80 border border-emerald-100 px-3 py-2">
                      <p className="text-[11px] text-gray-500 mb-1">Total Incoming</p>
                      <p className="text-sm font-bold text-emerald-700">${fmt(summary.cashbox.totalIncoming)}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-red-100 px-3 py-2">
                      <p className="text-[11px] text-gray-500 mb-1">Total Outgoing</p>
                      <p className="text-sm font-bold text-red-700">${fmt(summary.cashbox.totalOutgoing)}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-amber-100 px-3 py-2">
                      <p className="text-[11px] text-gray-500 mb-1">Invoiced Sales (Non-cash)</p>
                      <p className="text-sm font-bold text-amber-700">${fmt(summary.cashbox.invoicedSales)}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-emerald-100 px-3 py-2">
                      <p className="text-[11px] text-gray-500 mb-1">Customer Receipts</p>
                      <p className="text-sm font-bold text-emerald-700">${fmt(summary.cashbox.customerReceipts)}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-emerald-100 px-3 py-2">
                      <p className="text-[11px] text-gray-500 mb-1">Capital (Cash)</p>
                      <p className="text-sm font-bold text-emerald-700">${fmt(summary.cashbox.externalCapital)}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-amber-100 px-3 py-2">
                      <p className="text-[11px] text-gray-500 mb-1">Capital (Goods, Non-cash)</p>
                      <p className="text-sm font-bold text-amber-700">${fmt(summary.cashbox.capitalInjectionGoods ?? 0)}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-red-100 px-3 py-2">
                      <p className="text-[11px] text-gray-500 mb-1">Expenses</p>
                      <p className="text-sm font-bold text-red-700">${fmt(summary.cashbox.expenses)}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-red-100 px-3 py-2">
                      <p className="text-[11px] text-gray-500 mb-1">Cash Purchases</p>
                      <p className="text-sm font-bold text-red-700">${fmt(summary.cashbox.purchases)}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-red-100 px-3 py-2">
                      <p className="text-[11px] text-gray-500 mb-1">AP Settlements</p>
                      <p className="text-sm font-bold text-red-700">${fmt(summary.cashbox.payableSettlements ?? 0)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Total Credits</span>
                </div>
                <p className="text-2xl font-bold text-green-600">${fmt(summary.totalCredits)}</p>
                <p className="text-xs text-gray-400 mt-1">Customer receipts and cash capital</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Total Debits</span>
                </div>
                <p className="text-2xl font-bold text-red-600">${fmt(summary.totalDebits)}</p>
                <p className="text-xs text-gray-400 mt-1">Expenses, cash purchases, and AP settlements</p>
              </div>

              <div
                className={`bg-white rounded-2xl border p-5 ${
                  summary.netBalance >= 0 ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      summary.netBalance >= 0 ? "bg-green-100" : "bg-red-100"
                    }`}
                  >
                    <Scale className={`w-4 h-4 ${summary.netBalance >= 0 ? "text-green-600" : "text-red-600"}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Net Balance</span>
                </div>
                <p className={`text-2xl font-bold ${summary.netBalance >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {summary.netBalance < 0 ? "-" : ""}${fmt(summary.netBalance)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Actual cash inflows minus actual cash outflows</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Package className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Inventory Value</span>
                </div>
                <p className="text-2xl font-bold text-purple-700">${fmt(summary.inventoryValue)}</p>
                <p className="text-xs text-gray-400 mt-1">Owned stock at cost (excl. consignment)</p>
              </div>

              <div className="bg-white rounded-2xl border border-orange-200 bg-orange-50/30 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Accounts Payable</span>
                </div>
                <p className="text-2xl font-bold text-orange-700">${fmt(summary.accountsPayable ?? 0)}</p>
                <p className="text-xs text-gray-400 mt-1">Outstanding credit obligations</p>
              </div>

              {(summary.consignmentPayable ?? 0) > 0 && (
                <div className="bg-white rounded-2xl border border-violet-200 bg-violet-50/30 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                      <Layers className="w-4 h-4 text-violet-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-500">Consignment Due</span>
                  </div>
                  <p className="text-2xl font-bold text-violet-700">${fmt(summary.consignmentPayable)}</p>
                  <p className="text-xs text-gray-400 mt-1">Owed to consignment suppliers from sales</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden">
                {(["all", "credit", "debit"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      filter === type
                        ? type === "credit"
                          ? "bg-green-600 text-white"
                          : type === "debit"
                            ? "bg-red-600 text-white"
                            : "bg-gray-900 text-white"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {type === "all" ? "All" : type === "credit" ? "Cash In" : "Cash Out"}
                  </button>
                ))}
              </div>

              <div className="relative">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 pr-8 text-sm bg-white text-gray-700 outline-none focus:border-gray-400 cursor-pointer appearance-none"
                >
                  <option value="">All Months</option>
                  {months.map((month) => (
                    <option key={month} value={month}>
                      {new Date(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>

              <span className="text-xs text-gray-400 ml-auto">{filtered.length} entries</span>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center">
                <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No entries found</p>
              </div>
            ) : (
              <>
                <div className="sm:hidden space-y-2">
                  {withBalance.map((entry) => (
                    <div
                      key={`${entry.source}-${entry.id}`}
                      className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 shadow-[0_2px_8px_rgb(0,0,0,0.04)]"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${
                                entry.type === "credit"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : entry.type === "obligation"
                                    ? "bg-orange-50 text-orange-700 border-orange-200"
                                    : entry.type === "noncash"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              {entry.category}
                            </span>
                            <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {entry.ref}
                            </span>
                          </div>
                          <p className="font-medium text-sm text-gray-900 truncate">{entry.party}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(entry.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {entry.type === "credit" ? (
                            <p className="font-bold text-green-600">+${fmt(parseFloat(entry.amount))}</p>
                          ) : entry.type === "noncash" ? (
                            <p className="font-bold text-amber-600">[Non-cash] ${fmt(parseFloat(entry.amount))}</p>
                          ) : entry.type === "obligation" ? (
                            <p className="font-bold text-orange-600">[AP] ${fmt(parseFloat(entry.amount))}</p>
                          ) : (
                            <p className="font-bold text-red-600">-${fmt(parseFloat(entry.amount))}</p>
                          )}
                          <p
                            className={`text-xs font-semibold mt-0.5 ${
                              entry.runningBalance >= 0 ? "text-gray-700" : "text-red-600"
                            }`}
                          >
                            Bal: {entry.runningBalance < 0 ? "-" : ""}${fmt(entry.runningBalance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 flex justify-between items-center mt-2">
                    <span className="text-sm font-semibold text-gray-700">Net Balance</span>
                    <span
                      className={`font-bold text-base ${
                        summary.netBalance >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {summary.netBalance < 0 ? "-" : ""}${fmt(summary.netBalance)}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                          <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                          <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ref</th>
                          <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                          <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Category</th>
                          <th className="text-right px-4 py-3.5 text-xs font-semibold text-green-600 uppercase tracking-wide">Credit</th>
                          <th className="text-right px-4 py-3.5 text-xs font-semibold text-red-600 uppercase tracking-wide">Debit</th>
                          <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {withBalance.map((entry) => (
                          <tr key={`${entry.source}-${entry.id}`} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                              {new Date(entry.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {entry.ref}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-gray-800 max-w-[180px]">
                              <div className="font-medium truncate">{entry.party}</div>
                            </td>
                            <td className="px-4 py-3.5 hidden sm:table-cell">
                              <span
                                className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${
                                  entry.type === "credit"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : entry.type === "obligation"
                                      ? "bg-orange-50 text-orange-700 border-orange-200"
                                      : entry.type === "noncash"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-red-50 text-red-700 border-red-200"
                                }`}
                              >
                                {entry.category}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-semibold text-green-600 whitespace-nowrap">
                              {entry.type === "credit" ? `$${fmt(parseFloat(entry.amount))}` : "-"}
                            </td>
                            <td className="px-4 py-3.5 text-right font-semibold whitespace-nowrap">
                              {entry.type === "debit" ? (
                                <span className="text-red-600">{`$${fmt(parseFloat(entry.amount))}`}</span>
                              ) : entry.type === "obligation" ? (
                                <span className="text-orange-500 text-xs">[AP] ${fmt(parseFloat(entry.amount))}</span>
                              ) : entry.type === "noncash" ? (
                                <span className="text-amber-600 text-xs">[Non-cash] ${fmt(parseFloat(entry.amount))}</span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td
                              className={`px-5 py-3.5 text-right font-bold whitespace-nowrap ${
                                entry.runningBalance >= 0 ? "text-gray-900" : "text-red-700"
                              }`}
                            >
                              {entry.runningBalance < 0 ? "-" : ""}${fmt(entry.runningBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50/70">
                          <td colSpan={4} className="px-5 py-4 text-sm font-bold text-gray-700">Totals</td>
                          <td className="px-4 py-4 text-right font-bold text-green-700 text-base whitespace-nowrap">
                            ${fmt(filtered.filter((entry) => entry.type === "credit").reduce((sum, entry) => sum + parseFloat(entry.amount), 0))}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-red-700 text-base whitespace-nowrap">
                            ${fmt(filtered.filter((entry) => entry.type === "debit").reduce((sum, entry) => sum + parseFloat(entry.amount), 0))}
                          </td>
                          <td
                            className={`px-5 py-4 text-right font-bold text-base whitespace-nowrap ${
                              summary.netBalance >= 0 ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {summary.netBalance < 0 ? "-" : ""}${fmt(summary.netBalance)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
