import app from "./app";
import { guardEnvironment } from "./lib/guardEnvironment";
import { validateStorageConfig } from "./lib/validateStorageConfig";

const rawPort = process.env["API_PORT"] || process.env["PORT"] || "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

guardEnvironment();
validateStorageConfig();

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
