import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import {
  MailService,
  buildMailPayload,
} from "../build/server/mail/mail.service.js";
let db, mail, eventId;
const user = { id: 1, name: "Test Customer", email: "customer@example.com" };
const ticket = {
  id: 1,
  title: "Örnek istem",
  program: "ushops",
  customer_name: "Yargıcı",
  severity: "s2",
};
before(async () => {
  db = await openDb({ url: null, dir: ":memory:" });
  await seed(db);
  mail = new MailService(db);
  eventId = (
    await db.query(
      "INSERT INTO events(ticket_id,actor_id,kind,visibility,body) VALUES(1,2,'closed','public','Çözüldü') RETURNING id",
    )
  ).rows[0].id;
  process.env.MAIL_API_URL = "https://mail.example.com/send";
  process.env.MAIL_API_SECRET = "test-secret";
  process.env.MAIL_TEMPLATE_CLOSED = "support_request_closed";
  process.env.MAIL_TEMPLATE_ASSIGNED = "support_request_assigned";
  process.env.MAIL_ENABLED = "true";
  process.env.MAIL_APP_URL = "https://support.example.com";
});
after(async () => {
  await db.close();
});
test("Payload matches the reference API and exposes only the public resolution", () => {
  const p = buildMailPayload(
    "closed",
    user,
    { ...ticket, internal_note: "private" },
    "Public resolution",
  );
  assert.equal(p.data.customer_name, "Yargıcı");
  assert.equal(p.template, "support_request_closed");
  assert.deepEqual(p.to, [user.email]);
  assert.equal(p.data.resolution, "Public resolution");
  assert.equal(p.data.ticket_url, "https://support.example.com/tickets/1");
  assert.equal(JSON.stringify(p).includes("private"), false);
  assert.equal(
    buildMailPayload("assigned", user, ticket, "private").data.resolution,
    "",
  );
});
test("Outbox is atomic and unique per event and recipient", async () => {
  await assert.rejects(
    db.transaction(async (tx) => {
      await mail.enqueue(tx, eventId, "closed", ticket, [user], "Done");
      throw Error("rollback");
    }),
  );
  assert.equal((await db.query("SELECT * FROM mail_outbox")).rows.length, 0);
  await db.transaction(async (tx) => {
    await mail.enqueue(tx, eventId, "closed", ticket, [user], "Done");
    await mail.enqueue(tx, eventId, "closed", ticket, [user], "Done");
  });
  assert.equal((await db.query("SELECT * FROM mail_outbox")).rows.length, 1);
  const saved = (await db.query("SELECT payload FROM mail_outbox")).rows[0].payload;
  const customer = (await db.query("SELECT c.name FROM tickets t JOIN organizations c ON c.id=t.customer_id WHERE t.id=1")).rows[0];
  assert.equal(saved.data.customer_name, customer.name);
});
test("Failures retry without losing the notification; signatures match Laravel", async () => {
  const original = globalThis.fetch;
  let sent = 0;
  try {
    globalThis.fetch = async (url, options) => {
      sent++;
      assert.equal(String(url), "https://mail.example.com/send");
      const ts = options.headers["X-Mail-Timestamp"];
      assert.equal(
        options.headers["X-Mail-Signature"],
        createHmac("sha256", "test-secret").update(ts).digest("hex"),
      );
      assert.ok(options.headers["Idempotency-Key"]);
      return new Response("", { status: sent === 1 ? 503 : 200 });
    };
    await mail.processBatch();
    let row = (await db.query("SELECT * FROM mail_outbox")).rows[0];
    assert.equal(row.status, "pending");
    assert.equal(row.attempts, 1);
    assert.equal(row.last_error, "HTTP_503");
    await db.query("UPDATE mail_outbox SET next_attempt_at=now()");
    await mail.processBatch();
    row = (await db.query("SELECT * FROM mail_outbox")).rows[0];
    assert.equal(row.status, "sent");
    assert.equal(row.attempts, 2);
    await mail.processBatch();
    assert.equal(sent, 2);
  } finally {
    globalThis.fetch = original;
  }
});
test("Demo addresses are skipped and inactive recipients are not sent", async () => {
  await mail.enqueue(db, eventId, "assigned", ticket, [
    { ...user, email: "user@firm.demo" },
  ]);
  assert.equal(
    (await db.query("SELECT status FROM mail_outbox WHERE kind='assigned'"))
      .rows[0].status,
    "skipped",
  );
  const event = (
    await db.query(
      "INSERT INTO events(ticket_id,actor_id,kind,visibility,body) VALUES(1,2,'assigned','public','Assigned') RETURNING id",
    )
  ).rows[0];
  await mail.enqueue(db, event.id, "assigned", ticket, [user]);
  await db.query("UPDATE users SET active=false WHERE id=1");
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error("must not send");
  };
  try {
    await mail.processBatch();
    assert.equal(
      (
        await db.query("SELECT status FROM mail_outbox WHERE event_id=$1", [
          event.id,
        ])
      ).rows[0].status,
      "skipped",
    );
  } finally {
    globalThis.fetch = original;
  }
});
