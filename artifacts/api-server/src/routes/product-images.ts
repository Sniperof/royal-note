import { Router } from "express";
import { pool } from "@workspace/db";

export const productImagesRouter = Router({ mergeParams: true });

productImagesRouter.get("/", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const result = await pool.query(
    "SELECT * FROM product_images WHERE inventory_id = $1 ORDER BY sort_order ASC, created_at ASC",
    [id]
  );
  res.json(result.rows);
});

productImagesRouter.post("/", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { object_path, caption, sort_order } = req.body;
  if (!object_path) { res.status(400).json({ error: "object_path is required" }); return; }
  const countResult = await pool.query(
    "SELECT COUNT(*) FROM product_images WHERE inventory_id = $1",
    [id]
  );
  const nextOrder = sort_order ?? parseInt(countResult.rows[0].count);
  const result = await pool.query(
    "INSERT INTO product_images (inventory_id, object_path, caption, sort_order) VALUES ($1, $2, $3, $4) RETURNING *",
    [id, object_path, caption ?? null, nextOrder]
  );
  res.status(201).json(result.rows[0]);
});

productImagesRouter.delete("/:imageId", async (req, res) => {
  const id = parseInt(req.params.id);
  const imageId = parseInt(req.params.imageId);
  if (isNaN(id) || isNaN(imageId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const result = await pool.query(
    "DELETE FROM product_images WHERE id = $1 AND inventory_id = $2 RETURNING id",
    [imageId, id]
  );
  if (result.rows.length === 0) { res.status(404).json({ error: "Image not found" }); return; }
  res.json({ success: true });
});
