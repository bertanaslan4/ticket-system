// Build TypeScript with npm run build:server before starting.
import crypto from "node:crypto";
if (!crypto.hash) {
  crypto.hash = (algorithm, data, outputEncoding) =>
    crypto.createHash(algorithm).update(data).digest(outputEncoding);
}
import "../build/server/main.js";
