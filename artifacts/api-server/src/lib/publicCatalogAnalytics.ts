import { pool } from "@workspace/db";

export type PublicCatalogEventType =
  | "product_view"
  | "whatsapp_click"
  | "inquiry_submitted";

export async function insertPublicCatalogEvent(input: {
  eventType: PublicCatalogEventType;
  productId?: number | null;
  inquiryId?: number | null;
  productName?: string | null;
  brand?: string | null;
}) {
  await pool.query(
    `
      INSERT INTO public_catalog_events (
        event_type,
        product_id,
        inquiry_id,
        product_name,
        brand
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      input.eventType,
      input.productId ?? null,
      input.inquiryId ?? null,
      input.productName ?? null,
      input.brand ?? null,
    ],
  );
}
