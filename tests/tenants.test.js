import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";
import { hashPassword } from "../server/auth.js";

let db, app, base, tenant2;
const cookies = {};

async function req(role, path, body) {
  const r = await fetch(base + "/api" + path, {
    headers: {
      Cookie: cookies[role] || "",
      "Content-Type": "application/json",
    },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
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
  for (const [role, email] of Object.entries({
    admin: "admin@bekatos.local",
    customer: "musteri@yargici.demo",
    dealer: "bayi@verimsoft.demo",
    contractor: "bertan@bekatos.demo",
  })) {
    cookies[role] = (
      await req(null, "/login", { email, password: "Demo2026!" })
    ).cookie;
  }
});

after(async () => {
  await app?.close();
});

test("Tenant management is restricted to super admins and validates slugs", async () => {
  assert.equal((await req(null, "/admin/tenants")).status, 401);
  for (const role of ["customer", "dealer", "contractor"]) {
    assert.equal((await req(role, "/admin/tenants")).status, 403);
    assert.equal(
      (await req(role, "/admin/tenants", { name: "Forbidden", slug: "forbidden" })).status,
      403,
    );
  }
  assert.equal(
    (await req("admin", "/admin/tenants", { name: "Bad Slug", slug: "BAD SLUG!" })).status,
    400,
  );
  assert.equal(
    (await req("admin", "/admin/tenants", { name: "Dup", slug: "bekatos" })).status,
    409,
  );

  const created = await req("admin", "/admin/tenants", {
    name: "Acme Yazılım",
    slug: "acme-yazilim",
    plan_tier: "starter",
    status: "trial",
    agent_limit: 2,
    storage_limit_mb: 1,
    admin_name: "Acme Admin",
    admin_email: "admin@acme.local",
    admin_password: "AcmePassword123!",
  });
  assert.equal(created.status, 201);
  tenant2 = created.data;
  assert.equal(tenant2.slug, "acme-yazilim");
  assert.equal(tenant2.plan_tier, "starter");
  assert.equal(tenant2.agent_limit, 2);
  assert.equal(tenant2.agent_used, 1);

  const login2 = await req(null, "/login", {
    email: "admin@acme.local",
    password: "AcmePassword123!",
  });
  assert.equal(login2.status, 200);
  cookies.admin2 = login2.cookie;
  const me2 = await req("admin2", "/me");
  assert.equal(me2.status, 200);
  assert.equal(me2.data.tenant_id, tenant2.id);
  assert.equal(me2.data.tenant_slug, "acme-yazilim");
});

test("Complete logical isolation between Tenant 1 and Tenant 2 across all resources", async () => {
  const orgs2 = (await req("admin2", "/admin/organizations")).data;
  assert.equal(orgs2.length, 1);
  assert.equal(orgs2[0].name, "Acme Yazılım");

  // Tenant 2 can create a product with the same name as Tenant 1 ("ushops") without conflict
  const prodRes = await req("admin2", "/admin/products", { name: "ushops" });
  assert.equal(prodRes.status, 201);
  const prod2 = prodRes.data;

  // Create dealer and customer organizations in Tenant 2
  const dealerOrgRes = await req("admin2", "/admin/organizations", {
    name: "Acme Bayi",
    kind: "dealer",
  });
  assert.equal(dealerOrgRes.status, 201);
  const dealerOrg2 = dealerOrgRes.data;

  const custOrgRes = await req("admin2", "/admin/organizations", {
    name: "Acme Müşteri",
    kind: "customer",
    product_id: prod2.id,
    daily_limit: 20,
    support_chain: [dealerOrg2.id, orgs2[0].id],
  });
  assert.equal(custOrgRes.status, 201);
  const custOrg2 = custOrgRes.data;

  // Tenant 2 cannot see Tenant 1's tickets, users, or reports
  assert.equal((await req("admin2", "/tickets")).data.length, 0);
  assert.equal((await req("admin2", "/tickets/1")).status, 404);
  assert.equal((await req("admin2", "/admin/reports")).data.total, 0);

  // Tenant 1 cannot assign or reference Tenant 2's organizations
  assert.equal(
    (
      await req("admin", "/admin/organizations/3", {
        name: "Yargıcı",
        kind: "customer",
        product_id: 1,
        daily_limit: 10,
        support_chain: [dealerOrg2.id],
      })
    ).status,
    400,
  );

  // Save org IDs for quota test
  tenant2.dealerOrgId = dealerOrg2.id;
  tenant2.custOrgId = custOrg2.id;
});

test("Agent quota counts contractor and dealer staff while keeping customer users unlimited", async () => {
  // Tenant 2 has agent_limit = 2, and currently has 1 active super_admin (Acme Admin).
  // Adding 1 active dealer user reaches the limit (2/2):
  const dealerUserRes = await req("admin2", "/admin/users", {
    name: "Acme Bayi Personeli",
    email: "bayi@acme.local",
    password: "AcmePassword123!",
    org_id: tenant2.dealerOrgId,
    system_role: "member",
    active: true,
  });
  assert.equal(dealerUserRes.status, 201);

  // Adding another dealer or contractor user exceeds agent_limit (2) -> 403 agent_limit_reached
  const overQuotaRes = await req("admin2", "/admin/users", {
    name: "Fazla Personel",
    email: "fazla@acme.local",
    password: "AcmePassword123!",
    org_id: tenant2.dealerOrgId,
    system_role: "member",
    active: true,
  });
  assert.equal(overQuotaRes.status, 403);
  assert.equal(overQuotaRes.data.errorKey, "agent_limit_reached");

  // However, adding customer users is free and unlimited!
  for (let i = 1; i <= 3; i++) {
    const custUserRes = await req("admin2", "/admin/users", {
      name: `Acme Müşteri ${i}`,
      email: `musteri${i}@acme.local`,
      password: "AcmePassword123!",
      org_id: tenant2.custOrgId,
      system_role: "member",
      active: true,
    });
    assert.equal(custUserRes.status, 201);
  }
});

test("Storage quota is enforced per tenant on ticket attachments", async () => {
  // Set Tenant 1 storage_limit_mb to 1 MB and insert a dummy 1 MB attachment record
  await db.query("UPDATE tenants SET storage_limit_mb = 1 WHERE id = 1");
  await db.query(
    "INSERT INTO attachments(id,ticket_id,name,size,storage,object_key) VALUES('00000000-0000-4000-8000-000000000001',1,'existing.bin',1048576,'local','existing.bin')",
  );

  const pngBytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(1024, 65),
  ]);
  const form = new FormData();
  form.append(
    "payload",
    JSON.stringify({
      action: "comment",
      body: "Ek dosya denemesi",
      visibility: "public",
    }),
  );
  form.append(
    "files",
    new Blob([pngBytes], { type: "image/png" }),
    "extra.png",
  );
  const uploadRes = await fetch(base + "/api/tickets/1/actions", {
    method: "POST",
    headers: { Cookie: cookies.dealer },
    body: form,
  });
  assert.equal(uploadRes.status, 413);
  const uploadData = await uploadRes.json();
  assert.equal(uploadData.errorKey, "tenant_storage_quota_exceeded");

  // Restore Tenant 1 storage limit
  await db.query("UPDATE tenants SET storage_limit_mb = 256000 WHERE id = 1");
});

test("Suspending a tenant blocks login and active sessions, while primary tenant is protected", async () => {
  assert.equal(
    (
      await req("admin", "/admin/tenants/1", {
        name: "Bekatos",
        slug: "bekatos",
        plan_tier: "enterprise",
        status: "suspended",
        agent_limit: 500,
        storage_limit_mb: 256000,
      })
    ).status,
    400,
  );

  const suspendRes = await req("admin", `/admin/tenants/${tenant2.id}`, {
    name: "Acme Yazılım",
    slug: "acme-yazilim",
    plan_tier: "starter",
    status: "suspended",
    agent_limit: 2,
    storage_limit_mb: 1,
  });
  assert.equal(suspendRes.status, 200);
  assert.equal(suspendRes.data.status, "suspended");

  // Active session for Tenant 2 is immediately blocked
  const me2 = await req("admin2", "/me");
  assert.equal(me2.status, 403);
  assert.equal(me2.data.errorKey, "tenant_account_suspended");

  // Login to Tenant 2 is also blocked
  const login2 = await req(null, "/login", {
    email: "admin@acme.local",
    password: "AcmePassword123!",
  });
  assert.equal(login2.status, 403);
  assert.equal(login2.data.errorKey, "tenant_account_suspended");

  // Re-activating Tenant 2 restores access and allows workspace switching
  await req("admin", `/admin/tenants/${tenant2.id}`, {
    name: "Acme Yazılım",
    slug: "acme-yazilim",
    plan_tier: "pro",
    status: "active",
    agent_limit: 15,
    storage_limit_mb: 51200,
  });
  const switched = await req("admin", `/admin/tenants/${tenant2.id}/switch`, {});
  assert.equal(switched.status, 200);
  assert.equal(switched.data.tenant_id, tenant2.id);

  // Switch back to primary tenant 1
  const switchedBack = await req("admin", "/admin/tenants/1/switch", {});
  assert.equal(switchedBack.status, 200);
  assert.equal(switchedBack.data.tenant_id, 1);
});
