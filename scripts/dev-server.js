import crypto from "node:crypto";
if (!crypto.hash) {
  crypto.hash = (algorithm, data, outputEncoding) =>
    crypto.createHash(algorithm).update(data).digest(outputEncoding);
}
import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, ["scripts/build-server.js"], {
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status || 1);
process.env.VITE_DEV_SERVER = "true";
await import("../build/server/main.js");
