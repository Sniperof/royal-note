import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Eye, FileText, TrendingUp, Package } from "lucide-react";
import { getInvoices, deleteInvoice } from "@workspace/api-client-react";
import type { Invoice } from "@workspace/api-client-react";
import InvoiceForm from "../components/InvoiceForm";
import InvoiceDetailModal from "../components/InvoiceDetailModal";

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => getInvoices(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInvoice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const totalRevenue = invoices.reduce((s, inv) => s + Number(inv.total ?? 0), 0);
  const totalItems = invoices.reduce((s, inv) => s + (inv.items?.length ?? 0), 0);

  if (showForm) {
    return <InvoiceForm onClose={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["invoices"] }); }} />;
  }

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        {[
          { icon: FileText, bg: "bg-black", label: "Total Invoices", val: invoices.length, format: "int" },
          { icon: TrendingUp, bg: "bg-emerald-600", label: "Total Revenue", val: totalRevenue, format: "usd" },
          { icon: Package, bg: "bg-violet-600", label: "Items Sold", val: totalItems, format: "int" },
        ].map(({ icon: Icon, bg, label, val, format }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-5 flex items-center gap-2 sm:gap-4">
            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 truncate">{label}</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">
                {format === "usd" ? `$${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : val}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">Invoice Records</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-black text-white rounded-2xl text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">New Invoice</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium mb-1">No invoices yet</p>
          <p className="text-gray-400 text-sm mb-6">Create your first sales invoice to get started.</p>
          <button onClick={() => setShowForm(true)} className="px-5 py-2.5 bg-black text-white rounded-2xl text-sm font-medium hover:bg-gray-800 transition-colors">
            + Create Invoice
          </button>
        </div>
      ) : (
        <>
          {/* ── MOBILE: Cards ── */}
          <div className="sm:hidden space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="bg-white border border-gray-100 rounded-2xl shadow-[0_2px_8px_rgb(0,0,0,0.04)] px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-lg">{inv.invoice_number}</span>
                      <span className="text-xs text-gray-500">{inv.date ? String(inv.date).slice(0, 10) : ""}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{inv.customer_name ?? <span className="italic text-gray-400">Walk-in</span>}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                        {inv.items?.length ?? 0} item{(inv.items?.length ?? 0) !== 1 ? "s" : ""}
                      </span>
                      {Number(inv.discount ?? 0) > 0 && (
                        <span className="text-xs text-rose-600">−${Number(inv.discount ?? 0).toFixed(2)}</span>
                      )}
                      <span className="text-sm font-bold text-emerald-700 ml-auto">${Number(inv.total ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setViewingInvoice(inv)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete invoice ${inv.invoice_number}?`)) deleteMutation.mutate(inv.id!); }}
                      className="p-2 rounded-xl hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── DESKTOP: Table ── */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["Invoice #", "Customer", "Date", "Items", "Subtotal", "Discount", "Total", "Actions"].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, idx) => (
                    <tr key={inv.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                      <td className="py-3.5 px-4 font-mono text-xs font-medium text-gray-700">{inv.invoice_number}</td>
                      <td className="py-3.5 px-4 text-gray-700">{inv.customer_name ?? <span className="text-gray-400 italic">Walk-in</span>}</td>
                      <td className="py-3.5 px-4 text-gray-600">{inv.date ? String(inv.date).slice(0, 10) : ""}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">
                          {inv.items?.length ?? 0} item{(inv.items?.length ?? 0) !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700">${Number(inv.subtotal ?? 0).toFixed(2)}</td>
                      <td className="py-3.5 px-4">
                        {Number(inv.discount ?? 0) > 0 ? <span className="text-rose-600">-${Number(inv.discount ?? 0).toFixed(2)}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-700">${Number(inv.total ?? 0).toFixed(2)}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewingInvoice(inv)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"><Eye className="w-4 h-4" /></button>
                          <button
                            onClick={() => { if (confirm(`Delete invoice ${inv.invoice_number}?\nThis will restore all quantities back to inventory.`)) deleteMutation.mutate(inv.id!); }}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {viewingInvoice && <InvoiceDetailModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />}
    </div>
  );
}
