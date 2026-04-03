import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { ensureCoreSchema } from "../lib/ensureCoreSchema";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

const FAVORITE_SELECT = `
  SELECT
    i.id,
    i.barcode,
    i.brand,
    i.name,
    i.description,
    i.main_category,
    i.sub_category,
    i.size,
    i.concentration,
    i.gender,
    i.qty,
    i.discount_percent,
    pi.object_path AS thumbnail_path,
    COALESCE(
      (
        SELECT array_agg(DISTINCT isrc.availability_location ORDER BY isrc.availability_location)
        FROM inventory_sources isrc
        WHERE isrc.inventory_id = i.id
      ),
      '{}'::text[]
    ) AS available_locations,
    CASE
      WHEN COALESCE(i.qty, 0) > 0 AND EXISTS (
        SELECT 1 FROM inventory_sources isrc WHERE isrc.inventory_id = i.id
      ) THEN 'stock_and_source'
      WHEN COALESCE(i.qty, 0) > 0 THEN 'stock_only'
      WHEN EXISTS (
        SELECT 1 FROM inventory_sources isrc WHERE isrc.inventory_id = i.id
      ) THEN 'source_only'
      ELSE 'unavailable'
    END AS availability_mode
  FROM favorites f
  JOIN inventory i ON i.id = f.inventory_id
  LEFT JOIN LATERAL (
    SELECT object_path
    FROM product_images
    WHERE inventory_id = i.id
    ORDER BY sort_order ASC, id ASC
    LIMIT 1
  ) pi ON true
  WHERE f.user_id = $1
`;

router.use(requireAuth);

router.get("/", async (req, res): Promise<void> => {
  await ensureCoreSchema();
  const result = await pool.query(
    `${FAVORITE_SELECT} ORDER BY f.created_at DESC, i.brand ASC, i.name ASC`,
    [req.session.userId],
  );
  res.json(result.rows);
  return;
});

router.get("/ids", async (req, res): Promise<void> => {
  await ensureCoreSchema();
  const result = await pool.query(
    `SELECT inventory_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.session.userId],
  );
  res.json(result.rows.map((row) => row.inventory_id));
  return;
});

router.post("/:inventoryId", async (req, res): Promise<void> => {
  await ensureCoreSchema();
  const inventoryId = Number.parseInt(req.params.inventoryId, 10);
  if (Number.isNaN(inventoryId)) {
    res.status(400).json({ error: "Invalid inventory id" });
    return;
  }

  const inventoryCheck = await pool.query(`SELECT id FROM inventory WHERE id = $1`, [inventoryId]);
  if (inventoryCheck.rows.length === 0) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  await pool.query(
    `INSERT INTO favorites (user_id, inventory_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, inventory_id) DO NOTHING`,
    [req.session.userId, inventoryId],
  );

  res.status(201).json({ ok: true, inventory_id: inventoryId });
  return;
});

router.delete("/:inventoryId", async (req, res): Promise<void> => {
  await ensureCoreSchema();
  const inventoryId = Number.parseInt(req.params.inventoryId, 10);
  if (Number.isNaN(inventoryId)) {
    res.status(400).json({ error: "Invalid inventory id" });
    return;
  }

  await pool.query(
    `DELETE FROM favorites
     WHERE user_id = $1 AND inventory_id = $2`,
    [req.session.userId, inventoryId],
  );

  res.json({ ok: true, inventory_id: inventoryId });
  return;
});

export default router;
