import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "./pages/Home";
import ContactsPage from "./pages/ContactsPage";
import BrandsPage from "./pages/BrandsPage";
import InvoicesPage from "./pages/InvoicesPage";
import StatsPage from "./pages/StatsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import UserManagementPage from "./pages/UserManagementPage";
import ExpensesPage from "./pages/ExpensesPage";
import LedgerPage from "./pages/LedgerPage";
import PurchasesPage from "./pages/PurchasesPage";
import AccountsPayablePage from "./pages/AccountsPayablePage";
import CustomerReceivablesPage from "./pages/CustomerReceivablesPage";
import SupplierPayablesPage from "./pages/SupplierPayablesPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import PriceListsPage from "./pages/PriceListsPage";
import LoginPage from "./pages/LoginPage";
import WholesaleCatalogPage from "./pages/WholesaleCatalogPage";
import MyFavoritesPage from "./pages/MyFavoritesPage";
import MyQuotationsPage from "./pages/MyQuotationsPage";
import QuotationsAdminPage from "./pages/QuotationsAdminPage";
import PublicCatalogPage from "./pages/PublicCatalogPage";
import PublicProductPage from "./pages/PublicProductPage";
import PublicInquiriesPage from "./pages/PublicInquiriesPage";
import PublicCatalogAnalyticsPage from "./pages/PublicCatalogAnalyticsPage";
import Drawer from "./components/Drawer";
import NotificationBell from "./components/NotificationBell";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Box, Menu, Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type RuntimeInfo = {
  environment: "DEV" | "PROD";
  node_env: string;
  database_name: string;
};

const TRADER_PATHS = ["/catalog", "/favorites", "/my-quotations"];

function isTraderPath(pathname: string) {
  return TRADER_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function getRoleHomePath(role: "super_admin" | "wholesale_trader" | "sales_representative") {
  return role === "super_admin" ? "/" : "/catalog";
}

function useRuntimeInfo() {
  return useQuery<RuntimeInfo>({
    queryKey: ["runtime-info"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/runtime-info`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to load runtime info");
      }
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

function EnvironmentBadge({ runtimeInfo }: { runtimeInfo?: RuntimeInfo }) {
  if (!runtimeInfo) return null;

  const isProd = runtimeInfo.environment === "PROD";
  return (
    <div
      className={`hidden md:flex items-center gap-2 rounded-xl border px-3 py-1.5 ${
        isProd
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
      title={`Database: ${runtimeInfo.database_name}`}
    >
      <span className="text-[11px] font-bold tracking-wide">{runtimeInfo.environment}</span>
      <span className="text-[11px] opacity-80">{runtimeInfo.database_name}</span>
    </div>
  );
}

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth();
  const { data: runtimeInfo } = useRuntimeInfo();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 h-14">
      <div className="h-full px-4 flex items-center justify-between gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 bg-black text-white rounded-xl flex items-center justify-center shadow-sm shadow-black/10">
            <Box className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm font-bold text-gray-900">Royal Note</span>
        </div>

        <div className="flex-1" />

        <EnvironmentBadge runtimeInfo={runtimeInfo} />

        {user && (
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-gray-800 leading-tight">{user.fullName}</span>
              <span className="text-[10px] text-gray-400">
                {user.role === "super_admin"
                  ? "Super Admin"
                  : user.role === "sales_representative"
                  ? "Sales Representative"
                  : "Wholesale Trader"}
              </span>
            </div>
            <div
              onClick={onMenuClick}
              className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold cursor-pointer select-none hover:bg-gray-700 transition-colors"
            >
              {user.fullName[0].toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function TraderHome() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/catalog"); }, [navigate]);
  return null;
}

function AdminRoutes({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/inventory/:id" component={ProductDetailPage} />
      <Route path="/invoices" component={InvoicesPage} />
      <Route path="/stats" component={StatsPage} />
      <Route path="/expenses" component={ExpensesPage} />
      <Route path="/ledger" component={LedgerPage} />
      <Route path="/accounts-payable" component={AccountsPayablePage} />
      <Route path="/customer-receivables" component={CustomerReceivablesPage} />
      <Route path="/supplier-payables" component={SupplierPayablesPage} />
      <Route path="/activity-log" component={ActivityLogPage} />
      <Route path="/price-lists" component={PriceListsPage} />
      <Route path="/purchases" component={PurchasesPage} />
      <Route path="/customers">
        <ContactsPage type="customers" />
      </Route>
      <Route path="/suppliers">
        <ContactsPage type="suppliers" />
      </Route>
      <Route path="/brands" component={BrandsPage} />
      <Route path="/quotations" component={QuotationsAdminPage} />
      <Route path="/public-inquiries" component={PublicInquiriesPage} />
      <Route path="/public-catalog-analytics" component={PublicCatalogAnalyticsPage} />
      {isSuperAdmin ? <Route path="/users" component={UserManagementPage} /> : null}
      <Route component={NotFound} />
    </Switch>
  );
}

function TraderRoutes() {
  return (
    <Switch>
      <Route path="/catalog" component={WholesaleCatalogPage} />
      <Route path="/favorites" component={MyFavoritesPage} />
      <Route path="/my-quotations" component={MyQuotationsPage} />
      <Route component={TraderHome} />
    </Switch>
  );
}

function PublicRoutes() {
  return (
    <Switch>
      <Route path="/" component={PublicCatalogPage} />
      <Route path="/catalog/:id" component={PublicProductPage} />
      <Route path="/login" component={LoginPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: runtimeInfo } = useRuntimeInfo();

  useEffect(() => {
    if (!runtimeInfo) return;
    document.title = `Royal Note | ${runtimeInfo.environment} | ${runtimeInfo.database_name}`;
  }, [runtimeInfo]);

  useEffect(() => {
    if (loading || !user) return;

    const shouldRedirect =
      ((user.role === "wholesale_trader" || user.role === "sales_representative") && !isTraderPath(location)) ||
      (user.role === "super_admin" && isTraderPath(location));

    if (shouldRedirect) {
      navigate(getRoleHomePath(user.role), { replace: true });
    }
  }, [loading, user, location, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return <PublicRoutes />;
  }

  const isTrader = user.role === "wholesale_trader" || user.role === "sales_representative";
  const shouldRedirect =
    (isTrader && !isTraderPath(location)) ||
    (!isTrader && isTraderPath(location));

  if (shouldRedirect) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      {isTrader ? (
        <TraderRoutes />
      ) : (
        <>
          <TopBar onMenuClick={() => setDrawerOpen(true)} />
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
          <AdminRoutes isSuperAdmin={user.role === "super_admin"} />
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
