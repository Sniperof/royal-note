const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
export const PUBLIC_WHATSAPP_NUMBER = "963987410634";

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

export type PublicCatalogAnalyticsResponse = {
  summary: {
    total_views: number;
    total_whatsapp_clicks: number;
    total_inquiry_submissions: number;
  };
  top_products: Array<{
    product_id: number | null;
    product_name: string | null;
    brand: string | null;
    views: number;
    whatsapp_clicks: number;
    inquiries: number;
    total_events: number;
  }>;
  recent_inquiries: Array<{
    id: number;
    product_id: number | null;
    product_name: string;
    brand: string | null;
    company_name: string | null;
    contact_name: string;
    whatsapp: string;
    email: string | null;
    notes: string | null;
    created_at: string;
  }>;
};

export type PublicInquiryItemPayload = {
  product_id: number;
  qty: number;
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

export function publicWhatsAppTrackingUrl(id: number) {
  return `${BASE_URL}/api/public/catalog/${id}/whatsapp-click`;
}

export function publicCatalogAnalyticsUrl() {
  return `${BASE_URL}/api/public-catalog-analytics`;
}

function normalizeWhatsAppNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function buildPublicWhatsAppUrl(message: string) {
  const phone = normalizeWhatsAppNumber(PUBLIC_WHATSAPP_NUMBER);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildMultiProductWhatsAppMessage(items: Array<{
  brand: string;
  product_name: string;
  qty: number;
}>) {
  const lines = items.map(
    (item, index) => `${index + 1}. ${item.brand} ${item.product_name} — Qty: ${item.qty}`,
  );

  return [
    "Hello Royal Note, I want a B2B quote for these products:",
    "",
    ...lines,
    "",
    "Please share availability and quotation details.",
  ].join("\n");
}
