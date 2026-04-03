const PROD_DB_NAME = "Perfum_prod";
const DEV_DB_NAME = "Perfum_dev";

function getDatabaseNameFromUrl(connectionString: string) {
  try {
    const url = new URL(connectionString);
    return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    return "";
  }
}

export function guardEnvironment() {
  const nodeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const allowCrossEnvDb = process.env.ALLOW_CROSS_ENV_DB === "true";

  if (!databaseUrl || allowCrossEnvDb) {
    return;
  }

  const databaseName = getDatabaseNameFromUrl(databaseUrl);
  if (!databaseName) {
    return;
  }

  if (nodeEnv === "development" && databaseName === PROD_DB_NAME) {
    throw new Error(
      `Safety guard: development server refuses to start against "${PROD_DB_NAME}". ` +
        `Use "${DEV_DB_NAME}" or set ALLOW_CROSS_ENV_DB=true only if you really mean it.`,
    );
  }

  if (nodeEnv === "production" && databaseName === DEV_DB_NAME) {
    throw new Error(
      `Safety guard: production server refuses to start against "${DEV_DB_NAME}". ` +
        `Use "${PROD_DB_NAME}" or set ALLOW_CROSS_ENV_DB=true only if you really mean it.`,
    );
  }
}
