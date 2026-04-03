import path from "path";
import { cp, mkdir, rm, writeFile, readFile } from "fs/promises";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../../");
const apiServerDir = path.join(repoRoot, "artifacts", "api-server");
const inventoryDir = path.join(repoRoot, "artifacts", "inventory");
const targetDir =
  process.argv[2] ??
  process.env.LOCAL_PROD_DIR ??
  path.join(process.env.USERPROFILE ?? repoRoot, "inv-per-27-prod");

function run(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
}

async function buildArtifacts() {
  await run("pnpm", ["--filter", "@workspace/api-server", "build"], repoRoot);
  await run("pnpm", ["--filter", "@workspace/inventory", "build"], repoRoot);
}

async function writeRuntimePackageJson() {
  const apiPkg = JSON.parse(await readFile(path.join(apiServerDir, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const workspaceYaml = await readFile(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");
  const catalogEntries = new Map<string, string>();
  let inCatalog = false;

  for (const line of workspaceYaml.split(/\r?\n/)) {
    if (line.trim() === "catalog:") {
      inCatalog = true;
      continue;
    }
    if (inCatalog) {
      if (!line.startsWith("  ")) break;
      const match = line.match(/^\s{2}(.+?):\s+(.+)$/);
      if (match) {
        catalogEntries.set(match[1].trim(), match[2].trim());
      }
    }
  }

  const runtimeDependencies = Object.fromEntries(
    Object.entries(apiPkg.dependencies ?? {})
      .filter(([, version]) => !version.startsWith("workspace:"))
      .map(([name, version]) => {
        if (version === "catalog:") {
          return [name, catalogEntries.get(name) ?? version];
        }
        return [name, version];
      }),
  );

  const runtimePkg = {
    name: "inv-per-27-local-prod",
    private: true,
    type: "commonjs",
    scripts: {
      start: "node ./api/index.cjs",
    },
    dependencies: runtimeDependencies,
  };

  await writeFile(
    path.join(targetDir, "package.json"),
    `${JSON.stringify(runtimePkg, null, 2)}\n`,
    "utf8",
  );
}

async function writeEnvTemplate() {
  const envTemplate = `DATABASE_URL=postgres://postgres:CHANGE_ME@localhost:5432/Perfum_prod
API_PORT=3000
SESSION_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_SECRET
NODE_ENV=production
WEB_DIST_DIR=./web
`;

  await writeFile(path.join(targetDir, ".env.example"), envTemplate, "utf8");
}

async function writeStartScripts() {
  const backupScript = `$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$EnvFile = Join-Path $Root ".env"
$BackupDir = "C:\\Users\\Ibrahim Obaid\\Perfum_prod_backups"
$PgDump = "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"

if (-not (Test-Path $EnvFile)) {
  throw "Missing .env file in $Root"
}

if (-not (Test-Path $PgDump)) {
  throw "pg_dump.exe was not found at $PgDump"
}

Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\\s*#' -or $_ -match '^\\s*$') { return }
  $parts = $_ -split '=', 2
  if ($parts.Length -eq 2) {
    [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
  }
}

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is missing from .env"
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = Join-Path $BackupDir "Perfum_prod_$timestamp.backup"

& $PgDump --format=custom --no-owner --no-privileges --file $backupFile --dbname $env:DATABASE_URL

if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}

Get-ChildItem $BackupDir -Filter "Perfum_prod_*.backup" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 14 |
  Remove-Item -Force

Write-Host "Backup created: $backupFile"
`;

  const restoreScript = `param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$EnvFile = Join-Path $Root ".env"
$PgRestore = "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe"

if (-not (Test-Path $EnvFile)) {
  throw "Missing .env file in $Root"
}

if (-not (Test-Path $PgRestore)) {
  throw "pg_restore.exe was not found at $PgRestore"
}

if (-not (Test-Path $BackupFile)) {
  throw "Backup file was not found: $BackupFile"
}

Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\\s*#' -or $_ -match '^\\s*$') { return }
  $parts = $_ -split '=', 2
  if ($parts.Length -eq 2) {
    [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
  }
}

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is missing from .env"
}

& $PgRestore --clean --if-exists --no-owner --no-privileges --dbname $env:DATABASE_URL $BackupFile

if ($LASTEXITCODE -ne 0) {
  throw "pg_restore failed with exit code $LASTEXITCODE"
}

Write-Host "Restore completed from: $BackupFile"
`;

  const launchScript = `$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$HealthUrl = "http://localhost:3000/api/healthz"
$AppUrl = "http://localhost:3000/"
$StartScript = Join-Path $Root "start-prod.ps1"

function Test-ProdHealth {
  try {
    $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-Path $StartScript)) {
  throw "Missing start-prod.ps1 in $Root"
}

if (-not (Test-ProdHealth)) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $StartScript | Out-Null

  $started = $false
  for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Milliseconds 700
    if (Test-ProdHealth) {
      $started = $true
      break
    }
  }

  if (-not $started) {
    throw "Production did not become healthy on port 3000."
  }
}

Start-Process $AppUrl | Out-Null
`;

  const startScript = `$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$EnvFile = Join-Path $Root ".env"
$PidDir = Join-Path $Root ".runtime"
$PidFile = Join-Path $PidDir "api.pid"
$BackupScript = Join-Path $Root "backup-prod.ps1"

if (-not (Test-Path $EnvFile)) {
  throw "Missing .env file in $Root"
}

New-Item -ItemType Directory -Force -Path $PidDir | Out-Null

if (Test-Path $BackupScript) {
  try {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $BackupScript | Out-Null
  } catch {
    Write-Warning "Automatic backup failed: $($_.Exception.Message)"
  }
}

Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\\s*#' -or $_ -match '^\\s*$') { return }
  $parts = $_ -split '=', 2
  if ($parts.Length -eq 2) {
    [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
  }
}

$process = Start-Process -FilePath "node" -ArgumentList "./api/index.cjs" -WorkingDirectory $Root -PassThru
Set-Content -Path $PidFile -Value $process.Id
Write-Host "Production started. PID=$($process.Id)"
`;

  const stopScript = `$ErrorActionPreference = "Stop"
$PidFile = Join-Path $PSScriptRoot ".runtime\\api.pid"

if (-not (Test-Path $PidFile)) {
  Write-Host "No PID file found."
  exit 0
}

$pidValue = Get-Content $PidFile | Select-Object -First 1
if ($pidValue) {
  try {
    Stop-Process -Id ([int]$pidValue) -Force
    Write-Host "Stopped PID $pidValue"
  } catch {
    Write-Host "Process $pidValue is not running."
  }
}

Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
`;

  const runForegroundScript = `$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$EnvFile = Join-Path $Root ".env"

if (-not (Test-Path $EnvFile)) {
  throw "Missing .env file in $Root"
}

Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\\s*#' -or $_ -match '^\\s*$') { return }
  $parts = $_ -split '=', 2
  if ($parts.Length -eq 2) {
    [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
  }
}

node ./api/index.cjs
`;

  const startCmd = `@echo off
set "ROOT=${targetDir}"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\\launch-prod.ps1"
`;

  const stopCmd = `@echo off
set "ROOT=${targetDir}"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\\stop-prod.ps1"
`;

  const backupCmd = `@echo off
set "ROOT=${targetDir}"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\\backup-prod.ps1"
pause
`;

  await writeFile(path.join(targetDir, "backup-prod.ps1"), backupScript, "utf8");
  await writeFile(path.join(targetDir, "restore-prod.ps1"), restoreScript, "utf8");
  await writeFile(path.join(targetDir, "launch-prod.ps1"), launchScript, "utf8");
  await writeFile(path.join(targetDir, "start-prod.ps1"), startScript, "utf8");
  await writeFile(path.join(targetDir, "stop-prod.ps1"), stopScript, "utf8");
  await writeFile(path.join(targetDir, "run-prod.ps1"), runForegroundScript, "utf8");
  await writeFile(path.join(targetDir, "Start Perfum Production.cmd"), startCmd, "utf8");
  await writeFile(path.join(targetDir, "Stop Perfum Production.cmd"), stopCmd, "utf8");
  await writeFile(path.join(targetDir, "Backup Perfum Production.cmd"), backupCmd, "utf8");
}

async function writeReadme() {
  const readme = `Local production runtime
========================

This folder is safe to use as the local production runtime outside the source repo.

First-time setup
----------------
1. Copy .env.example to .env
2. Update DATABASE_URL to your production-local database
3. Run:
   pnpm install --prod
4. Start:
   powershell -ExecutionPolicy Bypass -File .\\start-prod.ps1

Foreground mode
---------------
powershell -ExecutionPolicy Bypass -File .\\run-prod.ps1

Stop
----
powershell -ExecutionPolicy Bypass -File .\\stop-prod.ps1
`;

  await writeFile(path.join(targetDir, "README.txt"), readme, "utf8");
}

async function copyBuildOutputs() {
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(path.join(targetDir, "api"), { recursive: true });
  await mkdir(path.join(targetDir, "web"), { recursive: true });

  await cp(path.join(apiServerDir, "dist"), path.join(targetDir, "api"), { recursive: true });
  await cp(path.join(inventoryDir, "dist", "public"), path.join(targetDir, "web"), { recursive: true });
}

async function main() {
  console.log(`Preparing local production runtime in ${targetDir}`);
  await buildArtifacts();
  await copyBuildOutputs();
  await writeRuntimePackageJson();
  await writeEnvTemplate();
  await writeStartScripts();
  await writeReadme();
  console.log("Local production runtime prepared successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
