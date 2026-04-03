import { TraderPanelCard } from "@/components/TraderUI";

export default function CatalogSummaryCards({
  filteredCount,
  favoritesCount,
  selectedCount,
}: {
  filteredCount: number;
  favoritesCount: number;
  selectedCount: number;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <TraderPanelCard className="rounded-[24px] p-4">
        <p className="font-headline text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Live catalog</p>
        <p className="mt-2 text-2xl font-semibold text-slate-950">{filteredCount}</p>
        <p className="mt-1 text-sm text-slate-500">Products ready for broker review</p>
      </TraderPanelCard>

      <TraderPanelCard className="rounded-[24px] p-4">
        <p className="font-headline text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Saved</p>
        <p className="mt-2 text-2xl font-semibold text-slate-950">{favoritesCount}</p>
        <p className="mt-1 text-sm text-slate-500">Favorited products across the catalog</p>
      </TraderPanelCard>

      <TraderPanelCard className="rounded-[24px] p-4">
        <p className="font-headline text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Staged</p>
        <p className="mt-2 text-2xl font-semibold text-slate-950">{selectedCount}</p>
        <p className="mt-1 text-sm text-slate-500">Items prepared for one quote request</p>
      </TraderPanelCard>
    </div>
  );
}
