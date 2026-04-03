import { Router } from "express";
import { pool } from "@workspace/db";

export const expensesRouter = Router();

expensesRouter.get("/", async (_req, res) => {
  const result = await pool.query(
    `SELECT * FROM expenses ORDER BY date DESC, created_at DESC`
  );
  res.json(result.rows);
});

expensesRouter.post("/", async (req, res) => {
  const { date, category, description, amount, payment_method, notes } = req.body as {
    date?: string;
    category?: string;
    description?: string;
    amount?: number;
    payment_method?: string;
    notes?: string;
  };

  if (!category || !description || amount === undefined) {
    return res.status(400).json({ error: "category, description and amount are required" });
  }

  const result = await pool.query(
    `INSERT INTO expenses (date, category, description, amount, payment_method, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [date ?? new Date().toISOString().slice(0, 10), category, description, amount, payment_method ?? "Cash", notes ?? null]
  );
  res.status(201).json(result.rows[0]);
});

expensesRouter.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { date, category, description, amount, payment_method, notes } = req.body as {
    date?: string;
    category?: string;
    description?: string;
    amount?: number;
    payment_method?: string;
    notes?: string;
  };

  const result = await pool.query(
    `UPDATE expenses SET
       date = COALESCE($1, date),
       category = COALESCE($2, category),
       description = COALESCE($3, description),
       amount = COALESCE($4, amount),
       payment_method = COALESCE($5, payment_method),
       notes = COALESCE($6, notes)
     WHERE id = $7
     RETURNING *`,
    [date, category, description, amount, payment_method, notes, id]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(result.rows[0]);
});

expensesRouter.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const result = await pool.query(`DELETE FROM expenses WHERE id = $1 RETURNING id`, [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});
