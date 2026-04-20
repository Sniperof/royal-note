import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { ensureCoreSchema } from "../lib/ensureCoreSchema";
import { normalize } from "../lib/masterData";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.get("/", requireAuth, async (_req, res): Promise<void> => {
  await ensureCoreSchema();
  const result = await pool.query(`
    SELECT id, name, is_active, created_at, updated_at
    FROM sizes
    ORDER BY name ASC
  `);
  res.json(result.rows);
});

router.post("/", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  await ensureCoreSchema();
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: "Size name is required" });
    return;
  }
  try {
    const normalizedName = normalize(name);
    const duplicate = await pool.query(
      `SELECT id FROM sizes WHERE normalized_name = $1 LIMIT 1`,
      [normalizedName],
    );
    if (duplicate.rows.length > 0) {
      res.status(409).json({ error: "Size already exists" });
      return;
    }
    const result = await pool.query(
      `INSERT INTO sizes (name, normalized_name, updated_at)
       VALUES ($1, $2, NOW())
       RETURNING id, name, is_active, created_at, updated_at`,
      [name.trim(), normalizedName],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "Size already exists" });
      return;
    }
    throw error;
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  await ensureCoreSchema();
  const id = Number.parseInt(req.params.id, 10);
  const { name, is_active } = req.body as { name?: string; is_active?: boolean };
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid size id" });
    return;
  }
  if (!name?.trim()) {
    res.status(400).json({ error: "Size name is required" });
    return;
  }
  try {
    const normalizedName = normalize(name);
    const duplicate = await pool.query(
      `SELECT id FROM sizes WHERE normalized_name = $1 AND id <> $2 LIMIT 1`,
      [normalizedName, id],
    );
    if (duplicate.rows.length > 0) {
      res.status(409).json({ error: "Size already exists" });
      return;
    }
    const result = await pool.query(
      `UPDATE sizes
       SET name = $1, normalized_name = $2, is_active = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, is_active, created_at, updated_at`,
      [name.trim(), normalizedName, is_active ?? true, id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Size not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "Size already exists" });
      return;
    }
    throw error;
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  await ensureCoreSchema();
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid size id" });
    return;
  }
  const result = await pool.query(`DELETE FROM sizes WHERE id = $1 RETURNING id`, [id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Size not found" });
    return;
  }
  res.json({ ok: true, id });
});

export default router;
