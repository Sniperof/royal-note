import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middleware/auth";

export const customerReceivablesRouter = Router();

customerReceivablesRouter.use(requireAuth, requireAdmin);

type PaymentStatus = "VOIDED" | "UNPAID" | "PARTIALLY_PAID" | "PAID";

function parseMoney(value: unknown): number {
  return Number.parseFloat(String(value ?? 0));
}

function normalizeInvoiceStatus(status: unknown): "CONFIRMED" | "VOIDED" {
  return String(status ?? "").toUpperCase() === "VOIDED" ? "VOIDED" : "CONFIRMED";
}

function normalizePaymentStatus(status: unknown): PaymentStatus {
  const value = String(status ?? "").toUpperCase();
  if (value === "VOIDED" || value === "PAID" || value === "PARTIALLY_PAID") {
    return value;
  }
  return "UNPAID";
}

customerReceivablesRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        c.phone_numbers,
        c.neighborhood,
        COUNT(i.id) FILTER (WHERE UPPER(i.status) <> 'VOIDED')::int AS invoice_count,
        COALESCE(
          SUM(CASE WHEN UPPER(i.status) <> 'VOIDED' THEN i.total ELSE 0 END),
          0
        )::numeric(10,2) AS total_invoiced,
        COALESCE(
          SUM(CASE WHEN UPPER(i.status) <> 'VOIDED' THEN COALESCE(pay.total_paid, 0) ELSE 0 END),
          0
        )::numeric(10,2) AS total_paid,
        COALESCE(
          SUM(
            CASE
              WHEN UPPER(i.status) <> 'VOIDED' THEN GREATEST(i.total - COALESCE(pay.total_paid, 0), 0)
              ELSE 0
            END
          ),
          0
        )::numeric(10,2) AS outstanding_balance,
        MAX(i.date) FILTER (WHERE UPPER(i.status) <> 'VOIDED') AS last_invoice_date,
        MAX(pay.last_payment_date) FILTER (WHERE UPPER(i.status) <> 'VOIDED') AS last_payment_date
      FROM customers c
      JOIN invoices i ON i.customer_id = c.id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(cp.amount_aed), 0) AS total_paid,
          MAX(cp.payment_date) AS last_payment_date
        FROM customer_payments cp
        WHERE cp.invoice_id = i.id
      ) pay ON true
      GROUP BY c.id, c.name, c.phone_numbers, c.neighborhood
      HAVING COUNT(i.id) FILTER (WHERE UPPER(i.status) <> 'VOIDED') > 0
      ORDER BY outstanding_balance DESC, customer_name ASC
    `);

    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

customerReceivablesRouter.get("/:customerId", async (req, res) => {
  const customerId = Number.parseInt(req.params.customerId, 10);
  if (Number.isNaN(customerId)) {
    return res.status(400).json({ error: "Invalid customer id" });
  }

  try {
    const customerRes = await pool.query(
      `
        SELECT id, name, neighborhood, address_detail, phone_numbers, notes, created_at
        FROM customers
        WHERE id = $1
      `,
      [customerId],
    );

    if (customerRes.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const invoicesRes = await pool.query(
      `
        SELECT
          i.id,
          i.invoice_number,
          i.customer_id,
          i.customer_name,
          i.date,
          i.status,
          i.subtotal,
          i.discount,
          i.total,
          i.notes,
          COALESCE(pay.total_paid, 0)::numeric(10,2) AS total_paid,
          CASE
            WHEN UPPER(i.status) = 'VOIDED' THEN 0::numeric(10,2)
            ELSE GREATEST(i.total - COALESCE(pay.total_paid, 0), 0)::numeric(10,2)
          END AS remaining_balance,
          CASE
            WHEN UPPER(i.status) = 'VOIDED' THEN 'VOIDED'
            WHEN COALESCE(pay.total_paid, 0) <= 0 THEN 'UNPAID'
            WHEN COALESCE(pay.total_paid, 0) >= i.total THEN 'PAID'
            ELSE 'PARTIALLY_PAID'
          END AS payment_status,
          COALESCE(pay.last_payment_date, NULL) AS last_payment_date,
          COALESCE(payments.payments, '[]'::json) AS payments
        FROM invoices i
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM(cp.amount_aed), 0) AS total_paid,
            MAX(cp.payment_date) AS last_payment_date
          FROM customer_payments cp
          WHERE cp.invoice_id = i.id
        ) pay ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            json_agg(
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
            ),
            '[]'::json
          ) AS payments
          FROM customer_payments cp
          WHERE cp.invoice_id = i.id
        ) payments ON true
        WHERE i.customer_id = $1
        ORDER BY i.date DESC NULLS LAST, i.id DESC
      `,
      [customerId],
    );

    const invoices = invoicesRes.rows.map((row) => {
      const status = normalizeInvoiceStatus(row.status);
      const totalPaid = parseMoney(row.total_paid);
      const remainingBalance = status === "VOIDED" ? 0 : parseMoney(row.remaining_balance);
      return {
        ...row,
        status,
        total_paid: totalPaid.toFixed(2),
        remaining_balance: remainingBalance.toFixed(2),
        payment_status: normalizePaymentStatus(row.payment_status),
      };
    });

    const activeInvoices = invoices.filter((invoice) => invoice.status !== "VOIDED");

    const totalInvoiced = activeInvoices.reduce((sum, invoice) => sum + parseMoney(invoice.total), 0);
    const totalPaid = activeInvoices.reduce((sum, invoice) => sum + parseMoney(invoice.total_paid), 0);
    const outstandingBalance = activeInvoices.reduce((sum, invoice) => sum + parseMoney(invoice.remaining_balance), 0);

    const lastInvoiceDate =
      activeInvoices.find((invoice) => invoice.date)?.date ?? null;
    const lastPaymentDate =
      activeInvoices
        .map((invoice) => invoice.last_payment_date)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .sort((a, b) => b.localeCompare(a))[0] ?? null;

    return res.json({
      customer: customerRes.rows[0],
      summary: {
        invoice_count: activeInvoices.length,
        total_invoiced: totalInvoiced.toFixed(2),
        total_paid: totalPaid.toFixed(2),
        outstanding_balance: outstandingBalance.toFixed(2),
        last_invoice_date: lastInvoiceDate,
        last_payment_date: lastPaymentDate,
      },
      invoices,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
