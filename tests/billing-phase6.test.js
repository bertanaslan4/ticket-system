import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";

function makeStripeSignature(secret, rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const payload = `${timestamp}.${typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

test("Stripe Web Checkout, Customer Portal, Webhook lifecycle & Idempotency (Faz 6)", async (t) => {
  const webhookSecret = "whsec_test_secret_for_phase_6_stripe";
  process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  t.after(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  const db = await openDb({ url: null, dir: ":memory:" });
  await seed(db);
  const app = await createApp(db);
  await app.listen(0, "127.0.0.1");
  const baseUrl = await app.getUrl();
  const ctx = { db, url: baseUrl };
  t.after(() => app.close());

  // 1. Create a workspace with a verified super admin
  const signupRes = await fetch(ctx.url + "/api/public/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client": "mobile",
    },
    body: JSON.stringify({
      company_name: "Stripe Cloud Solutions",
      admin_name: "SaaS Kurucu",
      email: "kurucu@stripecloud.io",
      password: "Password123!",
      industry_template: "it_software",
    }),
  });
  assert.equal(signupRes.status, 200);
  const signup = await signupRes.json();
  const token = signup.token;
  const tenantId = signup.tenant.id;

  // Verify email in database so purchases/checkout are permitted
  await db.query("UPDATE users SET email_verified_at = now() WHERE email=$1", [
    "kurucu@stripecloud.io",
  ]);

  // 2. Stripe Checkout Session creation
  const checkoutRes = await fetch(ctx.url + "/api/billing/stripe/checkout", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      product_id: "bekatos_starter_monthly",
    }),
  });
  assert.equal(checkoutRes.status, 200);
  const checkoutData = await checkoutRes.json();
  assert.equal(checkoutData.ok, true);
  assert.ok(checkoutData.session_id);
  assert.ok(checkoutData.url);

  // Non-existent product fails
  const badCheckout = await fetch(ctx.url + "/api/billing/stripe/checkout", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      product_id: "unknown_plan_xyz",
    }),
  });
  assert.equal(badCheckout.status, 400);

  // 3. Customer Portal session requires active stripe_customer_id
  const portalBefore = await fetch(ctx.url + "/api/billing/stripe/portal", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({}),
  });
  assert.equal(portalBefore.status, 400);
  const portalBeforeData = await portalBefore.json();
  assert.equal(portalBeforeData.errorKey, "no_active_stripe_customer");

  // 4. Webhook: checkout.session.completed
  const eventCheckout = {
    id: "evt_checkout_completed_001",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_session_123",
        client_reference_id: `tenant_${tenantId}`,
        customer: "cus_stripe_123456",
        subscription: "sub_stripe_789012",
        metadata: {
          tenant_id: String(tenantId),
          product_id: "bekatos_starter_monthly",
        },
      },
    },
  };
  const body1 = JSON.stringify(eventCheckout);
  const sig1 = makeStripeSignature(webhookSecret, body1);

  const hook1 = await fetch(ctx.url + "/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": sig1,
    },
    body: body1,
  });
  assert.equal(hook1.status, 200);
  const hook1Data = await hook1.json();
  assert.equal(hook1Data.ok, true);
  assert.equal(hook1Data.tenant_id, tenantId);

  // Verify workspace was upgraded to Starter
  const catRes = await fetch(ctx.url + "/api/billing/catalog", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(catRes.status, 200);
  const catData = await catRes.json();
  assert.equal(catData.tenant.plan_tier, "starter");
  assert.equal(catData.tenant.agent_limit, 5);
  assert.equal(catData.tenant.stripe_customer_id, "cus_stripe_123456");
  assert.equal(catData.tenant.stripe_subscription_id, "sub_stripe_789012");
  assert.equal(catData.tenant.has_stripe_subscription, true);
  assert.equal(catData.tenant.cancel_at_period_end, false);

  // 5. Customer Portal session succeeds now that customer_id exists
  const portalAfter = await fetch(ctx.url + "/api/billing/stripe/portal", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({}),
  });
  assert.equal(portalAfter.status, 200);
  const portalAfterData = await portalAfter.json();
  assert.equal(portalAfterData.ok, true);
  assert.ok(portalAfterData.url);

  // 6. Webhook Idempotency: replay of same event does not re-mutate
  const hookReplay = await fetch(ctx.url + "/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": sig1,
    },
    body: body1,
  });
  assert.equal(hookReplay.status, 200);
  const replayData = await hookReplay.json();
  assert.equal(replayData.ok, true);
  assert.equal(replayData.duplicate, true);

  // 7. Webhook: customer.subscription.updated (e.g. user set cancel_at_period_end)
  const eventUpdate = {
    id: "evt_sub_updated_002",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_stripe_789012",
        status: "active",
        cancel_at_period_end: true,
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 20,
      },
    },
  };
  const body2 = JSON.stringify(eventUpdate);
  const sig2 = makeStripeSignature(webhookSecret, body2);

  const hook2 = await fetch(ctx.url + "/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": sig2,
    },
    body: body2,
  });
  assert.equal(hook2.status, 200);

  const catRes2 = await fetch(ctx.url + "/api/billing/catalog", {
    headers: { authorization: `Bearer ${token}` },
  });
  const catData2 = await catRes2.json();
  assert.equal(catData2.tenant.cancel_at_period_end, true);

  // 8. Webhook: invoice.payment_failed marks workspace status as past_due
  const eventFailed = {
    id: "evt_inv_failed_003",
    type: "invoice.payment_failed",
    data: {
      object: {
        id: "in_stripe_failed_123",
        subscription: "sub_stripe_789012",
      },
    },
  };
  const body3 = JSON.stringify(eventFailed);
  const sig3 = makeStripeSignature(webhookSecret, body3);

  const hook3 = await fetch(ctx.url + "/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": sig3,
    },
    body: body3,
  });
  assert.equal(hook3.status, 200);

  const tenantRowFailed = (
    await db.query("SELECT status FROM tenants WHERE id=$1", [tenantId])
  ).rows[0];
  assert.equal(tenantRowFailed.status, "past_due");

  // 9. Webhook: invoice.payment_succeeded restores workspace status to active
  const eventSuccess = {
    id: "evt_inv_success_004",
    type: "invoice.payment_succeeded",
    data: {
      object: {
        id: "in_stripe_success_123",
        subscription: "sub_stripe_789012",
      },
    },
  };
  const body4 = JSON.stringify(eventSuccess);
  const sig4 = makeStripeSignature(webhookSecret, body4);

  const hook4 = await fetch(ctx.url + "/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": sig4,
    },
    body: body4,
  });
  assert.equal(hook4.status, 200);

  const tenantRowActive = (
    await db.query("SELECT status FROM tenants WHERE id=$1", [tenantId])
  ).rows[0];
  assert.equal(tenantRowActive.status, "active");

  // 10. Webhook: customer.subscription.deleted downgrades to Free
  const eventDeleted = {
    id: "evt_sub_deleted_005",
    type: "customer.subscription.deleted",
    data: {
      object: {
        id: "sub_stripe_789012",
        status: "canceled",
      },
    },
  };
  const body5 = JSON.stringify(eventDeleted);
  const sig5 = makeStripeSignature(webhookSecret, body5);

  const hook5 = await fetch(ctx.url + "/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": sig5,
    },
    body: body5,
  });
  assert.equal(hook5.status, 200);

  const catResEnd = await fetch(ctx.url + "/api/billing/catalog", {
    headers: { authorization: `Bearer ${token}` },
  });
  const catDataEnd = await catResEnd.json();
  assert.equal(catDataEnd.tenant.plan_tier, "free");
  assert.equal(catDataEnd.tenant.agent_limit, 1);
  assert.equal(catDataEnd.tenant.customer_org_limit, 3);
  assert.equal(catDataEnd.tenant.monthly_ticket_limit, 25);
  assert.equal(catDataEnd.tenant.has_stripe_subscription, false);

  // 11. Security: invalid Stripe signature rejected
  const fakeSig = `t=${Math.floor(Date.now() / 1000)},v1=invalid_fake_hmac_hex`;
  const badHook = await fetch(ctx.url + "/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": fakeSig,
    },
    body: JSON.stringify({ type: "ping" }),
  });
  assert.equal(badHook.status, 400);

  // 12. Security: expired Stripe signature rejected (> 300s in the past)
  const expiredTimestamp = Math.floor(Date.now() / 1000) - 400;
  const expiredSig = makeStripeSignature(webhookSecret, body1, expiredTimestamp);
  const expiredHook = await fetch(ctx.url + "/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": expiredSig,
    },
    body: body1,
  });
  assert.equal(expiredHook.status, 400);
});
