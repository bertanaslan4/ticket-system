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

  // Seed sample KB article to test suggestion matching
  await db.query(
    `INSERT INTO knowledge_base (tenant_id, title, slug, content, category, is_public)
     VALUES (1, 'POS ve Barkod Okuyucu Arıza Çözümleri', 'pos-barkod-cozum', 'POS cihazı ve barkod okuyucu bağlantısı koptuğunda USB portunu ve sürücüyü kontrol edin.', 'donanim', true)`,
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

test("AI Triaging analyzes critical error tickets accurately", async () => {
  const res = await req("dealer", "/api/ai/triage", {
    body: {
      title: "Kritik POS cihazı çöktü ve veritabanı kilitlendi acil",
      description: "Kasada satış yapılamıyor, acil destek rica ediyoruz. Sistem 504 hatası veriyor ve veritabanı yanıt vermiyor.",
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.data.suggested_severity, "s1");
  assert.equal(res.data.suggested_type, "Hata");
  assert.ok(res.data.urgency_score >= 70);
  assert.ok(["urgent", "negative"].includes(res.data.sentiment));
  assert.ok(Array.isArray(res.data.tags));
  assert.ok(res.data.tags.some((t) => t.toLowerCase().includes("pos") || t.toLowerCase().includes("veritabanı")));
  assert.ok(res.data.summary && res.data.summary.length > 5);
  assert.ok(Array.isArray(res.data.suggested_articles));
  assert.ok(res.data.suggested_articles.length > 0);
  assert.equal(res.data.suggested_articles[0].slug, "pos-barkod-cozum");
});

test("AI Triaging identifies non-urgent feature requests", async () => {
  const res = await req("dealer", "/api/ai/triage", {
    body: {
      title: "Raporlama ekranına excel dışa aktarımı eklemek istiyoruz",
      description: "Yeni bir özellik geliştirmesi olarak haftalık satış raporunu xlsx formatında indirmek faydalı olacaktır.",
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.data.suggested_severity, "s3");
  assert.equal(res.data.suggested_type, "İstek");
  assert.ok(res.data.urgency_score < 40);
  assert.ok(["neutral", "positive"].includes(res.data.sentiment));
  assert.ok(res.data.tags.some((t) => t.toLowerCase().includes("rapor")));
});

test("Staff can generate contextual AI drafts, but customer is blocked", async () => {
  // 1. Create a test ticket
  const ticketRes = await req("customer", "/api/tickets", {
    body: {
      title: "Barkod okuyucu USB bağlantısı kesiliyor",
      description: "Barkod okuyucu 10 dakikada bir kopuyor, satışı durduruyor.",
      severity: "s2",
      type: "Hata",
    },
  });
  assert.equal(ticketRes.status, 201);
  const ticketId = ticketRes.data.id;

  // 2. Customer attempts to generate AI draft -> 403 Forbidden
  const custDraftRes = await req("customer", "/api/ai/draft", {
    body: { ticket_id: ticketId, type: "solution" },
  });
  assert.equal(custDraftRes.status, 403);

  // 3. Dealer (staff) generates draft -> 200 OK
  const staffDraftRes = await req("dealer", "/api/ai/draft", {
    body: { ticket_id: ticketId, type: "solution", tone: "professional" },
  });
  assert.equal(staffDraftRes.status, 200);
  assert.ok(staffDraftRes.data.draft);
  assert.ok(staffDraftRes.data.draft.includes("Barkod okuyucu"));
  assert.equal(staffDraftRes.data.type, "solution");

  // 4. Generate first_response draft
  const firstRes = await req("contractor", "/api/ai/draft", {
    body: { ticket_id: ticketId, type: "first_response", tone: "friendly" },
  });
  assert.equal(firstRes.status, 200);
  assert.ok(firstRes.data.draft.includes("talebinizi aldık") || firstRes.data.draft.includes("incelemeye"));
});

test("Ticket creation auto-populates AI triage metadata on ticket", async () => {
  const newTicket = await req("customer", "/api/tickets", {
    body: {
      title: "Kasa POS barkod okuyucu arızası acil destek",
      description: "Sistem kilitlendi, işlem yapılamıyor acil müdahale lütfen.",
      severity: "s3", // User sets s3, but AI suggests s1
      type: "Hata",
    },
  });
  assert.equal(newTicket.status, 201);
  const ticketId = newTicket.data.id;

  // Query database directly to verify stored AI triage fields
  const dbTicket = (
    await db.query(
      "SELECT ai_suggested_severity, ai_sentiment, ai_summary, ai_tags FROM tickets WHERE id=$1",
      [ticketId],
    )
  ).rows[0];

  assert.ok(dbTicket);
  assert.equal(dbTicket.ai_suggested_severity, "s1");
  assert.ok(["urgent", "negative"].includes(dbTicket.ai_sentiment));
  assert.ok(dbTicket.ai_summary);
  assert.ok(dbTicket.ai_tags);
});

test("Admin can view and update AI Copilot tenant settings", async () => {
  // 1. Get current config
  const getRes = await req("admin", "/api/ai/config");
  assert.equal(getRes.status, 200);
  assert.equal(typeof getRes.data.ai_copilot_enabled, "boolean");

  // 2. Customer cannot update config
  const forbidRes = await req("customer", "/api/ai/config", {
    body: { ai_copilot_enabled: false, ai_tone: "concise" },
  });
  assert.equal(forbidRes.status, 403);

  // 3. Admin updates config
  const updateRes = await req("admin", "/api/ai/config", {
    body: { ai_copilot_enabled: true, ai_auto_triage: true, ai_tone: "concise" },
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.data.ai_tone, "concise");

  // 4. Verify config reflects update
  const getUpdated = await req("admin", "/api/ai/config");
  assert.equal(getUpdated.data.ai_tone, "concise");
});
