import { Router } from "express";
import { pool } from "@workspace/db";
import { CreateInvoiceBody } from "@workspace/api-zod";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { activityActorFromSession, insertActivityLog } from "../lib/activityLog";

export const invoicesRouter = Router();

invoicesRouter.use(requireAuth, requireAdmin);

type VoidInvoiceResult =
  | { ok: true; invoiceNumber: string }
  | { ok: false; status: 404 | 409; error: string };

type InvoiceTransactionClient = {
  query: typeof pool.query;
};

type PaymentStatus = "VOIDED" | "UNPAID" | "PARTIALLY_PAID" | "PAID";

const invoiceItemsJsonSql = `
  COALESCE((
    SELECT json_agg(
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
      )
      ORDER BY ii.id
    )
    FROM invoice_items ii
    WHERE ii.invoice_id = i.id
  ), '[]'::json) AS items
`;

const invoicePaymentsJsonSql = `
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', cp.id,
        'invoice_id', cp.invoice_id,
        'payment_date', cp.payment_date,
        'amount_aed', cp.amount_aed,
        'payment_method', cp.payment_method,
        'notes', cp.notes,
        'created_at', cp.created_at
      )
      ORDER BY cp.payment_date DESC, cp.id DESC
    )
    FROM customer_payments cp
    WHERE cp.invoice_id = i.id
  ), '[]'::json) AS payments
`;

const invoicePaymentSummarySql = `
  COALESCE(pay.total_paid, 0)::numeric(10,2) AS total_paid,
  GREATEST(i.total - COALESCE(pay.total_paid, 0), 0)::numeric(10,2) AS remaining_balance,
  CASE
    WHEN UPPER(i.status) = 'VOIDED' THEN 'VOIDED'
    WHEN COALESCE(pay.total_paid, 0) <= 0 THEN 'UNPAID'
    WHEN COALESCE(pay.total_paid, 0) >= i.total THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END AS payment_status
`;

function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `INV-${year}-${timestamp}`;
}

function normalizePaymentStatus(status: unknown): PaymentStatus {
  const value = String(status ?? "").toUpperCase();
  if (value === "VOIDED" || value === "PAID" || value === "PARTIALLY_PAID") {
    return value;
  }
  return "UNPAID";
}

function parseMoney(value: unknown): number {
  return Number.parseFloat(String(value ?? 0));
}

function buildInvoiceDetailQuery(whereClause: string) {
  return `
    SELECT
      i.*,
      ${invoiceItemsJsonSql},
      ${invoicePaymentsJsonSql},
      ${invoicePaymentSummarySql}
    FROM invoices i
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(cp.amount_aed), 0) AS total_paid
      FROM customer_payments cp
      WHERE cp.invoice_id = i.id
    ) pay ON true
    ${whereClause}
  `;
}

async function getInvoiceById(client: InvoiceTransactionClient, id: number) {
  const result = await client.query(buildInvoiceDetailQuery(`WHERE i.id = $1`), [id]);
  return result.rows[0] ?? null;
}

async function voidInvoiceById(client: InvoiceTransactionClient, id: number): Promise<VoidInvoiceResult> {
  const invoiceRes = await client.query(`SELECT * FROM invoices WHERE id = $1`, [id]);
  if (invoiceRes.rows.length === 0) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const invoice = invoiceRes.rows[0];
  if (invoice.status === "VOIDED") {
    return { ok: false, status: 409, error: "Invoice already voided" };
  }

  const paymentsRes = await client.query(
    `SELECT COALESCE(SUM(amount_aed), 0) AS total_paid FROM customer_payments WHERE invoice_id = $1`,
    [id],
  );
  if (parseMoney(paymentsRes.rows[0]?.total_paid) > 0) {
    return { ok: false, status: 409, error: "Cannot void invoice with recorded customer payments" };
  }

  const items = await client.query(`SELECT * FROM invoice_items WHERE invoice_id = $1`, [id]);
  for (const item of items.rows) {
    if (item.inventory_id && !item.is_consignment) {
      await client.query(`UPDATE inventory SET qty = qty + $1 WHERE id = $2`, [item.qty, item.inventory_id]);
    }
    if (item.is_consignment) {
      await client.query(`DELETE FROM accounts_payable WHERE invoice_item_id = $1`, [item.id]);
    }
  }

  await client.query(`UPDATE invoices SET status = 'VOIDED' WHERE id = $1`, [id]);

  return { ok: true, invoiceNumber: invoice.invoice_number };
}

invoicesRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        i.*,
        ${invoiceItemsJsonSql},
        ${invoicePaymentSummarySql}
      FROM invoices i
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(cp.amount_aed), 0) AS total_paid
        FROM customer_payments cp
        WHERE cp.invoice_id = i.id
      ) pay ON true
      ORDER BY i.created_at DESC
    `);
    return res.json(
      result.rows.map((row) => ({
        ...row,
        payment_status: normalizePaymentStatus(row.payment_status),
      })),
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

invoicesRouter.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const invoice = await getInvoiceById(pool, id);
    if (!invoice) return res.status(404).json({ error: "Not found" });

    return res.json({
      ...invoice,
      payment_status: normalizePaymentStatus(invoice.payment_status),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
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

    const inventoryIds = data.items.map((i) => i.inventory_id);
    const inventoryResult = await client.query(`SELECT * FROM inventory WHERE id = ANY($1::int[])`, [inventoryIds]);
    const inventoryMap = new Map(inventoryResult.rows.map((r) => [r.id, r]));

    for (const item of data.items) {
      const inv = inventoryMap.get(item.inventory_id);
      if (!inv) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Product ID ${item.inventory_id} not found` });
      }
      if (inv.product_type !== "consignment" && inv.qty < item.qty) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Requested quantity (${item.qty}) exceeds available stock (${inv.qty}) for: ${inv.brand} ${inv.name}`,
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

    const invoiceResult = await client.query(
      `
        INSERT INTO invoices (invoice_number, customer_id, customer_name, date, status, subtotal, discount, total, notes)
        VALUES ($1, $2, $3, $4, 'CONFIRMED', $5, $6, $7, $8)
        RETURNING *
      `,
      [invoiceNumber, data.customer_id ?? null, customerName, invoiceDate, subtotal, discount, total, data.notes ?? null],
    );

    const invoice = invoiceResult.rows[0];

    for (const item of data.items) {
      const inv = inventoryMap.get(item.inventory_id)!;
      const isConsignment = inv.product_type === "consignment";
      const consignmentCost = isConsignment ? parseFloat(inv.cost_usd) : null;

      const itemResult = await client.query(
        `
          INSERT INTO invoice_items (invoice_id, inventory_id, barcode, brand, name, size, concentration, gender, qty, unit_price_aed, cost_usd, is_consignment, consignment_supplier_id, consignment_cost_usd)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id
        `,
        [
          invoice.id,
          item.inventory_id,
          inv.barcode,
          inv.brand,
          inv.name,
          inv.size,
          inv.concentration,
          inv.gender,
          item.qty,
          item.unit_price_aed,
          inv.cost_usd,
          isConsignment,
          isConsignment ? inv.consignment_supplier_id : null,
          consignmentCost,
        ],
      );

      if (isConsignment) {
        if (inv.consignment_supplier_id && consignmentCost !== null) {
          const supplierRes = await client.query("SELECT name FROM suppliers WHERE id = $1", [inv.consignment_supplier_id]);
          const supplierName = supplierRes.rows.length > 0 ? supplierRes.rows[0].name : "Consignment Supplier";
          const owedAmount = (consignmentCost * item.qty).toFixed(4);

          await client.query(
            `
              INSERT INTO accounts_payable (invoice_item_id, supplier_id, supplier_name, description, amount_usd, status)
              VALUES ($1, $2, $3, $4, $5, 'open')
            `,
            [
              itemResult.rows[0].id,
              inv.consignment_supplier_id,
              supplierName,
              `Consignment sale: ${inv.brand} ${inv.name} x ${item.qty} - ${invoiceNumber}`,
              owedAmount,
            ],
          );
        }
      } else {
        await client.query(`UPDATE inventory SET qty = qty - $1 WHERE id = $2`, [item.qty, item.inventory_id]);
      }
    }

    await client.query("COMMIT");

    const full = await getInvoiceById(pool, invoice.id);
    return res.status(201).json({
      ...full,
      payment_status: normalizePaymentStatus(full?.payment_status),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

invoicesRouter.post("/:id/payments", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const amount = parseMoney((req.body as Record<string, unknown>)?.amount);
  const paymentDateRaw = (req.body as Record<string, unknown>)?.payment_date;
  const paymentMethodRaw = (req.body as Record<string, unknown>)?.payment_method;
  const notesRaw = (req.body as Record<string, unknown>)?.notes;

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Payment amount must be greater than 0" });
  }

  const paymentDate =
    typeof paymentDateRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(paymentDateRaw)
      ? paymentDateRaw
      : new Date().toISOString().slice(0, 10);
  if (paymentDateRaw && (typeof paymentDateRaw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDateRaw))) {
    return res.status(400).json({ error: "Invalid payment date" });
  }

  const paymentMethod =
    typeof paymentMethodRaw === "string" && paymentMethodRaw.trim()
      ? paymentMethodRaw.trim()
      : "Cash";
  const notes = typeof notesRaw === "string" && notesRaw.trim() ? notesRaw.trim() : null;

  const client = await pool.connect();
  const actor = activityActorFromSession(req.session);
  try {
    await client.query("BEGIN");

    const invoiceRes = await client.query(`SELECT * FROM invoices WHERE id = $1 FOR UPDATE`, [id]);
    if (invoiceRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }

    const invoice = invoiceRes.rows[0];
    if (String(invoice.status).toUpperCase() === "VOIDED") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Cannot record payment on a voided invoice" });
    }

    const totalsRes = await client.query(
      `SELECT COALESCE(SUM(amount_aed), 0) AS total_paid FROM customer_payments WHERE invoice_id = $1`,
      [id],
    );
    const totalPaid = parseMoney(totalsRes.rows[0]?.total_paid);
    const invoiceTotal = parseMoney(invoice.total);
    const remaining = Math.max(0, invoiceTotal - totalPaid);

    if (amount > remaining + 0.0001) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Payment exceeds remaining invoice balance" });
    }

    await client.query(
      `
        INSERT INTO customer_payments (invoice_id, payment_date, amount_aed, payment_method, notes)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [id, paymentDate, amount.toFixed(2), paymentMethod, notes],
    );
    await insertActivityLog(client, {
      ...actor,
      actionType: "customer_payment_recorded",
      entityType: "invoice",
      entityId: id,
      summary: `Recorded customer payment for invoice ${invoice.invoice_number}`,
      metadata: {
        invoice_number: invoice.invoice_number,
        invoice_total: invoice.total,
        amount_aed: amount.toFixed(2),
        payment_method: paymentMethod,
        payment_date: paymentDate,
      },
    });

    await client.query("COMMIT");

    const updatedInvoice = await getInvoiceById(pool, id);
    return res.status(201).json({
      ...updatedInvoice,
      payment_status: normalizePaymentStatus(updatedInvoice?.payment_status),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

invoicesRouter.post("/:id/void", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const client = await pool.connect();
  const actor = activityActorFromSession(req.session);
  try {
    await client.query("BEGIN");

    const voidResult = await voidInvoiceById(client, id);
    if (!voidResult.ok) {
      await client.query("ROLLBACK");
      return res.status(voidResult.status).json({ error: voidResult.error });
    }
    await insertActivityLog(client, {
      ...actor,
      actionType: "invoice_voided",
      entityType: "invoice",
      entityId: id,
      summary: `Voided invoice ${voidResult.invoiceNumber}`,
      metadata: {
        invoice_number: voidResult.invoiceNumber,
        route: "POST /api/invoices/:id/void",
      },
    });
    await client.query("COMMIT");

    return res.json({ success: true, message: `Invoice ${voidResult.invoiceNumber} voided and quantities restored to inventory` });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

invoicesRouter.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const client = await pool.connect();
  const actor = activityActorFromSession(req.session);
  try {
    await client.query("BEGIN");

    const voidResult = await voidInvoiceById(client, id);
    if (!voidResult.ok) {
      await client.query("ROLLBACK");
      return res.status(voidResult.status).json({ error: voidResult.error });
    }
    await insertActivityLog(client, {
      ...actor,
      actionType: "invoice_voided",
      entityType: "invoice",
      entityId: id,
      summary: `Voided invoice ${voidResult.invoiceNumber}`,
      metadata: {
        invoice_number: voidResult.invoiceNumber,
        route: "DELETE /api/invoices/:id",
      },
    });
    await client.query("COMMIT");

    return res.json({ success: true, message: `Invoice ${voidResult.invoiceNumber} voided and quantities restored to inventory` });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});
