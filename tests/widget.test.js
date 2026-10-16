import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";

let db, app, base;

before(async () => {
  db = await openDb({ url: null, dir: ":memory:" });
  await seed(db);

  // Add sample public KB article
  await db.query(
    `INSERT INTO knowledge_base (tenant_id, title, slug, content, category, is_public)
     VALUES (1, 'POS Entegrasyon Kılavuzu', 'pos-entegrasyon-kilavuzu', 'Kasa pos entegrasyonu için IP ve port ayarları yapılmalıdır.', 'entegrasyon', true)`,
  );

  app = await createApp(db);
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});

after(async () => {
  await app?.close();
});

test("Public widget config endpoint returns branding and allows CORS", async () => {
  // Test CORS preflight
  const optRes = await fetch(base + "/api/widget/config?tenant=1", {
    method: "OPTIONS",
    headers: { Origin: "https://external-client-site.com" },
  });
  assert.equal(optRes.status, 204);
  assert.equal(optRes.headers.get("access-control-allow-origin"), "*");

  // Test GET config
  const res = await fetch(base + "/api/widget/config?tenant=1", {
    headers: { Origin: "https://external-client-site.com" },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.tenant_id, 1);
  assert.equal(data.title, "Canlı Destek");
  assert.equal(data.color, "#3b4cb8");
  assert.ok(data.greeting);
});

test("Public widget KB search returns matching articles", async () => {
  const res = await fetch(base + "/api/widget/kb?tenant=1&q=entegrasyon");
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
  assert.equal(data.length, 1);
  assert.equal(data[0].title, "POS Entegrasyon Kılavuzu");
  assert.ok(data[0].snippet.includes("Kasa pos"));
});

test("Website visitor can create a ticket via widget and track its status", async () => {
  // 1. Visitor submits ticket from external site
  const createRes = await fetch(base + "/api/widget/tickets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://ecommerce-store.example",
    },
    body: JSON.stringify({
      tenant: "1",
      name: "Zeynep Kaya",
      email: "zeynep.kaya@musteri.com",
      title: "Ödeme sayfasında 3D Secure hatası alıyorum",
      description: "Müşteriler kart bilgilerini girdikten sonra onay ekranı gelmeden sayfa beyaz kalıyor.",
      priority: "s1",
    }),
  });

  assert.equal(createRes.status, 201);
  const createData = await createRes.json();
  assert.equal(createData.ok, true);
  assert.ok(createData.ticket_id > 0);
  assert.ok(createData.ticket_number.startsWith("TK-"));
  assert.equal(createData.severity, "s1");

  const ticketId = createData.ticket_id;
  const ticketNum = createData.ticket_number;

  // Verify in DB that SLA was attached
  const dbTicket = (
    await db.query("SELECT * FROM tickets WHERE id = $1", [ticketId])
  ).rows[0];
  assert.ok(dbTicket);
  assert.equal(dbTicket.program, "Web Widget");
  assert.ok(dbTicket.sla_resolution_due_at);

  // 2. Visitor tracks status with correct email
  const trackRes = await fetch(
    `${base}/api/widget/track?tenant=1&number=${ticketNum}&email=zeynep.kaya@musteri.com`,
  );
  assert.equal(trackRes.status, 200);
  const trackData = await trackRes.json();
  assert.equal(trackData.ticket_id, ticketId);
  assert.equal(trackData.ticket_number, ticketNum);
  assert.equal(trackData.status, "open");
  assert.equal(trackData.severity, "s1");
  assert.ok(Array.isArray(trackData.timeline));

  // 3. Unauthorized tracking with wrong email fails
  const wrongEmailRes = await fetch(
    `${base}/api/widget/track?tenant=1&number=${ticketNum}&email=wrong.person@musteri.com`,
  );
  assert.equal(wrongEmailRes.status, 403);
});
