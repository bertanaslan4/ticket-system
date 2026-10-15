import { existsSync, readFileSync } from "node:fs";
import { openDb } from "../server/db.js";
import { hashPassword } from "../server/auth.js";
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
const password = process.env.NEW_ADMIN_PASSWORD;
if (!password || password.length < 12)
  throw Error("NEW_ADMIN_PASSWORD en az 12 karakter olmalıdır.");
const db = await openDb();
try {
  await db.transaction(async (tx) => {
    await tx.query("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
    if (
      (
        await tx.query(
          "SELECT id FROM users WHERE system_role='super_admin' AND active=true",
        )
      ).rows.length
    )
      throw Error("Aktif süper admin zaten var. Yönetim ekranını kullanın.");
    const org = (
      await tx.query(
        "SELECT id FROM organizations WHERE kind='contractor' ORDER BY id LIMIT 1",
      )
    ).rows[0];
    if (!org) throw Error("Önce ana üstlenici şirketini oluşturun.");
    await tx.query(
      "INSERT INTO users(org_id,name,email,password_hash,system_role) VALUES($1,$2,$3,$4,'super_admin')",
      [
        org.id,
        "Sistem Yöneticisi",
        process.env.NEW_ADMIN_EMAIL || "admin@bekatos.local",
        hashPassword(password),
      ],
    );
  });
  console.log("Süper admin oluşturuldu.");
} finally {
  await db.close();
}
