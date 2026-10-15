import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { createApp } from "../server/app.js";
import { TicketsService } from "../build/server/tickets/tickets.service.js";
let app, base;
before(async () => {
  const db = await openDb({ url: null, dir: ":memory:" });
  app = await createApp(db, { frontend: true });
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});
after(async () => {
  await app?.close();
});
test("Nest container resolves the ticket service and exposes health", async () => {
  assert.ok(app.get(TicketsService) instanceof TicketsService);
  assert.deepEqual(await (await fetch(base + "/api/health")).json(), {
    ok: true,
  });
});
test("API misses remain JSON and never return the React index", async () => {
  const r = await fetch(base + "/api/not-a-route", {
    headers: { "Accept-Language": "en" },
  });
  assert.equal(r.status, 404);
  assert.equal((await r.json()).errorKey, "endpoint_not_found");
});
test("Nest preserves localized parser errors and body size limits", async () => {
  for (const [body, status, key] of [
    ["{", 400, "invalid_json_data"],
    [
      JSON.stringify({ data: "a".repeat(70000) }),
      413,
      "request_payload_is_too_large",
    ],
  ]) {
    const r = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": "en" },
      body,
    });
    assert.equal(r.status, status);
    assert.equal((await r.json()).errorKey, key);
  }
});
test("Login rate limiting remains enabled", async () => {
  let r;
  for (let i = 0; i < 31; i++)
    r = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": "en" },
      body: JSON.stringify({
        email: "missing@example.test",
        password: "invalid",
      }),
    });
  assert.equal(r.status, 429);
  assert.equal(
    (await r.json()).errorKey,
    "too_many_sign_in_attempts_please_try_again_later",
  );
});
