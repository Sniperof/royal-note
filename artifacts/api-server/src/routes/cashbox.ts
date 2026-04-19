import { Router } from "express";
import { pool } from "@workspace/db";

export const cashboxRouter = Router();

type MovementType = "income" | "expense";

function isValidMovementType(value: unknown): value is MovementType {
  return value === "income" || value === "expense";
}

function normalizeDate(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return new Date().toISOString().slice(0, 10);
}

async function insertCashboxMovement({
  movementType,
  date,
  amount,
  description,
  notes,
  paymentMethod,
}: {
  movementType: MovementType;
  date: string;
  amount: number;
  description: string;
  notes: string | null;
  paymentMethod: string;
}) {
  const category = movementType === "income" ? "Manual Cash In" : "Manual Cash Out";
  const result = await pool.query(
    `
      INSERT INTO expenses (date, movement_type, category, description, amount, payment_method, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [date, movementType, category, description, amount, paymentMethod, notes],
  );
  return result.rows[0];
}

cashboxRouter.get("/", async (req, res) => {
  const requestedType = req.query.type;
  const movementType =
    typeof requestedType === "string" && isValidMovementType(requestedType) ? requestedType : null;

  const params: unknown[] = [];
  const whereClause = movementType ? "WHERE movement_type = $1" : "";
  if (movementType) params.push(movementType);

  const result = await pool.query(
    `
      SELECT *
      FROM expenses
      ${whereClause}
      ORDER BY date DESC, created_at DESC
    `,
    params,
  );

  res.json(result.rows);
});

cashboxRouter.post("/in", async (req, res) => {
  const { date, amount, description, notes, payment_method } = req.body as {
    date?: string;
    amount?: number;
    description?: string;
    notes?: string;
    payment_method?: string;
  };

  if (!description || amount === undefined) {
    return res.status(400).json({ error: "description and amount are required" });
  }

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "amount must be greater than 0" });
  }

  const row = await insertCashboxMovement({
    movementType: "income",
    date: normalizeDate(date),
    amount: parsedAmount,
    description,
    notes: notes ?? null,
    paymentMethod: payment_method ?? "Cash",
  });

  res.status(201).json(row);
});

cashboxRouter.post("/out", async (req, res) => {
  const { date, amount, description, notes, payment_method, category } = req.body as {
    date?: string;
    amount?: number;
    description?: string;
    notes?: string;
    payment_method?: string;
    category?: string;
  };

  if (!description || amount === undefined) {
    return res.status(400).json({ error: "description and amount are required" });
  }

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "amount must be greater than 0" });
  }

  const result = await pool.query(
    `
      INSERT INTO expenses (date, movement_type, category, description, amount, payment_method, notes)
      VALUES ($1, 'expense', $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      normalizeDate(date),
      category?.trim() ? category.trim() : "Manual Cash Out",
      description,
      parsedAmount,
      payment_method ?? "Cash",
      notes ?? null,
    ],
  );

  res.status(201).json(result.rows[0]);
});

cashboxRouter.put("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const { date, amount, description, notes, payment_method, category } = req.body as {
    date?: string;
    amount?: number;
    description?: string;
    notes?: string;
    payment_method?: string;
    category?: string;
  };

  const movementRes = await pool.query(`SELECT * FROM expenses WHERE id = $1`, [id]);
  if (movementRes.rows.length === 0) {
    return res.status(404).json({ error: "Not found" });
  }

  const existing = movementRes.rows[0];
  const movementType = existing.movement_type === "income" ? "income" : "expense";
  const nextAmount = amount === undefined ? existing.amount : Number(amount);
  if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
    return res.status(400).json({ error: "amount must be greater than 0" });
  }

  const nextCategory =
    movementType === "income"
      ? "Manual Cash In"
      : category?.trim() ? category.trim() : existing.category;

  const result = await pool.query(
    `
      UPDATE expenses
      SET
        date = COALESCE($1, date),
        category = $2,
        description = COALESCE($3, description),
        amount = $4,
        payment_method = COALESCE($5, payment_method),
        notes = $6
      WHERE id = $7
      RETURNING *
    `,
    [
      date ?? null,
      nextCategory,
      description ?? null,
      nextAmount,
      payment_method ?? null,
      notes ?? existing.notes ?? null,
      id,
    ],
  );

  res.json(result.rows[0]);
});

cashboxRouter.delete("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const result = await pool.query(`DELETE FROM expenses WHERE id = $1 RETURNING id`, [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json({ ok: true });
});
