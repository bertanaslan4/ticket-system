import { existsSync } from "node:fs";
import { openDb } from "../server/db.js";
import { hashPassword } from "../server/auth.js";
if (existsSync(".env")) process.loadEnvFile(".env");
const [orgId, name, email] = process.argv.slice(2),
  password = process.env.NEW_USER_PASSWORD;
if (
  !Number.isInteger(Number(orgId)) ||
  !name ||
  !email?.includes("@") ||
  !password ||
  password.length < 12
) {
  console.error(
    'NEW_USER_PASSWORD ortam değişkenine en az 12 karakterlik şifre verin. Kullanım: node scripts/create-user.js <orgId> "Ad Soyad" email',
  );
  process.exit(1);
}
const db = await openDb();
try {
  await db.query(
    "INSERT INTO users(org_id,name,email,password_hash) VALUES($1,$2,$3,$4)",
    [Number(orgId), name, email.toLowerCase(), hashPassword(password)],
  );
  console.log("Kullanıcı oluşturuldu.");
} finally {
  await db.close();
}
