import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CheckCheck,
  CircleDollarSign,
  ClipboardList,
  Send,
  Tag,
  X,
  XCircle,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  quotation_id: number | null;
  ref_number: string | null;
  created_at: string;
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Bell; color: string; label: string }
> = {
  quotation_priced: { icon: CircleDollarSign, color: "bg-blue-50 text-blue-700", label: "Pricing ready" },
  quotation_sent: { icon: Send, color: "bg-emerald-50 text-emerald-700", label: "Quote sent" },
  quotation_cancelled: { icon: XCircle, color: "bg-red-50 text-red-700", label: "Request cancelled" },
  product_discount: { icon: Tag, color: "bg-amber-50 text-amber-700", label: "Discount added" },
};

export default function NotificationBell() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: unreadCountData } = useQuery<{ count: number }>({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/notifications/unread-count`, { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/notifications`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
    staleTime: 15_000,
  });

  const unreadCount = open
    ? notifications.filter((notification) => !notification.is_read).length
    : (unreadCountData?.count ?? 0);

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE_URL}/api/notifications/${id}/read`, {
        method: "PUT",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await fetch(`${BASE_URL}/api/notifications/read-all`, {
        method: "PUT",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  function handleNotificationClick(notification: Notification) {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.quotation_id) {
      navigate("/my-quotations");
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-0.5 -top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-3 w-[360px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="font-headline text-[11px] font-bold uppercase tracking-[0.22em] text-slate-900">Notifications</p>
                 <p className="mt-1 text-xs text-slate-400">Pricing updates, quote activity, and broker notices</p>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 ? (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                ) : null}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-12 text-center">
                  <Bell className="mb-3 h-8 w-8 text-slate-200" />
                  <p className="text-sm text-slate-400">No updates yet</p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const cfg = TYPE_CONFIG[notification.type] ?? {
                    icon: Bell,
                    color: "bg-slate-50 text-slate-700",
                    label: "Notification",
                  };
                  const Icon = cfg.icon;

                  return (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`flex w-full items-start gap-3 border-b border-slate-50 px-5 py-4 text-left transition-colors last:border-0 hover:bg-slate-50 ${
                        !notification.is_read ? "bg-blue-50/30" : ""
                      }`}
                    >
                      <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${cfg.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-headline text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                              {cfg.label}
                            </p>
                            <p
                              className={`mt-1 text-sm leading-snug ${
                                !notification.is_read ? "font-semibold text-slate-900" : "font-medium text-slate-700"
                              }`}
                            >
                              {notification.title}
                            </p>
                          </div>
                          {!notification.is_read ? <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" /> : null}
                        </div>

                        {notification.message ? (
                          <p className="mt-1 text-xs leading-snug text-slate-500">{notification.message}</p>
                        ) : null}

                        {notification.ref_number ? (
                          <div className="mt-2 flex items-center gap-1">
                            <ClipboardList className="h-3 w-3 text-slate-400" />
                            <span className="font-mono text-xs text-slate-500">{notification.ref_number}</span>
                          </div>
                        ) : null}

                        <p className="mt-2 text-[10px] text-slate-400">{timeAgo(notification.created_at)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
