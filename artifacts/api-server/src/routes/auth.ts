import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.username, username.trim().toLowerCase()),
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  req.session.userId = user.id;
  req.session.role = user.role;

  return res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    email: user.email,
    phone: user.phone,
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, req.session.userId),
  });

  if (!user || !user.isActive) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    email: user.email,
    phone: user.phone,
  });
});

export default router;
