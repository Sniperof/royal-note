import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middleware/auth";

export const neighborhoodsRouter = Router();

neighborhoodsRouter.use(requireAuth, requireAdmin);

const DEFAULT_NEIGHBORHOODS = [
  "Al Rahab", "Al Zahraa", "Al Nasr", "Al Salam", "Al Fath",
  "Al Hurriya", "Al Nahda", "Al Istiqlal", "Al Wahda", "Al Shuhada",
  "Al Rabie", "Al Amal", "Al Saada", "Al Hanaa", "Al Wurud",
  "Al Yasmin", "Al Firdous", "Al Janna", "Al Rayhan", "Al Uqhwan",
  "Al Basatin", "Al Hadaiq", "Al Ghadir", "Al Akhdar",
  "New City", "Old City", "City Center", "Al Dahiya",
  "East Suburb", "West Suburb", "North Suburb", "South Suburb",
  "Industrial Area", "Commercial District", "University District",
  "Hospital District", "Stadium District", "Station District",
  "Market District", "Other",
];

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS neighborhoods (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  const count = await pool.query(`SELECT COUNT(*) FROM neighborhoods`);
  if (parseInt(count.rows[0].count) === 0) {
    for (const name of DEFAULT_NEIGHBORHOODS) {
      await pool.query(`INSERT INTO neighborhoods (name) VALUES ($1) ON CONFLICT DO NOTHING`, [name]);
    }
  }
}

ensureTable().catch(console.error);

neighborhoodsRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT id, name FROM neighborhoods ORDER BY name ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

neighborhoodsRouter.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO neighborhoods (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *`,
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

neighborhoodsRouter.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await pool.query(`DELETE FROM neighborhoods WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
