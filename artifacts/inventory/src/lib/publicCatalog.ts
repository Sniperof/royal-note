const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export type PublicProduct = {
  id: number;
  brand: string;
  name: string;
  description: string | null;
  main_category: string;
  sub_category: string | null;
  size: string | null;
  concentration: string | null;
  gender: string | null;
  thumbnail_path: string | null;
  discount_percent: number | null;
  availability_label: "available" | "limited" | "coming_soon" | "unavailable";
};

export type PublicCatalogListResponse = {
  items: PublicProduct[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
};

export type PublicProductDetailResponse = PublicProduct & {
  similar_products: PublicProduct[];
};

export function buildPublicCatalogQuery(params: {
  q?: string;
  brand?: string;
  main_category?: string;
  sub_category?: string;
  gender?: string;
  page?: number;
  page_size?: number;
}) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, String(value));
  }

  const suffix = searchParams.toString();
  return `${BASE_URL}/api/public/catalog${suffix ? `?${suffix}` : ""}`;
}

export function publicProductUrl(id: number) {
  return `${BASE_URL}/api/public/catalog/${id}`;
}

export function publicInquiryUrl() {
  return `${BASE_URL}/api/public/inquiries`;
}
