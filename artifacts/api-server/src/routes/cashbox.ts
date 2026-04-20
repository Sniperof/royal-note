import { Router } from "express";
import { pool } from "@workspace/db";
import { activityActorFromSession, insertActivityLog } from "../lib/activityLog";

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
  client,
  movementType,
  date,
  amount,
  description,
  notes,
  paymentMethod,
}: {
  client: { query: typeof pool.query };
  movementType: MovementType;
  date: string;
  amount: number;
  description: string;
  notes: string | null;
  paymentMethod: string;
}) {
  const category = movementType === "income" ? "Manual Cash In" : "Manual Cash Out";
  const result = await client.query(
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

  return res.json(result.rows);
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

  const client = await pool.connect();
  const actor = activityActorFromSession(req.session);
  try {
    await client.query("BEGIN");
    const row = await insertCashboxMovement({
      client,
      movementType: "income",
      date: normalizeDate(date),
      amount: parsedAmount,
      description,
      notes: notes ?? null,
      paymentMethod: payment_method ?? "Cash",
    });
    await insertActivityLog(client, {
      ...actor,
      actionType: "cashbox_movement_created",
      entityType: "cashbox_movement",
      entityId: row.id,
      summary: `Created manual cash in of ${parsedAmount.toFixed(2)}`,
      metadata: {
        movement_type: "income",
        amount: parsedAmount.toFixed(2),
        date: row.date,
        description: row.description,
        payment_method: row.payment_method,
      },
    });
    await client.query("COMMIT");
    return res.status(201).json(row);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
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

  const client = await pool.connect();
  const actor = activityActorFromSession(req.session);
  try {
    await client.query("BEGIN");
    const result = await client.query(
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
    await insertActivityLog(client, {
      ...actor,
      actionType: "cashbox_movement_created",
      entityType: "cashbox_movement",
      entityId: result.rows[0].id,
      summary: `Created manual cash out of ${parsedAmount.toFixed(2)}`,
      metadata: {
        movement_type: "expense",
        amount: parsedAmount.toFixed(2),
        date: result.rows[0].date,
        category: result.rows[0].category,
        description: result.rows[0].description,
        payment_method: result.rows[0].payment_method,
      },
    });
    await client.query("COMMIT");
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
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

  const client = await pool.connect();
  const actor = activityActorFromSession(req.session);
  try {
    await client.query("BEGIN");
    const movementRes = await client.query(`SELECT * FROM expenses WHERE id = $1 FOR UPDATE`, [id]);
    if (movementRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }

    const existing = movementRes.rows[0];
    const movementType = existing.movement_type === "income" ? "income" : "expense";
    const nextAmount = amount === undefined ? Number(existing.amount) : Number(amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "amount must be greater than 0" });
    }

    const nextCategory =
      movementType === "income"
        ? "Manual Cash In"
        : category?.trim() ? category.trim() : existing.category;
    const result = await client.query(
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
    await insertActivityLog(client, {
      ...actor,
      actionType: "cashbox_movement_updated",
      entityType: "cashbox_movement",
      entityId: id,
      summary: `Updated ${movementType} cashbox movement #${id}`,
      metadata: {
        movement_type: movementType,
        before: {
          date: existing.date,
          category: existing.category,
          description: existing.description,
          amount: existing.amount,
          payment_method: existing.payment_method,
          notes: existing.notes,
        },
        after: {
          date: result.rows[0].date,
          category: result.rows[0].category,
          description: result.rows[0].description,
          amount: result.rows[0].amount,
          payment_method: result.rows[0].payment_method,
          notes: result.rows[0].notes,
        },
      },
    });
    await client.query("COMMIT");
    return res.json(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

cashboxRouter.delete("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const client = await pool.connect();
  const actor = activityActorFromSession(req.session);
  try {
    await client.query("BEGIN");
    const existing = await client.query(`SELECT * FROM expenses WHERE id = $1 FOR UPDATE`, [id]);
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }

    await client.query(`DELETE FROM expenses WHERE id = $1`, [id]);
    await insertActivityLog(client, {
      ...actor,
      actionType: "cashbox_movement_deleted",
      entityType: "cashbox_movement",
      entityId: id,
      summary: `Deleted ${existing.rows[0].movement_type} cashbox movement #${id}`,
      metadata: {
        movement_type: existing.rows[0].movement_type,
        date: existing.rows[0].date,
        category: existing.rows[0].category,
        description: existing.rows[0].description,
        amount: existing.rows[0].amount,
        payment_method: existing.rows[0].payment_method,
        notes: existing.rows[0].notes,
      },
    });
    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});
