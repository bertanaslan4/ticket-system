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
});
test("Admin olmayan kullanıcı yönetim ve raporlama API erişimi alamaz", async () => {
  for (const p of ["users", "organizations", "reports", "audit"])
    assert.equal((await req(member, "/admin/" + p)).status, 403);
  assert.equal((await req(member, "/admin/users", {})).status, 403);
  assert.equal((await req(null, "/admin/reports")).status, 401);
});
test("Admin tüm biletleri ve gizli yorumları görür; normal müşteri göremez", async () => {
  await db.query(
    "INSERT INTO events(ticket_id,actor_id,kind,visibility,body) VALUES(1,2,'comment','internal','admin-secret')",
  );
  assert.equal((await req(admin, "/me")).data.role, "super_admin");
  assert.equal((await req(admin, "/tickets")).data.length, 3);
  assert.ok(
    (await req(admin, "/tickets/1")).data.events.some(
      (e) => e.body === "admin-secret",
    ),
  );
  assert.ok(
    !(await req(member, "/tickets/1")).data.events.some(
      (e) => e.body === "admin-secret",
    ),
  );
});
test("Şirket oluşturma ve bayi doğrulaması", async () => {
  assert.equal(
    (
      await req(admin, "/admin/organizations", {
        name: "Yeni mağaza",
        kind: "customer",
        dealer_id: 3,
        program: "ushops",
        daily_limit: 2,
      })
    ).status,
    400,
  );
  const r = await req(admin, "/admin/organizations", {
    name: "Yeni mağaza",
    kind: "customer",
    dealer_id: 2,
    program: "ushops",
    daily_limit: 2,
  });
  assert.equal(r.status, 201);
  org = r.data;
  const updated = await req(admin, "/admin/organizations/" + org.id, {
    ...org,
    name: "Güncel mağaza",
    daily_limit: 3,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.daily_limit, 3);
  assert.equal(
    (
      await req(admin, "/admin/organizations/" + org.id, {
        ...org,
        kind: "dealer",
      })
    ).status,
    400,
  );
});
test("Kullanıcı ekleme, mükerrer e-posta ve güvenli yanıt", async () => {
  const data = {
    name: "Yeni Kullanıcı",
    email: "new@test.local",
    password: "NewUser2026!ok",
    org_id: org.id,
    system_role: "member",
    active: true,
  };
  const r = await req(admin, "/admin/users", data);
  assert.equal(r.status, 201);
  newUser = r.data;
  assert.ok(!JSON.stringify(r.data).includes("password"));
  assert.equal((await req(admin, "/admin/users", data)).status, 409);
  assert.equal((await login(data.email, data.password)).status, 200);
  assert.ok(
    !(await req(admin, "/admin/users")).data.some((u) => "password_hash" in u),
  );
});
test("Şifre yenileme ve pasifleştirme oturumu iptal eder", async () => {
  const old = (await login("new@test.local", "NewUser2026!ok")).cookie;
  assert.equal(
    (
      await req(admin, "/admin/users/" + newUser.id, {
        ...newUser,
        password: "ChangedUser2026!",
      })
    ).status,
    200,
  );
  assert.equal((await req(old, "/me")).status, 401);
  assert.equal((await login(newUser.email, "NewUser2026!ok")).status, 401);
  const current = (await login(newUser.email, "ChangedUser2026!")).cookie;
  assert.equal(
    (
      await req(admin, "/admin/users/" + newUser.id, {
        ...newUser,
        active: false,
      })
    ).status,
    200,
  );
  assert.equal((await req(current, "/me")).status, 401);
  assert.equal((await login(newUser.email, "ChangedUser2026!")).status, 401);
});
test("Admin kendi yetkisini kaldıramaz; normal kullanıcı kendini yükseltemez", async () => {
  const me = (await req(admin, "/me")).data;
  assert.equal(
    (
      await req(admin, "/admin/users/" + me.id, {
        ...me,
        system_role: "member",
        active: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req(member, "/admin/users/1", {
        name: "x",
        email: "x@test.local",
        org_id: 3,
        system_role: "super_admin",
        active: true,
      })
    ).status,
    403,
  );
});
test("Rapor filtreleri, İstanbul günü ve çözüm zamanı", async () => {
  await db.query(
    "UPDATE tickets SET created_at='2026-10-07T22:00:00Z',status='closed',updated_at='2026-10-08T03:00:00Z' WHERE id=1",
  );
  await db.query(
    "INSERT INTO events(ticket_id,actor_id,kind,visibility,body,created_at) VALUES(1,2,'closed','public','tamamlandı','2026-10-08T01:00:00Z')",
  );
  const r = await req(
    admin,
    "/admin/reports?from=2026-10-08&to=2026-10-08&status=closed&customer_id=3&dealer_id=2&severity=s1&type=Hata",
  );
  assert.equal(r.status, 200);
  assert.equal(r.data.total, 1);
  assert.equal(r.data.closed, 1);
  assert.equal(r.data.averageResolutionHours, 3);
  assert.equal(
    (await req(admin, "/admin/reports?from=2026-10-09&to=2026-10-01")).status,
    400,
  );
  assert.equal(
    (await req(admin, "/admin/reports?from=2026-02-30")).status,
    400,
  );
  assert.equal(
    (await req(admin, "/admin/reports?customer_id=999")).data.total,
    0,
  );
});
test("Yönetim geçmişi şifre içermez ve işlemleri kaydeder", async () => {
  const r = await req(admin, "/admin/audit");
  assert.ok(r.data.length >= 5);
  assert.ok(r.data.some((a) => a.action === "organization_created"));
  assert.ok(!JSON.stringify(r.data).includes("ChangedUser2026!"));
});
test("Süper admin bayi kapatma akışını atlayamaz", async () => {
  assert.equal(
    (
      await req(admin, "/tickets/2/actions", {
        action: "close",
        body: "admin doğrudan kapatamaz",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req(admin, "/tickets/2/actions", {
        action: "comment",
        visibility: "internal",
        body: "Yönetici inceleme notu",
      })
    ).status,
    200,
  );
});
