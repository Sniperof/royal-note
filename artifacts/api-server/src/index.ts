import app from "./app";
import { guardEnvironment } from "./lib/guardEnvironment";

const rawPort = process.env["API_PORT"] || process.env["PORT"] || "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

guardEnvironment();

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
