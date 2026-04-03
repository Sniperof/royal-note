import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries",
  "Marketing",
  "Shipping & Delivery",
  "Packaging",
  "Maintenance",
  "Travel",
  "Bank Fees",
  "Taxes",
  "Other",
] as const;

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Credit Card", "Cheque"] as const;

type LedgerRecordType = "expense" | "capital";

interface Expense {
  id: number;
  date: string;
  category: string;
  description: string;
  amount: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

interface CapitalEntry {
  id: number;
  date: string;
  source_name: string;
  description: string;
  amount: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

type FormRecord = Expense | CapitalEntry;

const CATEGORY_COLORS: Record<string, string> = {
  Rent: "bg-purple-50 text-purple-700 border-purple-200",
  Utilities: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Salaries: "bg-blue-50 text-blue-700 border-blue-200",
  Marketing: "bg-pink-50 text-pink-700 border-pink-200",
  "Shipping & Delivery": "bg-orange-50 text-orange-700 border-orange-200",
  Packaging: "bg-teal-50 text-teal-700 border-teal-200",
  Maintenance: "bg-gray-100 text-gray-700 border-gray-200",
  Travel: "bg-sky-50 text-sky-700 border-sky-200",
  "Bank Fees": "bg-red-50 text-red-700 border-red-200",
  Taxes: "bg-rose-50 text-rose-700 border-rose-200",
  Other: "bg-gray-100 text-gray-600 border-gray-200",
};

const TYPE_META = {
  expense: {
    title: "Expenses",
    itemLabel: "Expense",
    icon: Receipt,
    iconWrap: "bg-red-100 text-red-600",
    amountClass: "text-red-600",
    buttonClass: "bg-gray-900 hover:bg-gray-800 text-white",
    emptyIcon: ArrowDownCircle,
    emptyText: "No expenses found",
    queryKey: ["expenses"] as const,
    endpoint: `${BASE_URL}/api/expenses`,
  },
  capital: {
    title: "External Income",
    itemLabel: "External Income",
    icon: Wallet,
    iconWrap: "bg-emerald-100 text-emerald-700",
    amountClass: "text-emerald-600",
    buttonClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
    emptyIcon: ArrowUpCircle,
    emptyText: "No external income entries found",
    queryKey: ["capital"] as const,
    endpoint: `${BASE_URL}/api/capital`,
  },
} as const;

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function catCls(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

function getDisplayLabel(type: LedgerRecordType, record: FormRecord) {
  return type === "expense" ? (record as Expense).category : (record as CapitalEntry).source_name;
}

function FormModal({
  mode,
  record,
  onClose,
}: {
  mode: LedgerRecordType;
  record?: FormRecord;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = Boolean(record);
  const meta = TYPE_META[mode];
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    date: record?.date?.slice(0, 10) ?? today,
    category: mode === "expense" ? (record as Expense | undefined)?.category ?? CATEGORIES[0] : CATEGORIES[0],
    source_name: mode === "capital" ? (record as CapitalEntry | undefined)?.source_name ?? "" : "",
    description: record?.description ?? "",
    amount: record?.amount ?? "",
    payment_method: record?.payment_method ?? "Cash",
    notes: record?.notes ?? "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEdit ? `${meta.endpoint}/${record!.id}` : meta.endpoint;
      const payload =
        mode === "expense"
          ? {
              date: form.date,
              category: form.category,
              description: form.description,
              amount: parseFloat(form.amount),
              payment_method: form.payment_method,
              notes: form.notes || null,
            }
          : {
              date: form.date,
              source_name: form.source_name,
              description: form.description,
              amount: parseFloat(form.amount),
              payment_method: form.payment_method,
              notes: form.notes || null,
            };

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }

      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meta.queryKey });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? `Edit ${meta.itemLabel}` : `Add ${meta.itemLabel}`}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => updateField("amount", e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                required
              />
            </div>
          </div>

          {mode === "expense" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 bg-white"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Source Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.source_name}
                onChange={(e) => updateField("source_name", e.target.value)}
                placeholder="Owner, partner, loan, external source..."
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder={
                mode === "expense"
                  ? "Brief description of the expense"
                  : "Reason or note for this external income"
              }
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => updateField("payment_method", method)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    form.payment_method === method
                      ? "bg-gray-900 text-white border-gray-900"
                      : "border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 resize-none"
            />
          </div>

          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${meta.buttonClass}`}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                `Add ${meta.itemLabel}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<LedgerRecordType>("expense");
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<FormRecord | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<FormRecord | null>(null);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const { data: expenses = [], isLoading: isExpensesLoading } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/expenses`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load expenses");
      return res.json();
    },
  });

  const { data: capitalEntries = [], isLoading: isCapitalLoading } = useQuery<CapitalEntry[]>({
    queryKey: ["capital"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/capital`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load capital entries");
      return res.json();
    },
  });

  const activeMeta = TYPE_META[activeTab];
  const records = activeTab === "expense" ? expenses : capitalEntries;
  const isLoading = isExpensesLoading || isCapitalLoading;

  const deleteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: number; type: LedgerRecordType }) => {
      const res = await fetch(`${TYPE_META[type].endpoint}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to delete ${TYPE_META[type].itemLabel.toLowerCase()}`);
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: TYPE_META[vars.type].queryKey });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      setDeleteTarget(null);
    },
  });

  const months = useMemo(() => {
    return [...new Set(records.map((record) => record.date.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((record) => {
      if (filterMonth && !record.date.startsWith(filterMonth)) {
        return false;
      }

      if (activeTab === "expense") {
        const expense = record as Expense;
        if (filterCategory !== "All" && expense.category !== filterCategory) {
          return false;
        }
      }

      return true;
    });
  }, [activeTab, filterCategory, filterMonth, records]);

  const totalAll = records.reduce((sum, record) => sum + parseFloat(record.amount), 0);
  const totalFiltered = filtered.reduce((sum, record) => sum + parseFloat(record.amount), 0);
  const thisMonth = records
    .filter((record) => record.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((sum, record) => sum + parseFloat(record.amount), 0);

  const topItem = useMemo(() => {
    if (activeTab === "expense") {
      const grouped = expenses.reduce<Record<string, number>>((acc, expense) => {
        acc[expense.category] = (acc[expense.category] ?? 0) + parseFloat(expense.amount);
        return acc;
      }, {});
      return Object.entries(grouped).sort((a, b) => b[1] - a[1])[0];
    }

    const grouped = capitalEntries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.source_name] = (acc[entry.source_name] ?? 0) + parseFloat(entry.amount);
      return acc;
    }, {});
    return Object.entries(grouped).sort((a, b) => b[1] - a[1])[0];
  }, [activeTab, capitalEntries, expenses]);

  const openCreate = (type: LedgerRecordType) => {
    setActiveTab(type);
    setEditRecord(undefined);
    setShowForm(true);
  };

  const openEdit = (type: LedgerRecordType, record: FormRecord) => {
    setActiveTab(type);
    setEditRecord(record);
    setShowForm(true);
  };

  return (
    <div className="flex-1 bg-[#FAFAFA]">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeMeta.iconWrap}`}>
              <activeMeta.icon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Cashbox Movements</h1>
              <p className="text-sm text-gray-500">
                Track expenses and external income before they flow into the ledger
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openCreate("expense")}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </button>
            <button
              onClick={() => openCreate("capital")}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" />
              Add External Income
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1">
          {(["expense", "capital"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setFilterCategory("All");
              }}
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                activeTab === tab
                  ? tab === "expense"
                    ? "bg-gray-900 text-white"
                    : "bg-emerald-600 text-white"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {TYPE_META[tab].title}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total {activeMeta.title}</p>
            <p className={`text-xl font-bold ${activeMeta.amountClass}`}>${fmt(totalAll)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">This Month</p>
            <p className="text-xl font-bold text-gray-900">${fmt(thisMonth)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Transactions</p>
            <p className="text-xl font-bold text-gray-900">{records.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">
              {activeTab === "expense" ? "Top Category" : "Top Source"}
            </p>
            <p className="text-base font-bold text-gray-900 truncate">{topItem ? topItem[0] : "—"}</p>
            {topItem ? <p className="text-xs text-gray-400">${fmt(topItem[1])}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>
          {activeTab === "expense" ? (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white text-gray-700 outline-none focus:border-gray-400 cursor-pointer"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          ) : null}
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white text-gray-700 outline-none focus:border-gray-400 cursor-pointer"
          >
            <option value="">All Months</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {new Date(`${month}-01`).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </option>
            ))}
          </select>
          {(filterCategory !== "All" || filterMonth) && (
            <button
              onClick={() => {
                setFilterCategory("All");
                setFilterMonth("");
              }}
              className="text-xs text-gray-400 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}
          {filtered.length !== records.length ? (
            <span className="text-xs text-gray-400 ml-auto">
              Showing {filtered.length} · ${fmt(totalFiltered)}
            </span>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl py-16 text-center">
            <activeMeta.emptyIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{activeMeta.emptyText}</p>
          </div>
        ) : (
          <>
            <div className="sm:hidden space-y-2">
              {filtered.map((record) => {
                const label = getDisplayLabel(activeTab, record);
                const amountValue = parseFloat(record.amount);
                const isExpense = activeTab === "expense";

                return (
                  <div
                    key={`${activeTab}-${record.id}`}
                    className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 shadow-[0_2px_8px_rgb(0,0,0,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${
                              isExpense ? catCls(label) : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {label}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(record.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          {record.payment_method ? (
                            <span className="text-xs text-gray-400">{record.payment_method}</span>
                          ) : null}
                        </div>
                        <p className="font-medium text-sm text-gray-900 truncate">{record.description}</p>
                        {record.notes ? <p className="text-xs text-gray-400 truncate">{record.notes}</p> : null}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={`font-bold text-sm whitespace-nowrap ${
                            isExpense ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {isExpense ? "-" : "+"}${fmt(amountValue)}
                        </span>
                        <button
                          onClick={() => openEdit(activeTab, record)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(record)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 flex justify-between items-center mt-2">
                <span className="text-sm font-semibold text-gray-700">Total ({filtered.length})</span>
                <span className={`font-bold ${activeTab === "expense" ? "text-red-600" : "text-emerald-600"}`}>
                  {activeTab === "expense" ? "-" : "+"}${fmt(totalFiltered)}
                </span>
              </div>
            </div>

            <div className="hidden sm:block bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Date
                      </th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {activeTab === "expense" ? "Category" : "Source"}
                      </th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Description
                      </th>
                      <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                        Method
                      </th>
                      <th
                        className={`text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wide ${
                          activeTab === "expense" ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        Amount
                      </th>
                      <th className="px-4 py-3.5 w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((record) => {
                      const label = getDisplayLabel(activeTab, record);
                      const isExpense = activeTab === "expense";

                      return (
                        <tr key={`${activeTab}-${record.id}`} className="hover:bg-gray-50/60 transition-colors group">
                          <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                              {new Date(record.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                isExpense ? catCls(label) : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-800 max-w-[260px]">
                            <div className="font-medium truncate">{record.description}</div>
                            {record.notes ? <div className="text-xs text-gray-400 truncate">{record.notes}</div> : null}
                          </td>
                          <td className="px-4 py-3.5 text-gray-500 hidden md:table-cell text-xs">
                            {record.payment_method}
                          </td>
                          <td
                            className={`px-5 py-3.5 text-right font-bold whitespace-nowrap ${
                              isExpense ? "text-red-600" : "text-emerald-600"
                            }`}
                          >
                            {isExpense ? "-" : "+"}${fmt(parseFloat(record.amount))}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEdit(activeTab, record)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(record)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                      <td colSpan={4} className="px-5 py-3.5 text-sm font-semibold text-gray-700">
                        Total
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right text-base font-bold ${
                          activeTab === "expense" ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {activeTab === "expense" ? "-" : "+"}${fmt(totalFiltered)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {showForm ? (
        <FormModal
          mode={activeTab}
          record={editRecord}
          onClose={() => {
            setShowForm(false);
            setEditRecord(undefined);
          }}
        />
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Delete {TYPE_META[activeTab].itemLabel}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Delete <strong>{deleteTarget.description}</strong> (${fmt(parseFloat(deleteTarget.amount))})?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({ id: deleteTarget.id, type: activeTab })}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
