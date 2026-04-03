import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// GET /api/notifications — user's own notifications
router.get("/", requireAuth, async (req: any, res) => {
  const result = await pool.query(
    `SELECT n.*, q.ref_number
     FROM notifications n
     LEFT JOIN quotations q ON q.id = n.quotation_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT 50`,
    [req.session.userId]
  );
  res.json(result.rows);
});

// GET /api/notifications/unread-count
router.get("/unread-count", requireAuth, async (req: any, res) => {
  const result = await pool.query(
    "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE",
    [req.session.userId]
  );
  res.json({ count: result.rows[0].count });
});

// PUT /api/notifications/:id/read
router.put("/:id/read", requireAuth, async (req: any, res) => {
  await pool.query(
    "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2",
    [req.params.id, req.session.userId]
  );
  res.json({ success: true });
});

// PUT /api/notifications/read-all
router.put("/read-all", requireAuth, async (req: any, res) => {
  await pool.query(
    "UPDATE notifications SET is_read = TRUE WHERE user_id = $1",
    [req.session.userId]
  );
  res.json({ success: true });
});

export default router;
