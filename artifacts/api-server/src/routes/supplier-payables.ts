import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middleware/auth";

export const supplierPayablesRouter = Router();

supplierPayablesRouter.use(requireAuth, requireAdmin);

type RecordType = "purchase" | "consignment";

function parseMoney(value: unknown): number {
  return Number.parseFloat(String(value ?? 0));
}

function getRecordType(record: { invoice_item_id: number | null }): RecordType {
  return record.invoice_item_id ? "consignment" : "purchase";
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

supplierPayablesRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.neighborhood,
        s.phone_numbers,
        COUNT(ap.id)::int AS record_count,
        COALESCE(SUM(ap.amount_usd), 0)::numeric(10,2) AS total_amount,
        COALESCE(SUM(ap.amount_paid_usd), 0)::numeric(10,2) AS total_settled,
        COALESCE(SUM(ap.amount_usd - ap.amount_paid_usd), 0)::numeric(10,2) AS total_outstanding,
        COALESCE(SUM(CASE WHEN ap.invoice_item_id IS NULL THEN ap.amount_usd ELSE 0 END), 0)::numeric(10,2) AS purchase_total,
        COALESCE(SUM(CASE WHEN ap.invoice_item_id IS NULL THEN ap.amount_paid_usd ELSE 0 END), 0)::numeric(10,2) AS purchase_settled,
        COALESCE(SUM(CASE WHEN ap.invoice_item_id IS NULL THEN ap.amount_usd - ap.amount_paid_usd ELSE 0 END), 0)::numeric(10,2) AS purchase_outstanding,
        COALESCE(SUM(CASE WHEN ap.invoice_item_id IS NOT NULL THEN ap.amount_usd ELSE 0 END), 0)::numeric(10,2) AS consignment_total,
        COALESCE(SUM(CASE WHEN ap.invoice_item_id IS NOT NULL THEN ap.amount_paid_usd ELSE 0 END), 0)::numeric(10,2) AS consignment_settled,
        COALESCE(SUM(CASE WHEN ap.invoice_item_id IS NOT NULL THEN ap.amount_usd - ap.amount_paid_usd ELSE 0 END), 0)::numeric(10,2) AS consignment_outstanding,
        MAX(ap.created_at) AS last_record_at,
        MAX(ap.updated_at) AS last_settlement_at
      FROM accounts_payable ap
      JOIN suppliers s ON s.id = ap.supplier_id
      GROUP BY s.id, s.name, s.neighborhood, s.phone_numbers
      ORDER BY total_outstanding DESC, supplier_name ASC
    `);

    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

supplierPayablesRouter.get("/:supplierId", async (req, res) => {
  const supplierId = Number.parseInt(req.params.supplierId, 10);
  if (Number.isNaN(supplierId)) {
    return res.status(400).json({ error: "Invalid supplier id" });
  }

  try {
    const supplierRes = await pool.query(
      `
        SELECT id, name, neighborhood, address_detail, phone_numbers, notes, supplier_type, created_at
        FROM suppliers
        WHERE id = $1
      `,
      [supplierId],
    );

    if (supplierRes.rows.length === 0) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    const recordsRes = await pool.query(
      `
        SELECT
          ap.*,
          po.po_number,
          ii.invoice_id,
          COALESCE(sett.journaled_settled, 0)::numeric(10,2) AS journaled_settled,
          GREATEST(ap.amount_paid_usd - COALESCE(sett.journaled_settled, 0), 0)::numeric(10,2) AS unjournaled_settled_amount,
          COALESCE(sett.event_count, 0)::int AS settlement_event_count,
          sett.last_settlement_date,
          COALESCE(sett.settlements, '[]'::json) AS settlements
        FROM accounts_payable ap
        LEFT JOIN purchase_orders po ON po.id = ap.purchase_order_id
        LEFT JOIN invoice_items ii ON ii.id = ap.invoice_item_id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) AS event_count,
            COALESCE(SUM(aps.amount_usd), 0) AS journaled_settled,
            MAX(aps.payment_date) AS last_settlement_date,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', aps.id,
                  'accounts_payable_id', aps.accounts_payable_id,
                  'payment_date', aps.payment_date,
                  'amount_usd', aps.amount_usd,
                  'payment_method', aps.payment_method,
                  'notes', aps.notes,
                  'created_at', aps.created_at
                )
                ORDER BY aps.payment_date DESC, aps.id DESC
              ),
              '[]'::json
            ) AS settlements
          FROM accounts_payable_settlements aps
          WHERE aps.accounts_payable_id = ap.id
        ) sett ON true
        WHERE ap.supplier_id = $1
        ORDER BY ap.created_at DESC, ap.id DESC
      `,
      [supplierId],
    );

    const records = recordsRes.rows.map((row) => {
      const totalAmount = parseMoney(row.amount_usd);
      const totalSettled = parseMoney(row.amount_paid_usd);
      const totalOutstanding = Math.max(totalAmount - totalSettled, 0);
      return {
        ...row,
        payable_type: getRecordType(row),
        amount_usd: formatMoney(totalAmount),
        amount_paid_usd: formatMoney(totalSettled),
        outstanding_usd: formatMoney(totalOutstanding),
        journaled_settled: formatMoney(parseMoney(row.journaled_settled)),
        unjournaled_settled_amount: formatMoney(parseMoney(row.unjournaled_settled_amount)),
        settlement_history_complete: parseMoney(row.unjournaled_settled_amount) < 0.0001,
      };
    });

    const summary = records.reduce(
      (acc, record) => {
        const totalAmount = parseMoney(record.amount_usd);
        const totalSettled = parseMoney(record.amount_paid_usd);
        const totalOutstanding = parseMoney(record.outstanding_usd);
        const unjournaledSettled = parseMoney(record.unjournaled_settled_amount);
        acc.record_count += 1;
        acc.total_amount += totalAmount;
        acc.total_settled += totalSettled;
        acc.total_outstanding += totalOutstanding;
        acc.unjournaled_settled += unjournaledSettled;
        if (unjournaledSettled > 0) {
          acc.records_with_partial_history += 1;
        }
        if (record.payable_type === "consignment") {
          acc.consignment_total += totalAmount;
          acc.consignment_settled += totalSettled;
          acc.consignment_outstanding += totalOutstanding;
        } else {
          acc.purchase_total += totalAmount;
          acc.purchase_settled += totalSettled;
          acc.purchase_outstanding += totalOutstanding;
        }
        return acc;
      },
      {
        record_count: 0,
        total_amount: 0,
        total_settled: 0,
        total_outstanding: 0,
        purchase_total: 0,
        purchase_settled: 0,
        purchase_outstanding: 0,
        consignment_total: 0,
        consignment_settled: 0,
        consignment_outstanding: 0,
        unjournaled_settled: 0,
        records_with_partial_history: 0,
      },
    );

    const settlementHistoryNote =
      summary.records_with_partial_history > 0
        ? `Settlement history is complete only for new events recorded after Phase 11. ${summary.records_with_partial_history} record(s) still have pre-journal settled amounts shown as current cumulative state only.`
        : "Settlement history is event-based for this supplier. Current settled totals are fully backed by recorded settlement events.";

    return res.json({
      supplier: supplierRes.rows[0],
      summary: {
        record_count: summary.record_count,
        total_amount: formatMoney(summary.total_amount),
        total_settled: formatMoney(summary.total_settled),
        total_outstanding: formatMoney(summary.total_outstanding),
        purchase_total: formatMoney(summary.purchase_total),
        purchase_settled: formatMoney(summary.purchase_settled),
        purchase_outstanding: formatMoney(summary.purchase_outstanding),
        consignment_total: formatMoney(summary.consignment_total),
        consignment_settled: formatMoney(summary.consignment_settled),
        consignment_outstanding: formatMoney(summary.consignment_outstanding),
        unjournaled_settled: formatMoney(summary.unjournaled_settled),
        records_with_partial_history: summary.records_with_partial_history,
      },
      records,
      settlement_history_note: settlementHistoryNote,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
