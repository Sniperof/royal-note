import { Router } from "express";
import { pool } from "@workspace/db";

export const ledgerRouter = Router();

ledgerRouter.get("/", async (_req, res) => {
  const [
    invoicesRes,
    customerReceiptsRes,
    cashboxMovementsRes,
    capitalEntriesRes,
    inventoryCostRes,
    purchasesRes,
    accountsPayableRes,
    apEntriesRes,
    apPaymentsRes,
  ] = await Promise.all([
    pool.query(`
      SELECT
        id,
        date::text AS date,
        invoice_number AS ref,
        COALESCE(customer_name, 'Walk-in Customer') AS party,
        total AS amount,
        'noncash' AS type,
        'Invoiced Sales' AS category,
        created_at
      FROM invoices
      WHERE status = 'CONFIRMED'
      ORDER BY date DESC
    `),
    pool.query(`
      SELECT
        cp.id,
        cp.payment_date::text AS date,
        CONCAT('RCP-', LPAD(cp.id::text, 4, '0')) AS ref,
        COALESCE(i.customer_name, 'Walk-in Customer') AS party,
        cp.amount_aed AS amount,
        'credit' AS type,
        'Customer Receipt' AS category,
        cp.created_at
      FROM customer_payments cp
      LEFT JOIN invoices i ON i.id = cp.invoice_id
      ORDER BY cp.payment_date DESC, cp.created_at DESC
    `),
    pool.query(`
      SELECT
        id,
        date::text AS date,
        CASE
          WHEN movement_type = 'income' THEN CONCAT('CSHIN-', LPAD(id::text, 4, '0'))
          ELSE CONCAT('EXP-', LPAD(id::text, 4, '0'))
        END AS ref,
        description AS party,
        amount,
        CASE WHEN movement_type = 'income' THEN 'credit' ELSE 'debit' END AS type,
        category,
        movement_type,
        created_at
      FROM expenses
      ORDER BY date DESC
    `),
    pool.query(`
      SELECT
        id,
        date::text AS date,
        CONCAT('CAP-', LPAD(id::text, 4, '0')) AS ref,
        source_name AS party,
        amount,
        CASE WHEN payment_method = 'goods_in_kind' THEN 'noncash' ELSE 'credit' END AS type,
        CASE WHEN payment_method = 'goods_in_kind' THEN 'Capital Injection (Goods)' ELSE 'External Capital' END AS category,
        created_at
      FROM capital_entries
      ORDER BY date DESC
    `),
    pool.query(`
      SELECT
        COALESCE(SUM(cost_usd * qty), 0)::numeric(10,2) AS total_inventory_cost
      FROM inventory
      WHERE product_type = 'owned'
    `),
    pool.query(`
      SELECT
        id,
        order_date::text AS date,
        po_number AS ref,
        COALESCE(supplier_name, 'Unknown Supplier') AS party,
        (
          SELECT COALESCE(SUM(unit_cost * qty), 0) FROM purchase_order_items WHERE purchase_order_id = purchase_orders.id
        ) + shipping_cost AS amount,
        'debit' AS type,
        'Purchase Order' AS category,
        created_at
      FROM purchase_orders
      WHERE status = 'received'
        AND po_type = 'regular'
        AND payment_method = 'cash'
      ORDER BY order_date DESC
    `),
    pool.query(`
      SELECT
        COALESCE(SUM(amount_usd - amount_paid_usd), 0)::numeric(10,2) AS total_open_payable,
        COALESCE(SUM(CASE WHEN invoice_item_id IS NOT NULL THEN amount_usd - amount_paid_usd ELSE 0 END), 0)::numeric(10,2) AS consignment_payable
      FROM accounts_payable
      WHERE status IN ('open', 'partially_paid')
    `),
    pool.query(`
      SELECT
        id,
        created_at::date::text AS date,
        CONCAT('AP-', LPAD(id::text, 4, '0')) AS ref,
        supplier_name AS party,
        amount_usd AS amount,
        'obligation' AS type,
        CASE WHEN invoice_item_id IS NOT NULL THEN 'Consignment Payable' ELSE 'Credit Purchase (AP)' END AS category,
        created_at
      FROM accounts_payable
      ORDER BY created_at DESC
    `),
    pool.query(`
      SELECT
        id,
        COALESCE(updated_at, created_at)::date::text AS date,
        CONCAT('APP-', LPAD(id::text, 4, '0')) AS ref,
        supplier_name AS party,
        amount_paid_usd AS amount,
        'debit' AS type,
        CASE
          WHEN invoice_item_id IS NOT NULL THEN 'Consignment Payable Settlement'
          ELSE 'Accounts Payable Settlement'
        END AS category,
        COALESCE(updated_at, created_at) AS created_at
      FROM accounts_payable
      WHERE amount_paid_usd > 0
      ORDER BY COALESCE(updated_at, created_at) DESC
    `),
  ]);

  const entries = [
    ...invoicesRes.rows.map((r) => ({ ...r, source: "invoice" })),
    ...customerReceiptsRes.rows.map((r) => ({ ...r, source: "customer_payment" })),
    ...cashboxMovementsRes.rows.map((r) => ({ ...r, source: "cashbox_movement" })),
    ...capitalEntriesRes.rows.map((r) => ({ ...r, source: "capital_entry" })),
    ...purchasesRes.rows.map((r) => ({ ...r, source: "purchase_order" })),
    ...apPaymentsRes.rows.map((r) => ({ ...r, source: "accounts_payable" })),
    ...apEntriesRes.rows.map((r) => ({ ...r, source: "accounts_payable" })),
  ].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    return dateDiff !== 0 ? dateDiff : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const invoicedSales = invoicesRes.rows.reduce(
    (sum: number, r: { amount: string }) => sum + parseFloat(r.amount),
    0,
  );
  const customerReceipts = customerReceiptsRes.rows.reduce(
    (sum: number, r: { amount: string }) => sum + parseFloat(r.amount),
    0,
  );
  const manualCashIn = cashboxMovementsRes.rows
    .filter((r: any) => r.movement_type === "income")
    .reduce((sum: number, r: { amount: string }) => sum + parseFloat(r.amount), 0);
  const externalCapital = capitalEntriesRes.rows
    .filter((r: any) => r.category !== "Capital Injection (Goods)")
    .reduce((sum: number, r: { amount: string }) => sum + parseFloat(r.amount), 0);
  const capitalInjectionGoods = capitalEntriesRes.rows
    .filter((r: any) => r.category === "Capital Injection (Goods)")
    .reduce((sum: number, r: { amount: string }) => sum + parseFloat(r.amount), 0);
  const expenseOutflow = cashboxMovementsRes.rows
    .filter((r: any) => r.movement_type !== "income")
    .reduce(
    (sum: number, r: { amount: string }) => sum + parseFloat(r.amount),
    0,
  );
  const purchaseOutflow = purchasesRes.rows.reduce(
    (sum: number, r: { amount: string }) => sum + parseFloat(r.amount),
    0,
  );
  const payableSettlementOutflow = apPaymentsRes.rows.reduce(
    (sum: number, r: { amount: string }) => sum + parseFloat(r.amount),
    0,
  );
  const totalCredits = customerReceipts + externalCapital + manualCashIn;
  const totalDebits = expenseOutflow + purchaseOutflow + payableSettlementOutflow;
  const inventoryValue = parseFloat(inventoryCostRes.rows[0]?.total_inventory_cost ?? "0");
  const cashboxBalance = totalCredits - totalDebits;
  const accountsPayable = parseFloat(accountsPayableRes.rows[0]?.total_open_payable ?? "0");
  const consignmentPayable = parseFloat(accountsPayableRes.rows[0]?.consignment_payable ?? "0");

  res.json({
    summary: {
      totalCredits: +totalCredits.toFixed(2),
      totalDebits: +totalDebits.toFixed(2),
      netBalance: +cashboxBalance.toFixed(2),
      inventoryValue: +inventoryValue.toFixed(2),
      accountsPayable: +accountsPayable.toFixed(2),
      consignmentPayable: +consignmentPayable.toFixed(2),
      cashbox: {
        totalIncoming: +totalCredits.toFixed(2),
        totalOutgoing: +totalDebits.toFixed(2),
        currentBalance: +cashboxBalance.toFixed(2),
        invoicedSales: +invoicedSales.toFixed(2),
        customerReceipts: +customerReceipts.toFixed(2),
        manualCashIn: +manualCashIn.toFixed(2),
        externalCapital: +externalCapital.toFixed(2),
        capitalInjectionGoods: +capitalInjectionGoods.toFixed(2),
        expenses: +expenseOutflow.toFixed(2),
        purchases: +purchaseOutflow.toFixed(2),
        payableSettlements: +payableSettlementOutflow.toFixed(2),
      },
    },
    entries,
  });
});
