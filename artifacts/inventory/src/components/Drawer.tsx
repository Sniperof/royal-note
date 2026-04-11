import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  X, Box, FileText, BarChart2, Users, Truck, ShieldCheck, LogOut,
  Receipt, BookOpen, ChevronRight, LayoutGrid, ClipboardList, ShoppingCart, Tag, AlertCircle, ListOrdered,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  group: string;
  badge?: number;
}

function buildAdminNavItems(role?: string, pendingQuotes = 0): NavItem[] {
  const items: NavItem[] = [
    { href: "/", label: "Inventory", icon: Box, group: "Main" },
    { href: "/invoices", label: "Sales Invoices", icon: FileText, group: "Main" },
    { href: "/stats", label: "Statistics", icon: BarChart2, group: "Main" },
    { href: "/expenses", label: "Expenses", icon: Receipt, group: "Finance" },
    { href: "/purchases", label: "Purchase Orders", icon: ShoppingCart, group: "Finance" },
    { href: "/price-lists", label: "Price Lists", icon: ListOrdered, group: "Finance" },
    { href: "/accounts-payable", label: "Accounts Payable", icon: AlertCircle, group: "Finance" },
    { href: "/ledger", label: "General Ledger", icon: BookOpen, group: "Finance" },
    { href: "/customers", label: "Customers", icon: Users, group: "Contacts" },
    { href: "/suppliers", label: "Suppliers", icon: Truck, group: "Contacts" },
    { href: "/brands", label: "Brands", icon: Tag, group: "Contacts" },
    { href: "/quotations", label: "Quotations", icon: ClipboardList, group: "Sales", badge: pendingQuotes || undefined },
  ];
  if (role === "super_admin") {
    items.push({ href: "/users", label: "User Management", icon: ShieldCheck, group: "Admin" });
  }
  return items;
}

function buildTraderNavItems(): NavItem[] {
  return [
    { href: "/catalog", label: "Product Catalog", icon: LayoutGrid, group: "Catalog" },
    { href: "/favorites", label: "My Favorites", icon: Box, group: "Catalog" },
    { href: "/my-quotations", label: "My Quotations", icon: ClipboardList, group: "Catalog" },
  ];
}

const ADMIN_GROUP_ORDER = ["Main", "Finance", "Sales", "Contacts", "Admin"];
const ADMIN_GROUP_LABEL: Record<string, string> = {
  Main: "Main",
  Finance: "Finance",
  Sales: "Sales",
  Contacts: "Contacts",
  Admin: "Administration",
};

interface DrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function Drawer({ open, onClose }: DrawerProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const isTrader = user?.role === "wholesale_trader" || user?.role === "sales_representative";

  const { data: quotationsData } = useQuery<Array<{ status: string }>>({
    queryKey: ["admin-quotations"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/quotations`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !isTrader && open,
    staleTime: 30_000,
  });

  const pendingQuotes = isTrader ? 0 : (quotationsData ?? []).filter((q) => q.status === "pending").length;
  const navItems = isTrader ? buildTraderNavItems() : buildAdminNavItems(user?.role, pendingQuotes);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const grouped = isTrader
    ? { Catalog: navItems }
    : ADMIN_GROUP_ORDER.reduce<Record<string, NavItem[]>>((acc, g) => {
        const items = navItems.filter((n) => n.group === g);
        if (items.length) acc[g] = items;
        return acc;
      }, {});

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        className={`fixed left-0 top-0 bottom-0 z-50 w-72 bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-[cubic-bezier(.32,.72,0,1)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-black text-white rounded-xl flex items-center justify-center shadow-md shadow-black/10 flex-shrink-0">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 leading-tight">Royal Note</div>
              <div className="text-xs text-gray-400">Wholesale trading platform</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              {!isTrader && (
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-1.5">
                  {ADMIN_GROUP_LABEL[group] ?? group}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map(({ href, label, icon: Icon, badge }) => {
                  const isActive = href === "/" ? location === "/" : location.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                        isActive
                          ? "bg-gray-900 text-white shadow-sm"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-gray-400 group-hover:text-gray-700"}`} />
                      <span className="flex-1">{label}</span>
                      {badge !== undefined && badge > 0 && (
                        <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ${isActive ? "bg-white text-gray-900" : "bg-yellow-400 text-white"}`}>
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                      {!isActive && badge === undefined && (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User card + logout */}
        <div className="border-t border-gray-100 p-4">
          {isTrader && (
            <div className="bg-indigo-50 rounded-xl px-3 py-2.5 mb-3">
              <p className="text-xs font-medium text-indigo-700">
                {user?.role === "sales_representative" ? "Sales Representative Account" : "Wholesale Trader Account"}
              </p>
              <p className="text-[11px] text-indigo-400 mt-0.5">
                {user?.role === "sales_representative"
                  ? "Manage your catalog pricing and prepare quotations"
                  : "Select products and request quotations"}
              </p>
            </div>
          )}
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 select-none">
              {user?.fullName?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{user?.fullName}</div>
              <div className="text-xs text-gray-400">
                {user?.role === "super_admin"
                  ? "Super Admin"
                  : user?.role === "sales_representative"
                  ? "Sales Representative"
                  : "Wholesale Trader"}
              </div>
            </div>
            <button
              onClick={() => { onClose(); logout(); }}
              title="Sign out"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
