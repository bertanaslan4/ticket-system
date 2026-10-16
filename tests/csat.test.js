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

test("CSAT: Only customer can submit rating and ticket must be closed", async () => {
  // Create a ticket by customer
  const createRes = await req("customer", "/api/tickets", {
    body: {
      title: "Barkod okuyucu yanıt vermiyor",
      description: "Kasada kullanılan barkod okuyucu sisteme iletilmiyor.",
      type: "Hata",
      severity: "s2",
    },
  });
  assert.equal(createRes.status, 201);
  const ticketId = createRes.data.id;

  // 1. Cannot rate an open ticket
  const rateOpenRes = await req("customer", `/api/tickets/${ticketId}/csat`, {
    body: { rating: 5, comment: "Harika" },
  });
  assert.equal(rateOpenRes.status, 400);
  assert.equal(rateOpenRes.data.errorKey, "ticket_must_be_closed_to_rate");

  // 2. Non-customer (dealer) cannot submit rating
  const dealerRateRes = await req("dealer", `/api/tickets/${ticketId}/csat`, {
    body: { rating: 5 },
  });
  assert.equal(dealerRateRes.status, 403);
  assert.equal(dealerRateRes.data.errorKey, "only_customer_can_rate_ticket");

  // Close the ticket (first dealer resolves or closes)
  // Check ticket routing / close action
  const closeRes = await req("dealer", `/api/tickets/${ticketId}/actions`, {
    body: {
      action: "close",
      body: "Cihazın USB sürücüsü güncellendi ve test edildi, sorun çözüldü.",
    },
  });
  assert.equal(closeRes.status, 200);

  // 3. Invalid rating validation
  const invalidLow = await req("customer", `/api/tickets/${ticketId}/csat`, {
    body: { rating: 0, comment: "Geçersiz" },
  });
  assert.equal(invalidLow.status, 400);
  assert.equal(invalidLow.data.errorKey, "invalid_rating");

  const invalidHigh = await req("customer", `/api/tickets/${ticketId}/csat`, {
    body: { rating: 6, comment: "Geçersiz" },
  });
  assert.equal(invalidHigh.status, 400);
  assert.equal(invalidHigh.data.errorKey, "invalid_rating");

  // 4. Successful CSAT submission
  const submitRes = await req("customer", `/api/tickets/${ticketId}/csat`, {
    body: { rating: 5, comment: "Hızlı ve eksiksiz destek için teşekkürler!" },
  });
  assert.equal(submitRes.status, 200);
  assert.equal(submitRes.data.rating, 5);
  assert.equal(submitRes.data.comment, "Hızlı ve eksiksiz destek için teşekkürler!");

  // 5. Cannot rate twice (duplicate rejection)
  const dupRes = await req("customer", `/api/tickets/${ticketId}/csat`, {
    body: { rating: 4, comment: "İkinci deneme" },
  });
  assert.equal(dupRes.status, 400);
  assert.equal(dupRes.data.errorKey, "ticket_already_rated");

  // 6. Detail endpoint returns the CSAT rating
  const detailRes = await req("customer", `/api/tickets/${ticketId}`);
  assert.equal(detailRes.status, 200);
  assert.ok(detailRes.data.csat);
  assert.equal(detailRes.data.csat.rating, 5);
  assert.equal(detailRes.data.csat.comment, "Hızlı ve eksiksiz destek için teşekkürler!");

  // Staff can also view the customer's rating
  const dealerDetailRes = await req("dealer", `/api/tickets/${ticketId}`);
  assert.equal(dealerDetailRes.status, 200);
  assert.ok(dealerDetailRes.data.csat);
  assert.equal(dealerDetailRes.data.csat.rating, 5);

  // 7. CSAT metric aggregation in admin reports
  const reportsRes = await req("admin", "/api/admin/reports");
  assert.equal(reportsRes.status, 200);
  assert.ok(reportsRes.data.csat);
  assert.equal(reportsRes.data.csat.total, 1);
  assert.equal(reportsRes.data.csat.average, 5);
  assert.equal(reportsRes.data.csat.distribution[5], 1);
  assert.equal(reportsRes.data.csat.distribution[1], 0);

  // Check that row has csat_rating
  const ratedRow = reportsRes.data.rows.find((r) => r.id === ticketId);
  assert.ok(ratedRow);
  assert.equal(ratedRow.csat_rating, 5);
});
