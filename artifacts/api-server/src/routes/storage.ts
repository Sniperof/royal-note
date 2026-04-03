import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const LOCAL_UPLOAD_ROOT = path.resolve(process.cwd(), ".local-uploads");

function ensureLocalUploadDir() {
  fs.mkdirSync(LOCAL_UPLOAD_ROOT, { recursive: true });
}

function localObjectPath(fileName: string) {
  return `/local-uploads/${fileName}`;
}

function localUploadUrl(req: Request, fileName: string) {
  const baseUrl = `${req.protocol}://${req.get("host") ?? "localhost"}`;
  return `${baseUrl}/api/storage/uploads/local/${encodeURIComponent(fileName)}`;
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { name, size, contentType } = parsed.data;

  try {
    let uploadURL: string;
    let objectPath: string;

    try {
      uploadURL = await objectStorageService.getObjectEntityUploadURL();
      objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    } catch (storageError) {
      console.warn("Falling back to local uploads:", storageError);
      ensureLocalUploadDir();
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${randomUUID()}-${safeName}`;
      uploadURL = localUploadUrl(req, fileName);
      objectPath = localObjectPath(fileName);
    }

    const responsePayload = RequestUploadUrlResponse.parse({
      uploadURL,
      objectPath,
    });

    res.json(responsePayload);
  } catch (error) {
    console.error("Error generating upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.put("/storage/uploads/local/*filePath", async (req: Request, res: Response) => {
  try {
    ensureLocalUploadDir();
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const fullPath = path.resolve(LOCAL_UPLOAD_ROOT, filePath);

    if (!fullPath.startsWith(LOCAL_UPLOAD_ROOT)) {
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
    console.error("Error saving local upload:", error);
    res.status(500).json({ error: "Failed to save local upload" });
  }
});

router.get("/storage/local-uploads/*filePath", async (req: Request, res: Response) => {
  try {
    ensureLocalUploadDir();
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const fullPath = path.resolve(LOCAL_UPLOAD_ROOT, filePath);

    if (!fullPath.startsWith(LOCAL_UPLOAD_ROOT)) {
      res.status(400).json({ error: "Invalid file path" });
      return;
    }
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const fileBuffer = await fs.promises.readFile(fullPath);
    res.type(path.extname(fullPath) || "application/octet-stream");
    res.status(200).send(fileBuffer);
  } catch (error) {
    console.error("Error serving local upload:", error);
    res.status(500).json({ error: "Failed to serve local upload" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
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
    console.error("Error serving public object:", error);
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

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
    console.error("Error serving object:", error);
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
