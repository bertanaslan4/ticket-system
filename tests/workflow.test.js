import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { seed } from "../server/seed.js";
import { createApp } from "../server/app.js";
let db, server, base;
const cookies = {};
before(async () => {
  const url = process.env.TEST_DATABASE_URL || null;
  if (url && !/^\/ticket_test_\d+$/.test(new URL(url).pathname)) {
    throw new Error(
      "PostgreSQL tests require a separate ticket_test_<digits> database.",
    );
  }
  db = await openDb({ url, dir: ":memory:" });
  await seed(db);
  server = await createApp(db);
  await server.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${server.getHttpServer().address().port}`;
  for (const [role, email] of Object.entries({
    customer: "musteri@yargici.demo",
    dealer: "bayi@verimsoft.demo",
    colleague: "mehmet@verimsoft.demo",
    contractor: "bertan@bekatos.demo",
    other: "diger@musteri.demo",
    otherDealer: "diger@bayi.demo",
  })) {
    const r = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Demo2026!" }),
    });
    assert.equal(r.status, 200);
    cookies[role] = r.headers.get("set-cookie").split(";")[0];
  }
});
after(async () => {
  if (server) await server.close();
  else await db?.close();
});
async function req(role, path, body) {
  const r = await fetch(base + "/api" + path, {
    headers: {
      Cookie: cookies[role] || "",
      "Content-Type": "application/json",
    },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
const action = (role, body) => req(role, "/tickets/1/actions", body);
test("Oturumsuz erişim engellenir", async () =>
  assert.equal((await req("none", "/tickets")).status, 401));
test("Müşteri ve bayi izolasyonu", async () => {
  assert.equal((await req("other", "/tickets/1")).status, 404);
  assert.equal((await req("otherDealer", "/tickets/1")).status, 404);
  assert.equal((await req("contractor", "/tickets/1")).status, 404);
});
test("Bayi iç yorumları müşteri API yanıtından çıkarılır", async () => {
  assert.equal(
    (
      await action("dealer", {
        action: "comment",
        body: "Gizli teknik teşhis bilgisi",
        visibility: "internal",
      })
    ).status,
    200,
  );
  const customer = await req("customer", "/tickets/1");
  assert.equal(customer.data.customer_name, "Yargıcı");
  assert.equal(customer.data.owner_name, "Verimsoft");
  assert.ok(!JSON.stringify(customer.data).includes("Gizli teknik"));
  assert.ok(
    (await req("dealer", "/tickets/1")).data.events.some(
      (e) => e.visibility === "internal",
    ),
  );
});
test("Müşteri personel işlemlerini yapamaz", async () => {
  assert.equal(
    (await action("customer", { action: "severity", severity: "s3" })).status,
    403,
  );
  assert.equal(
    (await action("customer", { action: "assign", org_id: 1 })).status,
    403,
  );
  assert.equal(
    (await action("customer", { action: "close", body: "Talep tamamlandı." }))
      .status,
    403,
  );
});
test("Bayi öncelik ve kendi personeline atama yapar", async () => {
  assert.equal(
    (await action("dealer", { action: "severity", severity: "s2" })).status,
    200,
  );
  assert.equal(
    (await action("dealer", { action: "assign", org_id: 2, assignee_id: 3 }))
      .status,
    200,
  );
  assert.equal(
    (await action("dealer", { action: "assign", org_id: 4 })).status,
    403,
  );
  assert.equal(
    (await action("colleague", { action: "assign", org_id: 2, assignee_id: 4 }))
      .status,
    400,
  );
});
test("Çift yönlü atama ve Takipsan iletişim kuralları", async () => {
  assert.equal(
    (await action("colleague", { action: "assign", org_id: 1, assignee_id: 4 }))
      .status,
    200,
  );
  assert.equal((await action('dealer',{action:'comment',visibility:'internal',body:'Atamadan sonra mesaj'})).status,403);
  assert.equal((await action('contractor',{action:'comment',visibility:'internal',body:'Sorumlu şirket mesajı'})).status,200);
  assert.equal(
    (await action("dealer", { action: "severity", severity: "s1" })).status,
    403,
  );
  assert.equal(
    (
      await action("contractor", {
        action: "comment",
        visibility: "public",
        body: "Doğrudan müşteriye mesaj",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await action("contractor", {
        action: "close",
        body: "Sorun giderilmiştir.",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await action("contractor", {
        action: "assign",
        org_id: 2,
        assignee_id: 3,
      })
    ).status,
    200,
  );
  assert.equal((await action('contractor',{action:'comment',visibility:'internal',body:'İadeden sonra mesaj'})).status,403);
  assert.equal((await action('dealer',{action:'comment',visibility:'internal',body:'Geri atamada mesaj'})).status,200);
  assert.equal(
    (await action("colleague", { action: "assign", org_id: 1, assignee_id: 4 }))
      .status,
    200,
  );
});
test("Çözüm şirket içi açıklama ile bayiye döner, bayi test onayıyla kapatır", async () => {
 const assigned=(await db.query("SELECT m.user_id,e.message_params FROM mail_outbox m JOIN events e ON e.id=m.event_id WHERE m.kind='assigned' ORDER BY m.id")).rows;
 assert.ok(assigned.some(m=>m.user_id===4));assert.ok(assigned.some(m=>m.user_id===3));
 assert.equal(assigned.some(m=>m.user_id===1),false);
  assert.equal(
    (
      await action("contractor", {
        action: "resolve",
        body: "Gizli çözüm: stok önbelleği yenilendi.",
      })
    ).status,
    200,
  );
  let t = (await req("customer", "/tickets/1")).data;
  assert.equal(t.status, "review");
  assert.equal(t.resolution,null);
  assert.ok(!JSON.stringify(t).includes("Gizli çözüm"));
  assert.ok(t.events.some((e) => e.kind === "resolved"));
  assert.equal(
    (
      await action("dealer", {
        action: "close",
        body: "Stok ekranı düzeltildi.",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await action("dealer", {
        action: "close",
        body: "Stok ekranı düzeltildi. Test edilerek onaylandı.",
        confirmed: true,
      })
    ).status,
    200,
  );
  t = (await req("customer", "/tickets/1")).data;
  assert.equal(t.status, "closed");
  const mails=(await db.query("SELECT * FROM mail_outbox WHERE kind='closed'")).rows;
  assert.equal(mails.length,1);assert.equal(mails[0].user_id,1);
  assert.equal(mails[0].payload.data.resolution,'Stok ekranı düzeltildi. Test edilerek onaylandı.');
  assert.equal(JSON.stringify(mails).includes('Gizli çözüm'),false);
  assert.equal(t.resolution.body,'Stok ekranı düzeltildi. Test edilerek onaylandı.');
  assert.equal(t.resolution.org_name,'Verimsoft');
  assert.ok(!JSON.stringify(t).includes('Gizli çözüm'));
  assert.ok(t.events.some(e=>e.kind==='resolution'&&e.visibility==='public'));
  assert.ok(t.events.some((e) => e.body.includes("Test edilerek")));
  assert.equal(
    (await action("dealer", { action: "severity", severity: "s1" })).status,
    409,
  );
});
test("Bayi erken çözümle kapatabilir", async () =>
  assert.equal(
    (
      await req("dealer", "/tickets/2/actions", {
        action: "close",
        body: "Tarih filtresi mevcut rapor ayarlarından açıldı.",
      })
    ).status,
    200,
  ));
test("Otomatik müşteri/program alanları ve eşzamanlı günlük limit", async () => {
  await db.query("UPDATE organizations SET daily_limit=4 WHERE id=3");
  const body = {
    title: "Eşzamanlı limit testi",
    description: "Yeterli uzunlukta açıklama.",
    severity: "s3",
    type: "İstek",
    customer_id: 5,
    program: "hacked",
  };
  const results = await Promise.all([
    req("customer", "/tickets", body),
    req("customer", "/tickets", body),
    req("customer", "/tickets", body),
  ]);
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 429).length, 2);
  const t = results.find((r) => r.status === 201).data;
  assert.equal(t.customer_id, 3);
  assert.equal(t.program, "ushops");
  assert.equal(t.dealer_id, 2);
});
test("Geçersiz değerler ve farklı origin engellenir", async () => {
  assert.equal(
    (
      await req("customer", "/tickets", {
        title: "abc",
        description: "açıklama uzundur",
        type: "x",
        severity: "s1",
      })
    ).status,
    400,
  );
  const r = await fetch(base + "/api/tickets", {
    method: "POST",
    headers: {
      Cookie: cookies.customer,
      Origin: "https://evil.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(r.status, 403);
});

test('Eski kapanış yorumları desteklenir; gizli yorum çözüm olarak açığa çıkmaz',async()=>{
 const note=(await db.query("SELECT id FROM events WHERE ticket_id=1 AND kind='resolution' ORDER BY id DESC LIMIT 1")).rows[0];
 await db.query("UPDATE events SET kind='comment' WHERE id=$1",[note.id]);
 assert.equal((await req('customer','/tickets/1')).data.resolution.body,'Stok ekranı düzeltildi. Test edilerek onaylandı.');
 await db.query("UPDATE events SET visibility='internal' WHERE id=$1",[note.id]);
 const data=(await req('customer','/tickets/1')).data;assert.equal(data.resolution,null);assert.ok(!data.events.some(e=>e.id===note.id));
 await db.query("UPDATE events SET visibility='public' WHERE id=$1",[note.id]);
});
