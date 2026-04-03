import { X, Printer } from "lucide-react";
import type { Invoice } from "@workspace/api-client-react";

interface Props {
  invoice: Invoice;
  onClose: () => void;
}

const GENDER_MAP: Record<string, string> = {
  male: "Men", female: "Women", unisex: "Unisex",
  men: "Men", women: "Women",
  "for men": "Men", "for women": "Women",
};
function genderLabel(g: string | null | undefined) {
  if (!g) return "";
  return GENDER_MAP[g.toLowerCase()] ?? g;
}

export default function InvoiceDetailModal({ invoice, onClose }: Props) {
  const items = invoice.items ?? [];
  const subtotal = Number(invoice.subtotal ?? 0);
  const discount = Number(invoice.discount ?? 0);
  const total = Number(invoice.total ?? 0);

  function handlePrint() {
    const printContent = document.getElementById("invoice-print-area");
    if (!printContent) return;
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="en">
<head><meta charset="utf-8"><title>Invoice ${invoice.invoice_number}</title>
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
  .totals { margin-left: auto; width: 240px; }
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
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Invoice Details</h2>
            <p className="text-sm text-gray-400 font-mono">{invoice.invoice_number}</p>
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

        {/* Printable content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <div id="invoice-print-area">
            {/* Invoice Header */}
            <div className="flex justify-between items-start border-b-2 border-black pb-5 mb-5">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Royal Note</h1>
                <p className="text-sm text-gray-500">Sales Invoice</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</p>
                <p className="text-sm text-gray-500 mt-1">{invoice.date ? String(invoice.date).slice(0, 10) : ""}</p>
              </div>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-5 mb-6">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Customer</p>
                <p className="text-sm font-medium text-gray-900">{invoice.customer_name ?? "Walk-in"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Date</p>
                <p className="text-sm font-medium text-gray-900">{invoice.date ? String(invoice.date).slice(0, 10) : ""}</p>
              </div>
              {invoice.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                  <p className="text-sm text-gray-700">{invoice.notes}</p>
                </div>
              )}
            </div>

            {/* Items Table */}
            <table className="w-full text-sm mb-6">
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

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-56 space-y-2">
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
                <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-3 mt-2">
                  <span>Total</span>
                  <span className="text-emerald-700">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
