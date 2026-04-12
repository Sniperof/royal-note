#!/bin/bash
# post-merge.sh — runs after git pull/merge on the server.
#
# IMPORTANT: db push is intentionally NOT run here.
# Schema changes are applied automatically at startup via ensureCoreSchema()
# and ensureInventorySchema() (CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS).
# Running `db push` here is dangerous because:
#   - The Drizzle schema file only covers a subset of tables (inventory, inventory_traders).
#   - Running push on production can inadvertently affect live data.
#   - Schema migrations on production must be deliberate, not automatic.
#
# To manually apply a schema change on a specific environment run:
#   cd /path/to/repo && pnpm --filter db push
# after reviewing exactly what it will do.

set -e
pnpm install --frozen-lockfile
