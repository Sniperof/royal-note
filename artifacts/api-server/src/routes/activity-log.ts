import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middleware/auth";

export const activityLogRouter = Router();

activityLogRouter.use(requireAuth, requireAdmin);

activityLogRouter.get("/", async (req, res) => {
  const requestedLimit = Number.parseInt(String(req.query.limit ?? "200"), 10);
  const limit = Number.isNaN(requestedLimit) ? 200 : Math.max(1, Math.min(requestedLimit, 500));

  try {
    const result = await pool.query(
      `
        SELECT
          al.*,
          u.full_name AS actor_full_name,
          u.username AS actor_username
        FROM activity_log al
        LEFT JOIN users u ON u.id = al.actor_user_id
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT $1
      `,
      [limit],
    );

    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
