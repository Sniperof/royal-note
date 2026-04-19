import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Local upload root.
// validateStorageConfig() (called at server startup in index.ts) already
// verified that this env var is set, is outside the app dir, and is writable.
function getLocalUploadRoot(): string {
  const dir = process.env.LOCAL_UPLOAD_DIR;
  if (!dir || dir.trim() === "") {
    throw new Error(
      "[storage] LOCAL_UPLOAD_DIR is not set. " +
        "The server should have rejected startup - check validateStorageConfig().",
    );
  }
  return path.resolve(dir.trim());
}

function localObjectPath(fileName: string): string {
  return `/local-uploads/${fileName}`;
}

function localUploadUrl(req: Request, fileName: string): string {
  const proto = req.protocol;
  const host = req.get("host") ?? "localhost";
  return `${proto}://${host}/api/storage/uploads/local/${encodeURIComponent(fileName)}`;
}

// Returns true only when fullPath is strictly inside rootDir (prevents traversal).
function isInsideRoot(rootDir: string, fullPath: string): boolean {
  const root = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
  return fullPath.startsWith(root);
}

// GCS / Replit object storage is only active when REPLIT_ENV=true.
// Outside Replit all uploads go directly to the local filesystem.
const isReplit = process.env.REPLIT_ENV === "true";

// POST /storage/uploads/request-url
// Step 1 of the two-step upload flow.
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { name } = parsed.data;

  try {
    let uploadURL: string;
    let objectPath: string;

    if (isReplit) {
      uploadURL = await objectStorageService.getObjectEntityUploadURL();
      objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    } else {
      const localUploadRoot = getLocalUploadRoot();
      fs.mkdirSync(localUploadRoot, { recursive: true });

      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { randomUUID } = await import("crypto");
      const fileName = `${randomUUID()}-${safeName}`;

      uploadURL = localUploadUrl(req, fileName);
      objectPath = localObjectPath(fileName);
    }

    const responsePayload = RequestUploadUrlResponse.parse({ uploadURL, objectPath });
    res.json(responsePayload);
  } catch (error) {
    console.error("[storage] Error generating upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// PUT /storage/uploads/local/:filePath
// Receives the raw file body and writes it to LOCAL_UPLOAD_DIR.
router.put("/storage/uploads/local/*filePath", async (req: Request, res: Response) => {
  try {
    const localUploadRoot = getLocalUploadRoot();
    fs.mkdirSync(localUploadRoot, { recursive: true });

    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const fullPath = path.resolve(localUploadRoot, filePath);

    if (!isInsideRoot(localUploadRoot, fullPath)) {
      res.status(400).json({ error: "Invalid file path" });
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, Buffer.concat(chunks));
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[storage] Error saving local upload:", error);
    res.status(500).json({ error: "Failed to save local upload" });
  }
});

// GET /storage/local-uploads/:filePath
// Serves files from LOCAL_UPLOAD_DIR.
router.get("/storage/local-uploads/*filePath", async (req: Request, res: Response) => {
  try {
    const localUploadRoot = getLocalUploadRoot();

    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const fullPath = path.resolve(localUploadRoot, filePath);

    if (!isInsideRoot(localUploadRoot, fullPath)) {
      res.status(400).json({ error: "Invalid file path" });
      return;
    }

    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const fileBuffer = await fs.promises.readFile(fullPath);
    const ext = path.extname(fullPath) || ".bin";
    res.type(ext);
    res.status(200).send(fileBuffer);
  } catch (error) {
    console.error("[storage] Error serving local upload:", error);
    res.status(500).json({ error: "Failed to serve local upload" });
  }
});

// GET /storage/public-objects/:filePath
// Replit/GCS only.
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  if (!isReplit) {
    res
      .status(503)
      .json({ error: "Public object storage is only available on Replit (REPLIT_ENV=true)" });
    return;
  }

  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("[storage] Error serving public object:", error);
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

// GET /storage/objects/:path
// Replit/GCS only.
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  if (!isReplit) {
    res
      .status(503)
      .json({ error: "GCS object storage is only available on Replit (REPLIT_ENV=true)" });
    return;
  }

  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("[storage] Error serving object:", error);
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
