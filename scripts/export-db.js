import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { openDb } from "../server/db.js";
if (existsSync(".env")) process.loadEnvFile(".env");
const db = await openDb();
const literal = (v) =>
  v === null
    ? "NULL"
    : typeof v === "boolean"
      ? v
        ? "TRUE"
        : "FALSE"
      : typeof v === "number"
        ? String(v)
        : "'" +
          (v instanceof Date
            ? v.toISOString()
            : typeof v === "object"
              ? JSON.stringify(v)
              : String(v)
          ).replaceAll("'", "''") +
          "'";
try {
  const sql = await db.transaction(async (tx) => {
    const lines = ["BEGIN;"];
    for (const table of [
      "organizations",
      "users",
      "tickets",
      "events",
      "admin_audit",
    ]) {
      const { rows } = await tx.query(`SELECT * FROM ${table} ORDER BY id`);
      for (const row of rows) {
        lines.push(
          `INSERT INTO ${table} (${Object.keys(row).join(",")}) VALUES (${Object.values(row).map(literal).join(",")});`,
        );
      }
      if (rows.length)
        lines.push(
          `SELECT setval(pg_get_serial_sequence('${table}','id'),(SELECT max(id) FROM ${table}));`,
        );
    }
    lines.push("COMMIT;");
    return lines.join("\n");
  });
  await mkdir("backups", { recursive: true });
  const path = `backups/export-${Date.now()}.sql`;
  await writeFile(path, sql);
  console.log(path);
} finally {
  await db.close();
}
