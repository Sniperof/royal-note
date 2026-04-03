import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";

async function seedAdmin() {
  const hash = await bcrypt.hash("admin123", 12);
  const result = await db
    .insert(usersTable)
    .values({
      username: "admin",
      passwordHash: hash,
      role: "super_admin",
      fullName: "Super Admin",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning({ id: usersTable.id, username: usersTable.username });

  if (result.length > 0) {
    console.log("✅ Seeded admin user: admin / admin123");
  } else {
    console.log("ℹ️  Admin user already exists");
  }
  process.exit(0);
}

seedAdmin().catch((e) => { console.error(e); process.exit(1); });
