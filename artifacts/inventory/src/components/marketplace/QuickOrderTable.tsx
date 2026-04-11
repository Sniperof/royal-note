import CatalogRow from "./CatalogRow";
import type { CatalogItem } from "./catalogTypes";

// Must match CatalogRow GRID constant exactly
export const GRID = "lg:grid-cols-[20px_48px_120px_110px_1fr_72px_140px_150px_56px]";

export default function QuickOrderTable({
  items,
  selectedIds,
  favoriteIds,
  onSelect,
  onFavorite,
  allSelected,
  someSelected,
  onSelectAll,
  showSalesPrice = false,
  onUpdateSalePrice,
}: {
  items: CatalogItem[];
  selectedIds: Set<number>;
  favoriteIds: Set<number>;
  onSelect: (id: number) => void;
  onFavorite: (id: number) => void;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  showSalesPrice?: boolean;
  onUpdateSalePrice?: (id: number, price: number | null) => Promise<void>;
}) {
  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      {/* Desktop header */}
      <div className={`hidden border-b border-slate-200 bg-slate-50/70 px-5 py-3 lg:grid ${GRID} lg:items-center lg:gap-4`}>
        {/* Select-all checkbox */}
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
            onChange={onSelectAll}
            className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-slate-900"
          />
        </div>
        <span className="text-center text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Photo</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Category</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Brand</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Product</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Gender</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Availability</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
          {showSalesPrice ? "Sale Price" : "Catalog"}
        </span>
        <span className="text-right text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Actions</span>
      </div>

      <div>
        {items.map((item) => (
          <CatalogRow
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            favorite={favoriteIds.has(item.id)}
            onSelect={() => onSelect(item.id)}
            onFavorite={() => onFavorite(item.id)}
            showSalesPrice={showSalesPrice}
            onUpdateSalePrice={onUpdateSalePrice}
          />
        ))}
      </div>
    </div>
  );
}
