import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
export async function openDb({
  url = process.env.DATABASE_URL,
  dir = process.env.DATA_DIR || "./data",
} = {}) {
  let db;
  if (url) {
    const pool = new pg.Pool({ connectionString: url });
    db = {
      query: (s, p) => pool.query(s, p),
      exec: (s) => pool.query(s),
      close: () => pool.end(),
      transaction: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const r = await fn(c);
          await c.query("COMMIT");
          return r;
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      },
    };
  } else {
    if (dir !== ":memory:") await mkdir(resolve(dir), { recursive: true });
    db = new PGlite(dir === ":memory:" ? undefined : resolve(dir));
  }
  await db.exec(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
  return db;
}
