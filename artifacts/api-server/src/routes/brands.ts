import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { ensureCoreSchema } from "../lib/ensureCoreSchema";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.get("/", requireAuth, async (_req, res): Promise<void> => {
  await ensureCoreSchema();
  const result = await pool.query(`
    SELECT id, name, image_path, created_at, updated_at
    FROM brands
    ORDER BY name ASC
  `);
  res.json(result.rows);
});

router.post("/", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  await ensureCoreSchema();
  const { name, image_path } = req.body as { name?: string; image_path?: string | null };
  if (!name?.trim()) {
    res.status(400).json({ error: "Brand name is required" });
    return;
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO brands (name, image_path, updated_at)
      VALUES ($1, $2, NOW())
      RETURNING id, name, image_path, created_at, updated_at
      `,
      [name.trim(), image_path?.trim() || null],
    );
    res.status(201).json(result.rows[0]);
    return;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "Brand already exists" });
      return;
    }
    throw error;
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  await ensureCoreSchema();
  const id = Number.parseInt(req.params.id, 10);
  const { name, image_path } = req.body as { name?: string; image_path?: string | null };

  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid brand id" });
    return;
  }
  if (!name?.trim()) {
    res.status(400).json({ error: "Brand name is required" });
    return;
  }

  try {
    const result = await pool.query(
      `
      UPDATE brands
      SET name = $1, image_path = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, name, image_path, created_at, updated_at
      `,
      [name.trim(), image_path?.trim() || null, id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }
    res.json(result.rows[0]);
    return;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "Brand already exists" });
      return;
    }
    throw error;
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  await ensureCoreSchema();
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid brand id" });
    return;
  }

  const result = await pool.query(`DELETE FROM brands WHERE id = $1 RETURNING id`, [id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }

  res.json({ ok: true, id });
});

export default router;
