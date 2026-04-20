import { Router } from "express";
import { pool } from "@workspace/db";
import { canonicalizeMasterValues, MasterDataError } from "../lib/masterData";

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
      await pool.query(`
        ALTER TABLE purchase_order_items
        ADD COLUMN IF NOT EXISTS sale_price_aed numeric
      `);
      await pool.query(`
        ALTER TABLE purchase_order_items
        ADD COLUMN IF NOT EXISTS is_received boolean NOT NULL DEFAULT false
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

async function canonicalizePurchaseItemFields<T extends {
  brand: string;
  size?: string | null;
  concentration?: string | null;
}>(item: T) {
  return canonicalizeMasterValues(item);
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
        'sale_price_aed', poi.sale_price_aed,
        'supplier_id', poi.supplier_id,
        'is_available_to_order', poi.is_available_to_order,
        'is_received', poi.is_received
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
    const canonical = await canonicalizePurchaseItemFields({
      brand: item.brand,
      size: item.size ?? null,
      concentration: item.concentration ?? null,
    });
    let inventoryId = item.inventory_id ?? null;
    if (!inventoryId && item.barcode) {
      const inv = await client.query("SELECT id FROM inventory WHERE barcode = $1 LIMIT 1", [item.barcode]);
      if (inv.rows.length > 0) inventoryId = inv.rows[0].id;
    }
    await client.query(
      `INSERT INTO purchase_order_items (purchase_order_id, inventory_id, barcode, brand, name, main_category, sub_category, size, concentration, gender, qty, unit_cost, sale_price_aed, supplier_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [poId, inventoryId, item.barcode, canonical.brand, item.name, item.main_category ?? null, item.sub_category ?? null, canonical.size, canonical.concentration, item.gender ?? null, item.qty, item.unit_cost, item.sale_price_aed ?? null, supplierId]
    );
  }
}

purchasesRouter.post("/", async (req, res) => {
  await ensurePurchasesSchema();
  const { supplier_id, order_date, shipping_cost, notes, items, payment_method } = req.body as any;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let supplierName: string | null = null;
    let supplierType = "regular";
    if (supplier_id) {
      const sup = await client.query("SELECT name, supplier_type FROM suppliers WHERE id = $1", [supplier_id]);
      if (sup.rows.length > 0) {
        supplierName = sup.rows[0].name;
        supplierType = sup.rows[0].supplier_type ?? "regular";
      }
    }

    // Derive po_type from supplier classification (snapshot for audit stability)
    let poType = "regular";
    if (supplierType === "capital_owner") poType = "capital_injection";
    else if (supplierType === "consignment") poType = "consignment";

    // payment_method only applies to regular suppliers
    const effectivePaymentMethod = poType === "regular" ? (payment_method ?? "cash") : "cash";

    const poResult = await client.query(
      `INSERT INTO purchase_orders (po_number, supplier_id, supplier_name, status, order_date, shipping_cost, notes, po_type, payment_method)
       VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8) RETURNING *`,
      [generatePONumber(), supplier_id ?? null, supplierName, order_date ?? new Date().toISOString().slice(0, 10), shipping_cost ?? 0, notes ?? null, poType, effectivePaymentMethod]
    );
    const po = poResult.rows[0];
    if (items && Array.isArray(items)) await insertItems(client, po.id, supplier_id ?? null, items);
    await client.query("COMMIT");
    const full = await pool.query(`${WITH_ITEMS} WHERE po.id = $1 GROUP BY po.id`, [po.id]);
    res.status(201).json(full.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    if (err instanceof MasterDataError) return res.status(err.status).json({ error: err.message });
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
    const isConsignment = po.po_type === "consignment";

    // For each item, ensure it is linked to an inventory record
    for (const item of items) {
      const canonicalItem = await canonicalizePurchaseItemFields({
        brand: item.brand,
        size: item.size ?? null,
        concentration: item.concentration ?? null,
      });
      await client.query(
        "UPDATE purchase_order_items SET brand = $1, size = $2, concentration = $3 WHERE id = $4",
        [canonicalItem.brand, canonicalItem.size, canonicalItem.concentration, item.id],
      );
      let inventoryId = item.inventory_id ?? null;

      if (!inventoryId && item.barcode) {
        // Try to find existing inventory by barcode
        const found = await client.query("SELECT id FROM inventory WHERE barcode = $1 LIMIT 1", [item.barcode]);
        if (found.rows.length > 0) {
          inventoryId = found.rows[0].id;
        } else {
          // Create skeleton record; consignment products are never qty-tracked by us
          const newInv = await client.query(
            `INSERT INTO inventory (barcode, brand, name, main_category, sub_category, size, concentration, gender, qty, cost_usd, sale_price_aed, product_type, consignment_supplier_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12) RETURNING id`,
            [item.barcode, canonicalItem.brand, item.name, item.main_category ?? 'perfume', item.sub_category ?? null,
             canonicalItem.size, canonicalItem.concentration, item.gender ?? null, item.unit_cost,
             item.sale_price_aed ?? 0,
             isConsignment ? 'consignment' : 'owned',
             isConsignment ? effectiveSupplierId : null]
          );
          inventoryId = newInv.rows[0].id;
        }
        await client.query("UPDATE purchase_order_items SET inventory_id = $1 WHERE id = $2", [inventoryId, item.id]);
      }

      // For consignment: mark the inventory record as consignment
      if (isConsignment && inventoryId) {
        await client.query(
          "UPDATE inventory SET product_type = 'consignment', consignment_supplier_id = $1 WHERE id = $2",
          [effectiveSupplierId, inventoryId]
        );
      }

      // Create/update inventory_sources so the item shows a supplier in the catalog
      const itemSupplierId = item.supplier_id ?? effectiveSupplierId;
      if (inventoryId && itemSupplierId) {
        await upsertInventorySourceFromPurchase(client, inventoryId, itemSupplierId, parseFloat(item.unit_cost));
      }
      // Note: qty is NOT added at confirm — it is added per-item or bulk at receive time
    }

    // For credit POs: create AP commitment so balance is visible immediately
    if (po.po_type === "regular" && po.payment_method === "credit") {
      const estimatedTotal = items.reduce((sum: number, i: any) => sum + parseFloat(i.unit_cost) * i.qty, 0);
      const existingAP = await client.query(
        "SELECT id FROM accounts_payable WHERE purchase_order_id = $1 LIMIT 1",
        [id]
      );
      if (existingAP.rows.length === 0) {
        await client.query(
          `INSERT INTO accounts_payable (purchase_order_id, supplier_id, supplier_name, description, amount_usd, status)
           VALUES ($1, $2, $3, $4, $5, 'open')`,
          [id, po.supplier_id, po.supplier_name ?? 'مورد', po.po_number, estimatedTotal.toFixed(4)]
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
    if (err instanceof MasterDataError) return res.status(err.status).json({ error: err.message });
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
    const canonicalItem = await canonicalizePurchaseItemFields({
      brand: item.brand,
      size: item.size ?? null,
      concentration: item.concentration ?? null,
    });
    await client.query(
      "UPDATE purchase_order_items SET brand = $1, size = $2, concentration = $3 WHERE id = $4",
      [canonicalItem.brand, canonicalItem.size, canonicalItem.concentration, itemId],
    );

    // Auto-link to inventory if not linked yet
    if (!item.inventory_id && item.barcode) {
      const existing = await client.query("SELECT id FROM inventory WHERE barcode = $1 LIMIT 1", [item.barcode]);
      if (existing.rows.length > 0) {
        await client.query("UPDATE purchase_order_items SET inventory_id = $1 WHERE id = $2", [existing.rows[0].id, itemId]);
      } else {
        const newInv = await client.query(
          `INSERT INTO inventory (barcode, brand, name, main_category, sub_category, size, concentration, gender, qty, cost_usd, sale_price_aed)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10) RETURNING id`,
          [item.barcode, canonicalItem.brand, item.name, item.main_category ?? 'perfume', item.sub_category ?? null,
           canonicalItem.size, canonicalItem.concentration, item.gender ?? null, item.unit_cost, item.sale_price_aed ?? 0]
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
    if (err instanceof MasterDataError) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

purchasesRouter.put("/:id/items/:itemId/receive", async (req, res) => {
  await ensurePurchasesSchema();
  const id = parseInt(req.params.id);
  const itemId = parseInt(req.params.itemId);
  if (isNaN(id) || isNaN(itemId)) return res.status(400).json({ error: "Invalid id" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const poResult = await client.query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
    if (poResult.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Not found" }); }
    const po = poResult.rows[0];
    if (po.status === "received") { await client.query("ROLLBACK"); return res.status(400).json({ error: "PO is already fully received" }); }
    if (po.status === "cancelled") { await client.query("ROLLBACK"); return res.status(400).json({ error: "Cannot receive from a cancelled PO" }); }

    const itemRes = await client.query("SELECT * FROM purchase_order_items WHERE id = $1 AND purchase_order_id = $2", [itemId, id]);
    if (itemRes.rows.length === 0) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Item not found" }); }
    const item = itemRes.rows[0];
    if (item.is_received) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Item already received" }); }
    const canonicalItem = await canonicalizePurchaseItemFields({
      brand: item.brand,
      size: item.size ?? null,
      concentration: item.concentration ?? null,
    });
    await client.query(
      "UPDATE purchase_order_items SET brand = $1, size = $2, concentration = $3 WHERE id = $4",
      [canonicalItem.brand, canonicalItem.size, canonicalItem.concentration, item.id],
    );

    const isConsignment = po.po_type === "consignment";
    const isCapitalInjection = po.po_type === "capital_injection";
    const effectiveSupplierId = item.supplier_id ?? po.supplier_id ?? null;
    const unitCost = parseFloat(item.unit_cost);

    if (isConsignment) {
      // Consignment: update cost and product_type only, no qty
      if (item.inventory_id) {
        await client.query(
            "UPDATE inventory SET cost_usd = $1, sale_price_aed = COALESCE($2, sale_price_aed), product_type = 'consignment', consignment_supplier_id = $3 WHERE id = $4",
            [unitCost.toFixed(4), item.sale_price_aed ?? null, po.supplier_id ?? null, item.inventory_id]
          );
      }
    } else {
      // Non-consignment: add qty to inventory
      let inventoryId = item.inventory_id ?? null;
      if (!inventoryId && item.barcode) {
        const found = await client.query("SELECT id FROM inventory WHERE barcode = $1 LIMIT 1", [item.barcode]);
        if (found.rows.length > 0) {
          inventoryId = found.rows[0].id;
        } else {
          const newInv = await client.query(
            `INSERT INTO inventory (barcode, brand, name, main_category, sub_category, size, concentration, gender, qty, cost_usd, sale_price_aed)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10) RETURNING id`,
            [item.barcode, canonicalItem.brand, item.name, item.main_category ?? 'perfume', item.sub_category ?? null,
             canonicalItem.size, canonicalItem.concentration, item.gender ?? null, unitCost.toFixed(4), item.sale_price_aed ?? 0]
          );
          inventoryId = newInv.rows[0].id;
        }
        await client.query("UPDATE purchase_order_items SET inventory_id = $1 WHERE id = $2", [inventoryId, item.id]);
      }

      if (inventoryId) {
        await client.query(
          "UPDATE inventory SET qty = qty + $1, cost_usd = $2, sale_price_aed = COALESCE($3, sale_price_aed) WHERE id = $4",
          [item.qty, unitCost.toFixed(4), item.sale_price_aed ?? null, inventoryId]
        );
        await upsertInventorySourceFromPurchase(client, inventoryId, effectiveSupplierId, unitCost);
      }

      // Capital injection: create capital_entry for this item's value
      if (isCapitalInjection) {
        const itemValue = unitCost * item.qty;
        const receiveDate = new Date().toISOString().slice(0, 10);
        await client.query(
          `INSERT INTO capital_entries (date, source_name, description, amount, payment_method, notes)
           VALUES ($1, $2, $3, $4, 'goods_in_kind', $5)`,
          [receiveDate, po.supplier_name ?? 'Capital Owner',
           `بضاعة من صاحب رأس المال — ${po.po_number} — ${item.name}`,
           itemValue.toFixed(4),
           `استلام عنصر واحد من أمر الشراء ${po.po_number}`]
        );
      }
    }

    // Mark this item as received
    await client.query("UPDATE purchase_order_items SET is_received = true WHERE id = $1", [item.id]);

    // Check if ALL items in this PO are now received → mark PO as received
    const pendingRes = await client.query(
      "SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = $1 AND is_received = false",
      [id]
    );
    const pendingCount = parseInt(pendingRes.rows[0].count);
    if (pendingCount === 0) {
      // All items received: finalize PO and update AP to final amount (no shipping adjustment for individual receives)
      if (po.po_type === "regular" && po.payment_method === "credit") {
        const allItemsRes = await client.query("SELECT unit_cost, qty FROM purchase_order_items WHERE purchase_order_id = $1", [id]);
        const totalItemCost = allItemsRes.rows.reduce((sum: number, i: any) => sum + parseFloat(i.unit_cost) * i.qty, 0);
        const shippingCost = parseFloat(po.shipping_cost) || 0;
        const finalTotal = totalItemCost + shippingCost;
        const existingAP = await client.query("SELECT id FROM accounts_payable WHERE purchase_order_id = $1 LIMIT 1", [id]);
        if (existingAP.rows.length > 0) {
          await client.query("UPDATE accounts_payable SET amount_usd = $1, updated_at = now() WHERE id = $2",
            [finalTotal.toFixed(4), existingAP.rows[0].id]);
        }
      }
      await client.query("UPDATE purchase_orders SET status = 'received' WHERE id = $1", [id]);
    }

    await client.query("COMMIT");
    const full = await pool.query(`${WITH_ITEMS} WHERE po.id = $1 GROUP BY po.id`, [id]);
    res.json(full.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    if (err instanceof MasterDataError) return res.status(err.status).json({ error: err.message });
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

    const shippingCost = parseFloat(po.shipping_cost) || 0;
    const totalItemCost = items.reduce((sum: number, i: any) => sum + parseFloat(i.unit_cost) * i.qty, 0);
    const isConsignment = po.po_type === "consignment";
    const isCapitalInjection = po.po_type === "capital_injection";
    const isCreditPurchase = po.po_type === "regular" && po.payment_method === "credit";

    let totalLandedCost = 0;

    for (const item of items) {
      const canonicalItem = await canonicalizePurchaseItemFields({
        brand: item.brand,
        size: item.size ?? null,
        concentration: item.concentration ?? null,
      });
      await client.query(
        "UPDATE purchase_order_items SET brand = $1, size = $2, concentration = $3 WHERE id = $4",
        [canonicalItem.brand, canonicalItem.size, canonicalItem.concentration, item.id],
      );
      const itemTotal = parseFloat(item.unit_cost) * item.qty;
      const shippingShare = totalItemCost > 0 ? (itemTotal / totalItemCost) * shippingCost : 0;
      const landedUnitCost = parseFloat(item.unit_cost) + (item.qty > 0 ? shippingShare / item.qty : 0);
      totalLandedCost += landedUnitCost * item.qty;
      const effectiveSupplierId = item.supplier_id ?? po.supplier_id ?? null;

      if (isConsignment) {
        // Consignment: update cost_usd (cost owed to supplier per sale) and mark product type
        // Never touch qty — company doesn't own this stock
        if (item.inventory_id) {
          await client.query(
            "UPDATE inventory SET cost_usd = $1, product_type = 'consignment', consignment_supplier_id = $2 WHERE id = $3",
            [landedUnitCost.toFixed(4), po.supplier_id ?? null, item.inventory_id]
          );
          await upsertInventorySourceFromPurchase(client, item.inventory_id, effectiveSupplierId, landedUnitCost);
        } else if (item.barcode) {
          const newInv = await client.query(
            `INSERT INTO inventory (barcode, brand, name, main_category, sub_category, size, concentration, gender, qty, cost_usd, sale_price_aed, product_type, consignment_supplier_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,'consignment',$11)
             ON CONFLICT (barcode) DO UPDATE SET cost_usd = $9, sale_price_aed = COALESCE($10, inventory.sale_price_aed), product_type = 'consignment', consignment_supplier_id = $11
             RETURNING id`,
            [item.barcode, canonicalItem.brand, item.name, item.main_category ?? 'perfume', item.sub_category ?? null,
             canonicalItem.size, canonicalItem.concentration, item.gender ?? null,
             landedUnitCost.toFixed(4), item.sale_price_aed ?? 0, po.supplier_id ?? null]
          );
          await client.query(
            "UPDATE purchase_order_items SET inventory_id = $1 WHERE id = $2",
            [newInv.rows[0].id, item.id]
          );
          await upsertInventorySourceFromPurchase(client, newInv.rows[0].id, effectiveSupplierId, landedUnitCost);
        }
        continue; // No qty/financial changes for consignment
      }

      // Non-consignment: add qty and update cost (confirm no longer adds qty)
      if (item.inventory_id) {
        await client.query(
          "UPDATE inventory SET qty = qty + $1, cost_usd = $2, sale_price_aed = COALESCE($3, sale_price_aed) WHERE id = $4",
          [item.qty, landedUnitCost.toFixed(4), item.sale_price_aed ?? null, item.inventory_id],
        );
        await upsertInventorySourceFromPurchase(client, item.inventory_id, effectiveSupplierId, landedUnitCost);
      } else {
        const newInv = await client.query(
          `INSERT INTO inventory (barcode, brand, name, main_category, sub_category, size, concentration, gender, qty, cost_usd, sale_price_aed)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (barcode) DO UPDATE SET qty = inventory.qty + $9, cost_usd = $10, sale_price_aed = COALESCE($11, inventory.sale_price_aed)
           RETURNING id`,
          [item.barcode, canonicalItem.brand, item.name, item.main_category ?? 'perfume', item.sub_category ?? null,
           canonicalItem.size, canonicalItem.concentration, item.gender ?? null,
           item.qty, landedUnitCost.toFixed(4), item.sale_price_aed ?? 0]
        );
        await client.query(
          "UPDATE purchase_order_items SET inventory_id = $1, supplier_id = COALESCE(supplier_id, $3) WHERE id = $2",
          [newInv.rows[0].id, item.id, effectiveSupplierId],
        );
        await upsertInventorySourceFromPurchase(client, newInv.rows[0].id, effectiveSupplierId, landedUnitCost);
      }
      // Mark item as received
      await client.query("UPDATE purchase_order_items SET is_received = true WHERE id = $1", [item.id]);
    }

    // Financial entries based on PO type
    const receiveDate = new Date().toISOString().slice(0, 10);

    if (isCapitalInjection) {
      // Goods from capital owner → auto-create capital entry (no purchase debit)
      await client.query(
        `INSERT INTO capital_entries (date, source_name, description, amount, payment_method, notes)
         VALUES ($1, $2, $3, $4, 'goods_in_kind', $5)`,
        [receiveDate, po.supplier_name ?? 'Capital Owner',
         `بضاعة من صاحب رأس المال — ${po.po_number}`,
         totalLandedCost.toFixed(4),
         `تم إنشاؤه تلقائياً عند استلام أمر الشراء ${po.po_number}`]
      );
    } else if (isCreditPurchase) {
      // Credit purchase → update existing AP (created at confirm) to final landed cost,
      // or create it now if it was somehow missing
      const existingAP = await client.query(
        "SELECT id FROM accounts_payable WHERE purchase_order_id = $1 LIMIT 1",
        [po.id]
      );
      if (existingAP.rows.length > 0) {
        await client.query(
          "UPDATE accounts_payable SET amount_usd = $1, updated_at = now() WHERE id = $2",
          [totalLandedCost.toFixed(4), existingAP.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO accounts_payable (purchase_order_id, supplier_id, supplier_name, description, amount_usd, status)
           VALUES ($1, $2, $3, $4, $5, 'open')`,
          [po.id, po.supplier_id, po.supplier_name ?? 'مورد', po.po_number, totalLandedCost.toFixed(4)]
        );
      }
    }
    // Regular cash PO: no extra entry needed — ledger picks it up via po_type='regular' AND payment_method='cash' AND status='received'

    await client.query("UPDATE purchase_orders SET status = 'received' WHERE id = $1", [id]);
    await client.query("COMMIT");
    const full = await pool.query(`${WITH_ITEMS} WHERE po.id = $1 GROUP BY po.id`, [po.id]);
    res.json(full.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    if (err instanceof MasterDataError) return res.status(err.status).json({ error: err.message });
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
    if (err instanceof MasterDataError) return res.status(err.status).json({ error: err.message });
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

  // Block deletion if any items have already been individually received
  const receivedCheck = await pool.query(
    "SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = $1 AND is_received = true",
    [id]
  );
  if (parseInt(receivedCheck.rows[0].count) > 0) {
    return res.status(400).json({ error: "Cannot delete a PO with already-received items" });
  }

  // Delete open AP commitment created at confirm time (credit POs)
  await pool.query(
    "DELETE FROM accounts_payable WHERE purchase_order_id = $1 AND status = 'open' AND amount_paid_usd = 0",
    [id]
  );
  await pool.query("DELETE FROM purchase_orders WHERE id = $1", [id]);
  res.json({ ok: true });
});
