import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middleware/auth";

export const publicInquiriesRouter = Router();

publicInquiriesRouter.use(requireAuth, requireAdmin);

publicInquiriesRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          pci.id,
          pci.product_id,
          pci.product_name,
          pci.brand,
          pci.company_name,
          pci.contact_name,
          pci.whatsapp,
          pci.email,
          pci.notes,
          pci.created_at
        FROM public_catalog_inquiries pci
        ORDER BY pci.created_at DESC, pci.id DESC
      `,
    );

    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});
