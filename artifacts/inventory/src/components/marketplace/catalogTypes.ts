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
  available_locations?: string[];
  assigned_source_ids?: number[];
  availability_mode?: "stock_only" | "source_only" | "stock_and_source" | "incoming" | "unavailable";
  incoming_qty?: number;
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
