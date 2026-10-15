import crypto from "node:crypto";
if (!(crypto as any).hash) {
  (crypto as any).hash = (algorithm: string, data: crypto.BinaryLike, outputEncoding?: crypto.BinaryToTextEncoding) =>
    (crypto.createHash(algorithm).update(data) as any).digest(outputEncoding);
}
import { existsSync, readFileSync } from "node:fs";
import { openDb } from "./db.js";
import { seed } from "./seed.js";
import { createApp } from "./bootstrap.js";
if (existsSync(".env")) {
  if (typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile(".env");
  } else {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
const db = await openDb();
if (
  process.env.SEED_DEMO === "true" ||
  (!process.env.DATABASE_URL &&
    process.env.NODE_ENV !== "production" &&
    process.env.SEED_DEMO !== "false")
)
  await seed(db);
try {
  const app = await createApp(db, { frontend: true });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, process.env.HOST || "127.0.0.1");
  console.log(`NestJS Destek Merkezi: http://localhost:${port}`);
} catch (error) {
  await db.close();
  throw error;
}
