import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";
import { hashPassword } from "../server/auth.js";
import { DatabaseService } from "../build/server/database/database.service.js";
import { runWithTenant, RLS_ROLE } from "../build/server/common/tenant-context.js";

let db, app, base, tenant2;
const cookies = {};

async function req(role, path, body) {
  const r = await fetch(base + "/api" + path, {
    headers: { Cookie: cookies[role] || "", "Content-Type": "application/json" },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}

// Runs raw SQL the way DatabaseService does for a tenant request.
function asTenant(tenantId, work) {
  return db.transaction(async (tx) => {
    await tx.query(
      "SELECT set_config('app.tenant_id',$1,true), set_config('role',$2,true)",
      [String(tenantId), RLS_ROLE],
    );
    return work(tx);
  });
}

before(async () => {
  db = await openDb({ url: null, dir: ":memory:" });
  await seed(db);
  await db.query(
    "INSERT INTO users(tenant_id,org_id,name,email,password_hash,system_role) VALUES(1,1,'Platform Admin','admin@bekatos.local',$1,'super_admin')",
    [hashPassword("Demo2026!")],
  );
  app = await createApp(db);
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  cookies.admin = (
    await req(null, "/login", { email: "admin@bekatos.local", password: "Demo2026!" })
  ).cookie;
  const created = await req("admin", "/admin/tenants", {
    name: "Rakip Yazılım",
    slug: "rakip",
    plan_tier: "starter",
    status: "active",
    agent_limit: 5,
    storage_limit_mb: 1024,
    admin_name: "Rakip Sahibi",
    admin_email: "owner@rakip.local",
    admin_password: "RakipPassword123!",
  });
  assert.equal(created.status, 201);
  tenant2 = created.data;
  cookies.owner2 = (
    await req(null, "/login", { email: "owner@rakip.local", password: "RakipPassword123!" })
  ).cookie;
});

after(async () => {
  await app?.close();
});

test("Workspace owners are super admins of their tenant but not platform admins", async () => {
  const me = await req("admin", "/me");
  assert.equal(me.data.is_platform_admin, true);
  const owner = await req("owner2", "/me");
  assert.equal(owner.data.role, "super_admin");
  assert.equal(owner.data.is_platform_admin, false);

  assert.equal((await req("owner2", "/admin/tenants")).status, 403);
  // Previously a workspace owner could upgrade their own plan or move into another tenant.
  const upgrade = await req("owner2", `/admin/tenants/${tenant2.id}`, {
    name: "Rakip Yazılım",
    slug: "rakip",
    plan_tier: "enterprise",
    status: "active",
    agent_limit: 100000,
    storage_limit_mb: 1024,
  });
  assert.equal(upgrade.status, 403);
  assert.equal(upgrade.data.errorKey, "this_area_is_restricted_to_platform_admins");
  assert.equal((await req("owner2", "/admin/tenants/1/switch", {})).status, 403);
  assert.equal((await req("owner2", "/admin/storage")).status, 403);
  assert.equal((await db.query("SELECT tenant_id FROM users WHERE email='owner@rakip.local'")).rows[0].tenant_id, tenant2.id);

  // Their own tenant administration keeps working.
  assert.equal((await req("owner2", "/admin/organizations")).status, 200);
  assert.equal((await req("owner2", "/admin/users")).status, 200);
});

test("Platform admin routes see every tenant", async () => {
  const list = await req("admin", "/admin/tenants");
  assert.equal(list.status, 200);
  const primary = list.data.find((t) => t.id === 1);
  assert.ok(primary.ticket_count > 0);
  assert.ok(list.data.some((t) => t.id === tenant2.id));
  assert.equal((await req("admin", "/admin/storage")).status, 200);
});

test("Child rows take tenant_id from their parent, whatever the caller sends", async () => {
  const missing = await db.query(
    "SELECT (SELECT count(*) FROM events e JOIN tickets t ON t.id=e.ticket_id WHERE e.tenant_id<>t.tenant_id)::int events, (SELECT count(*) FROM events WHERE tenant_id IS NULL)::int nulls",
  );
  assert.deepEqual(missing.rows[0], { events: 0, nulls: 0 });

  const forged = await db.query(
    "INSERT INTO events(ticket_id,actor_id,kind,visibility,body,tenant_id) VALUES(1,1,'comment','internal','x',$1) RETURNING tenant_id",
    [tenant2.id],
  );
  assert.equal(forged.rows[0].tenant_id, 1);
  const attachment = await db.query(
    "INSERT INTO attachments(id,ticket_id,name,size,storage,object_key) VALUES('00000000-0000-4000-8000-0000000000aa',1,'a.png',1,'local','a.png') RETURNING tenant_id",
  );
  assert.equal(attachment.rows[0].tenant_id, 1);
});

test("Row level security hides and protects other tenants' rows in the database", async () => {
  const seen = await asTenant(tenant2.id, async (tx) => ({
    tickets: (await tx.query("SELECT count(*)::int n FROM tickets")).rows[0].n,
    events: (await tx.query("SELECT count(*)::int n FROM events")).rows[0].n,
    attachments: (await tx.query("SELECT count(*)::int n FROM attachments")).rows[0].n,
    foreignUsers: (await tx.query("SELECT count(*)::int n FROM users WHERE tenant_id<>$1", [tenant2.id])).rows[0].n,
    updated: (await tx.query("UPDATE tickets SET title='hijacked' WHERE id=1")).affectedRows,
  }));
  assert.deepEqual(seen, { tickets: 0, events: 0, attachments: 0, foreignUsers: 0, updated: 0 });
  assert.notEqual((await db.query("SELECT title FROM tickets WHERE id=1")).rows[0].title, "hijacked");

  // Writing into another tenant fails: explicit tenant_id is rejected, and a child of an invisible ticket gets none.
  await assert.rejects(
    asTenant(tenant2.id, (tx) =>
      tx.query("INSERT INTO products(tenant_id,name) VALUES(1,'sızma')"),
    ),
    /row-level security/,
  );
  await assert.rejects(
    asTenant(tenant2.id, (tx) =>
      tx.query("INSERT INTO events(ticket_id,actor_id,kind,visibility,body) VALUES(1,1,'comment','internal','sızma')"),
    ),
    /row-level security|tenant_id/,
  );
});

test("DatabaseService applies the request tenant even to unfiltered queries", async () => {
  const service = new DatabaseService(db);
  const unfiltered = "SELECT id FROM tickets";
  const own = await runWithTenant(1, () => service.query(unfiltered));
  const other = await runWithTenant(tenant2.id, () => service.query(unfiltered));
  const system = await service.query(unfiltered);
  assert.ok(own.rows.length > 0);
  assert.equal(other.rows.length, 0);
  assert.equal(system.rows.length, own.rows.length);
  const inTx = await runWithTenant(tenant2.id, () =>
    service.transaction(async (tx) => (await tx.query(unfiltered)).rows.length),
  );
  assert.equal(inTx, 0);
});

test("Tenant users cannot reach another tenant's tickets over the API", async () => {
  assert.equal((await req("owner2", "/tickets")).data.length, 0);
  assert.equal((await req("owner2", "/tickets/1")).status, 404);
});
