import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync } from "node:fs";
const result = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.server.json"],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status || 1);
copyFileSync("server/schema.sql", "build/server/schema.sql");
cpSync("server/mail/templates", "build/server/mail/templates", { recursive: true });
