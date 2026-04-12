import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../../");

dotenv.config({ path: path.join(repoRoot, ".env") });

const NODE_ENV = process.env.NODE_ENV;
const DATABASE_URL = process.env.DATABASE_URL;

if (NODE_ENV === "production") {
  console.error("ERROR: Refusing to clear data — NODE_ENV is 'production'.");
  console.error("This script is only allowed on development or staging environments.");
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set in .env");
  process.exit(1);
}

// Extra guard: reject any URL that contains a known production database name
const PROD_DB_MARKERS = ["prod", "production"];
const urlLower = DATABASE_URL.toLowerCase();
if (PROD_DB_MARKERS.some((marker) => urlLower.includes(marker))) {
  console.error(
    `ERROR: DATABASE_URL appears to point to a production database (contains "${PROD_DB_MARKERS.find((m) => urlLower.includes(m))}").`,
  );
  console.error("Refusing to proceed. Update .env to point to a staging/dev database.");
  process.exit(1);
}

console.log(`Environment : ${NODE_ENV}`);
console.log(`Database URL: ${DATABASE_URL.replace(/:\/\/[^@]+@/, "://<credentials>@")}`);
console.log("");
console.log("The following tables will be TRUNCATED and sequences reset:");
console.log("  1. inventory_traders");
console.log("  2. inventory");
console.log("  3. users");
console.log("");

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL });

async function clearDatabase() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Truncate in dependency order (children before parents), restart identity resets sequences
    await client.query(
      "TRUNCATE TABLE inventory_traders, inventory, users RESTART IDENTITY CASCADE",
    );

    await client.query("COMMIT");
    console.log("All tables cleared and sequences reset successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

clearDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to clear database:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
