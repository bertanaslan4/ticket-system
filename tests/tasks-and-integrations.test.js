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
      Cookie: cookies[role] || "",
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

test("Customer cannot access internal tasks", async () => {
  const listRes = await req("customer", "/api/tasks");
  assert.equal(listRes.status, 403);

  const createRes = await req("customer", "/api/tasks", {
    body: { title: "Gizli teknik görev" },
  });
  assert.equal(createRes.status, 403);
});

test("Staff can create, list, and move tasks across Kanban columns", async () => {
  // Create task by contractor
  const created = await req("contractor", "/api/tasks", {
    body: {
      title: "Veritabanı İndeksleme ve Optimizasyon",
      description: "Sorgu performansını artırmak için indeks eklenmeli.",
      priority: "high",
      status: "todo",
      estimated_minutes: 120,
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.title, "Veritabanı İndeksleme ve Optimizasyon");
  assert.ok(created.data.task_number.startsWith("TSK-"));
  assert.equal(created.data.status, "todo");
  assert.equal(created.data.priority, "high");

  const taskId = created.data.id;

  // Move status: todo -> in_progress
  const moved = await req("contractor", `/api/tasks/${taskId}/status`, {
    method: "PATCH",
    body: { status: "in_progress" },
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.data.status, "in_progress");

  // Move status: in_progress -> done
  const doneRes = await req("dealer", `/api/tasks/${taskId}/status`, {
    method: "PATCH",
    body: { status: "done" },
  });
  assert.equal(doneRes.status, 200);
  assert.equal(doneRes.data.status, "done");

  // List tasks and verify total
  const list = await req("admin", "/api/tasks");
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.data));
  const found = list.data.find((t) => t.id === taskId);
  assert.ok(found);
  assert.equal(found.status, "done");
});

test("Worklogs can be logged and aggregate total minutes spent", async () => {
  const taskRes = await req("contractor", "/api/tasks", {
    body: {
      title: "API Entegrasyon Testleri",
      priority: "medium",
      status: "in_progress",
    },
  });
  const taskId = taskRes.data.id;

  // Log 45 minutes
  const log1 = await req("contractor", `/api/tasks/${taskId}/worklogs`, {
    body: { minutes_spent: 45, description: "Birim testleri yazıldı" },
  });
  assert.equal(log1.status, 201);
  assert.equal(log1.data.minutes_spent, 45);

  // Log 30 minutes
  const log2 = await req("dealer", `/api/tasks/${taskId}/worklogs`, {
    body: { minutes_spent: 30, description: "Entegrasyon testleri çalıştırıldı" },
  });
  assert.equal(log2.status, 201);
  assert.equal(log2.data.minutes_spent, 30);

  // Fetch task detail and verify aggregated total
  const detail = await req("contractor", `/api/tasks/${taskId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.total_logged_minutes, 75);
  assert.equal(detail.data.worklogs.length, 2);
});

test("Tenant custom SMTP settings can be saved and encrypted password is not exposed", async () => {
  // Only super admin can manage integrations
  const nonAdmin = await req("contractor", "/api/admin/integrations/smtp");
  assert.equal(nonAdmin.status, 403);

  // Admin saves custom SMTP
  const saveRes = await req("admin", "/api/admin/integrations/smtp", {
    body: {
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      user: "destek@kurumsal.com",
      password: "SuperSecretPassword123!",
      from_name: "Kurumsal Destek",
      from_email: "destek@kurumsal.com",
    },
  });
  assert.equal(saveRes.status, 201);
  assert.equal(saveRes.data.host, "smtp.office365.com");
  assert.equal(saveRes.data.port, 587);
  assert.equal(saveRes.data.from_name, "Kurumsal Destek");
  assert.equal(saveRes.data.has_password, true);
  // Password itself must NEVER be returned in plaintext
  assert.equal(saveRes.data.password, undefined);
  assert.equal(saveRes.data.smtp_pass_encrypted, undefined);
});

test("Teams and Slack webhooks can be saved and validated", async () => {
  const saveRes = await req("admin", "/api/admin/integrations/webhooks", {
    body: {
      webhook_teams_url: "https://outlook.office.com/webhook/test-token",
      webhook_slack_url: "https://hooks.slack.com/services/test/token",
      webhook_events: "ticket.created,ticket.closed",
    },
  });
  assert.equal(saveRes.status, 201);
  assert.equal(saveRes.data.webhook_teams_url, "https://outlook.office.com/webhook/test-token");
  assert.equal(saveRes.data.webhook_events, "ticket.created,ticket.closed");
});
