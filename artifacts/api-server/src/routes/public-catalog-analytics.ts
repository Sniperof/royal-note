import { Router } from "express";
import { pool } from "@workspace/db";
import { ensureCoreSchema } from "../lib/ensureCoreSchema";
import { requireAdmin, requireAuth } from "../middleware/auth";

export const publicCatalogAnalyticsRouter = Router();

publicCatalogAnalyticsRouter.use(requireAuth, requireAdmin);

publicCatalogAnalyticsRouter.get("/", async (_req, res) => {
  await ensureCoreSchema();

  try {
    const [totalsResult, topProductsResult, recentInquiriesResult] = await Promise.all([
      pool.query<{
        total_views: string;
        total_whatsapp_clicks: string;
        total_inquiry_submissions: string;
      }>(`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'product_view')::int AS total_views,
          COUNT(*) FILTER (WHERE event_type = 'whatsapp_click')::int AS total_whatsapp_clicks,
          COUNT(*) FILTER (WHERE event_type = 'inquiry_submitted')::int AS total_inquiry_submissions
        FROM public_catalog_events
      `),
      pool.query<{
        product_id: number | null;
        product_name: string | null;
        brand: string | null;
        views: string;
        whatsapp_clicks: string;
        inquiries: string;
        total_events: string;
      }>(`
        SELECT
          product_id,
          COALESCE(MAX(product_name), 'Unknown Product') AS product_name,
          MAX(brand) AS brand,
          COUNT(*) FILTER (WHERE event_type = 'product_view')::int AS views,
          COUNT(*) FILTER (WHERE event_type = 'whatsapp_click')::int AS whatsapp_clicks,
          COUNT(*) FILTER (WHERE event_type = 'inquiry_submitted')::int AS inquiries,
          COUNT(*)::int AS total_events
        FROM public_catalog_events
        WHERE product_id IS NOT NULL
        GROUP BY product_id
        ORDER BY total_events DESC, views DESC, whatsapp_clicks DESC, inquiries DESC, product_id DESC
        LIMIT 12
      `),
      pool.query<{
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
      }>(`
        SELECT
          id,
          product_id,
          product_name,
          brand,
          company_name,
          contact_name,
          whatsapp,
          email,
          notes,
          created_at
        FROM public_catalog_inquiries
        ORDER BY created_at DESC, id DESC
        LIMIT 10
      `),
    ]);

    const totals = totalsResult.rows[0] ?? {
      total_views: "0",
      total_whatsapp_clicks: "0",
      total_inquiry_submissions: "0",
    };

    res.json({
      summary: {
        total_views: Number(totals.total_views ?? 0),
        total_whatsapp_clicks: Number(totals.total_whatsapp_clicks ?? 0),
        total_inquiry_submissions: Number(totals.total_inquiry_submissions ?? 0),
      },
      top_products: topProductsResult.rows.map((row) => ({
        product_id: row.product_id,
        product_name: row.product_name,
        brand: row.brand,
        views: Number(row.views ?? 0),
        whatsapp_clicks: Number(row.whatsapp_clicks ?? 0),
        inquiries: Number(row.inquiries ?? 0),
        total_events: Number(row.total_events ?? 0),
      })),
      recent_inquiries: recentInquiriesResult.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});
