import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Filter, Loader2, Pencil, Plus, Receipt, Trash2, Wallet, X } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const CATEGORIES = ["Rent", "Utilities", "Salaries", "Marketing", "Shipping & Delivery", "Packaging", "Maintenance", "Travel", "Bank Fees", "Taxes", "Other"] as const;
const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Credit Card", "Cheque"] as const;

type Tab = "expense" | "income" | "capital";

interface ExpenseRecord {
  id: number;
  date: string;
  movement_type?: "expense" | "income";
  category: string;
  description: string;
  amount: string;
  payment_method: string | null;
  notes: string | null;
}

interface CapitalEntry {
  id: number;
  date: string;
  source_name: string;
  description: string;
  amount: string;
  payment_method: string | null;
  notes: string | null;
}

interface LedgerSummary {
  summary: {
    cashbox: {
      currentBalance: number;
      manualCashIn?: number;
      expenses: number;
      customerReceipts: number;
      externalCapital: number;
    };
  };
}

type RecordItem = ExpenseRecord | CapitalEntry;

const META = {
  expense: { title: "Outgoing", itemLabel: "Cash Out", endpoint: `${BASE_URL}/api/expenses`, queryKey: ["expenses"] as const, amountClass: "text-red-600", badgeClass: "bg-gray-100 text-gray-700 border-gray-200" },
  income: { title: "Incoming", itemLabel: "Cash In", endpoint: `${BASE_URL}/api/cashbox`, queryKey: ["cashbox-income"] as const, amountClass: "text-emerald-600", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  capital: { title: "Capital", itemLabel: "Capital Entry", endpoint: `${BASE_URL}/api/capital`, queryKey: ["capital"] as const, amountClass: "text-sky-600", badgeClass: "bg-sky-50 text-sky-700 border-sky-200" },
} as const;

function fmt(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getLabel(tab: Tab, record: RecordItem) {
  if (tab === "capital") return (record as CapitalEntry).source_name;
  if (tab === "income") return "Manual Cash In";
  return (record as ExpenseRecord).category;
}

function FormModal({ mode, record, onClose }: { mode: Tab; record?: RecordItem; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = Boolean(record);
  const [form, setForm] = useState({
    date: record?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    category: mode === "expense" ? (record as ExpenseRecord | undefined)?.category ?? CATEGORIES[0] : CATEGORIES[0],
    source_name: mode === "capital" ? (record as CapitalEntry | undefined)?.source_name ?? "" : "",
    description: record?.description ?? "",
    amount: record?.amount ?? "",
    payment_method: record?.payment_method ?? "Cash",
    notes: record?.notes ?? "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const endpoint =
        mode === "income"
          ? isEdit ? `${META[mode].endpoint}/${record!.id}` : `${META[mode].endpoint}/in`
          : isEdit ? `${META[mode].endpoint}/${record!.id}` : META[mode].endpoint;
      const payload =
        mode === "capital"
          ? { date: form.date, source_name: form.source_name, description: form.description, amount: parseFloat(form.amount), payment_method: form.payment_method, notes: form.notes || null }
          : mode === "expense"
            ? { date: form.date, category: form.category, description: form.description, amount: parseFloat(form.amount), payment_method: form.payment_method, notes: form.notes || null }
            : { date: form.date, description: form.description, amount: parseFloat(form.amount), payment_method: form.payment_method, notes: form.notes || null };
      const res = await fetch(endpoint, { method: isEdit ? "PUT" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: META[mode].queryKey });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? `Edit ${META[mode].itemLabel}` : `Add ${META[mode].itemLabel}`}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm" required />
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="Amount" className="rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm" required />
          </div>
          {mode === "expense" ? (
            <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm bg-white">
              {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          ) : null}
          {mode === "capital" ? (
            <input value={form.source_name} onChange={(e) => setForm((p) => ({ ...p, source_name: e.target.value }))} placeholder="Source name" className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm" required />
          ) : null}
          <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder={mode === "income" ? "Cash in description" : mode === "expense" ? "Cash out description" : "Capital description"} className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm" required />
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button key={method} type="button" onClick={() => setForm((p) => ({ ...p, payment_method: method }))} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${form.payment_method === method ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"}`}>
                {method}
              </button>
            ))}
          </div>
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm resize-none" />
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : `Add ${META[mode].itemLabel}`}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("expense");
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<RecordItem | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<RecordItem | null>(null);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery<ExpenseRecord[]>({ queryKey: ["expenses"], queryFn: async () => (await (await fetch(`${BASE_URL}/api/expenses`, { credentials: "include" })).json()) });
  const { data: incomes = [], isLoading: loadingIncome } = useQuery<ExpenseRecord[]>({ queryKey: ["cashbox-income"], queryFn: async () => (await (await fetch(`${BASE_URL}/api/cashbox?type=income`, { credentials: "include" })).json()) });
  const { data: capital = [], isLoading: loadingCapital } = useQuery<CapitalEntry[]>({ queryKey: ["capital"], queryFn: async () => (await (await fetch(`${BASE_URL}/api/capital`, { credentials: "include" })).json()) });
  const { data: ledger } = useQuery<LedgerSummary>({ queryKey: ["ledger"], queryFn: async () => (await (await fetch(`${BASE_URL}/api/ledger`, { credentials: "include" })).json()) });

  const records = activeTab === "expense" ? expenses : activeTab === "income" ? incomes : capital;
  const filtered = useMemo(() => records.filter((record) => (!filterMonth || record.date.startsWith(filterMonth)) && (activeTab !== "expense" || filterCategory === "All" || (record as ExpenseRecord).category === filterCategory)), [records, filterMonth, filterCategory, activeTab]);
  const months = useMemo(() => [...new Set(records.map((record) => record.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a)), [records]);
  const totalAll = records.reduce((sum, record) => sum + parseFloat(record.amount), 0);
  const totalFiltered = filtered.reduce((sum, record) => sum + parseFloat(record.amount), 0);
  const thisMonth = records.filter((record) => record.date.startsWith(new Date().toISOString().slice(0, 7))).reduce((sum, record) => sum + parseFloat(record.amount), 0);
  const topLabel = activeTab === "expense" ? Object.entries(expenses.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.category]: (acc[item.category] ?? 0) + parseFloat(item.amount) }), {})).sort((a, b) => b[1] - a[1])[0] : activeTab === "income" ? ["Manual Cash In", incomes.reduce((sum, item) => sum + parseFloat(item.amount), 0)] : Object.entries(capital.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.source_name]: (acc[item.source_name] ?? 0) + parseFloat(item.amount) }), {})).sort((a, b) => b[1] - a[1])[0];

  const deleteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: Tab }) => {
      const endpoint = type === "income" ? `${META[type].endpoint}/${id}` : `${META[type].endpoint}/${id}`;
      const res = await fetch(endpoint, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: META[vars.type].queryKey });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      setDeleteTarget(null);
    },
  });

  const isLoading = loadingExpenses || loadingIncome || loadingCapital;
  const cashbox = ledger?.summary.cashbox;

  return (
    <div className="flex-1 bg-[#FAFAFA]">
      <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Wallet className="h-5 w-5" /></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Cashbox Movements</h1>
              <p className="text-sm text-gray-500">Record manual cash in and out while keeping the live cashbox balance visible.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setActiveTab("expense"); setEditRecord(undefined); setShowForm(true); }} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="mr-2 inline h-4 w-4" />Add Cash Out</button>
            <button onClick={() => { setActiveTab("income"); setEditRecord(undefined); setShowForm(true); }} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="mr-2 inline h-4 w-4" />Add Cash In</button>
            <button onClick={() => { setActiveTab("capital"); setEditRecord(undefined); setShowForm(true); }} className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="mr-2 inline h-4 w-4" />Add Capital</button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-emerald-200 bg-white p-4"><p className="text-xs text-gray-500">Current Cash Balance</p><p className="mt-1 text-xl font-bold text-emerald-700">${fmt(cashbox?.currentBalance ?? 0)}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Manual Cash In</p><p className="mt-1 text-xl font-bold text-emerald-600">${fmt(cashbox?.manualCashIn ?? 0)}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Manual Cash Out</p><p className="mt-1 text-xl font-bold text-red-600">${fmt(cashbox?.expenses ?? 0)}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Customer Receipts</p><p className="mt-1 text-xl font-bold text-gray-900">${fmt(cashbox?.customerReceipts ?? 0)}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Capital Cash In</p><p className="mt-1 text-xl font-bold text-sky-600">${fmt(cashbox?.externalCapital ?? 0)}</p></div>
        </div>

        <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1">
          {(["expense", "income", "capital"] as const).map((tab) => (
            <button key={tab} onClick={() => { setActiveTab(tab); setFilterCategory("All"); }} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === tab ? tab === "expense" ? "bg-gray-900 text-white" : tab === "income" ? "bg-emerald-600 text-white" : "bg-sky-600 text-white" : "text-gray-500 hover:text-gray-900"}`}>{META[tab].title}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Total {META[activeTab].title}</p><p className={`mt-1 text-xl font-bold ${META[activeTab].amountClass}`}>${fmt(totalAll)}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">This Month</p><p className="mt-1 text-xl font-bold text-gray-900">${fmt(thisMonth)}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Transactions</p><p className="mt-1 text-xl font-bold text-gray-900">{records.length}</p></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">{activeTab === "expense" ? "Top Category" : activeTab === "income" ? "Flow Type" : "Top Source"}</p><p className="mt-1 truncate text-base font-bold text-gray-900">{topLabel ? topLabel[0] : "-"}</p>{topLabel ? <p className="text-xs text-gray-400">${fmt(topLabel[1])}</p> : null}</div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500"><Filter className="h-3.5 w-3.5" /><span>Filter:</span></div>
          {activeTab === "expense" ? <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white">{["All", ...CATEGORIES].map((category) => <option key={category} value={category}>{category}</option>)}</select> : null}
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"><option value="">All Months</option>{months.map((month) => <option key={month} value={month}>{new Date(`${month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</option>)}</select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">{activeTab === "expense" ? <ArrowDownCircle className="mx-auto mb-3 h-10 w-10 text-gray-200" /> : <ArrowUpCircle className="mx-auto mb-3 h-10 w-10 text-gray-200" />}<p className="text-sm text-gray-400">No {META[activeTab].title.toLowerCase()} records found</p></div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50/50"><th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th><th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{activeTab === "expense" ? "Category" : activeTab === "income" ? "Type" : "Source"}</th><th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Description</th><th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Method</th><th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th><th className="px-4 py-3.5" /></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((record) => (
                  <tr key={`${activeTab}-${record.id}`} className="group hover:bg-gray-50/60">
                    <td className="px-5 py-3.5 text-gray-600">{new Date(record.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-4 py-3.5"><span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium ${activeTab === "expense" ? "bg-gray-100 text-gray-700 border-gray-200" : META[activeTab].badgeClass}`}>{getLabel(activeTab, record)}</span></td>
                    <td className="px-4 py-3.5 text-gray-800"><div className="font-medium">{record.description}</div>{record.notes ? <div className="text-xs text-gray-400">{record.notes}</div> : null}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">{record.payment_method}</td>
                    <td className={`px-5 py-3.5 text-right font-bold ${META[activeTab].amountClass}`}>{activeTab === "expense" ? "-" : "+"}${fmt(parseFloat(record.amount))}</td>
                    <td className="px-4 py-3.5"><div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100"><button onClick={() => { setActiveTab(activeTab); setEditRecord(record); setShowForm(true); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => setDeleteTarget(record)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm ? <FormModal mode={activeTab} record={editRecord} onClose={() => { setShowForm(false); setEditRecord(undefined); }} /> : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-gray-900">Delete {META[activeTab].itemLabel}</h3>
            <p className="mb-6 text-sm text-gray-600">Delete <strong>{deleteTarget.description}</strong> (${fmt(parseFloat(deleteTarget.amount))})?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
              <button onClick={() => deleteMutation.mutate({ id: deleteTarget.id, type: activeTab })} disabled={deleteMutation.isPending} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{deleteMutation.isPending ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
