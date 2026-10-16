import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";

let db, app, base;
const tokens = {};

async function mobileReq(role, path, body) {
  const headers = {
    "X-Client": "mobile",
    "Content-Type": "application/json",
  };
  if (tokens[role]) {
    headers.Authorization = `Bearer ${tokens[role]}`;
  }
  const r = await fetch(base + "/api" + path, {
    headers,
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  return {
    status: r.status,
    data: await r.json(),
  };
}

before(async () => {
  db = await openDb({ url: null, dir: ":memory:" });
  await seed(db);
  app = await createApp(db);
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});

after(async () => {
  await app?.close();
});

test("Mobile login returns Bearer session token and authenticates without cookies", async () => {
  for (const [role, email] of Object.entries({
    customer: "musteri@yargici.demo",
    dealer: "bayi@verimsoft.demo",
    contractor: "bertan@bekatos.demo",
  })) {
    const login = await mobileReq(null, "/login", {
      email,
      password: "Demo2026!",
      mobile: true,
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.ok, true);
    assert.match(login.data.token, /^[a-f0-9]{64}$/);
    tokens[role] = login.data.token;
  }

  const me = await mobileReq("dealer", "/me");
  assert.equal(me.status, 200);
  assert.equal(me.data.role, "dealer");

  const tickets = await mobileReq("dealer", "/tickets");
  assert.equal(tickets.status, 200);
  assert.ok(tickets.data.length > 0);
});

test("Mobile users can register and remove Expo push tokens", async () => {
  const bad = await mobileReq("dealer", "/me/push-token", {
    token: "short",
    platform: "expo",
  });
  assert.equal(bad.status, 400);

  const reg = await mobileReq("dealer", "/me/push-token", {
    token: "ExponentPushToken[bekatos_demo_device_01]",
    platform: "ios",
  });
  assert.equal(reg.status, 200);
  assert.equal(reg.data.platform, "ios");
  assert.equal(reg.data.token, "ExponentPushToken[bekatos_demo_device_01]");

  const remove = await mobileReq("dealer", "/me/push-token/remove", {
    token: "ExponentPushToken[bekatos_demo_device_01]",
  });
  assert.equal(remove.status, 200);
  assert.equal(remove.data.ok, true);
});

test("Ticket creation, comments, assignment, and closure generate mobile push notifications with deep links", async () => {
  // Customer creates a new ticket on mobile
  const created = await mobileReq("customer", "/tickets", {
    title: "Mobil Kamera İle Barkod Okuyucu Sorunu",
    description: "Sahadan mobil uygulama üzerinden açılan destek talebi.",
    type: "Hata",
    severity: "s1",
  });
  assert.equal(created.status, 201);
  const ticketId = created.data.id;

  // Dealer receives an 'assigned' mobile notification with deepLink
  const dealerNotifs = await mobileReq("dealer", "/me/notifications");
  assert.equal(dealerNotifs.status, 200);
  const assignNotif = dealerNotifs.data.find(
    (n) => n.ticket_id === ticketId && n.kind === "assigned",
  );
  assert.ok(assignNotif);
  assert.equal(assignNotif.data.ticketId, ticketId);
  assert.equal(assignNotif.data.deepLink, `bekatos://tickets/${ticketId}`);

  // Dealer posts a public comment -> Customer receives a 'comment' push notification
  const commentRes = await mobileReq("dealer", `/tickets/${ticketId}/actions`, {
    action: "comment",
    visibility: "public",
    body: "Sahadan gönderdiğiniz görseller incelendi, müdahale ediliyor.",
  });
  assert.equal(commentRes.status, 200);

  const custNotifs1 = await mobileReq("customer", "/me/notifications");
  assert.ok(
    custNotifs1.data.some(
      (n) => n.ticket_id === ticketId && n.kind === "comment",
    ),
  );

  // Dealer closes the ticket -> Customer receives a 'closed' push notification
  const closeRes = await mobileReq("dealer", `/tickets/${ticketId}/actions`, {
    action: "close",
    body: "Barkod okuyucu kalibrasyonu tamamlandı ve sorun giderildi.",
  });
  assert.equal(closeRes.status, 200);

  const custNotifs2 = await mobileReq("customer", "/me/notifications");
  const closedNotif = custNotifs2.data.find(
    (n) => n.ticket_id === ticketId && n.kind === "closed",
  );
  assert.ok(closedNotif);
  assert.equal(closedNotif.data.deepLink, `bekatos://tickets/${ticketId}`);
});
