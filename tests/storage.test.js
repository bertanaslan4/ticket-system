import { StorageSettings } from "../build/server/storage/storage.service.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
let temp;
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";
import { hashPassword } from "../server/auth.js";
let db, server, base, admin, member, newUser, org;
async function login(email, password = "Demo2026!") {
  const r = await fetch(base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return {
    status: r.status,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function req(cookie, path, body) {
  const r = await fetch(base + "/api" + path, {
    headers: { Cookie: cookie || "", "Content-Type": "application/json" },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
before(async () => {
  const url = process.env.TEST_DATABASE_URL || null;
  if (url && !/^\/ticket_test_\d+$/.test(new URL(url).pathname))
    throw Error("Isolated test database required.");
  temp = await mkdtemp(join(tmpdir(), "storage-settings-"));
  process.env.STORAGE_KEY_FILE = join(temp, "key");
  process.env.ATTACHMENT_DIR = join(temp, "files");
  db = await openDb({ url, dir: ":memory:" });
  await seed(db);
  await db.query(
    "INSERT INTO users(org_id,name,email,password_hash,system_role) VALUES(1,'Admin','admin@test.local',$1,'super_admin')",
    [hashPassword("AdminTest2026!")],
  );
  server = await createApp(db);
  await server.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${server.getHttpServer().address().port}`;
  admin = (await login("admin@test.local", "AdminTest2026!")).cookie;
  member = (await login("musteri@yargici.demo")).cookie;
});
after(async () => {
  if (server) await server.close();
  else await db?.close();
  await rm(temp, { recursive: true, force: true });
});

const initial = {
  provider: "local",
  account: "",
  bucket: "",
  accessKey: "",
  secret: "",
  version: 0,
};
test("Storage settings require super admin", async () => {
  for (const path of ["/admin/storage", "/admin/storage/test"])
    assert.equal((await req(member, path, initial)).status, 403);
  assert.equal((await req(null, "/admin/storage")).status, 401);
});
test("Local settings save, status and concurrency", async () => {
  assert.equal(
    (await req(admin, "/admin/storage/test", initial)).data.ok,
    true,
  );
  const r = await req(admin, "/admin/storage", initial);
  assert.equal(r.status, 201);
  assert.equal(r.data.version, 1);
  assert.ok(r.data.checked_at);
  assert.equal((await req(admin, "/admin/storage", initial)).status, 409);
});
test("Cloud credentials encrypted, redacted and used dynamically; failed tests never save", async () => {
  const service = server.get(StorageSettings),
    probe = service.probe.bind(service);
  const config = {
    provider: "r2",
    account: "a".repeat(32),
    bucket: "test-bucket",
    accessKey: "private-key",
    secret: "private-secret",
    version: 1,
  };
  service.probe = async () => ({
    ok: false,
    errorKey: "storage_connection_failed",
  });
  assert.equal((await req(admin, "/admin/storage", config)).status, 400);
  assert.equal((await service.config()).provider, "local");
  service.probe = async () => ({
    ok: true,
    checked_at: new Date().toISOString(),
  });
  const r = await req(admin, "/admin/storage", config);
  assert.equal(r.status, 201);
  assert.equal(r.data.hasCredentials, true);
  assert.equal(JSON.stringify(r.data).includes("private-"), false);
  const stored = (await db.query("SELECT config FROM storage_settings")).rows[0]
    .config;
  assert.equal(stored.includes("private-"), false);
  assert.notEqual(stored[0], "{");
  assert.equal((await service.config()).secret, "private-secret");
  assert.equal(
    (
      await req(admin, "/admin/storage", {
        ...config,
        version: 2,
        account: "b".repeat(32),
      })
    ).status,
    409,
  );
  const updated = await req(admin, "/admin/storage", {
    ...config,
    version: 2,
    provider: "local",
    accessKey: "",
    secret: "",
  });
  assert.equal(updated.status, 201);
  assert.equal((await service.config()).secret, "private-secret");
  assert.equal(
    JSON.stringify(
      (await db.query("SELECT details FROM admin_audit")).rows,
    ).includes("private-"),
    false,
  );
  service.probe = probe;
});
