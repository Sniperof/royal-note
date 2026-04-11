import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      role: usersTable.role,
      email: usersTable.email,
      phone: usersTable.phone,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);

  res.json(users);
});

router.post("/", async (req, res) => {
  const { username, password, fullName, role, email, phone } = req.body as {
    username?: string;
    password?: string;
    fullName?: string;
    role?: string;
    email?: string;
    phone?: string;
  };

  if (!username || !password || !fullName) {
    return res.status(400).json({ error: "username, password and fullName are required" });
  }

  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.username, username.trim().toLowerCase()),
  });
  if (existing) {
    return res.status(409).json({ error: "Username already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({
      username: username.trim().toLowerCase(),
      passwordHash,
      fullName: fullName.trim(),
      role: (role as "super_admin" | "wholesale_trader" | "sales_representative") ?? "wholesale_trader",
      email: email?.trim() || null,
      phone: phone?.trim() || null,
    })
    .returning({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      role: usersTable.role,
      email: usersTable.email,
      phone: usersTable.phone,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    });

  return res.status(201).json(user);
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { fullName, role, email, phone, isActive, password } = req.body as {
    fullName?: string;
    role?: string;
    email?: string;
    phone?: string;
    isActive?: boolean;
    password?: string;
  };

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (fullName !== undefined) updates.fullName = fullName.trim();
  if (role !== undefined) updates.role = role as "super_admin" | "wholesale_trader" | "sales_representative";
  if (email !== undefined) updates.email = email?.trim() || null;
  if (phone !== undefined) updates.phone = phone?.trim() || null;
  if (isActive !== undefined) updates.isActive = isActive;
  if (password) updates.passwordHash = await bcrypt.hash(password, 12);
  updates.updatedAt = new Date();

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      role: usersTable.role,
      email: usersTable.email,
      phone: usersTable.phone,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    });

  if (!updated) return res.status(404).json({ error: "User not found" });
  return res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  if (req.session.userId === id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  const [deleted] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id });

  if (!deleted) return res.status(404).json({ error: "User not found" });
  return res.json({ ok: true });
});

export default router;
