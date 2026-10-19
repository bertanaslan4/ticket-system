import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";
import { hashPassword } from "../server/auth.js";

let db, app, base;
const cookies = {};

async function req(role, path, options = {}) {
  const method = options.method || (options.body ? "POST" : "GET");
  const r = await fetch(base + path, {
    method,
    headers: {
      Cookie: (role && cookies[role]) || "",
      "Content-Type": "application/json",
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  let data = null;
  try {
    data = await r.json();
  } catch {}
  return {
    status: r.status,
    data,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}

before(async () => {
  db = await openDb({ url: null, dir: ":memory:" });
  await seed(db);

  // Platform admin in primary tenant (enterprise tier)
  await db.query(
    "INSERT INTO users(tenant_id,org_id,name,email,password_hash,system_role) VALUES(1,1,'Platform Admin','admin@bekatos.local',$1,'super_admin')",
    [hashPassword("Demo2026!")],
  );

  // Create a tenant on free tier with a customer user
  const freeTenant = (
    await db.query(
      "INSERT INTO tenants(name, slug, plan_tier, status, agent_limit, customer_org_limit, monthly_ticket_limit, storage_limit_mb) VALUES('Free Org', 'free-org', 'free', 'active', 1, 3, 25, 500) RETURNING id",
    )
  ).rows[0];

  const freeCustOrg = (
    await db.query(
      "INSERT INTO organizations(name, kind, tenant_id) VALUES('Free Customer Co', 'customer', $1) RETURNING id",
      [freeTenant.id],
    )
  ).rows[0];

  await db.query(
    "INSERT INTO users(tenant_id, org_id, name, email, password_hash, system_role) VALUES($1, $2, 'Free User', 'free@user.local', $3, 'member')",
    [freeTenant.id, freeCustOrg.id, hashPassword("Demo2026!")],
  );

  app = await createApp(db);
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();

  for (const [role, email] of Object.entries({
    admin: "admin@bekatos.local", // enterprise tier
    customer: "musteri@yargici.demo", // enterprise tier (tenant 1)
    dealer: "bayi@verimsoft.demo",
    freeUser: "free@user.local", // free tier
  })) {
    cookies[role] = (
      await req(null, "/api/login", { body: { email, password: "Demo2026!" } })
    ).cookie;
  }
});

after(async () => {
  await app?.close();
});

test("Realtime status returns tier entitlement info", async () => {
  const adminStatus = await req("admin", "/api/realtime/status");
  assert.equal(adminStatus.status, 200);
  assert.equal(adminStatus.data.is_premium, true);
  assert.equal(adminStatus.data.plan_tier, "enterprise");

  const freeStatus = await req("freeUser", "/api/realtime/status");
  assert.equal(freeStatus.status, 200);
  assert.equal(freeStatus.data.is_premium, false);
  assert.equal(freeStatus.data.plan_tier, "free");
});

test("Free tier is gated with 403 Forbidden on SSE stream", async () => {
  const res = await req("freeUser", "/api/realtime/stream");
  assert.equal(res.status, 403);
  assert.equal(res.data.error, "premium_feature_required");
  assert.equal(res.data.required_tier, "pro");
});

test("Premium (Enterprise/Pro) tier connects to SSE stream and receives events", async () => {
  // Connect to SSE stream using native fetch with stream response
  const controller = new AbortController();
  const streamRes = await fetch(base + "/api/realtime/stream", {
    headers: {
      Cookie: cookies.admin || "",
    },
    signal: controller.signal,
  });

  assert.equal(streamRes.status, 200);
  assert.equal(streamRes.headers.get("content-type"), "text/event-stream");

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();

  // Read initial handshake chunk
  const { value: initialChunk } = await reader.read();
  const initialText = decoder.decode(initialChunk);
  assert.ok(initialText.includes("event: connected"));
  assert.ok(initialText.includes('"connected":true'));

  // Trigger ticket creation in the same tenant
  const createPromise = req("customer", "/api/tickets", {
    body: {
      title: "Realtime Test Bilet Başlığı",
      description: "Anlık SSE bildirimi test ediliyor.",
      severity: "s2",
      type: "Hata",
    },
  });

  // Read broadcast chunk from SSE stream
  let ticketEventFound = false;
  const readChunks = async () => {
    while (!ticketEventFound) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      if (text.includes("event: ticket:created") && text.includes("Realtime Test Bilet Başlığı")) {
        ticketEventFound = true;
        break;
      }
    }
  };

  await Promise.all([createPromise, readChunks()]);
  assert.ok(ticketEventFound, "Expected to receive ticket:created event via SSE stream");

  // Close stream
  controller.abort();
});
