import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2, Search, ShieldCheck } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type ActivityLogEntry = {
  id: number;
  actor_user_id: number | null;
  actor_role: string | null;
  actor_full_name: string | null;
  actor_username: string | null;
  action_type: string;
  entity_type: string;
  entity_id: number | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelForAction(actionType: string) {
  switch (actionType) {
    case "invoice_voided":
      return "Invoice Voided";
    case "customer_payment_recorded":
      return "Customer Payment";
    case "ap_settlement_recorded":
      return "AP Settlement";
    case "cashbox_movement_created":
      return "Cashbox Created";
    case "cashbox_movement_updated":
      return "Cashbox Updated";
    case "cashbox_movement_deleted":
      return "Cashbox Deleted";
    default:
      return actionType;
  }
}

function badgeClasses(actionType: string) {
  if (actionType.includes("void")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (actionType.includes("payment") || actionType.includes("settlement")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function ActivityLogPage() {
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery<ActivityLogEntry[]>({
    queryKey: ["activity-log"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/activity-log`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load activity log");
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((entry) => {
      const actor = `${entry.actor_full_name ?? ""} ${entry.actor_username ?? ""}`.toLowerCase();
      return (
        entry.summary.toLowerCase().includes(needle) ||
        labelForAction(entry.action_type).toLowerCase().includes(needle) ||
        actor.includes(needle) ||
        String(entry.entity_type).toLowerCase().includes(needle) ||
        JSON.stringify(entry.metadata ?? {}).toLowerCase().includes(needle)
      );
    });
  }, [data, search]);

  return (
    <div className="flex-1 bg-[#FAFAFA]">
      <div className="border-b border-gray-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>
              <p className="text-sm text-gray-500">Traceability for sensitive financial and cashbox actions.</p>
            </div>
          </div>
          <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right md:block">
            <p className="text-xs text-slate-500">Visible Entries</p>
            <p className="text-xl font-bold text-slate-900">{filtered.length}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Search Activity</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by action, actor, summary, or metadata"
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-20 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">No activity log entries matched this search.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClasses(entry.action_type)}`}>
                        {labelForAction(entry.action_type)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {entry.entity_type}
                        {entry.entity_id !== null ? ` #${entry.entity_id}` : ""}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-900">{entry.summary}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {entry.actor_full_name || entry.actor_username || "Unknown actor"}
                      {entry.actor_role ? ` | ${entry.actor_role}` : ""}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">{formatDateTime(entry.created_at)}</div>
                </div>

                <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Metadata</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-gray-700">
                    {JSON.stringify(entry.metadata ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
