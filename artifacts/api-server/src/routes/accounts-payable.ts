import { Router } from "express";
import { pool } from "@workspace/db";

export const accountsPayableRouter = Router();

// GET all accounts payable records
accountsPayableRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ap.*,
        s.name AS supplier_name_current,
        po.po_number,
        ii.invoice_id
      FROM accounts_payable ap
      LEFT JOIN suppliers s ON s.id = ap.supplier_id
      LEFT JOIN purchase_orders po ON po.id = ap.purchase_order_id
      LEFT JOIN invoice_items ii ON ii.id = ap.invoice_item_id
      ORDER BY ap.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET summary by supplier
accountsPayableRouter.get("/summary", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ap.supplier_id,
        ap.supplier_name,
        COUNT(*) AS record_count,
        COALESCE(SUM(ap.amount_usd), 0)::numeric(10,2) AS total_amount,
        COALESCE(SUM(ap.amount_paid_usd), 0)::numeric(10,2) AS total_paid,
        COALESCE(SUM(ap.amount_usd - ap.amount_paid_usd), 0)::numeric(10,2) AS total_outstanding
      FROM accounts_payable ap
      WHERE ap.status IN ('open', 'partially_paid')
      GROUP BY ap.supplier_id, ap.supplier_name
      ORDER BY total_outstanding DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /:id/pay — record a payment against an AP record
accountsPayableRouter.put("/:id/pay", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { amount, notes, payment_method } = req.body as any;
  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: "Invalid payment amount" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const apRes = await client.query("SELECT * FROM accounts_payable WHERE id = $1", [id]);
    if (apRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }
    const ap = apRes.rows[0];
    if (ap.status === "paid") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Already fully paid" });
    }

    const outstanding = parseFloat(ap.amount_usd) - parseFloat(ap.amount_paid_usd);
    const actualPayment = Math.min(paymentAmount, outstanding);
    const newPaid = parseFloat(ap.amount_paid_usd) + actualPayment;
    const newStatus = newPaid >= parseFloat(ap.amount_usd) ? "paid" : "partially_paid";

    await client.query(
      `UPDATE accounts_payable
       SET amount_paid_usd = $1, status = $2, updated_at = now()
       WHERE id = $3`,
      [newPaid.toFixed(4), newStatus, id]
    );

    // Record as an expense so the cash outflow appears in the ledger
    const today = new Date().toISOString().slice(0, 10);
    await client.query(
      `INSERT INTO expenses (date, category, description, amount, payment_method, notes)
       VALUES ($1, 'Credit Purchase Payment', $2, $3, $4, $5)`,
      [today,
       `دفعة مستحقات: ${ap.supplier_name} — AP-${String(id).padStart(4, '0')}`,
       actualPayment.toFixed(4),
       payment_method ?? "Cash",
       notes ?? null]
    );

    await client.query("COMMIT");

    const updated = await pool.query("SELECT * FROM accounts_payable WHERE id = $1", [id]);
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});
