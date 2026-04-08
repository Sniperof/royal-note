import { Router } from "express";
import { pool } from "@workspace/db";

export const priceListsRouter = Router();

// ── Schema guard ───────────────────────────────────────────────────────────────
// price_list_items is created by ensureInventorySchema (inventory route).
// Calling ensureCoreSchema first is sufficient since it's run as middleware.
// No separate schema promise needed here.

// ── GET / ── list price list items (optionally filter by supplier_id) ──────────
priceListsRouter.get("/", async (req, res) => {
  try {
    const supplierId = req.query.supplier_id ? parseInt(req.query.supplier_id as string) : null;
    let query = `
      SELECT pli.*,
        i.barcode AS inv_barcode,
        i.qty AS inv_qty,
        i.sale_price_aed AS inv_sale_price_aed,
        i.product_type AS inv_product_type
      FROM price_list_items pli
      LEFT JOIN inventory i ON i.id = pli.inventory_id
    `;
    const params: any[] = [];
    if (supplierId) {
      query += " WHERE pli.supplier_id = $1";
      params.push(supplierId);
    }
    query += " ORDER BY pli.supplier_name ASC, pli.brand ASC, pli.name ASC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /by-supplier ── grouped by supplier ──────────────────────────────────
priceListsRouter.get("/by-supplier", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.supplier_type,
        COUNT(pli.id)::integer AS item_count,
        SUM(pli.offered_qty)::integer AS total_offered_qty,
        SUM(pli.offered_qty * pli.cost_usd) AS total_cost_value
      FROM suppliers s
      LEFT JOIN price_list_items pli ON pli.supplier_id = s.id
      WHERE EXISTS (SELECT 1 FROM price_list_items p2 WHERE p2.supplier_id = s.id)
      GROUP BY s.id, s.name, s.supplier_type
      ORDER BY s.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST / ── create single price list item ───────────────────────────────────
priceListsRouter.post("/", async (req, res) => {
  const {
    supplier_id, barcode, brand, name, main_category, sub_category,
    size, concentration, gender, offered_qty, cost_usd,
    suggested_sale_price_aed, availability_location, notes,
  } = req.body as any;

  if (!supplier_id || !brand || !name) {
    return res.status(400).json({ error: "supplier_id, brand, and name are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Resolve supplier name
    const supRes = await client.query("SELECT name FROM suppliers WHERE id = $1", [supplier_id]);
    if (supRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Supplier not found" }); }
    const supplierName = supRes.rows[0].name;

    // Find or create inventory record
    let inventoryId: number | null = null;
    if (barcode) {
      const invRes = await client.query("SELECT id FROM inventory WHERE barcode = $1 LIMIT 1", [barcode]);
      if (invRes.rows.length > 0) {
        inventoryId = invRes.rows[0].id;
      } else {
        // Create price_list_only inventory skeleton
        const newInv = await client.query(
          `INSERT INTO inventory (barcode, brand, name, main_category, sub_category, size, concentration, gender, qty, cost_usd, sale_price_aed, product_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,'price_list_only') RETURNING id`,
          [barcode, brand, name, main_category ?? 'perfume', sub_category ?? null,
           size ?? null, concentration ?? null, gender ?? null,
           cost_usd ?? 0, suggested_sale_price_aed ?? 0]
        );
        inventoryId = newInv.rows[0].id;
      }
    }

    const result = await client.query(
      `INSERT INTO price_list_items
         (inventory_id, supplier_id, supplier_name, barcode, brand, name, main_category, sub_category,
          size, concentration, gender, offered_qty, cost_usd, suggested_sale_price_aed, availability_location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [inventoryId, supplier_id, supplierName, barcode ?? null, brand, name,
       main_category ?? null, sub_category ?? null, size ?? null, concentration ?? null,
       gender ?? null, offered_qty ?? 0, cost_usd ?? 0, suggested_sale_price_aed ?? 0,
       availability_location ?? null, notes ?? null]
    );

    await client.query("COMMIT");
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ── POST /bulk ── bulk import items for a supplier ───────────────────────────
priceListsRouter.post("/bulk", async (req, res) => {
  const { supplier_id, items } = req.body as any;
  if (!supplier_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "supplier_id and items[] are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const supRes = await client.query("SELECT name FROM suppliers WHERE id = $1", [supplier_id]);
    if (supRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Supplier not found" }); }
    const supplierName = supRes.rows[0].name;

    const inserted: any[] = [];
    for (const item of items) {
      if (!item.brand || !item.name) continue;

      let inventoryId: number | null = null;
      if (item.barcode) {
        const invRes = await client.query("SELECT id, product_type FROM inventory WHERE barcode = $1 LIMIT 1", [item.barcode]);
        if (invRes.rows.length > 0) {
          inventoryId = invRes.rows[0].id;
          // If the existing inventory record is price_list_only, update its metadata from this import
          if (invRes.rows[0].product_type === 'price_list_only') {
            await client.query(
              "UPDATE inventory SET brand = $1, name = $2, cost_usd = $3, sale_price_aed = $4 WHERE id = $5",
              [item.brand, item.name, item.cost_usd ?? 0, item.suggested_sale_price_aed ?? 0, inventoryId]
            );
          }
        } else {
          const newInv = await client.query(
            `INSERT INTO inventory (barcode, brand, name, main_category, sub_category, size, concentration, gender, qty, cost_usd, sale_price_aed, product_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,'price_list_only') RETURNING id`,
            [item.barcode, item.brand, item.name, item.main_category ?? 'perfume', item.sub_category ?? null,
             item.size ?? null, item.concentration ?? null, item.gender ?? null,
             item.cost_usd ?? 0, item.suggested_sale_price_aed ?? 0]
          );
          inventoryId = newInv.rows[0].id;
        }
      }

      const row = await client.query(
        `INSERT INTO price_list_items
           (inventory_id, supplier_id, supplier_name, barcode, brand, name, main_category, sub_category,
            size, concentration, gender, offered_qty, cost_usd, suggested_sale_price_aed, availability_location, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [inventoryId, supplier_id, supplierName, item.barcode ?? null, item.brand, item.name,
         item.main_category ?? null, item.sub_category ?? null, item.size ?? null,
         item.concentration ?? null, item.gender ?? null, item.offered_qty ?? 0,
         item.cost_usd ?? 0, item.suggested_sale_price_aed ?? 0,
         item.availability_location ?? null, item.notes ?? null]
      );
      inserted.push(row.rows[0]);
    }

    await client.query("COMMIT");
    res.status(201).json({ inserted: inserted.length, items: inserted });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ── PUT /:id ── update price list item ─────────────────────────────────────────
priceListsRouter.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const {
    offered_qty, cost_usd, suggested_sale_price_aed, availability_location, notes, brand, name, size, show_in_catalog,
  } = req.body as any;

  try {
    const result = await pool.query(
      `UPDATE price_list_items SET
         offered_qty = COALESCE($1, offered_qty),
         cost_usd = COALESCE($2, cost_usd),
         suggested_sale_price_aed = COALESCE($3, suggested_sale_price_aed),
         availability_location = $4,
         notes = $5,
         brand = COALESCE($6, brand),
         name = COALESCE($7, name),
         size = COALESCE($8, size),
         show_in_catalog = COALESCE($10, show_in_catalog),
         updated_at = now()
       WHERE id = $9
       RETURNING *`,
      [offered_qty ?? null, cost_usd ?? null, suggested_sale_price_aed ?? null,
       availability_location ?? null, notes ?? null, brand ?? null, name ?? null, size ?? null, id,
       show_in_catalog ?? null]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── PATCH /:id/toggle-catalog ── toggle show_in_catalog ───────────────────────
priceListsRouter.patch("/:id/toggle-catalog", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const result = await pool.query(
      `UPDATE price_list_items
       SET show_in_catalog = NOT show_in_catalog, updated_at = now()
       WHERE id = $1
       RETURNING id, show_in_catalog`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /:id/convert-to-po ── create a PO from this price list item ──────────
priceListsRouter.post("/:id/convert-to-po", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { qty, payment_method } = req.body as any;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get the price list item
    const itemRes = await client.query("SELECT * FROM price_list_items WHERE id = $1", [id]);
    if (itemRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Price list item not found" });
    }
    const pli = itemRes.rows[0];

    // Get supplier info
    const supRes = await client.query(
      "SELECT id, name, supplier_type FROM suppliers WHERE id = $1",
      [pli.supplier_id]
    );
    if (supRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Supplier not found" });
    }
    const supplier = supRes.rows[0];

    const poType =
      supplier.supplier_type === "capital_owner" ? "capital_injection" :
      supplier.supplier_type === "consignment" ? "consignment" : "regular";

    const now = new Date();
    const poNumber = `PO-${now.getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Ensure purchase_order_items has the is_received column (may not exist if purchases route hasn't run)
    await client.query(`
      ALTER TABLE purchase_order_items
      ADD COLUMN IF NOT EXISTS is_received boolean NOT NULL DEFAULT false
    `).catch(() => {/* ignore if already exists */});

    // Create the PO
    const poResult = await client.query(
      `INSERT INTO purchase_orders
         (po_number, supplier_id, supplier_name, order_date, status, shipping_cost, notes, payment_method, po_type)
       VALUES ($1,$2,$3,$4,'draft',0,$5,$6,$7)
       RETURNING *`,
      [
        poNumber,
        supplier.id,
        supplier.name,
        now.toISOString().slice(0, 10),
        `Converted from price list on ${now.toLocaleDateString("en-GB")}`,
        payment_method ?? "cash",
        poType,
      ]
    );
    const po = poResult.rows[0];

    // Create PO item
    await client.query(
      `INSERT INTO purchase_order_items
         (purchase_order_id, inventory_id, barcode, brand, name, main_category, sub_category,
          size, concentration, gender, qty, unit_cost, supplier_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        po.id,
        pli.inventory_id,
        pli.barcode,
        pli.brand,
        pli.name,
        pli.main_category ?? null,
        pli.sub_category ?? null,
        pli.size ?? null,
        pli.concentration ?? null,
        pli.gender ?? null,
        qty ?? pli.offered_qty,
        pli.cost_usd,
        supplier.id,
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({ po_id: po.id, po_number: po.po_number, supplier_name: supplier.name });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// ── DELETE /:id ── remove price list item ─────────────────────────────────────
priceListsRouter.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get the item to check if inventory record should be cleaned up
    const item = await client.query("SELECT inventory_id FROM price_list_items WHERE id = $1", [id]);
    if (item.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }

    await client.query("DELETE FROM price_list_items WHERE id = $1", [id]);

    // If the linked inventory record is price_list_only and has no other price list entries, delete it
    const inventoryId = item.rows[0].inventory_id;
    if (inventoryId) {
      const invCheck = await client.query(
        "SELECT product_type FROM inventory WHERE id = $1", [inventoryId]
      );
      if (invCheck.rows.length > 0 && invCheck.rows[0].product_type === 'price_list_only') {
        const remaining = await client.query(
          "SELECT COUNT(*) FROM price_list_items WHERE inventory_id = $1", [inventoryId]
        );
        if (parseInt(remaining.rows[0].count) === 0) {
          // Also check no purchase orders reference it
          const poCheck = await client.query(
            "SELECT COUNT(*) FROM purchase_order_items WHERE inventory_id = $1", [inventoryId]
          );
          if (parseInt(poCheck.rows[0].count) === 0) {
            await client.query("DELETE FROM inventory WHERE id = $1", [inventoryId]);
          }
        }
      }
    }

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});
