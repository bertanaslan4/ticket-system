import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";

test("self-service workspace signup, invite code join, free tier quotas, IAP upgrades, and RevenueCat webhooks", async (t) => {
  const db = await openDb({ url: null, dir: ":memory:" });
  await seed(db);
  const app = await createApp(db);
  await app.listen(0, "127.0.0.1");
  const baseUrl = await app.getUrl();
  const ctx = { db, url: baseUrl };
  t.after(() => app.close());

  // 1. Self-service signup creates a Free tier workspace in 1 step
  const signupRes = await fetch(ctx.url + "/api/public/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client": "mobile",
    },
    body: JSON.stringify({
      company_name: "Nova Teknik Servis",
      admin_name: "Emre Kaya",
      email: "emre@novaservis.io",
      password: "Password123!",
      industry_template: "field_service",
    }),
  });
  assert.equal(signupRes.status, 200);
  const signupData = await signupRes.json();
  assert.equal(signupData.ok, true);
  assert.ok(signupData.token);
  assert.equal(signupData.tenant.plan_tier, "free");
  assert.equal(signupData.tenant.agent_limit, 1);
  assert.equal(signupData.tenant.customer_org_limit, 3);
  assert.equal(signupData.tenant.monthly_ticket_limit, 25);
  assert.match(signupData.tenant.invite_code, /^BKT-[A-Z0-9]{4}$/);

  const adminToken = signupData.token;
  const inviteCode = signupData.tenant.invite_code;
  const tenantId = signupData.tenant.id;

  // Verify industry template products were created
  const productsRes = await fetch(ctx.url + "/api/admin/products", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(productsRes.status, 200);
  const products = await productsRes.json();
  assert.equal(products.length, 2);

  // 2. Customer joins via invite_code (2nd and 3rd customer orgs succeed; 1st was starter portal)
  const join1 = await fetch(ctx.url + "/api/public/join", {
    method: "POST",
    headers: { "content-type": "application/json", "x-client": "mobile" },
    body: JSON.stringify({
      invite_code: inviteCode,
      name: "Müşteri Bir",
      email: "m1@musteri1.com",
      password: "Password123!",
      company_name: "Müşteri Firma 1",
    }),
  });
  assert.equal(join1.status, 200);
  const join1Data = await join1.json();
  assert.ok(join1Data.token);

  const join2 = await fetch(ctx.url + "/api/public/join", {
    method: "POST",
    headers: { "content-type": "application/json", "x-client": "mobile" },
    body: JSON.stringify({
      invite_code: inviteCode,
      name: "Müşteri İki",
      email: "m2@musteri2.com",
      password: "Password123!",
      company_name: "Müşteri Firma 2",
    }),
  });
  assert.equal(join2.status, 200);

  // 4th customer company on Free tier (limit = 3) must be blocked with 403
  const join3Blocked = await fetch(ctx.url + "/api/public/join", {
    method: "POST",
    headers: { "content-type": "application/json", "x-client": "mobile" },
    body: JSON.stringify({
      invite_code: inviteCode,
      name: "Müşteri Üç",
      email: "m3@musteri3.com",
      password: "Password123!",
      company_name: "Müşteri Firma 3 Limit Aşımı",
    }),
  });
  assert.equal(join3Blocked.status, 403);
  const join3Err = await join3Blocked.json();
  assert.equal(join3Err.errorKey, "customer_org_limit_reached");

  // 3. Monthly ticket quota enforcement on Free tier
  await ctx.db.query(
    "UPDATE tenants SET monthly_ticket_limit = 1 WHERE id = $1",
    [tenantId],
  );
  const firstTicket = await fetch(ctx.url + "/api/tickets", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${join1Data.token}`,
    },
    body: JSON.stringify({
      title: "İlk ücretsiz talep",
      description: "Saha cihazı çalışmıyor",
      type: "Hata",
      severity: "s2",
    }),
  });
  assert.equal(firstTicket.status, 201);

  const secondTicketBlocked = await fetch(ctx.url + "/api/tickets", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${join1Data.token}`,
    },
    body: JSON.stringify({
      title: "İkinci talep kota aşımı",
      description: "Aylık limit doldu",
      type: "Hata",
      severity: "s3",
    }),
  });
  assert.equal(secondTicketBlocked.status, 403);
  const ticketErr = await secondTicketBlocked.json();
  assert.equal(ticketErr.errorKey, "monthly_ticket_limit_reached");

  // 4. Check Billing Catalog & Purchase IAP Starter Plan + Add-on
  const catalogRes = await fetch(ctx.url + "/api/billing/catalog", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(catalogRes.status, 200);
  const catalog = await catalogRes.json();
  assert.equal(catalog.tenant.plan_tier, "free");
  assert.equal(catalog.plans.length, 3);
  assert.equal(catalog.addons.length, 2);

  // Upgrade to Starter via IAP
  const upgradeRes = await fetch(ctx.url + "/api/billing/purchase", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      product_id: "bekatos_starter_monthly",
      store: "app_store",
      transaction_id: " GPA.1001-STARTER ",
    }),
  });
  assert.equal(upgradeRes.status, 200);
  const upgradeData = await upgradeRes.json();
  assert.equal(upgradeData.tenant.plan_tier, "starter");
  assert.equal(upgradeData.tenant.agent_limit, 5);
  assert.equal(upgradeData.tenant.customer_org_limit, 50);

  // Duplicate transaction_id is rejected
  const dupRes = await fetch(ctx.url + "/api/billing/purchase", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      product_id: "bekatos_starter_monthly",
      store: "app_store",
      transaction_id: "GPA.1001-STARTER",
    }),
  });
  assert.equal(dupRes.status, 409);

  // Buy +5 agents add-on
  const addonRes = await fetch(ctx.url + "/api/billing/purchase", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      product_id: "bekatos_addon_5_agents",
      store: "app_store",
      transaction_id: "GPA.1002-ADDON-5",
    }),
  });
  assert.equal(addonRes.status, 200);
  const addonData = await addonRes.json();
  assert.equal(addonData.tenant.agent_limit, 10);

  // Now customer can create another ticket because Starter unlocked monthly_ticket_limit
  const unlockedTicket = await fetch(ctx.url + "/api/tickets", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${join1Data.token}`,
    },
    body: JSON.stringify({
      title: "Paket yükseltme sonrası talep",
      description: "Artık sınırsız talep açılabiliyor",
      type: "İstek",
      severity: "s3",
    }),
  });
  assert.equal(unlockedTicket.status, 201);

  // 5. RevenueCat Webhook lifecycle (RENEWAL -> Pro, EXPIRATION -> Free)
  const rcRenew = await fetch(ctx.url + "/api/webhooks/revenuecat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: {
        id: "rc-evt-pro-1",
        type: "RENEWAL",
        app_user_id: `tenant_${tenantId}`,
        product_id: "bekatos_pro_monthly",
        store: "PLAY_STORE",
        expiration_at_ms: Date.now() + 30 * 86400 * 1000,
      },
    }),
  });
  assert.equal(rcRenew.status, 200);

  const afterRenew = await fetch(ctx.url + "/api/billing/catalog", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const afterRenewCatalog = await afterRenew.json();
  assert.equal(afterRenewCatalog.tenant.plan_tier, "pro");
  assert.equal(afterRenewCatalog.tenant.agent_limit, 15);

  const rcExpire = await fetch(ctx.url + "/api/webhooks/revenuecat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: {
        id: "rc-evt-exp-1",
        type: "EXPIRATION",
        app_user_id: `tenant_${tenantId}`,
      },
    }),
  });
  assert.equal(rcExpire.status, 200);

  const afterExpire = await fetch(ctx.url + "/api/billing/catalog", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const afterExpireCatalog = await afterExpire.json();
  assert.equal(afterExpireCatalog.tenant.plan_tier, "free");
});
