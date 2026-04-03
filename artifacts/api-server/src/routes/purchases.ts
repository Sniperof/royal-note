import { Router } from "express";
import { pool } from "@workspace/db";

export const purchasesRouter = Router();

let ensurePurchasesSchemaPromise: Promise<void> | null = null;

async function ensurePurchasesSchema() {
  if (!ensurePurchasesSchemaPromise) {
    ensurePurchasesSchemaPromise = (async () => {
      await pool.query(`
        ALTER TABLE purchase_order_items
        ADD COLUMN IF NOT EXISTS supplier_id integer REFERENCES suppliers(id) ON DELETE SET NULL
      `);
      await pool.query(`
        ALTER TABLE purchase_order_items
        ADD COLUMN IF NOT EXISTS main_category text,
        ADD COLUMN IF NOT EXISTS sub_category text
      `);
      await pool.query(`
        ALTER TABLE purchase_order_items
        ADD COLUMN IF NOT EXISTS is_available_to_order boolean NOT NULL DEFAULT false
      `);
    })().catch((error) => {
      ensurePurchasesSchemaPromise = null;
      throw error;
    });
  }

  await ensurePurchasesSchemaPromise;
}

async function upsertInventorySourceFromPurchase(
  client: any,
  inventoryId: number,
  supplierId: number | null,
  landedUnitCost: number,
) {
  if (!supplierId) return;

  const existing = await client.query(
    `
      SELECT id
      FROM inventory_sources
      WHERE inventory_id = $1
        AND supplier_id = $2
      ORDER BY is_preferred DESC, created_at ASC
      LIMIT 1
    `,
    [inventoryId, supplierId],
  );

  if (existing.rows.length > 0) {
    await client.query(
      `
        UPDATE inventory_sources
        SET last_known_cost = $1
        WHERE id = $2
      `,
      [landedUnitCost.toFixed(4), existing.rows[0].id],
    );
    return;
  }

  const preferredRes = await client.query(
    `
      SELECT id
      FROM inventory_sources
      WHERE inventory_id = $1
        AND is_preferred = true
      LIMIT 1
    `,
    [inventoryId],
  );

  await client.query(
    `
      INSERT INTO inventory_sources (
        inventory_id,
        supplier_id,
        availability_location,
        is_preferred,
        last_known_cost
      )
      VALUES ($1, $2, NULL, $3, $4)
    `,
    [inventoryId, supplierId, preferredRes.rows.length === 0, landedUnitCost.toFixed(4)],
  );
}

function generatePONumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const ts = Date.now().toString().slice(-6);
  return `PO-${year}-${ts}`;
}

const WITH_ITEMS = `
  SELECT po.*,
    COALESCE(json_agg(
      json_build_object(
        'id', poi.id,
        'inventory_id', poi.inventory_id,
        'barcode', poi.barcode,
        'brand', poi.brand,
        'name', poi.name,
        'main_category', poi.main_category,
        'sub_category', poi.sub_category,
        'size', poi.size,
        'concentration', poi.concentration,
        'gender', poi.gender,
        'qty', poi.qty,
        'unit_cost', poi.unit_cost,
        'supplier_id', poi.supplier_id,
        'is_available_to_order', poi.is_available_to_order
      ) ORDER BY poi.id
    ) FILTER (WHERE poi.id IS NOT NULL), '[]') AS items
  FROM purchase_orders po
  LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
`;

purchasesRouter.get("/", async (_req, res) => {
  try {
    await ensurePurchasesSchema();
    const result = await pool.query(`${WITH_ITEMS} GROUP BY po.id ORDER BY po.created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

purchasesRouter.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await ensurePurchasesSchema();
    const result = await pool.query(`${WITH_ITEMS} WHERE po.id = $1 GROUP BY po.id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

async function insertItems(client: any, poId: number, supplierId: number | null, items: any[]) {
  for (const item of items) {
    if (!item.barcode || !item.brand || !item.name || !item.qty || item.unit_cost === undefined) continue;
    let inventoryId = item.inventory_id ?? null;
    if (!inventoryId && item.barcode) {
      const inv = await client.query("SELECT id FROM inventory WHERE barcode = $1 LIMIT 1", [item.barcode]);
      if (inv.rows.length > 0) inventoryId = inv.rows[0].id;
    }
    await client.query(
      `INSERT INTO purchase_order_items (purchase_order_id, inventory_id, barcode, brand, name, main_category, sub_category, size, concentration, gender, qty, unit_cost, supplier_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [poId, inventoryId, item.barcode, item.brand, item.name, item.main_category ?? null, item.sub_category ?? null, item.size ?? null, item.concentration ?? null, item.gender ?? null, item.qty, item.unit_cost, supplierId]
    );
  }
}

purchasesRouter.post("/", async (req, res) => {
  await ensurePurchasesSchema();
  const { supplier_id, order_date, shipping_cost, notes, items } = req.body as any;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let supplierName: string | null = null;
    if (supplier_id) {
      const sup = await client.query("SELECT name FROM suppliers WHERE id = $1", [supplier_id]);
      if (sup.rows.length > 0) supplierName = sup.rows[0].name;
    }
    const poResult = await client.query(
      `INSERT INTO purchase_orders (po_number, supplier_id, supplier_name, status, order_date, shipping_cost, notes)
       VALUES ($1,$2,$3,'draft',$4,$5,$6) RETURNING *`,
      [generatePONumber(), supplier_id ?? null, supplierName, order_date ?? new Date().toISOString().slice(0, 10), shipping_cost ?? 0, notes ?? null]
    );
    const po = poResult.rows[0];
    if (items && Array.isArray(items)) await insertItems(client, po.id, supplier_id ?? null, items);
    await client.query("COMMIT");
    const full = await pool.query(`${WITH_ITEMS} WHERE po.id = $1 GROUP BY po.id`, [po.id]);
    res.status(201).json(full.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

purchasesRouter.put("/:id/confirm", async (req, res) => {
  await ensurePurchasesSchema();
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
    if (existing.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }
    if (existing.rows[0].status !== "draft") { await client.query("ROLLBACK"); return res.status(400).json({ error: "Only draft POs can be confirmed" }); }

    const itemsRes = await client.query("SELECT * FROM purchase_order_items WHERE purchase_order_id = $1", [id]);
    const items = itemsRes.rows;
    if (items.length === 0) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Cannot confirm an empty purchase order" }); }

    const po = existing.rows[0];
    const effectiveSupplierId = po.supplier_id ?? null;

    // For each item, ensure it is linked to an inventory record
    for (const item of items) {
      let inventoryId = item.inventory_id ?? null;

      if (!inventoryId && item.barcode) {
        // Try to find existing inventory by barcode
        const found = await client.query("SELECT id FROM inventory WHERE barcode = $1 LIMIT 1", [item.barcode]);
        if (found.rows.length > 0) {
          inventoryId = found.rows[0].id;
        } else {
          // Create a skeleton record (qty=0) so it surfaces in the catalog as incoming
          const newInv = await client.query(
            `INSERT INTO inventory (barcode, brand, name, main_category, sub_category, size, concentration, gender, qty, cost_usd, sale_price_aed)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,0) RETURNING id`,
            [item.barcode, item.brand, item.name, item.main_category ?? 'perfume', item.sub_category ?? null,
             item.size ?? null, item.concentration ?? null, item.gender ?? null, item.unit_cost]
          );
          inventoryId = newInv.rows[0].id;
        }
        await client.query("UPDATE purchase_order_items SET inventory_id = $1 WHERE id = $2", [inventoryId, item.id]);
      }

      // Create/update inventory_sources so the item shows a supplier in the catalog
      const itemSupplierId = item.supplier_id ?? effectiveSupplierId;
      if (inventoryId && itemSupplierId) {
        await upsertInventorySourceFromPurchase(client, inventoryId, itemSupplierId, parseFloat(item.unit_cost));
      }

      // Add the PO qty to inventory as actual stock (confirmed = owned, no need for +incoming)
      if (inventoryId) {
        await client.query(
          "UPDATE inventory SET qty = qty + $1 WHERE id = $2",
          [item.qty, inventoryId],
        );
      }
    }

    await client.query("UPDATE purchase_orders SET status = 'confirmed' WHERE id = $1", [id]);
    await client.query("COMMIT");
    const full = await pool.query(`${WITH_ITEMS} WHERE po.id = $1 GROUP BY po.id`, [id]);
    res.json(full.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

purchasesRouter.put("/:id/items/:itemId/toggle-available", async (req, res) => {
  await ensurePurchasesSchema();
  const id = parseInt(req.params.id);
  const itemId = parseInt(req.params.itemId);
  if (isNaN(id) || isNaN(itemId)) return res.status(400).json({ error: "Invalid id" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const po = await client.query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
    if (po.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }
    if (po.rows[0].status === "received") { await client.query("ROLLBACK"); return res.status(400).json({ error: "Cannot modify a received PO" }); }

    const itemRes = await client.query("SELECT * FROM purchase_order_items WHERE id = $1 AND purchase_order_id = $2", [itemId, id]);
    if (itemRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Item not found" }); }
    const item = itemRes.rows[0];

    // Auto-link to inventory if not linked yet
    if (!item.inventory_id && item.barcode) {
      const existing = await client.query("SELECT id FROM inventory WHERE barcode = $1 LIMIT 1", [item.barcode]);
      if (existing.rows.length > 0) {
        await client.query("UPDATE purchase_order_items SET inventory_id = $1 WHERE id = $2", [existing.rows[0].id, itemId]);
      } else {
        const newInv = await client.query(
          `INSERT INTO inventory (barcode, brand, name, main_category, sub_category, size, concentration, gender, qty, cost_usd, sale_price_aed)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,0) RETURNING id`,
          [item.barcode, item.brand, item.name, item.main_category ?? 'perfume', item.sub_category ?? null,
           item.size ?? null, item.concentration ?? null, item.gender ?? null, item.unit_cost]
        );
        await client.query("UPDATE purchase_order_items SET inventory_id = $1 WHERE id = $2", [newInv.rows[0].id, itemId]);
      }
    }

    const updated = await client.query(
      "UPDATE purchase_order_items SET is_available_to_order = NOT is_available_to_order WHERE id = $1 RETURNING is_available_to_order, inventory_id",
      [itemId]
    );
    await client.query("COMMIT");
    res.json({ is_available_to_order: updated.rows[0].is_available_to_order, inventory_id: updated.rows[0].inventory_id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

purchasesRouter.put("/:id", async (req, res) => {
  await ensurePurchasesSchema();
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const existing = await pool.query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: "Not found" });
  if (existing.rows[0].status === "received") return res.status(400).json({ error: "Cannot edit a received purchase order" });

  const { supplier_id, order_date, shipping_cost, notes } = req.body as any;
  let supplierName: string | null = null;
  if (supplier_id) {
    const sup = await pool.query("SELECT name FROM suppliers WHERE id = $1", [supplier_id]);
    if (sup.rows.length > 0) supplierName = sup.rows[0].name;
  }

  const result = await pool.query(
    `UPDATE purchase_orders SET
       supplier_id = COALESCE($1, supplier_id),
       supplier_name = COALESCE($2, supplier_name),
       order_date = COALESCE($3, order_date),
       shipping_cost = COALESCE($4, shipping_cost),
       notes = COALESCE($5, notes)
     WHERE id = $6 RETURNING *`,
    [supplier_id ?? null, supplierName, order_date ?? null, shipping_cost ?? null, notes ?? null, id]
  );
  res.json(result.rows[0]);
});

purchasesRouter.put("/:id/receive", async (req, res) => {
  await ensurePurchasesSchema();
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const poResult = await client.query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
    if (poResult.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }
    const po = poResult.rows[0];
    if (po.status === "received") { await client.query("ROLLBACK"); return res.status(400).json({ error: "Already received" }); }
    if (po.status === "cancelled") { await client.query("ROLLBACK"); return res.status(400).json({ error: "Cannot receive a cancelled PO" }); }

    const itemsRes = await client.query("SELECT * FROM purchase_order_items WHERE purchase_order_id = $1", [id]);
    const items = itemsRes.rows;
    if (items.length === 0) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Cannot receive an empty purchase order" }); }

    const wasConfirmed = po.status === "confirmed";
    const shippingCost = parseFloat(po.shipping_cost) || 0;
    const totalItemCost = items.reduce((sum: number, i: any) => sum + parseFloat(i.unit_cost) * i.qty, 0);

    for (const item of items) {
      const itemTotal = parseFloat(item.unit_cost) * item.qty;
      const shippingShare = totalItemCost > 0 ? (itemTotal / totalItemCost) * shippingCost : 0;
      const landedUnitCost = parseFloat(item.unit_cost) + (item.qty > 0 ? shippingShare / item.qty : 0);
      const effectiveSupplierId = item.supplier_id ?? po.supplier_id ?? null;

      if (item.inventory_id) {
        if (wasConfirmed) {
          // Qty was already added at confirm; only update the landed cost
          await client.query(
            "UPDATE inventory SET cost_usd = $1 WHERE id = $2",
            [landedUnitCost.toFixed(4), item.inventory_id],
          );
        } else {
          await client.query(
            "UPDATE inventory SET qty = qty + $1, cost_usd = $2 WHERE id = $3",
            [item.qty, landedUnitCost.toFixed(4), item.inventory_id],
          );
        }
        await upsertInventorySourceFromPurchase(
          client,
          item.inventory_id,
          effectiveSupplierId,
          landedUnitCost,
        );
      } else {
        const newInv = await client.query(
          `INSERT INTO inventory (barcode, brand, name, main_category, sub_category, size, concentration, gender, qty, cost_usd, sale_price_aed)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0)
           ON CONFLICT (barcode) DO UPDATE SET qty = inventory.qty + $9, cost_usd = $10
           RETURNING id`,
          [item.barcode, item.brand, item.name, item.main_category ?? 'perfume', item.sub_category ?? null, item.size ?? null, item.concentration ?? null, item.gender ?? null, item.qty, landedUnitCost.toFixed(4)]
        );
        await client.query(
          "UPDATE purchase_order_items SET inventory_id = $1, supplier_id = COALESCE(supplier_id, $3) WHERE id = $2",
          [newInv.rows[0].id, item.id, effectiveSupplierId],
        );
        await upsertInventorySourceFromPurchase(
          client,
          newInv.rows[0].id,
          effectiveSupplierId,
          landedUnitCost,
        );
      }
    }

    await client.query("UPDATE purchase_orders SET status = 'received' WHERE id = $1", [id]);
    await client.query("COMMIT");
    const full = await pool.query(`${WITH_ITEMS} WHERE po.id = $1 GROUP BY po.id`, [po.id]);
    res.json(full.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

purchasesRouter.post("/:id/items", async (req, res) => {
  await ensurePurchasesSchema();
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const po = await pool.query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
  if (po.rows.length === 0) return res.status(404).json({ error: "Not found" });
  if (po.rows[0].status === "received") return res.status(400).json({ error: "Cannot edit a received PO" });
  if (po.rows[0].status === "cancelled") return res.status(400).json({ error: "Cannot edit a cancelled PO" });

  const { items } = req.body as any;
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: "items array required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await insertItems(client, id, po.rows[0].supplier_id ?? null, items);
    await client.query("COMMIT");
    const full = await pool.query(`${WITH_ITEMS} WHERE po.id = $1 GROUP BY po.id`, [id]);
    res.status(201).json(full.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

purchasesRouter.delete("/:id/items/:itemId", async (req, res) => {
  await ensurePurchasesSchema();
  const id = parseInt(req.params.id);
  const itemId = parseInt(req.params.itemId);
  if (isNaN(id) || isNaN(itemId)) return res.status(400).json({ error: "Invalid id" });
  const po = await pool.query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
  if (po.rows.length === 0) return res.status(404).json({ error: "Not found" });
  if (po.rows[0].status === "received") return res.status(400).json({ error: "Cannot edit a received PO" });
  if (po.rows[0].status === "cancelled") return res.status(400).json({ error: "Cannot edit a cancelled PO" });
  await pool.query("DELETE FROM purchase_order_items WHERE id = $1 AND purchase_order_id = $2", [itemId, id]);
  res.json({ ok: true });
});

purchasesRouter.delete("/:id", async (req, res) => {
  await ensurePurchasesSchema();
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const existing = await pool.query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
  if (existing.rows.length === 0) return res.status(404).json({ error: "Not found" });
  if (existing.rows[0].status === "received") return res.status(400).json({ error: "Cannot delete a received PO. Cancel it instead." });

  if (existing.rows[0].status === "confirmed") {
    // Qty was added at confirm — reverse it before deleting
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const itemsRes = await client.query(
        "SELECT inventory_id, qty FROM purchase_order_items WHERE purchase_order_id = $1",
        [id],
      );
      for (const item of itemsRes.rows) {
        if (item.inventory_id) {
          await client.query(
            "UPDATE inventory SET qty = GREATEST(0, qty - $1) WHERE id = $2",
            [item.qty, item.inventory_id],
          );
        }
      }
      await client.query("DELETE FROM purchase_orders WHERE id = $1", [id]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  } else {
    await pool.query("DELETE FROM purchase_orders WHERE id = $1", [id]);
  }

  res.json({ ok: true });
});
