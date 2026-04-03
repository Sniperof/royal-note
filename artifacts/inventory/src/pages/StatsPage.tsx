import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, DollarSign, Package, Users, ChevronDown, ChevronUp } from "lucide-react";
import { getProductStats } from "@workspace/api-client-react";
import type { ProductStats } from "@workspace/api-client-react";

const GENDER_MAP: Record<string, string> = {
  male: "Men", female: "Women", unisex: "Unisex",
  men: "Men", women: "Women",
  "for men": "Men", "for women": "Women",
};
function genderLabel(g: string | null | undefined) {
  if (!g) return "—";
  return GENDER_MAP[g.toLowerCase()] ?? g;
}
function genderColor(g: string | null | undefined) {
  const v = g?.toLowerCase();
  if (v === "male" || v === "men" || v === "for men") return "text-blue-600 bg-blue-50";
  if (v === "female" || v === "women" || v === "for women") return "text-pink-600 bg-pink-50";
  return "text-violet-600 bg-violet-50";
}

type SortKey = keyof ProductStats;

export default function StatsPage() {
  const [sortKey, setSortKey] = useState<SortKey>("total_units_sold");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState("");

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ["product-stats"],
    queryFn: () => getProductStats(),
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const filtered = stats.filter(s => {
    const q = filter.toLowerCase();
    return !q || [s.brand, s.name, s.barcode, s.gender].some(v => v?.toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    const va = Number(a[sortKey] ?? 0);
    const vb = Number(b[sortKey] ?? 0);
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const totalRevenue = stats.reduce((s, p) => s + Number(p.total_revenue_aed ?? 0), 0);
  const totalProfit = stats.reduce((s, p) => s + Number(p.total_profit_aed ?? 0), 0);
  const totalSold = stats.reduce((s, p) => s + Number(p.total_units_sold ?? 0), 0);
  const totalStock = stats.reduce((s, p) => s + Number(p.current_qty ?? 0), 0);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 text-xs">⇅</span>;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;
  }

  function SortTh({ col, label }: { col: SortKey; label: string }) {
    return (
      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-900 transition-colors select-none whitespace-nowrap" onClick={() => toggleSort(col)}>
        {label} <SortIcon col={col} />
      </th>
    );
  }

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {[
          { Icon: TrendingUp, bg: "bg-emerald-600", label: "Total Revenue", val: `$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
          { Icon: DollarSign, bg: "bg-black", label: "Total Profit", val: `$${totalProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: totalProfit >= 0 ? "text-emerald-700" : "text-rose-600" },
          { Icon: Users, bg: "bg-violet-600", label: "Units Sold", val: totalSold.toLocaleString("en-US") },
          { Icon: Package, bg: "bg-amber-500", label: "Current Stock", val: totalStock.toLocaleString("en-US") },
        ].map(({ Icon, bg, label, val, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-xs text-gray-500 leading-tight">{label}</p>
            </div>
            <p className={`text-lg sm:text-xl font-bold ${color ?? "text-gray-900"}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900">Product Statistics</h2>
        <input
          type="text" value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filter…"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 w-36 sm:w-48"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── MOBILE: Cards ── */}
          <div className="sm:hidden space-y-2">
            {sorted.map((s) => {
              const sold = Number(s.total_units_sold ?? 0);
              const revenue = Number(s.total_revenue_aed ?? 0);
              const profit = Number(s.total_profit_aed ?? 0);
              const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(0) : null;
              const lastSale = s.last_sale_price_aed ? Number(s.last_sale_price_aed) : null;
              return (
                <div key={s.inventory_id} className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 shadow-[0_2px_8px_rgb(0,0,0,0.04)]">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{s.brand}</p>
                      <p className="text-xs text-gray-500 truncate">{s.name}{s.size ? ` · ${s.size}` : ""}{s.concentration ? ` · ${s.concentration}` : ""}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${genderColor(s.gender)}`}>{genderLabel(s.gender)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-gray-50 rounded-xl p-2">
                      <p className="text-[10px] text-gray-400 mb-0.5">Stock</p>
                      <p className={`text-sm font-bold ${Number(s.current_qty) === 0 ? "text-rose-600" : Number(s.current_qty) <= 3 ? "text-amber-600" : "text-gray-900"}`}>{s.current_qty}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2">
                      <p className="text-[10px] text-gray-400 mb-0.5">Sold</p>
                      <p className="text-sm font-bold text-gray-900">{sold}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2">
                      <p className="text-[10px] text-gray-400 mb-0.5">Revenue</p>
                      <p className="text-sm font-bold text-gray-900">{revenue > 0 ? `$${revenue.toFixed(0)}` : "—"}</p>
                    </div>
                    <div className={`rounded-xl p-2 ${profit > 0 ? "bg-emerald-50" : profit < 0 ? "bg-rose-50" : "bg-gray-50"}`}>
                      <p className="text-[10px] text-gray-400 mb-0.5">Profit</p>
                      <p className={`text-sm font-bold ${profit > 0 ? "text-emerald-700" : profit < 0 ? "text-rose-600" : "text-gray-400"}`}>
                        {profit !== 0 ? `$${profit.toFixed(0)}` : "—"}
                      </p>
                      {margin !== null && profit !== 0 && <p className="text-[9px] text-gray-400">{margin}%</p>}
                    </div>
                  </div>
                  {lastSale && <p className="text-xs text-gray-400 mt-2">Last sale: ${lastSale.toFixed(2)} · Cost: ${s.cost_usd ? `$${Number(s.cost_usd).toFixed(2)}` : "—"}</p>}
                </div>
              );
            })}
          </div>

          {/* ── DESKTOP: Table ── */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Product</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500">Gender</th>
                    <SortTh col="current_qty" label="Stock" />
                    <SortTh col="cost_usd" label="Cost (USD)" />
                    <SortTh col="last_sale_price_aed" label="Last Sale" />
                    <SortTh col="total_units_sold" label="Units Sold" />
                    <SortTh col="total_revenue_aed" label="Revenue" />
                    <SortTh col="total_profit_aed" label="Profit" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, idx) => {
                    const sold = Number(s.total_units_sold ?? 0);
                    const revenue = Number(s.total_revenue_aed ?? 0);
                    const profit = Number(s.total_profit_aed ?? 0);
                    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                    const lastSale = s.last_sale_price_aed ? Number(s.last_sale_price_aed) : null;
                    const maxSold = Math.max(...sorted.map(x => Number(x.total_units_sold ?? 0)));
                    return (
                      <tr key={s.inventory_id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/20"}`}>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-gray-900">{s.brand}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[160px]">{s.name}</div>
                          <div className="flex gap-1 mt-1">
                            {s.size && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{s.size}</span>}
                            {s.concentration && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{s.concentration}</span>}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${genderColor(s.gender)}`}>{genderLabel(s.gender)}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`font-semibold ${Number(s.current_qty) === 0 ? "text-rose-600" : Number(s.current_qty) <= 3 ? "text-amber-600" : "text-gray-900"}`}>{s.current_qty}</span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-700">{s.cost_usd ? `$${Number(s.cost_usd).toFixed(2)}` : <span className="text-gray-400">—</span>}</td>
                        <td className="py-3.5 px-4 font-medium text-gray-900">{lastSale ? `$${lastSale.toFixed(2)}` : <span className="text-gray-400">—</span>}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">{sold}</div>
                          {sold > 0 && maxSold > 0 && (
                            <div className="w-16 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                              <div className="h-1 bg-black rounded-full" style={{ width: `${Math.min(100, (sold / maxSold) * 100)}%` }} />
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700">{revenue > 0 ? `$${revenue.toFixed(2)}` : <span className="text-gray-400">—</span>}</td>
                        <td className="py-3.5 px-4">
                          {profit !== 0 ? (
                            <div>
                              <span className={`font-semibold ${profit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>${profit.toFixed(2)}</span>
                              {revenue > 0 && <div className={`text-xs mt-0.5 ${margin >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{margin.toFixed(0)}%</div>}
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
