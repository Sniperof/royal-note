/**
 * fix-product-image-paths.ts
 *
 * Production-safe diagnostic + migration for product_images.object_path.
 *
 * BACKGROUND
 * ----------
 * Before commit 930f093, normalizeObjectEntityPath() only handled URLs that
 * started with "https://storage.googleapis.com/…".  Any URL using the
 * subdomain style ("https://<bucket>.storage.googleapis.com/…") was returned
 * unchanged and saved verbatim into product_images.object_path.
 *
 * At run-time resolveStorageUrl() (frontend) sees an https:// value and
 * returns it as-is, so the browser makes a direct request to GCS.  That
 * fails because:
 *   a) Signed URLs are short-lived (15 min) — they are always expired by
 *      the time someone looks at the product page later.
 *   b) The underlying object may be private, so unsigned GCS access is 403.
 *
 * The server's GET /storage/objects/* endpoint (objectStorage.ts line 131)
 * only accepts paths starting with "/objects/"; it also performs ACL checks
 * and proxies the bytes securely.  That is the canonical path the DB should
 * store.
 *
 * WHAT THIS SCRIPT DOES
 * ---------------------
 * 1. Prints a diagnostic report — no writes.
 * 2. Asks for explicit confirmation before making any changes.
 * 3. Backs up the affected rows to product_images_path_backup before touching them.
 * 4. Normalises broken object_path values in three categories:
 *      A) https://<bucket>.storage.googleapis.com/<rest>?…  →  /objects/<rest>
 *      B) https://storage.googleapis.com/<bucket>/<rest>?…  →  /objects/<rest>
 *      C) /<bucket>/<rest>  (bare GCS path, no https)        →  /objects/<rest>
 *         (only when the leading segment matches PRIVATE_OBJECT_DIR bucket)
 * 5. Prints a post-migration verification report.
 *
 * USAGE
 * -----
 *   # Dry-run (default — safe to run anywhere):
 *   pnpm --filter @workspace/scripts tsx src/fix-product-image-paths.ts
 *
 *   # Apply fixes:
 *   pnpm --filter @workspace/scripts tsx src/fix-product-image-paths.ts --fix
 *
 * The script reads DATABASE_URL and PRIVATE_OBJECT_DIR from .env at the
 * repo root.  PRIVATE_OBJECT_DIR must be set (e.g. "/my-bucket").
 *
 * ROLLBACK
 * --------
 *   UPDATE product_images pi
 *   SET    object_path = b.object_path
 *   FROM   product_images_path_backup b
 *   WHERE  pi.id = b.image_id;
 *
 *   DROP TABLE product_images_path_backup;
 */

import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import pg from "pg";
import * as readline from "readline";

// ── Bootstrap ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../../");
dotenv.config({ path: path.join(repoRoot, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
const PRIVATE_OBJECT_DIR = (process.env.PRIVATE_OBJECT_DIR ?? "").trim();
const DRY_RUN = !process.argv.includes("--fix");

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}
if (!PRIVATE_OBJECT_DIR) {
  console.error(
    "ERROR: PRIVATE_OBJECT_DIR is not set in .env.\n" +
      "       It should be the GCS path prefix used for private objects,\n" +
      '       e.g. PRIVATE_OBJECT_DIR="/my-bucket" or "/my-bucket/objects"'
  );
  process.exit(1);
}

// Normalise so it always starts with "/" and has no trailing "/"
const objectDir = PRIVATE_OBJECT_DIR.startsWith("/")
  ? PRIVATE_OBJECT_DIR
  : `/${PRIVATE_OBJECT_DIR}`;
// Extract just the first path segment → the GCS bucket name
const bucketName = objectDir.split("/").filter(Boolean)[0];

if (!bucketName) {
  console.error(
    `ERROR: Could not extract a bucket name from PRIVATE_OBJECT_DIR="${PRIVATE_OBJECT_DIR}"`
  );
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL });

// ── Helpers ──────────────────────────────────────────────────────────────────

function separator(title?: string) {
  const bar = "─".repeat(60);
  console.log(title ? `\n${bar}\n  ${title}\n${bar}` : bar);
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ── Step 1 — Diagnostic ──────────────────────────────────────────────────────

async function runDiagnostic(client: pg.PoolClient) {
  separator("DIAGNOSTIC REPORT  —  product_images.object_path");

  console.log(`\nPrivate bucket name   : ${bucketName}`);
  console.log(`PRIVATE_OBJECT_DIR    : ${PRIVATE_OBJECT_DIR}`);
  console.log(`Mode                  : ${DRY_RUN ? "DRY-RUN (no writes)" : "LIVE FIX"}\n`);

  // ── Format distribution ─────────────────────────────────────────────────

  const distributionSQL = `
    SELECT
      format_label,
      COUNT(*)            AS count,
      MIN(created_at)     AS oldest,
      MAX(created_at)     AS newest
    FROM (
      SELECT
        created_at,
        CASE
          WHEN object_path LIKE '/objects/%'
            THEN '✅  canonical  (/objects/…)'
          WHEN object_path LIKE '/local-uploads/%'
            THEN '✅  local-upload  (/local-uploads/…)'
          WHEN object_path LIKE '/public-objects/%'
            THEN '✅  public-objects  (/public-objects/…)'
          WHEN object_path ~ $1
            THEN '❌  gcs-subdomain  (https://<bucket>.storage.googleapis.com/…)'
          WHEN object_path LIKE 'https://storage.googleapis.com/%'
            THEN '❌  gcs-standard  (https://storage.googleapis.com/…)'
          WHEN object_path LIKE 'https://%'
            THEN '⚠️  other-https  (unknown https URL)'
          WHEN object_path LIKE ('/' || $2 || '/%')
            THEN '❌  bare-gcs-path  (/<bucket>/…)'
          WHEN object_path LIKE '/%'
            THEN '⚠️  bare-path  (unknown /… path)'
          WHEN object_path IS NULL OR object_path = ''
            THEN '🔴  null-or-empty'
          ELSE '⚠️  unrecognised'
        END AS format_label
      FROM product_images
    ) t
    GROUP BY format_label
    ORDER BY count DESC
  `;

  const dist = await client.query(distributionSQL, [
    `^https?://[^/]+\\.storage\\.googleapis\\.com/`,
    bucketName,
  ]);

  console.log("Format distribution:");
  console.log(
    "  " +
      ["Format", "Count", "Oldest", "Newest"]
        .map((h, i) => h.padEnd([55, 8, 24, 24][i]))
        .join("")
  );
  console.log("  " + "-".repeat(111));
  for (const row of dist.rows) {
    const oldest = row.oldest ? new Date(row.oldest).toISOString().slice(0, 10) : "-";
    const newest = row.newest ? new Date(row.newest).toISOString().slice(0, 10) : "-";
    console.log(
      "  " +
        [row.format_label, row.count, oldest, newest]
          .map((v, i) => String(v).padEnd([55, 8, 24, 24][i]))
          .join("")
    );
  }

  // ── Total ───────────────────────────────────────────────────────────────

  const totalResult = await client.query(
    "SELECT COUNT(*) AS total FROM product_images"
  );
  const total = parseInt(totalResult.rows[0].total, 10);
  console.log(`\nTotal rows in product_images: ${total}`);

  // ── Examples of broken formats ──────────────────────────────────────────

  separator("EXAMPLES — GCS subdomain URLs (Category A — main culprit)");
  const subdomainRows = await client.query(
    `SELECT id, inventory_id, object_path, created_at
     FROM   product_images
     WHERE  object_path ~ $1
     ORDER  BY created_at DESC
     LIMIT  5`,
    [`^https?://[^/]+\\.storage\\.googleapis\\.com/`]
  );
  if (subdomainRows.rows.length === 0) {
    console.log("  (none found)");
  } else {
    for (const r of subdomainRows.rows) {
      console.log(`  id=${r.id}  inv=${r.inventory_id}  path=${r.object_path}`);
      console.log(`    → proposed fix: /objects/${extractSubdomainPath(r.object_path)}`);
    }
  }

  separator("EXAMPLES — GCS standard URLs (Category B)");
  const standardRows = await client.query(
    `SELECT id, inventory_id, object_path, created_at
     FROM   product_images
     WHERE  object_path LIKE 'https://storage.googleapis.com/%'
     ORDER  BY created_at DESC
     LIMIT  5`
  );
  if (standardRows.rows.length === 0) {
    console.log("  (none found)");
  } else {
    for (const r of standardRows.rows) {
      const fixed = extractStandardPath(r.object_path, bucketName);
      console.log(`  id=${r.id}  inv=${r.inventory_id}  path=${r.object_path}`);
      console.log(`    → proposed fix: ${fixed}`);
    }
  }

  separator("EXAMPLES — Bare GCS paths  /<bucket>/…  (Category C)");
  const bareRows = await client.query(
    `SELECT id, inventory_id, object_path, created_at
     FROM   product_images
     WHERE  object_path LIKE ($1 || '/%')
     ORDER  BY created_at DESC
     LIMIT  5`,
    [`/${bucketName}`]
  );
  if (bareRows.rows.length === 0) {
    console.log("  (none found)");
  } else {
    for (const r of bareRows.rows) {
      const fixed = extractBarePath(r.object_path, bucketName);
      console.log(`  id=${r.id}  inv=${r.inventory_id}  path=${r.object_path}`);
      console.log(`    → proposed fix: ${fixed}`);
    }
  }

  separator("EXAMPLES — Unknown / other bare paths");
  const unknownRows = await client.query(
    `SELECT id, inventory_id, object_path, created_at
     FROM   product_images
     WHERE  object_path NOT LIKE '/objects/%'
       AND  object_path NOT LIKE '/local-uploads/%'
       AND  object_path NOT LIKE '/public-objects/%'
       AND  object_path NOT LIKE 'https://storage.googleapis.com/%'
       AND  object_path NOT LIKE ($1 || '/%')
       AND  object_path NOT ~ $2
       AND  (object_path IS NOT NULL AND object_path <> '')
     ORDER  BY created_at DESC
     LIMIT  10`,
    [`/${bucketName}`, `^https?://[^/]+\\.storage\\.googleapis\\.com/`]
  );
  if (unknownRows.rows.length === 0) {
    console.log("  (none found — good)");
  } else {
    for (const r of unknownRows.rows) {
      console.log(`  id=${r.id}  inv=${r.inventory_id}  path=${r.object_path}`);
    }
    console.log("\n  ⚠️  These rows are NOT automatically fixed — manual review required.");
  }

  return {
    subdomainCount: subdomainRows.rowCount ?? 0,
    standardCount: standardRows.rowCount ?? 0,
    bareCount: bareRows.rowCount ?? 0,
    total,
  };
}

// ── Path extraction helpers (mirrors server-side logic) ──────────────────────

function extractSubdomainPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, ""); // strip leading /
  } catch {
    return url;
  }
}

function extractStandardPath(url: string, bucket: string): string {
  try {
    const u = new URL(url);
    const pathname = u.pathname; // /bucket/rest/of/path
    const prefix = `/${bucket}/`;
    if (pathname.startsWith(prefix)) {
      return `/objects/${pathname.slice(prefix.length)}`;
    }
    // Bucket name not at start — don't touch
    return url;
  } catch {
    return url;
  }
}

function extractBarePath(rawPath: string, bucket: string): string {
  const prefix = `/${bucket}/`;
  if (rawPath.startsWith(prefix)) {
    return `/objects/${rawPath.slice(prefix.length)}`;
  }
  return rawPath;
}

// ── Step 2 — Migration ───────────────────────────────────────────────────────

async function runMigration(client: pg.PoolClient) {
  separator("MIGRATION");

  // ── 2a: Create backup table ─────────────────────────────────────────────

  console.log("\nCreating backup table product_images_path_backup …");
  await client.query(`
    CREATE TABLE IF NOT EXISTS product_images_path_backup (
      image_id     integer PRIMARY KEY,
      inventory_id integer,
      object_path  text,
      backed_up_at timestamp DEFAULT now()
    )
  `);

  // Insert only rows we are about to change (idempotent: ON CONFLICT DO NOTHING)
  const backupResult = await client.query(
    `
    INSERT INTO product_images_path_backup (image_id, inventory_id, object_path)
    SELECT id, inventory_id, object_path
    FROM   product_images
    WHERE  object_path ~ $1
       OR  object_path LIKE 'https://storage.googleapis.com/%'
       OR  object_path LIKE ($2 || '/%')
    ON CONFLICT (image_id) DO NOTHING
    RETURNING image_id
    `,
    [`^https?://[^/]+\\.storage\\.googleapis\\.com/`, `/${bucketName}`]
  );
  console.log(`  Backed up ${backupResult.rowCount} row(s).`);

  // ── 2b: Category A — GCS subdomain URLs ────────────────────────────────

  console.log("\nCategory A — https://<bucket>.storage.googleapis.com/PATH → /objects/PATH");
  const updateA = await client.query(
    `
    UPDATE product_images
    SET    object_path =
             '/objects/' ||
             ltrim(
               regexp_replace(object_path, '^https?://[^/]+\\.storage\\.googleapis\\.com(/[^?#]*)(\\?.*)?$', '\\1'),
               '/'
             )
    WHERE  object_path ~ $1
    RETURNING id, object_path AS new_path
    `,
    [`^https?://[^/]+\\.storage\\.googleapis\\.com/`]
  );
  console.log(`  Updated ${updateA.rowCount} row(s).`);
  for (const r of updateA.rows.slice(0, 5)) {
    console.log(`    id=${r.id}  →  ${r.new_path}`);
  }
  if ((updateA.rowCount ?? 0) > 5) {
    console.log(`    … and ${(updateA.rowCount ?? 0) - 5} more`);
  }

  // ── 2c: Category B — GCS standard URLs ─────────────────────────────────

  console.log(
    `\nCategory B — https://storage.googleapis.com/${bucketName}/PATH → /objects/PATH`
  );
  const updateB = await client.query(
    `
    UPDATE product_images
    SET    object_path =
             '/objects/' ||
             substr(
               regexp_replace(object_path, '^https://storage\\.googleapis\\.com/[^/?#]+(/[^?#]*)(\\?.*)?$', '\\1'),
               2   -- strip leading /
             )
    WHERE  object_path LIKE $1
    RETURNING id, object_path AS new_path
    `,
    [`https://storage.googleapis.com/${bucketName}/%`]
  );
  console.log(`  Updated ${updateB.rowCount} row(s).`);
  for (const r of updateB.rows.slice(0, 5)) {
    console.log(`    id=${r.id}  →  ${r.new_path}`);
  }

  // Handle other-bucket standard URLs (treat as unrecognised — log only)
  const otherStandardResult = await client.query(
    `SELECT id, object_path FROM product_images
     WHERE  object_path LIKE 'https://storage.googleapis.com/%'
       AND  object_path NOT LIKE $1`,
    [`https://storage.googleapis.com/${bucketName}/%`]
  );
  if ((otherStandardResult.rowCount ?? 0) > 0) {
    console.log(
      `\n  ⚠️  ${otherStandardResult.rowCount} GCS standard URL(s) point to a DIFFERENT bucket — not updated:`
    );
    for (const r of otherStandardResult.rows.slice(0, 5)) {
      console.log(`    id=${r.id}  path=${r.object_path}`);
    }
  }

  // ── 2d: Category C — Bare GCS paths ────────────────────────────────────

  console.log(`\nCategory C — /${bucketName}/PATH → /objects/PATH`);
  const updateC = await client.query(
    `
    UPDATE product_images
    SET    object_path = '/objects/' || substr(object_path, length($1) + 2)
    WHERE  object_path LIKE ($1 || '/%')
    RETURNING id, object_path AS new_path
    `,
    [`/${bucketName}`]
  );
  console.log(`  Updated ${updateC.rowCount} row(s).`);
  for (const r of updateC.rows.slice(0, 5)) {
    console.log(`    id=${r.id}  →  ${r.new_path}`);
  }

  return {
    a: updateA.rowCount ?? 0,
    b: updateB.rowCount ?? 0,
    c: updateC.rowCount ?? 0,
  };
}

// ── Step 3 — Post-migration verification ─────────────────────────────────────

async function runVerification(client: pg.PoolClient) {
  separator("POST-MIGRATION VERIFICATION");

  const result = await client.query(`
    SELECT
      CASE
        WHEN object_path LIKE '/objects/%'           THEN '✅  canonical  (/objects/…)'
        WHEN object_path LIKE '/local-uploads/%'     THEN '✅  local-upload'
        WHEN object_path LIKE '/public-objects/%'    THEN '✅  public-objects'
        WHEN object_path LIKE 'https://%'            THEN '❌  still-https-url'
        WHEN object_path IS NULL OR object_path = '' THEN '🔴  null-or-empty'
        ELSE '⚠️  other-path'
      END AS format_label,
      COUNT(*) AS count
    FROM product_images
    GROUP BY 1
    ORDER BY 2 DESC
  `);

  console.log("\nPost-fix format distribution:");
  for (const row of result.rows) {
    console.log(`  ${row.format_label.padEnd(40)}  ${row.count}`);
  }

  // Sanity check: any row updated to /objects/ should produce a parseable path
  const malformedResult = await client.query(`
    SELECT id, object_path
    FROM   product_images
    WHERE  object_path LIKE '/objects/'  -- exactly /objects/ with nothing after
        OR (object_path LIKE '/objects/%' AND length(object_path) <= length('/objects/'))
    LIMIT 10
  `);
  if ((malformedResult.rowCount ?? 0) > 0) {
    console.log(`\n  ⚠️  ${malformedResult.rowCount} row(s) have malformed /objects/ paths — review manually:`);
    for (const r of malformedResult.rows) {
      console.log(`    id=${r.id}  path=${r.object_path}`);
    }
  }

  separator("ROLLBACK INSTRUCTIONS (keep this in your runbook)");
  console.log(`
  If something looks wrong, restore the original paths with:

    BEGIN;

    UPDATE product_images pi
    SET    object_path = b.object_path
    FROM   product_images_path_backup b
    WHERE  pi.id = b.image_id;

    -- verify row count before committing:
    -- SELECT COUNT(*) FROM product_images_path_backup;

    COMMIT;

    -- Then drop the backup table once satisfied:
    DROP TABLE product_images_path_backup;
  `);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  separator("Royal Note — product_images.object_path migration");
  console.log(`\nBucket name derived from PRIVATE_OBJECT_DIR: "${bucketName}"`);

  const client = await pool.connect();
  try {
    if (DRY_RUN) {
      // Diagnostic only — no transaction needed
      await runDiagnostic(client);

      separator("DRY-RUN COMPLETE");
      console.log(`
  No rows were modified.  Review the report above, then run:

    pnpm --filter @workspace/scripts tsx src/fix-product-image-paths.ts --fix
`);
    } else {
      // Show diagnostic first
      const { subdomainCount, standardCount, bareCount } =
        await runDiagnostic(client);

      const totalToFix = subdomainCount + standardCount + bareCount;
      if (totalToFix === 0) {
        console.log(
          "\n✅  No broken paths found.  Nothing to migrate.  Exiting."
        );
        return;
      }

      separator("CONFIRMATION REQUIRED");
      console.log(
        `\n  About to update up to ${totalToFix} row(s) in product_images.\n` +
          "  A backup will be created in product_images_path_backup first.\n"
      );
      const answer = await ask("  Type YES to proceed: ");
      if (answer !== "yes") {
        console.log("\n  Aborted — no changes made.");
        return;
      }

      // Run migration inside a transaction
      await client.query("BEGIN");
      try {
        const counts = await runMigration(client);
        await client.query("COMMIT");
        console.log(
          `\n✅  Migration committed:  A=${counts.a}  B=${counts.b}  C=${counts.c}  ` +
            `total=${counts.a + counts.b + counts.c} row(s) updated.`
        );
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("\n❌  Migration failed — transaction rolled back.");
        throw err;
      }

      // Verify (outside transaction, read-only)
      await runVerification(client);
    }
  } finally {
    client.release();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nFATAL:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
