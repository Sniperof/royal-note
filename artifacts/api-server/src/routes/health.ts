import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function getDatabaseNameFromUrl(connectionString: string) {
  try {
    const url = new URL(connectionString);
    return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    return "unknown";
  }
}

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/runtime-info", (_req, res) => {
  const nodeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
  const databaseName = getDatabaseNameFromUrl(process.env.DATABASE_URL ?? "");

  res.json({
    environment: nodeEnv === "production" ? "PROD" : "DEV",
    node_env: nodeEnv,
    database_name: databaseName,
  });
});

export default router;
