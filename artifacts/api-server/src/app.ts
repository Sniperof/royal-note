import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "path";
import { existsSync } from "fs";
import { pool } from "@workspace/db";
import router from "./routes";
import { ensureCoreSchema } from "./lib/ensureCoreSchema";
import "./types/session.d";

const PgSession = connectPgSimple(session);

const app: Express = express();

app.set("trust proxy", 1);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET ?? "fallback-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

app.use("/api", async (req, res, next) => {
  if (req.path === "/healthz") {
    next();
    return;
  }

  try {
    await ensureCoreSchema();
    next();
  } catch (error) {
    next(error);
  }
});

app.use("/api", router);

const shouldServeStatic =
  process.env.NODE_ENV === "production" || Boolean(process.env.WEB_DIST_DIR);

const webDistDir = process.env.WEB_DIST_DIR
  ? path.resolve(process.env.WEB_DIST_DIR)
  : path.resolve(process.cwd(), "web");

if (shouldServeStatic && existsSync(webDistDir)) {
  app.use(express.static(webDistDir));

  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(path.join(webDistDir, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

export default app;
