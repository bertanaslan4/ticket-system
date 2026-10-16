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
      await req(null, "/api/login", { body: { email, password: "Demo2026!" } })
    ).cookie;
  }
});

after(async () => {
  await app?.close();
});

test("Non-admin roles cannot access or manage automation rules", async () => {
  const custRes = await req("customer", "/api/automations");
  assert.equal(custRes.status, 403);

  const dealerRes = await req("dealer", "/api/automations");
  assert.equal(dealerRes.status, 403);
});

test("Admin can CRUD automation rules", async () => {
  // 1. Create rule
  const createRes = await req("admin", "/api/automations", {
    body: {
      name: "Acil POS Hatalarını S1 Yap",
      description: "Kasada acil ve kilitlenme geçen biletleri S1 seviyesine eskale et",
      trigger_event: "ticket.created",
      conditions: [{ field: "title", operator: "contains", value: "acil" }],
      actions: [
        { type: "set_severity", value: "s1" },
        { type: "add_internal_note", text: "Acil talep otomasyon tarafından S1 yapıldı." },
      ],
      is_active: true,
    },
  });

  assert.equal(createRes.status, 200);
  assert.ok(createRes.data.id);
  assert.equal(createRes.data.name, "Acil POS Hatalarını S1 Yap");
  const ruleId = createRes.data.id;

  // 2. List rules
  const listRes = await req("admin", "/api/automations");
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.data));
  assert.ok(listRes.data.some((r) => r.id === ruleId));

  // 3. Update rule
  const updateRes = await req("admin", `/api/automations/${ruleId}`, {
    method: "PUT",
    body: {
      name: "Acil ve Kilitlenme Hatalarını S1 Yap",
      description: "Güncellenmiş açıklama",
      trigger_event: "ticket.created",
      conditions: [{ field: "title", operator: "contains", value: "acil" }],
      actions: [{ type: "set_severity", value: "s1" }],
      is_active: true,
    },
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.data.name, "Acil ve Kilitlenme Hatalarını S1 Yap");

  // 4. Toggle rule active state
  const toggleRes = await req("admin", `/api/automations/${ruleId}/toggle`, {
    method: "PATCH",
    body: { is_active: false },
  });
  assert.equal(toggleRes.status, 200);
  assert.equal(toggleRes.data.is_active, false);

  // Re-enable for execution tests
  await req("admin", `/api/automations/${ruleId}/toggle`, {
    method: "PATCH",
    body: { is_active: true },
  });
});

test("Rule simulation endpoint accurately evaluates conditions and planned actions", async () => {
  const simRes = await req("admin", "/api/automations/test", {
    body: {
      rule: {
        trigger_event: "ticket.created",
        conditions: [
          { field: "title", operator: "contains", value: "pos" },
          { field: "severity", operator: "equals", value: "s2" },
        ],
        actions: [{ type: "set_severity", value: "s1" }],
      },
      sample_ticket: {
        title: "Kasada POS arızası oluştu",
        severity: "s2",
      },
    },
  });

  assert.equal(simRes.status, 200);
  assert.equal(simRes.data.matched, true);
  assert.equal(simRes.data.plannedActions.length, 1);
  assert.equal(simRes.data.plannedActions[0].type, "set_severity");

  // Non-matching sample
  const nonMatchRes = await req("admin", "/api/automations/test", {
    body: {
      rule: {
        trigger_event: "ticket.created",
        conditions: [{ field: "title", operator: "contains", value: "yazıcı" }],
        actions: [{ type: "set_severity", value: "s1" }],
      },
      sample_ticket: {
        title: "Kasada POS arızası oluştu",
      },
    },
  });

  assert.equal(nonMatchRes.status, 200);
  assert.equal(nonMatchRes.data.matched, false);
  assert.equal(nonMatchRes.data.plannedActions.length, 0);
});

test("Automation rule triggers on ticket creation, mutates severity, and logs execution", async () => {
  // Create rule that sets severity to S1 and adds an internal note when title contains "yangın"
  const rule = await req("admin", "/api/automations", {
    body: {
      name: "Acil Sistem Kilitlenmesi",
      trigger_event: "ticket.created",
      conditions: [{ field: "title", operator: "contains", value: "yangın" }],
      actions: [
        { type: "set_severity", value: "s1" },
        { type: "add_internal_note", text: "Acil yangın kelimesi tespit edildi, S1 önceliğe çekildi." },
      ],
      is_active: true,
    },
  });
  assert.equal(rule.status, 200);
  const ruleId = rule.data.id;

  // Customer creates ticket with S3 and title containing "yangın"
  const ticketRes = await req("customer", "/api/tickets", {
    body: {
      title: "Sunucu odasında yangın alarmı ve kilitlenme",
      description: "Tüm sistemler durdu acil müdahale lütfen.",
      severity: "s3",
      type: "Hata",
    },
  });
  assert.equal(ticketRes.status, 201);
  const ticketId = ticketRes.data.id;

  // Verify ticket severity in database was mutated to S1 by the automation rule
  const dbTicket = (
    await db.query("SELECT severity FROM tickets WHERE id=$1", [ticketId])
  ).rows[0];
  assert.equal(dbTicket.severity, "s1");

  // Verify internal note was inserted
  const events = (
    await db.query("SELECT * FROM events WHERE ticket_id=$1 AND kind='comment' AND visibility='internal'", [ticketId])
  ).rows;
  assert.ok(events.length > 0);
  assert.ok(events.some((e) => e.body.includes("yangın kelimesi tespit edildi")));

  // Verify rule execution count incremented
  const updatedRule = (
    await db.query("SELECT execution_count FROM automation_rules WHERE id=$1", [ruleId])
  ).rows[0];
  assert.ok(updatedRule.execution_count >= 1);

  // Verify execution logs endpoint
  const logsRes = await req("admin", "/api/automations/logs");
  assert.equal(logsRes.status, 200);
  assert.ok(Array.isArray(logsRes.data));
  assert.ok(logsRes.data.some((l) => l.rule_id === ruleId && l.ticket_id === ticketId));
});
