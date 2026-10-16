import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";
import { hashPassword } from "../server/auth.js";

let db, app, base;
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

test("SLA and operational endpoints are restricted to super admins", async () => {
  assert.equal((await req(null, "/admin/sla")).status, 401);
  for (const role of ["customer", "dealer", "contractor"]) {
    assert.equal((await req(role, "/admin/sla")).status, 403);
    assert.equal(
      (await req(role, "/admin/sla", { policies: [] })).status,
      403,
    );
    assert.equal((await req(role, "/admin/operations/outbox")).status, 403);
    assert.equal((await req(role, "/admin/operations/export")).status, 403);
  }
});

test("SLA policies can be configured per priority and validate target bounds", async () => {
  const initial = await req("admin", "/admin/sla");
  assert.equal(initial.status, 200);
  assert.equal(initial.data.policies.length, 3);

  // Resolution target smaller than first response target is rejected
  const invalid = await req("admin", "/admin/sla", {
    policies: [
      {
        severity: "s1",
        first_response_target_minutes: 120,
        resolution_target_minutes: 60,
      },
    ],
  });
  assert.equal(invalid.status, 400);
  assert.equal(
    invalid.data.errorKey,
    "sla_resolution_must_exceed_first_response",
  );

  // Valid SLA policy update
  const updated = await req("admin", "/admin/sla", {
    policies: [
      {
        severity: "s1",
        first_response_target_minutes: 30,
        resolution_target_minutes: 120,
      },
      {
        severity: "s2",
        first_response_target_minutes: 180,
        resolution_target_minutes: 720,
      },
      {
        severity: "s3",
        first_response_target_minutes: 360,
        resolution_target_minutes: 1440,
      },
    ],
  });
  assert.equal(updated.status, 200);
  const s1 = updated.data.policies.find((p) => p.severity === "s1");
  assert.equal(s1.first_response_target_minutes, 30);
  assert.equal(s1.resolution_target_minutes, 120);
  assert.ok(
    (await req("admin", "/admin/audit")).data.some(
      (a) => a.action === "sla_updated",
    ),
  );
});

test("Tickets track SLA due timestamps, first response, closure, and breaches", async () => {
  const createdRes = await req("customer", "/tickets", {
    title: "SLA Takip Testi",
    description: "İlk yanıt ve çözüm SLA hedeflerinin doğrulanması.",
    type: "Hata",
    severity: "s1",
  });
  assert.equal(createdRes.status, 201);
  const ticket = createdRes.data;
  assert.ok(ticket.sla_first_response_due_at);
  assert.ok(ticket.sla_resolution_due_at);
  assert.equal(ticket.sla_status, "on_track");
  assert.equal(ticket.first_responded_at, null);

  // Dealer comments -> sets first_responded_at
  const commentRes = await req("dealer", `/tickets/${ticket.id}/actions`, {
    action: "comment",
    visibility: "public",
    body: "Talebiniz incelenmeye başlandı.",
  });
  assert.equal(commentRes.status, 200);

  const afterComment = (await req("dealer", `/tickets/${ticket.id}`)).data;
  assert.ok(afterComment.first_responded_at);
  assert.equal(afterComment.sla_first_response_breached, false);

  // Simulate an SLA breach on ticket #1 by moving its due timestamps to the past
  await db.query(
    "UPDATE tickets SET first_responded_at = NULL, sla_first_response_due_at = now() - interval '2 hours', sla_resolution_due_at = now() - interval '1 hour' WHERE id = 1",
  );
  const breachedTicket = (await req("dealer", "/tickets/1")).data;
  assert.equal(breachedTicket.sla_first_response_breached, true);
  assert.equal(breachedTicket.sla_resolution_breached, true);
  assert.equal(breachedTicket.sla_status, "breached");

  const report = (await req("admin", "/admin/reports")).data;
  assert.ok(report.slaBreached >= 1);
  assert.equal(typeof report.slaComplianceRate, "number");
});

test("Operational outbox monitor lists notifications and allows retrying deliveries", async () => {
  const outboxRes = await req("admin", "/admin/operations/outbox");
  assert.equal(outboxRes.status, 200);
  assert.ok(outboxRes.data.rows.length > 0);
  const item = outboxRes.data.rows[0];

  const retryRes = await req(
    "admin",
    `/admin/operations/outbox/${item.id}/retry`,
    {},
  );
  assert.equal(retryRes.status, 200);
  assert.equal(retryRes.data.status, "pending");
  assert.equal(retryRes.data.attempts, 0);
});

test("Workspace JSON export includes tenant entities and excludes password hashes", async () => {
  const exportRes = await req("admin", "/admin/operations/export");
  assert.equal(exportRes.status, 200);
  const data = exportRes.data;
  assert.equal(data.tenant.slug, "bekatos");
  assert.equal(data.sla_policies.length, 3);
  assert.ok(data.organizations.length > 0);
  assert.ok(data.users.length > 0);
  assert.ok(data.tickets.length > 0);
  assert.ok(data.users.every((u) => u.password_hash === undefined));
});
