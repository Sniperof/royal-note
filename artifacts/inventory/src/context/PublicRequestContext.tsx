import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { PublicProduct } from "@/lib/publicCatalog";

export type PublicRequestItem = {
  product_id: number;
  brand: string;
  product_name: string;
  qty: number;
  thumbnail_path: string | null;
  size: string | null;
  concentration: string | null;
  gender: string | null;
  availability_label: PublicProduct["availability_label"];
};

type PublicRequestContextValue = {
  items: PublicRequestItem[];
  totalItems: number;
  requestPanelOpen: boolean;
  openRequestPanel: () => void;
  closeRequestPanel: () => void;
  addItem: (product: PublicProduct, qty?: number) => void;
  removeItem: (productId: number) => void;
  setQty: (productId: number, qty: number) => void;
  clear: () => void;
  hasItem: (productId: number) => boolean;
  getQty: (productId: number) => number;
};

const PublicRequestContext = createContext<PublicRequestContextValue | null>(null);

function toRequestItem(product: PublicProduct, qty: number): PublicRequestItem {
  return {
    product_id: product.id,
    brand: product.brand,
    product_name: product.name,
    qty,
    thumbnail_path: product.thumbnail_path,
    size: product.size,
    concentration: product.concentration,
    gender: product.gender,
    availability_label: product.availability_label,
  };
}

export function PublicRequestProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PublicRequestItem[]>([]);
  const [requestPanelOpen, setRequestPanelOpen] = useState(false);

  const value = useMemo<PublicRequestContextValue>(() => ({
    items,
    totalItems: items.reduce((sum, item) => sum + item.qty, 0),
    requestPanelOpen,
    openRequestPanel: () => setRequestPanelOpen(true),
    closeRequestPanel: () => setRequestPanelOpen(false),
    addItem: (product, qty = 1) => {
      const safeQty = Math.max(1, Math.floor(qty));
      setItems((current) => {
        const existing = current.find((item) => item.product_id === product.id);
        if (existing) {
          return current.map((item) =>
            item.product_id === product.id
              ? { ...item, qty: item.qty + safeQty }
              : item,
          );
        }
        return [...current, toRequestItem(product, safeQty)];
      });
    },
    removeItem: (productId) => {
      setItems((current) => current.filter((item) => item.product_id !== productId));
    },
    setQty: (productId, qty) => {
      const safeQty = Math.max(1, Math.floor(qty));
      setItems((current) =>
        current.map((item) =>
          item.product_id === productId
            ? { ...item, qty: safeQty }
            : item,
        ),
      );
    },
    clear: () => {
      setItems([]);
      setRequestPanelOpen(false);
    },
    hasItem: (productId) => items.some((item) => item.product_id === productId),
    getQty: (productId) => items.find((item) => item.product_id === productId)?.qty ?? 0,
  }), [items, requestPanelOpen]);

  return <PublicRequestContext.Provider value={value}>{children}</PublicRequestContext.Provider>;
}

export function usePublicRequest() {
  const context = useContext(PublicRequestContext);
  if (!context) {
    throw new Error("usePublicRequest must be used inside PublicRequestProvider");
  }
  return context;
}
