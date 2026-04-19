#!/bin/bash
# deploy-staging.sh
# Run on the staging server via GitHub Actions SSH step.
# Location on server: /srv/royal-note-staging/scripts/deploy-from-workspace-staging.sh
#
# Differences from production:
#   - Pulls from `develop` branch.
#   - Uses /srv/royal-note-staging paths.
#   - Does NOT run db push (schema is applied at startup).

set -euo pipefail

APP_DIR="/opt/royal-note-staging/current"
ENV_FILE="${APP_DIR}/.env"

log()  { echo "[deploy-staging] $*"; }
fail() { echo "[deploy-staging] FATAL: $*" >&2; exit 1; }

# ─── Pre-flight: LOCAL_UPLOAD_DIR ────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  fail ".env not found at ${ENV_FILE}. Create it before deploying."
fi

LOCAL_UPLOAD_DIR_VALUE=""
LOCAL_UPLOAD_DIR_VALUE=$(grep -E '^LOCAL_UPLOAD_DIR=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]' || true)

if [ -z "$LOCAL_UPLOAD_DIR_VALUE" ]; then
  fail "LOCAL_UPLOAD_DIR is not set in ${ENV_FILE}.\n" \
       "  Add: LOCAL_UPLOAD_DIR=/srv/royal-note-staging/shared/uploads"
fi

case "${LOCAL_UPLOAD_DIR_VALUE}" in
  "${APP_DIR}"*) fail "LOCAL_UPLOAD_DIR (${LOCAL_UPLOAD_DIR_VALUE}) is INSIDE the app directory (${APP_DIR}). Aborting to protect uploads." ;;
esac

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

log "Pulling latest code (develop)..."
git pull origin develop

log "Installing dependencies..."
pnpm install --frozen-lockfile

log "Building API server..."
pnpm --filter @workspace/api-server build

log "Building frontend..."
pnpm --filter @workspace/inventory build

# ─── Restart PM2 ─────────────────────────────────────────────────────────────
log "Restarting PM2..."
ECOSYSTEM="${APP_DIR}/ecosystem.config.cjs"

if pm2 describe royal-note-staging > /dev/null 2>&1; then
  pm2 reload "$ECOSYSTEM" --update-env
else
  pm2 start "$ECOSYSTEM"
fi

# ─── Post-deploy smoke tests ─────────────────────────────────────────────────
log "Waiting for staging server to become healthy..."
PORT_VALUE=$(grep -E '^API_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]' || echo "8084")
HEALTH_URL="http://127.0.0.1:${PORT_VALUE}/api/healthz"

for i in $(seq 1 15); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    log "Health check passed: ${HEALTH_URL}"
    break
  fi
  if [ "$i" -eq 15 ]; then
    fail "Server did not become healthy after 15 seconds. Check: pm2 logs royal-note-staging"
  fi
  sleep 1
done

if [ ! -w "$LOCAL_UPLOAD_DIR_VALUE" ]; then
  fail "POST-DEPLOY: LOCAL_UPLOAD_DIR is no longer writable: ${LOCAL_UPLOAD_DIR_VALUE}"
fi
log "Upload directory writable: ${LOCAL_UPLOAD_DIR_VALUE}"

log "Staging deploy complete."
