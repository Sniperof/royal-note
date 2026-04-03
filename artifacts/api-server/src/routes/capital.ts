import { Router } from "express";
import { pool } from "@workspace/db";

export const capitalRouter = Router();

capitalRouter.get("/", async (_req, res): Promise<void> => {
  const result = await pool.query(
    `SELECT * FROM capital_entries ORDER BY date DESC, created_at DESC`,
  );
  res.json(result.rows);
});

capitalRouter.post("/", async (req, res): Promise<void> => {
  const { date, source_name, description, amount, payment_method, notes } = req.body as {
    date?: string;
    source_name?: string;
    description?: string;
    amount?: number;
    payment_method?: string;
    notes?: string;
  };

  if (!source_name || !description || amount === undefined) {
    res.status(400).json({ error: "source_name, description and amount are required" });
    return;
  }

  const result = await pool.query(
    `INSERT INTO capital_entries (date, source_name, description, amount, payment_method, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      date ?? new Date().toISOString().slice(0, 10),
      source_name,
      description,
      amount,
      payment_method ?? "Cash",
      notes ?? null,
    ],
  );
  res.status(201).json(result.rows[0]);
});

capitalRouter.put("/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { date, source_name, description, amount, payment_method, notes } = req.body as {
    date?: string;
    source_name?: string;
    description?: string;
    amount?: number;
    payment_method?: string;
    notes?: string;
  };

  const result = await pool.query(
    `UPDATE capital_entries SET
       date = COALESCE($1, date),
       source_name = COALESCE($2, source_name),
       description = COALESCE($3, description),
       amount = COALESCE($4, amount),
       payment_method = COALESCE($5, payment_method),
       notes = COALESCE($6, notes)
     WHERE id = $7
     RETURNING *`,
    [date, source_name, description, amount, payment_method, notes, id],
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(result.rows[0]);
});

capitalRouter.delete("/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const result = await pool.query(`DELETE FROM capital_entries WHERE id = $1 RETURNING id`, [id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});
