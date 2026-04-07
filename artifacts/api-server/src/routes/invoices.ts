import { Router } from "express";
import { pool } from "@workspace/db";
import { CreateInvoiceBody } from "@workspace/api-zod";

export const invoicesRouter = Router();

function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `INV-${year}-${timestamp}`;
}

invoicesRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, 
        COALESCE(json_agg(
          json_build_object(
            'id', ii.id,
            'invoice_id', ii.invoice_id,
            'inventory_id', ii.inventory_id,
            'barcode', ii.barcode,
            'brand', ii.brand,
            'name', ii.name,
            'size', ii.size,
            'concentration', ii.concentration,
            'gender', ii.gender,
            'qty', ii.qty,
            'unit_price_aed', ii.unit_price_aed,
            'cost_usd', ii.cost_usd,
            'created_at', ii.created_at
          ) ORDER BY ii.id
        ) FILTER (WHERE ii.id IS NOT NULL), '[]') AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

invoicesRouter.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const result = await pool.query(`
      SELECT i.*, 
        COALESCE(json_agg(
          json_build_object(
            'id', ii.id,
            'invoice_id', ii.invoice_id,
            'inventory_id', ii.inventory_id,
            'barcode', ii.barcode,
            'brand', ii.brand,
            'name', ii.name,
            'size', ii.size,
            'concentration', ii.concentration,
            'gender', ii.gender,
            'qty', ii.qty,
            'unit_price_aed', ii.unit_price_aed,
            'cost_usd', ii.cost_usd,
            'created_at', ii.created_at
          ) ORDER BY ii.id
        ) FILTER (WHERE ii.id IS NOT NULL), '[]') AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      WHERE i.id = $1
      GROUP BY i.id
    `, [id]);

    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

invoicesRouter.post("/", async (req, res) => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const data = parsed.data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const inventoryIds = data.items.map(i => i.inventory_id);
    const inventoryResult = await client.query(
      `SELECT * FROM inventory WHERE id = ANY($1::int[])`,
      [inventoryIds]
    );
    const inventoryMap = new Map(inventoryResult.rows.map(r => [r.id, r]));

    for (const item of data.items) {
      const inv = inventoryMap.get(item.inventory_id);
      if (!inv) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Product ID ${item.inventory_id} not found` });
      }
      // Consignment products have qty=0 always — skip stock check
      if (inv.product_type !== 'consignment' && inv.qty < item.qty) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Requested quantity (${item.qty}) exceeds available stock (${inv.qty}) for: ${inv.brand} ${inv.name}`
        });
      }
    }

    let subtotal = 0;
    for (const item of data.items) {
      subtotal += item.qty * item.unit_price_aed;
    }
    const discount = data.discount ?? 0;
    const total = Math.max(0, subtotal - discount);

    let customerName = data.customer_name ?? null;
    if (data.customer_id && !customerName) {
      const cust = await client.query(`SELECT name FROM customers WHERE id = $1`, [data.customer_id]);
      if (cust.rows.length > 0) customerName = cust.rows[0].name;
    }

    const invoiceNumber = generateInvoiceNumber();
    const invoiceDate = data.date ?? new Date().toISOString().split("T")[0];

    const invoiceResult = await client.query(`
      INSERT INTO invoices (invoice_number, customer_id, customer_name, date, status, subtotal, discount, total, notes)
      VALUES ($1, $2, $3, $4, 'confirmed', $5, $6, $7, $8)
      RETURNING *
    `, [invoiceNumber, data.customer_id ?? null, customerName, invoiceDate, subtotal, discount, total, data.notes ?? null]);

    const invoice = invoiceResult.rows[0];

    for (const item of data.items) {
      const inv = inventoryMap.get(item.inventory_id)!;
      const isConsignment = inv.product_type === 'consignment';
      const consignmentCost = isConsignment ? parseFloat(inv.cost_usd) : null;

      const itemResult = await client.query(`
        INSERT INTO invoice_items (invoice_id, inventory_id, barcode, brand, name, size, concentration, gender, qty, unit_price_aed, cost_usd, is_consignment, consignment_supplier_id, consignment_cost_usd)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `, [invoice.id, item.inventory_id, inv.barcode, inv.brand, inv.name, inv.size, inv.concentration, inv.gender,
          item.qty, item.unit_price_aed, inv.cost_usd,
          isConsignment, isConsignment ? inv.consignment_supplier_id : null, consignmentCost]);

      if (isConsignment) {
        // Consignment sale: create accounts_payable for what we owe the supplier
        if (inv.consignment_supplier_id && consignmentCost !== null) {
          const supplierRes = await client.query("SELECT name FROM suppliers WHERE id = $1", [inv.consignment_supplier_id]);
          const supplierName = supplierRes.rows.length > 0 ? supplierRes.rows[0].name : 'مورد كونسينيمنت';
          const owedAmount = (consignmentCost * item.qty).toFixed(4);

          await client.query(`
            INSERT INTO accounts_payable (invoice_item_id, supplier_id, supplier_name, description, amount_usd, status)
            VALUES ($1, $2, $3, $4, $5, 'open')
          `, [itemResult.rows[0].id, inv.consignment_supplier_id, supplierName,
              `بيع كونسينيمنت: ${inv.brand} ${inv.name} × ${item.qty} — ${invoiceNumber}`,
              owedAmount]);
        }
        // Do NOT decrement inventory qty for consignment (it's always 0)
      } else {
        await client.query(`UPDATE inventory SET qty = qty - $1 WHERE id = $2`, [item.qty, item.inventory_id]);
      }
    }

    await client.query("COMMIT");

    const full = await pool.query(`
      SELECT i.*, 
        COALESCE(json_agg(
          json_build_object(
            'id', ii.id, 'invoice_id', ii.invoice_id, 'inventory_id', ii.inventory_id,
            'barcode', ii.barcode, 'brand', ii.brand, 'name', ii.name,
            'size', ii.size, 'concentration', ii.concentration, 'gender', ii.gender,
            'qty', ii.qty, 'unit_price_aed', ii.unit_price_aed, 'cost_usd', ii.cost_usd,
            'created_at', ii.created_at
          ) ORDER BY ii.id
        ) FILTER (WHERE ii.id IS NOT NULL), '[]') AS items
      FROM invoices i
      LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
      WHERE i.id = $1
      GROUP BY i.id
    `, [invoice.id]);

    res.status(201).json(full.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

invoicesRouter.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inv = await client.query(`SELECT * FROM invoices WHERE id = $1`, [id]);
    if (inv.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }

    const items = await client.query(`SELECT * FROM invoice_items WHERE invoice_id = $1`, [id]);
    for (const item of items.rows) {
      if (item.inventory_id && !item.is_consignment) {
        // Only restore qty for owned inventory
        await client.query(`UPDATE inventory SET qty = qty + $1 WHERE id = $2`, [item.qty, item.inventory_id]);
      }
      if (item.is_consignment) {
        // Cancel the related accounts_payable entry
        await client.query(
          `DELETE FROM accounts_payable WHERE invoice_item_id = $1`,
          [item.id]
        );
      }
    }

    await client.query(`DELETE FROM invoices WHERE id = $1`, [id]);
    await client.query("COMMIT");

    res.json({ success: true, message: "Invoice deleted and quantities restored to inventory" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});
