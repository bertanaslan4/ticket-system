import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";

async function withApp(fn) {
  const db = await openDb({ url: null, dir: ":memory:" });
  await seed(db);
  const app = await createApp(db);
  await app.listen(0, "127.0.0.1");
  const url = await app.getUrl();
  const call = async (path, { token, body, method, headers } = {}) => {
    const res = await fetch(url + "/api" + path, {
      method: method || (body !== undefined ? "POST" : "GET"),
      headers: {
        "content-type": "application/json",
        "x-client": "mobile",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  try {
    await fn({ db, call });
  } finally {
    await app.close();
  }
}

const PASSWORD = "Password123!";
let counter = 0;
async function signup(call, name = "Nova") {
  counter += 1;
  const email = `owner${counter}@${name.toLowerCase()}-corp.io`;
  const res = await call("/public/signup", {
    body: {
      company_name: `${name} Servis ${counter}`,
      admin_name: "Emre Kaya",
      email,
      password: PASSWORD,
      industry_template: "software",
    },
  });
  assert.equal(res.status, 200);
  return { ...res.data, email };
}

async function mailLink(db, email, kind) {
  const row = (
    await db.query(
      "SELECT payload FROM auth_mail_outbox WHERE kind=$1 AND payload->'to'->>0=$2 ORDER BY id DESC LIMIT 1",
      [kind, email],
    )
  ).rows[0];
  return row?.payload.data.link;
}

async function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("Store webhook refuses to run unprotected in production and checks the shared secret", async () => {
  await withApp(async ({ call }) => {
    const event = (extra = {}) => ({
      event: {
        id: `evt-${Math.random()}`,
        type: "RENEWAL",
        app_user_id: "tenant_1",
        product_id: "bekatos_pro_monthly",
        ...extra,
      },
    });

    await withEnv(
      { NODE_ENV: "production", REVENUECAT_WEBHOOK_SECRET: undefined },
      async () => {
        const res = await call("/webhooks/revenuecat", { body: event() });
        assert.equal(res.status, 503);
        assert.equal(res.data.errorKey, "webhook_not_configured");
      },
    );

    await withEnv(
      { NODE_ENV: "production", REVENUECAT_WEBHOOK_SECRET: "s3cret-value" },
      async () => {
        const none = await call("/webhooks/revenuecat", { body: event() });
        assert.equal(none.status, 401);
        const wrong = await call("/webhooks/revenuecat", {
          body: event(),
          headers: { authorization: "Bearer not-the-secret" },
        });
        assert.equal(wrong.status, 401);
        const ok = await call("/webhooks/revenuecat", {
          body: event(),
          headers: { authorization: "Bearer s3cret-value" },
        });
        assert.equal(ok.status, 200);
        assert.equal(ok.data.event_type, "RENEWAL");
      },
    );
  });
});

test("Webhook events are idempotent, ordered by time and never map unknown products to paid plans", async () => {
  await withApp(async ({ db, call }) => {
    const ws = await signup(call);
    const tenantId = ws.tenant.id;
    const plan = async () =>
      (await db.query("SELECT plan_tier,status FROM tenants WHERE id=$1", [tenantId])).rows[0];
    const base = Date.now();
    const send = (type, id, offsetMs, extra = {}) =>
      call("/webhooks/revenuecat", {
        body: {
          event: {
            id,
            type,
            app_user_id: `tenant_${tenantId}`,
            event_timestamp_ms: base + offsetMs,
            ...extra,
          },
        },
      });

    const buy = await send("INITIAL_PURCHASE", "evt-1", 1000, {
      product_id: "bekatos_pro_monthly",
      store: "PLAY_STORE",
    });
    assert.equal(buy.status, 200);
    assert.equal((await plan()).plan_tier, "pro");
    const stored = (await db.query("SELECT store_provider FROM tenants WHERE id=$1", [tenantId])).rows[0];
    assert.equal(stored.store_provider, "play_store");

    const expired = await send("EXPIRATION", "evt-2", 3000);
    assert.equal(expired.status, 200);
    assert.equal((await plan()).plan_tier, "free");

    // Replaying the original purchase must not resurrect the paid plan.
    const replay = await send("INITIAL_PURCHASE", "evt-1", 1000, { product_id: "bekatos_pro_monthly" });
    assert.equal(replay.data.duplicate, true);
    assert.equal((await plan()).plan_tier, "free");

    // A different but older event is logged and ignored.
    const stale = await send("RENEWAL", "evt-3", 2000, { product_id: "bekatos_pro_monthly" });
    assert.equal(stale.data.ignored, "stale_event");
    assert.equal((await plan()).plan_tier, "free");

    // Unknown product ids are acknowledged but never upgrade the workspace.
    const unknown = await send("INITIAL_PURCHASE", "evt-4", 4000, { product_id: "something_else" });
    assert.equal(unknown.status, 200);
    assert.equal(unknown.data.ignored, "unknown_product");
    assert.equal((await plan()).plan_tier, "free");

    // Billing problems flag the workspace without removing access.
    await send("INITIAL_PURCHASE", "evt-5", 5000, { product_id: "bekatos_starter_monthly" });
    await send("BILLING_ISSUE", "evt-6", 6000);
    const flagged = await plan();
    assert.equal(flagged.plan_tier, "starter");
    assert.equal(flagged.status, "past_due");

    // A suspended workspace stays suspended even when the store reports a renewal.
    await db.query("UPDATE tenants SET status='suspended' WHERE id=$1", [tenantId]);
    await send("RENEWAL", "evt-7", 7000, { product_id: "bekatos_pro_monthly" });
    assert.equal((await plan()).status, "suspended");
  });
});

test("Client-reported purchases are disabled in production unless explicitly enabled", async () => {
  await withApp(async ({ db, call }) => {
    const ws = await signup(call);
    await db.query("UPDATE users SET email_verified_at=now() WHERE email=$1", [ws.email]);
    const buy = (id) =>
      call("/billing/purchase", {
        token: ws.token,
        body: { product_id: "bekatos_pro_monthly", store: "app_store", transaction_id: id },
      });

    await withEnv({ NODE_ENV: "production", BILLING_ALLOW_CLIENT_PURCHASES: undefined }, async () => {
      const blocked = await buy("TX-PROD-1");
      assert.equal(blocked.status, 403);
      assert.equal(blocked.data.errorKey, "client_purchases_disabled");
    });
    const unchanged = (await db.query("SELECT plan_tier FROM tenants WHERE id=$1", [ws.tenant.id])).rows[0];
    assert.equal(unchanged.plan_tier, "free");

    await withEnv({ NODE_ENV: "production", BILLING_ALLOW_CLIENT_PURCHASES: "true" }, async () => {
      assert.equal((await buy("TX-PROD-2")).status, 200);
    });
  });
});

test("Invite codes are random, hidden from customers, rotatable and brute force is rate limited", async () => {
  await withApp(async ({ db, call }) => {
    const legacy = (await db.query("SELECT invite_code FROM tenants WHERE id=1")).rows[0].invite_code;
    assert.doesNotMatch(legacy, /^BKT-[0-9]{4}$/);

    const a = await signup(call, "Alpha");
    const b = await signup(call, "Bravo");
    assert.match(a.tenant.invite_code, /^BKT-[A-Z2-9]{6}$/);
    assert.notEqual(a.tenant.invite_code, b.tenant.invite_code);

    const joined = await call("/public/join", {
      body: {
        invite_code: a.tenant.invite_code.toLowerCase(),
        name: "Müşteri Bir",
        email: "musteri@alpha-customer.io",
        password: PASSWORD,
        company_name: "Alpha Müşterisi",
      },
    });
    assert.equal(joined.status, 200);
    assert.equal(joined.data.tenant.invite_code, undefined);

    // Customers neither see the code in /me nor in the billing catalog.
    const customerMe = await call("/me", { token: joined.data.token });
    assert.equal(customerMe.data.invite_code, null);
    assert.equal(customerMe.data.email_verified, false);
    const customerCatalog = await call("/billing/catalog", { token: joined.data.token });
    assert.equal(customerCatalog.data.workspace.invite_code, undefined);
    assert.deepEqual(customerCatalog.data.transactions, []);
    const adminMe = await call("/me", { token: a.token });
    assert.equal(adminMe.data.invite_code, a.tenant.invite_code);

    // Only workspace admins rotate the code; the old one stops working immediately.
    const denied = await call("/billing/invite-code/rotate", { token: joined.data.token, body: {} });
    assert.equal(denied.status, 403);
    const rotated = await call("/billing/invite-code/rotate", { token: a.token, body: {} });
    assert.equal(rotated.status, 200);
    assert.notEqual(rotated.data.invite_code, a.tenant.invite_code);
    const oldCode = await call("/public/join", {
      body: { invite_code: a.tenant.invite_code, name: "Eski Kod", email: "old@alpha-customer.io", password: PASSWORD },
    });
    assert.equal(oldCode.status, 404);
    const newCode = await call("/public/join", {
      body: { invite_code: rotated.data.invite_code, name: "Yeni Kod", email: "new@alpha-customer.io", password: PASSWORD },
    });
    assert.equal(newCode.status, 200);

    // Other workspaces are untouched by the rotation.
    const other = (await db.query("SELECT invite_code FROM tenants WHERE id=$1", [b.tenant.id])).rows[0];
    assert.equal(other.invite_code, b.tenant.invite_code);
  });

  await withApp(async ({ call }) => {
    let last;
    for (let i = 0; i < 21; i++)
      last = await call("/public/join", {
        body: { invite_code: `BKT-ZZZ${i}22`, name: "Deneme", email: `try${i}@guess.io`, password: PASSWORD },
      });
    assert.equal(last.status, 429);
    assert.equal(last.data.errorKey, "too_many_requests_please_try_again_later");
  });
});

test("Email verification links are single use, expire, can be resent and replace older links", async () => {
  await withApp(async ({ db, call }) => {
    const ws = await signup(call);
    const me = await call("/me", { token: ws.token });
    assert.equal(me.data.email_verified, false);
    // Existing and admin-created accounts are verified by default.
    const seeded = (await db.query("SELECT count(*)::int n FROM users WHERE email_verified_at IS NULL")).rows[0].n;
    assert.equal(seeded, 1);

    const first = await mailLink(db, ws.email, "email_verify");
    assert.match(first, /\/login\?verify=[a-f0-9]{64}$/);
    const firstToken = first.split("verify=")[1];

    assert.equal((await call("/public/verify-email", { body: { token: "nope" } })).status, 400);

    // Resending is throttled, then replaces the earlier link.
    const tooSoon = await call("/me/verify-email/resend", { token: ws.token, body: {} });
    assert.equal(tooSoon.status, 429);
    await db.query("UPDATE auth_tokens SET created_at=now()-interval '5 minutes' WHERE user_id=$1", [ws.user.id]);
    assert.equal((await call("/me/verify-email/resend", { token: ws.token, body: {} })).status, 200);
    const secondToken = (await mailLink(db, ws.email, "email_verify")).split("verify=")[1];
    assert.notEqual(secondToken, firstToken);
    assert.equal((await call("/public/verify-email", { body: { token: firstToken } })).data.errorKey, "invalid_or_expired_token");

    // Expired links are rejected.
    await db.query("UPDATE auth_tokens SET expires_at=now()-interval '1 minute' WHERE token_hash IS NOT NULL AND used_at IS NULL AND user_id=$1", [ws.user.id]);
    assert.equal((await call("/public/verify-email", { body: { token: secondToken } })).status, 400);
    await db.query("UPDATE auth_tokens SET created_at=now()-interval '5 minutes' WHERE user_id=$1", [ws.user.id]);
    await call("/me/verify-email/resend", { token: ws.token, body: {} });
    const thirdToken = (await mailLink(db, ws.email, "email_verify")).split("verify=")[1];

    assert.equal((await call("/public/verify-email", { body: { token: thirdToken } })).status, 200);
    assert.equal((await call("/me", { token: ws.token })).data.email_verified, true);
    // Single use.
    assert.equal((await call("/public/verify-email", { body: { token: thirdToken } })).status, 400);
    // A verified user asking again does not generate another mail.
    const before = (await db.query("SELECT count(*)::int n FROM auth_mail_outbox")).rows[0].n;
    assert.equal((await call("/me/verify-email/resend", { token: ws.token, body: {} })).status, 200);
    assert.equal((await db.query("SELECT count(*)::int n FROM auth_mail_outbox")).rows[0].n, before);
  });
});

test("Password reset is enumeration-safe, single use, expiring and revokes every session", async () => {
  await withApp(async ({ db, call }) => {
    const ws = await signup(call);
    const login = (email, password) => call("/login", { body: { email, password } });

    const unknown = await call("/public/forgot-password", { body: { email: "ghost@nowhere.io" } });
    const known = await call("/public/forgot-password", { body: { email: ws.email } });
    assert.deepEqual(unknown.data, known.data);
    assert.equal(unknown.status, 200);
    assert.equal(
      (await db.query("SELECT count(*)::int n FROM auth_mail_outbox WHERE payload->'to'->>0='ghost@nowhere.io'")).rows[0].n,
      0,
    );

    const link = await mailLink(db, ws.email, "password_reset");
    assert.match(link, /\/login\?reset=[a-f0-9]{64}$/);
    const token = link.split("reset=")[1];

    // Tokens are stored hashed only.
    assert.equal((await db.query("SELECT count(*)::int n FROM auth_tokens WHERE token_hash=$1", [token])).rows[0].n, 0);

    const weak = await call("/public/reset-password", { body: { token, newPassword: "short" } });
    assert.equal(weak.status, 400);
    const mismatch = await call("/public/reset-password", { body: { token, newPassword: "NewPassword456!", confirmPassword: "different" } });
    assert.equal(mismatch.status, 400);
    assert.equal((await call("/public/reset-password", { body: { token: "f".repeat(64), newPassword: "NewPassword456!" } })).status, 400);

    const done = await call("/public/reset-password", { body: { token, newPassword: "NewPassword456!", confirmPassword: "NewPassword456!" } });
    assert.equal(done.status, 200);

    // The old password and every earlier session stop working.
    assert.equal((await login(ws.email, PASSWORD)).status, 401);
    assert.equal((await call("/me", { token: ws.token })).status, 401);
    const fresh = await login(ws.email, "NewPassword456!");
    assert.equal(fresh.status, 200);

    // The link cannot be reused, and a reset also proves the mailbox belongs to the user.
    assert.equal((await call("/public/reset-password", { body: { token, newPassword: "Another789Pass!" } })).status, 400);
    assert.equal((await call("/me", { token: fresh.data.token })).data.email_verified, true);

    // A newer request invalidates the older link; expired links fail.
    await call("/public/forgot-password", { body: { email: ws.email } });
    const older = (await mailLink(db, ws.email, "password_reset")).split("reset=")[1];
    await call("/public/forgot-password", { body: { email: ws.email } });
    const newer = (await mailLink(db, ws.email, "password_reset")).split("reset=")[1];
    assert.equal((await call("/public/reset-password", { body: { token: older, newPassword: "Another789Pass!" } })).status, 400);
    await db.query("UPDATE auth_tokens SET expires_at=now()-interval '1 minute' WHERE kind='password_reset' AND used_at IS NULL");
    assert.equal((await call("/public/reset-password", { body: { token: newer, newPassword: "Another789Pass!" } })).status, 400);

    // Suspended workspaces and deactivated users never receive reset links.
    await db.query("UPDATE tenants SET status='suspended' WHERE id=$1", [ws.tenant.id]);
    const rows = (await db.query("SELECT count(*)::int n FROM auth_mail_outbox WHERE kind='password_reset'")).rows[0].n;
    await call("/public/forgot-password", { body: { email: ws.email } });
    assert.equal((await db.query("SELECT count(*)::int n FROM auth_mail_outbox WHERE kind='password_reset'")).rows[0].n, rows);
  });
});

test("Account recovery requests are rate limited per client", async () => {
  await withApp(async ({ call }) => {
    const statuses = [];
    for (let i = 0; i < 6; i++)
      statuses.push((await call("/public/forgot-password", { body: { email: `user${i}@example-mail.io` } })).status);
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
  });
});
