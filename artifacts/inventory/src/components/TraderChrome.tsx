import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Boxes, ClipboardList, Heart, LogOut, Menu, Search, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "./NotificationBell";

type TraderChromeProps = {
  eyebrow: string;
  title: string;
  description?: string;
  sideTitle?: string;
  sideSubtitle?: string;
  sideContent?: ReactNode;
  actions?: ReactNode;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof Boxes;
  enabled: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/catalog", label: "Marketplace", icon: Boxes, enabled: true },
  { href: "/favorites", label: "Favorites", icon: Heart, enabled: true },
  { href: "/my-quotations", label: "Active Quotes", icon: ClipboardList, enabled: true },
];

function defaultSearchPlaceholder(location: string) {
  if (location.startsWith("/favorites")) return "Search saved products";
  if (location.startsWith("/my-quotations")) return "Search quotations by reference";
  return "Search by brand, product, or barcode";
}

function initials(fullName?: string | null) {
  if (!fullName) return "T";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "T";
}

function TraderAvatar({ fullName, avatarUrl, className = "" }: { fullName?: string | null; avatarUrl?: string | null; className?: string }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={fullName ?? "Trader"} className={`rounded-full object-cover ${className}`} />;
  }

  return (
    <div className={`grid place-items-center rounded-full bg-white font-semibold text-slate-700 ${className}`}>
      {initials(fullName)}
    </div>
  );
}

export default function TraderChrome({
  eyebrow,
  title,
  description,
  sideTitle = "Trading Workspace",
  sideSubtitle = "Buyer navigation",
  sideContent,
  actions,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  children,
}: TraderChromeProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navLinks = (
    <div className="space-y-2">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === "/catalog" ? location.startsWith("/catalog") : location.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setDrawerOpen(false)}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              isActive
                ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                : "border-slate-200/70 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

  const sidebar = (
    <>
      {sideContent ? <div className="mt-8">{sideContent}</div> : null}

      <button
        onClick={() => {
          setDrawerOpen(false);
          void logout();
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-5 sm:px-6 xl:px-10">
          <button
            onClick={() => setDrawerOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="min-w-[150px]">
            <p className="font-headline text-2xl font-light uppercase tracking-[0.25em] text-slate-950">Royal Note</p>
          </div>

          <nav className="hidden items-center gap-8 lg:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/catalog" ? location.startsWith("/catalog") : location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-headline text-[11px] uppercase tracking-[0.18em] transition ${
                    isActive
                      ? "border-b border-slate-950 pb-1 font-semibold text-slate-950"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <span className="font-headline text-[11px] uppercase tracking-[0.18em] text-slate-300">Order History</span>
            <span className="font-headline text-[11px] uppercase tracking-[0.18em] text-slate-300">Analytics</span>
          </nav>

            {onSearchChange ? (
              <div className="hidden flex-1 items-center justify-center lg:flex">
                <div className="relative w-full max-w-xl">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchValue ?? ""}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder={searchPlaceholder ?? defaultSearchPlaceholder(location)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-12 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-slate-400"
                  />
                </div>
              </div>
            ) : (
              <div className="hidden flex-1 lg:block" />
            )}

          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-3 rounded-2xl bg-[#ffe7bf] px-3 py-2 shadow-sm transition hover:opacity-90"
              aria-label="Open account drawer"
            >
              <TraderAvatar fullName={user?.fullName} avatarUrl={user?.avatarUrl} className="h-10 w-10 text-sm" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {drawerOpen ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -28, opacity: 0 }}
              className="fixed inset-y-0 left-0 z-50 w-[320px] overflow-y-auto border-r border-slate-200/70 bg-background px-6 py-7 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <p className="font-headline text-lg font-light uppercase tracking-[0.22em] text-slate-950">Royal Note</p>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-8 rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <TraderAvatar fullName={user?.fullName} avatarUrl={user?.avatarUrl} className="h-14 w-14 text-base" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{user?.fullName ?? "Trader"}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">Buyer account</p>
                  </div>
                </div>
              </div>

              {navLinks}

              <div className="mt-8">
              {sidebar}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200/70 bg-background xl:block">
          <div className="sticky top-[92px] max-h-[calc(100vh-92px)] overflow-y-auto px-6 py-7">{sidebar}</div>
        </aside>

        <main className="px-4 py-6 sm:px-6 xl:px-10 xl:py-8">
          <div className="grid gap-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                {eyebrow ? <p className="font-headline text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400">{eyebrow}</p> : null}
                <h1 className="font-headline mt-3 text-[1.55rem] sm:text-[1.85rem] font-light leading-tight tracking-tight text-slate-950">
                  {title}
                </h1>
                {description ? <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
              </div>
              {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
