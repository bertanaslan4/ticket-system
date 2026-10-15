import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";
let app, base, root, id;
const cookies = {};
before(async () => {
  root = await mkdtemp(join(tmpdir(), "ticket-attachments-"));
  process.env.ATTACHMENT_DIR = root;
  process.env.ATTACHMENT_STORAGE = "local";
  const db = await openDb({ url: null, dir: ":memory:" });
  await seed(db);
  app = await createApp(db);
  await app.listen(0, "127.0.0.1");
  base = "http://127.0.0.1:" + app.getHttpServer().address().port;
  for (const [role, email] of Object.entries({
    customer: "musteri@yargici.demo",
    dealer: "bayi@verimsoft.demo",
    contractor: "bertan@bekatos.demo",
    other: "diger@musteri.demo",
  })) {
    const r = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Demo2026!" }),
    });
    cookies[role] = r.headers.get("set-cookie").split(";")[0];
  }
});
after(async () => {
  await app?.close();
  if (root) await rm(root, { recursive: true, force: true });
});
async function send(role, path, data, files = [["test.pdf", "%PDF-1.7 test"]]) {
  const form = new FormData();
  form.append("payload", JSON.stringify(data));
  for (const [name, content] of files)
    form.append("files", new Blob([content]), name);
  return fetch(base + "/api" + path, {
    method: "POST",
    headers: { Cookie: cookies[role] },
    body: form,
  });
}
async function detail(role) {
  return (
    await fetch(base + "/api/tickets/" + id, {
      headers: { Cookie: cookies[role] },
    })
  ).json();
}
async function download(role, url) {
  return fetch(base + url, { headers: { Cookie: cookies[role] || "" } });
}
test("Creation attachments are downloadable only by authorized users", async () => {
  const r = await send("customer", "/tickets", {
    title: "Attachment ticket",
    description: "Description with attachment",
    type: "Hata",
    severity: "s2",
  });
  assert.equal(r.status, 201);
  id = (await r.json()).id;
  const t = await detail("customer");
  assert.equal(t.attachments.length, 1);
  const url = t.attachments[0].url;
  const file = await download("customer", url);
  assert.equal(file.status, 200);
  assert.equal(await file.text(), "%PDF-1.7 test");
  assert.match(file.headers.get("content-disposition"), /attachment/);
  assert.equal((await download("other", url)).status, 404);
  assert.equal((await download("contractor", url)).status, 404);
  assert.equal((await download("none", url)).status, 401);
});
test("Internal comment attachments cannot leak through detail or download", async () => {
  assert.equal(
    (
      await send("dealer", `/tickets/${id}/actions`, {
        action: "comment",
        visibility: "internal",
        body: "Internal file",
      })
    ).status,
    200,
  );
  const staff = await detail("dealer");
  const note = staff.events.find((e) => e.body === "Internal file");
  assert.equal(note.attachments.length, 1);
  assert.equal(
    (await download("customer", note.attachments[0].url)).status,
    404,
  );
  assert.equal(
    (await detail("customer")).events.some((e) => e.id === note.id),
    false,
  );
});
test("Rejected action and invalid file roll back uploaded objects", async () => {
  const beforeFiles = await readdir(root, {recursive:true});
  assert.equal(
    (
      await send("customer", `/tickets/${id}/actions`, {
        action: "close",
        body: "Not allowed to close",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await send(
        "dealer",
        `/tickets/${id}/actions`,
        { action: "comment", body: "Invalid file", visibility: "public" },
        [["fake.pdf", "not a pdf"]],
      )
    ).status,
    400,
  );
  assert.deepEqual(await readdir(root, {recursive:true}), beforeFiles);
});
test("Contractor resolution stays private and dealer resolution attachments are public", async () => {
  const d = await detail("dealer");
  const contractor = d.orgs.find((o) => o.kind === "contractor");
  assert.equal(
    (
      await send(
        "dealer",
        `/tickets/${id}/actions`,
        { action: "assign", org_id: contractor.id },
        [],
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await send("contractor", `/tickets/${id}/actions`, {
        action: "resolve",
        body: "Private contractor resolution",
      })
    ).status,
    200,
  );
  const internal = (await detail("dealer")).events.find(
    (e) => e.body === "Private contractor resolution",
  ).attachments[0];
  assert.equal(
    (
      await send("dealer", `/tickets/${id}/actions`, {
        action: "close",
        body: "Tested dealer public resolution",
        confirmed: true,
      })
    ).status,
    200,
  );
  const customer = await detail("customer");
  assert.equal(customer.resolution.attachments.length, 1);
  assert.equal(
    (await download("customer", customer.resolution.attachments[0].url)).status,
    200,
  );
  assert.equal((await download("customer", internal.url)).status, 404);
  const beforeFiles = await readdir(root, {recursive:true});
  assert.equal(
    (
      await send("dealer", `/tickets/${id}/actions`, {
        action: "comment",
        body: "Closed file",
        visibility: "public",
      })
    ).status,
    409,
  );
  assert.deepEqual(await readdir(root, {recursive:true}), beforeFiles);
});
test("File count and size limits are enforced", async () => {
  const data = {
    title: "Limit ticket",
    description: "File limit verification",
    type: "Hata",
    severity: "s2",
  };
  assert.equal(
    (
      await send(
        "customer",
        "/tickets",
        data,
        Array.from({ length: 6 }, () => ["test.pdf", "%PDF-1.7"]),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await send("customer", "/tickets", data, [
        ["test.pdf", "%PDF-" + "a".repeat(25 * 1024 * 1024)],
      ])
    ).status,
    413,
  );
});
