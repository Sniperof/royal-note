import fs from "fs";
import path from "path";

/**
 * Validates LOCAL_UPLOAD_DIR at server startup.
 *
 * Rules enforced:
 *   1. LOCAL_UPLOAD_DIR must be explicitly set via environment variable.
 *   2. It must resolve to an absolute path OUTSIDE the application directory.
 *   3. It must either already exist and be writable, or be creatable.
 *
 * If any rule fails the process throws and refuses to start.
 * There is intentionally no fallback — a missing or wrong upload path is a
 * deployment error, not a runtime condition to recover from silently.
 */
export function validateStorageConfig(): void {
  const rawDir = process.env.LOCAL_UPLOAD_DIR;

  if (!rawDir || rawDir.trim() === "") {
    throw new Error(
      "FATAL [storage]: LOCAL_UPLOAD_DIR is not set.\n" +
        "  Set LOCAL_UPLOAD_DIR to an absolute path OUTSIDE the application directory.\n" +
        "  Linux example:   LOCAL_UPLOAD_DIR=/srv/royal-note/shared/uploads\n" +
        "  Windows example: LOCAL_UPLOAD_DIR=D:\\royal-note-data\\uploads",
    );
  }

  const uploadDir = path.resolve(rawDir.trim());
  const appDir = path.resolve(process.cwd());

  if (uploadDir === appDir || uploadDir.startsWith(appDir + path.sep)) {
    throw new Error(
      "FATAL [storage]: LOCAL_UPLOAD_DIR must be OUTSIDE the application directory.\n" +
        `  App dir:    ${appDir}\n` +
        `  Upload dir: ${uploadDir}\n` +
        "  Move uploads to a persistent path that survives deploys.\n" +
        "  Linux example:   /srv/royal-note/shared/uploads\n" +
        "  Windows example: D:\\royal-note-data\\uploads",
    );
  }

  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`[storage] Created LOCAL_UPLOAD_DIR: ${uploadDir}`);
    } catch (mkdirErr) {
      throw new Error(
        "FATAL [storage]: LOCAL_UPLOAD_DIR does not exist and could not be created.\n" +
          `  Path: ${uploadDir}\n` +
          `  Error: ${(mkdirErr as Error).message}\n` +
          "  Create the directory manually and ensure the process user has write permission.",
      );
    }
  }

  try {
    fs.accessSync(uploadDir, fs.constants.W_OK);
  } catch {
    throw new Error(
      "FATAL [storage]: LOCAL_UPLOAD_DIR is not writable.\n" +
        `  Path: ${uploadDir}\n` +
        "  Fix on Linux: chmod 750 <dir>  or  chown <user>:<group> <dir>",
    );
  }

  console.log(`[storage] LOCAL_UPLOAD_DIR validated: ${uploadDir}`);
}
