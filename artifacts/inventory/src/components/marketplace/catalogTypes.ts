export interface PLOffer {
  id: number;
  supplier_id: number;
  supplier_name: string;
  offered_qty: number;
  cost_usd: number;
  suggested_sale_price_aed: number;
  availability_location?: string | null;
}

export interface CatalogItem {
  id: number;
  brand: string;
  name: string;
  barcode: string;
  main_category: string;
  sub_category: string | null;
  size: string | null;
  concentration: string | null;
  gender: string | null;
  description: string | null;
  thumbnail_path: string | null;
  discount_percent: number | null;
  qty: number;
  sale_price_aed?: number | string | null;
  sales_rep_sale_price_aed?: number | string | null;
  effective_sale_price_aed?: number | string | null;
  can_edit_sale_price?: boolean;
  product_type?: string;
  available_locations?: string[];
  assigned_source_ids?: number[];
  availability_mode?: "stock_only" | "source_only" | "stock_and_source" | "incoming" | "unavailable";
  incoming_qty?: number;
  price_list_offers?: PLOffer[];
  total_offered_qty?: number;
}

export type BrandCard = {
  id: number;
  name: string;
  image_path: string | null;
};

export type GenderFilter = "all" | "men" | "women" | "unisex";
export type CategoryFilter = "all" | "perfume" | "makeup" | "skin_care";
export type SortOption = "featured" | "brand" | "discount";
export type ViewMode = "quick" | "gallery";
