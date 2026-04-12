#!/bin/bash
# deploy-production.sh
# Run on the production server via GitHub Actions SSH step.
# Location on server: /srv/royal-note/scripts/deploy-from-workspace.sh
#
# This script:
#   1. Validates that LOCAL_UPLOAD_DIR is configured and safe (pre-flight).
#   2. Pulls the latest code.
#   3. Installs dependencies.
#   4. Builds artifacts.
#   5. Restarts PM2.
#   6. Runs post-deploy smoke tests.
#
# It NEVER runs db push.
# It NEVER touches LOCAL_UPLOAD_DIR.

set -euo pipefail

APP_DIR="/opt/royal-note/current"
ENV_FILE="${APP_DIR}/.env"

log()  { echo "[deploy-production] $*"; }
fail() { echo "[deploy-production] FATAL: $*" >&2; exit 1; }

# ─── Pre-flight: LOCAL_UPLOAD_DIR ────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  fail ".env not found at ${ENV_FILE}. Create it before deploying."
fi

LOCAL_UPLOAD_DIR_VALUE=""
LOCAL_UPLOAD_DIR_VALUE=$(grep -E '^LOCAL_UPLOAD_DIR=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]' || true)

if [ -z "$LOCAL_UPLOAD_DIR_VALUE" ]; then
  fail "LOCAL_UPLOAD_DIR is not set in ${ENV_FILE}.\n" \
       "  Add: LOCAL_UPLOAD_DIR=/srv/royal-note/shared/uploads\n" \
       "  This path must be outside ${APP_DIR}."
fi

# Must be outside APP_DIR
case "${LOCAL_UPLOAD_DIR_VALUE}" in
  "${APP_DIR}"*) fail "LOCAL_UPLOAD_DIR (${LOCAL_UPLOAD_DIR_VALUE}) is INSIDE the app directory (${APP_DIR}). Aborting to protect uploads." ;;
esac

# Must exist and be writable
if [ ! -d "$LOCAL_UPLOAD_DIR_VALUE" ]; then
  mkdir -p "$LOCAL_UPLOAD_DIR_VALUE" || fail "Cannot create LOCAL_UPLOAD_DIR: ${LOCAL_UPLOAD_DIR_VALUE}"
  log "Created upload directory: ${LOCAL_UPLOAD_DIR_VALUE}"
fi

if [ ! -w "$LOCAL_UPLOAD_DIR_VALUE" ]; then
  fail "LOCAL_UPLOAD_DIR is not writable: ${LOCAL_UPLOAD_DIR_VALUE}"
fi

log "LOCAL_UPLOAD_DIR OK: ${LOCAL_UPLOAD_DIR_VALUE}"

# ─── Deploy ───────────────────────────────────────────────────────────────────
cd "$APP_DIR"

log "Pulling latest code..."
git pull origin main

log "Installing dependencies..."
pnpm install --frozen-lockfile

log "Building API server..."
pnpm --filter @workspace/api-server build

log "Building frontend..."
pnpm --filter @workspace/inventory build

# ─── Restart PM2 ─────────────────────────────────────────────────────────────
log "Restarting PM2..."
if pm2 describe royal-note > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi

# ─── Post-deploy smoke tests ─────────────────────────────────────────────────
log "Waiting for server to become healthy..."
PORT_VALUE=$(grep -E '^API_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]' || echo "8083")
HEALTH_URL="http://127.0.0.1:${PORT_VALUE}/api/healthz"

for i in $(seq 1 15); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    log "Health check passed: ${HEALTH_URL}"
    break
  fi
  if [ "$i" -eq 15 ]; then
    fail "Server did not become healthy after 15 seconds. Check PM2 logs: pm2 logs royal-note"
  fi
  sleep 1
done

# Verify LOCAL_UPLOAD_DIR is still accessible after restart
if [ ! -w "$LOCAL_UPLOAD_DIR_VALUE" ]; then
  fail "POST-DEPLOY: LOCAL_UPLOAD_DIR is no longer writable after restart: ${LOCAL_UPLOAD_DIR_VALUE}"
fi
log "Upload directory writable: ${LOCAL_UPLOAD_DIR_VALUE}"

log "Production deploy complete."
