import { Router } from "express";
import { pool } from "@workspace/db";

export const accountsPayableRouter = Router();

function parseMoney(value: unknown): number {
  return Number.parseFloat(String(value ?? 0));
}

// GET all accounts payable records
accountsPayableRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ap.*,
        s.name AS supplier_name_current,
        po.po_number,
        ii.invoice_id,
        COALESCE(sett.event_count, 0)::int AS settlement_event_count,
        sett.last_settlement_date,
        GREATEST(ap.amount_paid_usd - COALESCE(sett.journaled_paid, 0), 0)::numeric(10,2) AS unjournaled_settled_amount
      FROM accounts_payable ap
      LEFT JOIN suppliers s ON s.id = ap.supplier_id
      LEFT JOIN purchase_orders po ON po.id = ap.purchase_order_id
      LEFT JOIN invoice_items ii ON ii.id = ap.invoice_item_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS event_count,
          COALESCE(SUM(aps.amount_usd), 0) AS journaled_paid,
          MAX(aps.payment_date) AS last_settlement_date
        FROM accounts_payable_settlements aps
        WHERE aps.accounts_payable_id = ap.id
      ) sett ON true
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

accountsPayableRouter.get("/:id/settlements", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const apRes = await pool.query(
      `
        SELECT id, supplier_id, supplier_name, amount_usd, amount_paid_usd, status
        FROM accounts_payable
        WHERE id = $1
      `,
      [id],
    );
    if (apRes.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const eventsRes = await pool.query(
      `
        SELECT id, accounts_payable_id, payment_date, amount_usd, payment_method, notes, created_at
        FROM accounts_payable_settlements
        WHERE accounts_payable_id = $1
        ORDER BY payment_date DESC, id DESC
      `,
      [id],
    );

    const journaledPaid = eventsRes.rows.reduce((sum, row) => sum + parseMoney(row.amount_usd), 0);
    const currentPaid = parseMoney(apRes.rows[0].amount_paid_usd);

    return res.json({
      payable: apRes.rows[0],
      settlements: eventsRes.rows,
      journaled_paid: journaledPaid.toFixed(2),
      unjournaled_settled_amount: Math.max(currentPaid - journaledPaid, 0).toFixed(2),
      settlement_history_complete: Math.max(currentPaid - journaledPaid, 0) < 0.0001,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// PUT /:id/pay - record a payment against an AP record
accountsPayableRouter.put("/:id/pay", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { amount, payment_method, notes, payment_date } = req.body as any;
  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: "Invalid payment amount" });
  }
  const paymentMethod =
    typeof payment_method === "string" && payment_method.trim() ? payment_method.trim() : "Cash";
  const paymentNotes = typeof notes === "string" && notes.trim() ? notes.trim() : null;
  const paymentDate =
    typeof payment_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payment_date)
      ? payment_date
      : new Date().toISOString().slice(0, 10);
  if (payment_date && (typeof payment_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payment_date))) {
    return res.status(400).json({ error: "Invalid payment date" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const apRes = await client.query("SELECT * FROM accounts_payable WHERE id = $1 FOR UPDATE", [id]);
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
    await client.query(
      `
        INSERT INTO accounts_payable_settlements (accounts_payable_id, payment_date, amount_usd, payment_method, notes)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [id, paymentDate, actualPayment.toFixed(4), paymentMethod, paymentNotes]
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
