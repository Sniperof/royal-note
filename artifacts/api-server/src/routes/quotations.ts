import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router: IRouter = Router();

function isTraderOrSalesRep(role: unknown) {
  return role === "wholesale_trader" || role === "sales_representative";
}

// GET /api/quotations — admin: all; trader: own
router.get("/", requireAuth, async (req: any, res) => {
  const isAdmin = req.session.role === "super_admin";
  let query: string;
  let params: unknown[];

  if (isAdmin) {
    query = `
      SELECT q.*,
        u.full_name AS trader_name, u.username AS trader_username, u.phone AS trader_phone,
        COUNT(qi.id)::int AS items_count
      FROM quotations q
      JOIN users u ON u.id = q.trader_id
      LEFT JOIN quotation_items qi ON qi.quotation_id = q.id
      GROUP BY q.id, u.full_name, u.username, u.phone
      ORDER BY q.created_at DESC
    `;
    params = [];
  } else {
    query = `
      SELECT q.*,
        COUNT(qi.id)::int AS items_count
      FROM quotations q
      LEFT JOIN quotation_items qi ON qi.quotation_id = q.id
      WHERE q.trader_id = $1
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `;
    params = [req.session.userId];
  }

  const result = await pool.query(query, params);
  res.json(result.rows);
});

// GET /api/quotations/:id — detail with items
router.get("/:id", requireAuth, async (req: any, res) => {
  const { id } = req.params;
  const isAdmin = req.session.role === "super_admin";

  const qRes = await pool.query(
    `SELECT q.*, u.full_name AS trader_name, u.username AS trader_username, u.phone AS trader_phone
     FROM quotations q
     JOIN users u ON u.id = q.trader_id
     WHERE q.id = $1`,
    [id]
  );
  if (qRes.rows.length === 0) return res.status(404).json({ error: "Not found" });

  const quotation = qRes.rows[0];
  if (!isAdmin && quotation.trader_id !== req.session.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const itemsRes = await pool.query(
    `SELECT qi.*, i.brand, i.name, i.size, i.concentration, i.gender, i.barcode,
       pi.object_path AS thumbnail_path
     FROM quotation_items qi
     JOIN inventory i ON i.id = qi.inventory_id
     LEFT JOIN LATERAL (
       SELECT object_path FROM product_images
       WHERE inventory_id = i.id ORDER BY sort_order ASC, id ASC LIMIT 1
     ) pi ON true
     WHERE qi.quotation_id = $1
     ORDER BY qi.id`,
    [id]
  );

  res.json({ ...quotation, items: itemsRes.rows });
});

// POST /api/quotations — trader creates quotation
router.post("/", requireAuth, async (req: any, res) => {
  if (!isTraderOrSalesRep(req.session.role)) {
    return res.status(403).json({ error: "Only trader accounts can create quotations" });
  }

  const { notes, items } = req.body as { notes?: string; items: { inventory_id: number; qty_requested: number }[] };
  if (!items || items.length === 0) {
    return res.status(400).json({ error: "No items provided" });
  }

  const refNumber = `QT-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const q = await client.query(
      `INSERT INTO quotations (ref_number, trader_id, status, trader_notes)
       VALUES ($1, $2, 'pending', $3) RETURNING *`,
      [refNumber, req.session.userId, notes || null]
    );
    const quotationId = q.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO quotation_items (quotation_id, inventory_id, qty_requested)
         VALUES ($1, $2, $3)`,
        [quotationId, item.inventory_id, item.qty_requested]
      );
    }

    await client.query("COMMIT");
    res.status(201).json(q.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// PUT /api/quotations/:id/price — admin sets prices, status → priced, creates notification
router.put("/:id/price", requireAdmin, async (req: any, res) => {
  const { id } = req.params;
  const { admin_notes, items } = req.body as {
    admin_notes?: string;
    items: { id: number; unit_price: number }[];
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const qRes = await client.query("SELECT * FROM quotations WHERE id = $1", [id]);
    if (qRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }
    const quotation = qRes.rows[0];

    for (const item of items) {
      await client.query(
        "UPDATE quotation_items SET unit_price = $1 WHERE id = $2 AND quotation_id = $3",
        [item.unit_price, item.id, id]
      );
    }

    await client.query(
      `UPDATE quotations SET status = 'priced', admin_notes = $1, updated_at = NOW()
       WHERE id = $2`,
      [admin_notes || null, id]
    );

    // Create notification for trader
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, quotation_id)
       VALUES ($1, 'quotation_priced', $2, $3, $4)`,
      [
        quotation.trader_id,
        "Your quotation has been priced",
        `Your quotation ${quotation.ref_number} is ready. Please review the prices.`,
        id,
      ]
    );

    await client.query("COMMIT");

    const updated = await pool.query(
      `SELECT q.*, u.full_name AS trader_name, u.phone AS trader_phone
       FROM quotations q JOIN users u ON u.id = q.trader_id WHERE q.id = $1`,
      [id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// PUT /api/quotations/:id/status — update status (sent | cancelled)
router.put("/:id/status", requireAuth, async (req: any, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: string };
  const isAdmin = req.session.role === "super_admin";

  const allowed = isAdmin ? ["sent", "cancelled"] : ["cancelled"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const qRes = await pool.query("SELECT * FROM quotations WHERE id = $1", [id]);
  if (qRes.rows.length === 0) return res.status(404).json({ error: "Not found" });
  const quotation = qRes.rows[0];

  if (!isAdmin && quotation.trader_id !== req.session.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE quotations SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, id]
    );

    // Notify trader if admin cancels their quotation
    if (isAdmin && status === "cancelled") {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, quotation_id)
         VALUES ($1, 'quotation_cancelled', $2, $3, $4)`,
        [
          quotation.trader_id,
          "Quotation cancelled",
          `Your quotation ${quotation.ref_number} has been cancelled.`,
          id,
        ]
      );
    }

    // Notify trader when admin marks as sent
    if (isAdmin && status === "sent") {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, quotation_id)
         VALUES ($1, 'quotation_sent', $2, $3, $4)`,
        [
          quotation.trader_id,
          "Quotation WhatsApp sent",
          `Pricing for ${quotation.ref_number} has been sent to your WhatsApp.`,
          id,
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

export default router;
