import { Router } from "express";
import { pool } from "@workspace/db";

export const statsRouter = Router();

statsRouter.get("/products", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        inv.id AS inventory_id,
        inv.barcode,
        inv.brand,
        inv.name,
        inv.size,
        inv.concentration,
        inv.gender,
        inv.qty AS current_qty,
        inv.cost_usd,
        COALESCE(SUM(ii.qty), 0) AS total_units_sold,
        COALESCE(SUM(ii.qty * ii.unit_price_aed), 0) AS total_revenue_aed,
        COALESCE(SUM(ii.qty * (ii.unit_price_aed - COALESCE(ii.cost_usd, 0))), 0) AS total_profit_aed,
        (
          SELECT ii2.unit_price_aed
          FROM invoice_items ii2
          JOIN invoices inv2 ON inv2.id = ii2.invoice_id
          WHERE ii2.inventory_id = inv.id
          ORDER BY inv2.created_at DESC
          LIMIT 1
        ) AS last_sale_price_aed
      FROM inventory inv
      LEFT JOIN invoice_items ii ON ii.inventory_id = inv.id
      GROUP BY inv.id
      ORDER BY total_units_sold DESC, inv.brand, inv.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
