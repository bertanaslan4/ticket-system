import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { catalogs, languageOf, translate, eventParts } from "../shared/i18n.js";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";
let db, server, base;
before(async () => {
  const url = process.env.TEST_DATABASE_URL || null;
  if (url && !/^\/ticket_test_\d+$/.test(new URL(url).pathname))
    throw Error("Isolated database required");
  db = await openDb({ url, dir: ":memory:" });
  await seed(db);
  server = await createApp(db);
  await server.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${server.getHttpServer().address().port}/api`;
});
after(async () => {
  if (server) await server.close();
  else await db?.close();
});
test("Locales, fallback and interpolation are safe", () => {
  assert.equal(languageOf("en-GB,en;q=0.9"), "en");
  assert.equal(languageOf("constructor"), "tr");
  assert.equal(languageOf("fr"), "tr");
  assert.equal(translate("constructor", {}, "en"), "constructor");
  assert.equal(translate("users_2", { count: 3 }, "en"), "Users: 3");
  assert.deepEqual(
    Object.keys(catalogs.tr).sort(),
    Object.keys(catalogs.en).sort(),
  );
  assert.equal(translate("ticket_report", {}, "tr"), "Destek istemi raporları");
  assert.equal(translate("ticket_report", {}, "en"), "Support request reports");
  const original = catalogs.tr.ticket_report;
  try {
    catalogs.tr.ticket_report = "Bilet raporlaması";
    assert.equal(translate("ticket_report", {}, "en"), "Support request reports");
  } finally {
    catalogs.tr.ticket_report = original;
  }
  for (const [key, value] of Object.entries(catalogs.en)) {
    assert.deepEqual(
      [...catalogs.tr[key].matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(),
      [...value.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort(),
      key,
    );
  }
});
test("Every literal UI translation key has an English translation", () => {
  for (const name of readdirSync("src", { recursive: true }).filter((name) =>
    /\.(tsx?|js)$/.test(name),
  )) {
    const file = "src/" + name;
    const ast = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function walk(n) {
      if (!n || typeof n !== "object") return;
      if (
        ts.isCallExpression(n) &&
        n.expression.getText(ast) === "tr" &&
        n.arguments[0] &&
        ts.isStringLiteral(n.arguments[0])
      )
        assert.ok(
          Object.hasOwn(catalogs.en, n.arguments[0].text),
          `${file}: ${n.arguments[0].text}`,
        );
      ts.forEachChild(n, walk);
    }
    walk(ast);
  }
});
test("Legacy timeline is translated while comments and company names are preserved", () => {
  const event = {
    kind: "created",
    body: "Bilet oluşturuldu ve Verimsoft havuzuna iletildi.",
  };
  const p = eventParts(event);
  assert.equal(p.params.company, "Verimsoft");
  assert.equal(p.key, "event_ticket_created");
  assert.deepEqual(
    eventParts({
      ...event,
      message_key: "Bilet oluşturuldu ve {company} havuzuna iletildi.",
      message_params: p.params,
    }),
    p,
  );
  assert.notEqual(translate(p.key, p.params, "en"), event.body);
  assert.equal(eventParts({ ...event, kind: "comment" }), null);
  assert.deepEqual(
    eventParts({ ...event, message_key: p.key, message_params: p.params }),
    p,
  );
});
test("API errors use requested locale and retain stable translation metadata", async () => {
  for (const lang of ["tr", "en"]) {
    const r = await fetch(base + "/tickets", {
      headers: { "Accept-Language": lang },
    });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get("content-language"), lang);
    const data = await r.json();
    assert.equal(data.error, translate(data.errorKey, data.errorParams, lang));
    assert.ok(Object.hasOwn(catalogs.en, data.errorKey));
  }
  const r = await fetch(base + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept-Language": "en" },
    body: JSON.stringify({ email: "x", password: "x" }),
  });
  assert.equal(r.status, 400);
  const data = await r.json();
  assert.equal(data.errorKey, "validation_text_length");
  assert.match(data.error, /3/);
});
test("English requests preserve ticket content and persist translatable events", async () => {
  const r = await fetch(base + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "musteri@yargici.demo",
      password: "Demo2026!",
    }),
  });
  const cookie = r.headers.get("set-cookie").split(";")[0];
  const response = await fetch(base + "/tickets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "en",
      Cookie: cookie,
    },
    body: JSON.stringify({
      title: "Türkçe test başlığı",
      description: "Bu açıklama çevrilmeden korunmalıdır.",
      type: "Hata",
      severity: "s2",
    }),
  });
  assert.equal(response.status, 201);
  const ticket = await response.json();
  const saved = (
    await db.query("SELECT * FROM tickets WHERE id=$1", [ticket.id])
  ).rows[0];
  assert.equal(saved.title, "Türkçe test başlığı");
  assert.equal(saved.type, "Hata");
  const event = (
    await db.query("SELECT * FROM events WHERE ticket_id=$1", [ticket.id])
  ).rows[0];
  assert.equal(event.message_key, "event_ticket_created");
  assert.equal(event.message_params.company, "Verimsoft");
});
