import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";

test("Faz 7 & 8: Knowledge Base, Onboarding Wizard, Inbound Email, Health & Operational Metrics", async (t) => {
  const db = await openDb({ url: null, dir: ":memory:" });
  await seed(db);
  const app = await createApp(db);
  await app.listen(0, "127.0.0.1");
  const baseUrl = await app.getUrl();
  const ctx = { db, url: baseUrl };
  t.after(() => app.close());

  // 1. Create a workspace with a super admin
  const signupRes = await fetch(ctx.url + "/api/public/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client": "mobile",
    },
    body: JSON.stringify({
      company_name: "Tekno Destek A.Ş.",
      admin_name: "Ali Vural",
      email: "ali@teknodestek.io",
      password: "Password123!",
      industry_template: "field_service",
    }),
  });
  assert.equal(signupRes.status, 200);
  const signup = await signupRes.json();
  const adminToken = signup.token;
  const tenantId = signup.tenant.id;

  // Verify email in database
  await db.query("UPDATE users SET email_verified_at = now() WHERE email=$1", [
    "ali@teknodestek.io",
  ]);

  // Customer join
  const joinRes = await fetch(ctx.url + "/api/public/join", {
    method: "POST",
    headers: { "content-type": "application/json", "x-client": "mobile" },
    body: JSON.stringify({
      invite_code: signup.tenant.invite_code,
      name: "Müşteri Kullanıcı",
      email: "musteri@firma.io",
      password: "Password123!",
      company_name: "Müşteri Şirketi",
    }),
  });
  assert.equal(joinRes.status, 200);
  const customer = await joinRes.json();
  const customerToken = customer.token;

  // --- KNOWLEDGE BASE TESTS ---
  // 1. Customer cannot create an article (403)
  const custCreate = await fetch(ctx.url + "/api/admin/kb", {
    method: "POST",
    headers: {
      authorization: `Bearer ${customerToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Yetkisiz Makale",
      content: "Bu makale kaydedilmemeli",
    }),
  });
  assert.equal(custCreate.status, 403);

  // 2. Super admin creates article
  const adminCreate = await fetch(ctx.url + "/api/admin/kb", {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      title: "POS Cihazı Kurulum Rehberi",
      content: "POS cihazını kurmak için adımları takip edin: 1. Gücü bağlayın. 2. Ağı seçin.",
      category: "installation",
      is_public: true,
    }),
  });
  assert.equal(adminCreate.status, 200);
  const createdArticle = await adminCreate.json();
  assert.ok(createdArticle.id);
  assert.equal(createdArticle.title, "POS Cihazı Kurulum Rehberi");
  assert.equal(createdArticle.view_count, 0);

  // 3. Customer lists and searches articles
  const listRes = await fetch(ctx.url + "/api/kb?q=pos", {
    headers: { authorization: `Bearer ${customerToken}` },
  });
  assert.equal(listRes.status, 200);
  const searchResults = await listRes.json();
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].id, createdArticle.id);

  // 4. View single article and verify view_count increments
  const viewRes = await fetch(ctx.url + `/api/kb/${createdArticle.id}`, {
    headers: { authorization: `Bearer ${customerToken}` },
  });
  assert.equal(viewRes.status, 200);
  const viewed = await viewRes.json();
  assert.equal(viewed.id, createdArticle.id);
  assert.equal(viewed.view_count, 1);

  // 5. Super admin updates article
  const updateRes = await fetch(ctx.url + `/api/admin/kb/${createdArticle.id}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      title: "POS Cihazı Kurulum & Bakım Rehberi",
      content: "Güncellenmiş rehber içeriği...",
      category: "installation",
      is_public: true,
    }),
  });
  assert.equal(updateRes.status, 200);
  const updated = await updateRes.json();
  assert.equal(updated.title, "POS Cihazı Kurulum & Bakım Rehberi");

  // --- ONBOARDING WIZARD TESTS ---
  // 6. Super admin gets onboarding progress
  const obRes = await fetch(ctx.url + "/api/me/onboarding", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(obRes.status, 200);
  const obData = await obRes.json();
  assert.equal(obData.total_steps, 4);
  assert.ok(obData.steps.some((s) => s.id === "invite_customer" && s.completed));
  assert.equal(obData.dismissed, false);

  // 7. Super admin dismisses onboarding
  const dismissRes = await fetch(ctx.url + "/api/me/onboarding/dismiss", {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({}),
  });
  assert.equal(dismissRes.status, 200);

  const obResAfter = await fetch(ctx.url + "/api/me/onboarding", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const obDataAfter = await obResAfter.json();
  assert.equal(obDataAfter.dismissed, true);

  // --- INBOUND EMAIL WEBHOOK TESTS ---
  // 8. External mail system sends an inbound email
  const inboundRes = await fetch(ctx.url + "/api/webhooks/inbound-email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      from: "inbound_customer@firma.com",
      to: `destek+${signup.tenant.slug}@bekatos.app`,
      subject: "Cihaz ekranda hata veriyor",
      body: "Sabah açtığımızda error 500 yazısı belirdi, yardım rica ederiz.",
      tenant_slug: signup.tenant.slug,
    }),
  });
  assert.equal(inboundRes.status, 200);
  const inboundData = await inboundRes.json();
  assert.equal(inboundData.ok, true);
  assert.ok(inboundData.ticket_id);
  assert.equal(inboundData.tenant_id, tenantId);

  // Verify ticket was saved in database
  const ticketRow = (
    await db.query("SELECT * FROM tickets WHERE id=$1", [inboundData.ticket_id])
  ).rows[0];
  assert.equal(ticketRow.title, "Cihaz ekranda hata veriyor");
  assert.equal(ticketRow.status, "open");

  // --- HEALTH & OPERATIONAL METRICS TESTS (Faz 8) ---
  // 9. Public Health check
  const healthRes = await fetch(ctx.url + "/api/health?detailed=1");
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.equal(healthData.ok, true);
  assert.equal(healthData.status, "healthy");
  assert.equal(healthData.db, "connected");
  assert.ok(typeof healthData.latency_ms === "number");
  assert.ok(typeof healthData.uptime_seconds === "number");

  // 10. Operational Metrics for super admin
  const metricsRes = await fetch(ctx.url + "/api/admin/operations/metrics", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(metricsRes.status, 200);
  const metricsData = await metricsRes.json();
  assert.equal(metricsData.ok, true);
  assert.equal(metricsData.tenant_id, tenantId);
  assert.ok(Number(metricsData.tickets.total) >= 1);
  assert.ok(Number(metricsData.organizations.total) >= 2);
  assert.ok(Number(metricsData.users.total) >= 2);

  // Customer cannot view operational metrics (403)
  const custMetrics = await fetch(ctx.url + "/api/admin/operations/metrics", {
    headers: { authorization: `Bearer ${customerToken}` },
  });
  assert.equal(custMetrics.status, 403);

  // 11. Delete article
  const deleteRes = await fetch(ctx.url + `/api/admin/kb/${createdArticle.id}/delete`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({}),
  });
  assert.equal(deleteRes.status, 200);

  const checkDeleted = await fetch(ctx.url + `/api/kb/${createdArticle.id}`, {
    headers: { authorization: `Bearer ${customerToken}` },
  });
  assert.equal(checkDeleted.status, 404);
});
