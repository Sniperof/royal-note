# Local Dev / Local Production

## Goal

This setup keeps:

- `dev` work isolated for feature development
- `local production` data isolated and persistent
- runtime files outside the source directory

## Database split

- Dev DB: `Perfum_dev`
- Local production DB: `Perfum_prod`

Never point both environments to the same database.
The API now refuses to start if `development` points to `Perfum_prod` or if `production` points to `Perfum_dev`.
There is an emergency override only:
`ALLOW_CROSS_ENV_DB=true`

## Recommended folder layout

- Source repo: your normal project folder
- Local production runtime: outside the repo, for example `D:\apps\inv-per-27-prod`

## Prepare local production runtime

From the repo root:

```powershell
pnpm run deploy:local-prod "D:\apps\inv-per-27-prod"
```

This will:

- build the API
- build the frontend
- copy both into the target runtime folder
- generate startup scripts
- generate `.env.example`

## First-time production runtime setup

Inside the runtime folder:

1. Copy `.env.example` to `.env`
2. Set `DATABASE_URL` to your local production database
3. Install runtime dependencies:

```powershell
pnpm install --prod
```

4. Start production:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-prod.ps1
```

## Run production in foreground

```powershell
powershell -ExecutionPolicy Bypass -File .\run-prod.ps1
```

## Stop production

```powershell
powershell -ExecutionPolicy Bypass -File .\stop-prod.ps1
```

## Dev workflow

- Keep development on the repo worktree
- Use a dedicated `.env` or `.env.dev` mapped to `Perfum_dev`
- Recommended dev ports: web `5173`, API `3001`
- Recommended local production port: `3000`
- Only deploy to local production after testing

## Safe release flow

1. Develop on `dev`
2. Test with `Perfum_dev`
3. Build and deploy runtime to local production folder
4. Run local production against `Perfum_prod`
