import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/auth.js';
let db, app, base; const cookies = {};
async function req(role, path, body) {
  const r = await fetch(base + '/api' + path, { headers:{ Cookie:cookies[role] || '', 'Content-Type':'application/json' }, ...(body ? { method:'POST', body:JSON.stringify(body) } : {}) });
  return { status:r.status, data:await r.json(), cookie:r.headers.get('set-cookie')?.split(';')[0] };
}
const action = (role, id, body) => req(role, `/tickets/${id}/actions`, body);
before(async () => {
  db = await openDb({ url:null, dir:':memory:' }); await seed(db);
  await db.query("INSERT INTO users(org_id,name,email,password_hash,system_role) VALUES(1,'Admin','admin@test.local',$1,'super_admin')", [hashPassword('Demo2026!')]);
  const other = (await db.query("INSERT INTO organizations(name,kind) VALUES('Other Contractor','contractor') RETURNING id")).rows[0];
  await db.query("INSERT INTO users(org_id,name,email,password_hash) VALUES($1,'Other','other@contractor.demo',$2)", [other.id,hashPassword('Demo2026!')]);
  app = await createApp(db); await app.listen(0,'127.0.0.1'); base = await app.getUrl();
  for (const [role,email] of Object.entries({admin:'admin@test.local',customer:'musteri@yargici.demo',dealer:'bayi@verimsoft.demo',contractor:'bertan@bekatos.demo',other:'other@contractor.demo'}))
    cookies[role] = (await req(null,'/login',{email,password:'Demo2026!'})).cookie;
});
after(async () => { await app?.close(); });
async function configure(flow, dealer_id=2) {
  return req('admin','/admin/organizations/3',{name:'Yargıcı',kind:'customer',program:'ushops',daily_limit:100,dealer_id,support_flow:flow});
}
async function create() {
  const r = await req('customer','/tickets',{title:'Routing request',description:'Support workflow verification.',type:'Hata',severity:'s2',support_flow:'dealer_first',owner_org_id:2});
  assert.equal(r.status,201); return r.data;
}
test('Routing configuration requires admin and validates dealer only for workflows that use one', async () => {
  assert.equal((await req('customer','/admin/organizations/3',{support_flow:'contractor_only'})).status,403);
  assert.equal((await configure('bad')).status,400);
  assert.equal((await configure('contractor_first',null)).status,400);
  assert.equal((await configure('contractor_first',1)).status,400);
  const r=await configure('contractor_only',null);
  assert.equal(r.status,200); assert.equal(r.data.dealer_id,null);
});
test('Takipsan-only requests exclude dealers, support public closure and appear in reports', async () => {
  const t=await create();
  assert.equal(t.support_flow,'contractor_only'); assert.equal(t.owner_org_id,1); assert.equal(t.dealer_id,null);
  assert.equal((await req('dealer',`/tickets/${t.id}`)).status,404);
  assert.equal((await req('other',`/tickets/${t.id}`)).status,404);
  assert.equal((await req('dealer','/tickets')).data.some(x=>x.id===t.id),false);
  const detail=(await req('contractor',`/tickets/${t.id}`)).data;
  assert.deepEqual(detail.orgs.map(o=>o.id),[1]);
  assert.ok(detail.targets.every(u=>u.org_id===1));
  assert.equal((await action('contractor',t.id,{action:'assign',org_id:2})).status,403);
  assert.equal((await action('contractor',t.id,{action:'resolve',body:'Cannot return to any dealer.'})).status,403);
  assert.equal((await action('contractor',t.id,{action:'severity',severity:'s1'})).status,200);
  assert.equal((await action('contractor',t.id,{action:'comment',visibility:'public',body:'Customer-facing progress.'})).status,200);
  assert.equal((await action('contractor',t.id,{action:'close',body:'Resolved directly by Takipsan.'})).status,200);
  assert.equal((await req('customer',`/tickets/${t.id}`)).data.resolution.body,'Resolved directly by Takipsan.');
  assert.ok((await req('admin','/admin/reports')).data.rows.some(row=>row.id===t.id));
  const mails=(await db.query('SELECT kind,user_id FROM mail_outbox WHERE event_id IN (SELECT id FROM events WHERE ticket_id=$1)',[t.id])).rows;
  assert.ok(mails.some(m=>m.kind==='closed' && m.user_id===1));
  assert.ok(mails.some(m=>m.kind==='assigned' && m.user_id===4));
  assert.ok(!mails.some(m=>[2,3].includes(m.user_id)));
});
test('Reverse workflow hides requests until dealer assignment and returns private resolution to Takipsan', async () => {
  assert.equal((await configure('contractor_first')).status,200);
  const t=await create();
  assert.equal(t.owner_org_id,1); assert.equal(t.dealer_involved,false);
  assert.equal((await req('dealer',`/tickets/${t.id}`)).status,404);
  const file='00000000-0000-4000-8000-000000000001';
  await db.query("INSERT INTO attachments(id,ticket_id,name,size,storage,object_key) VALUES($1,$2,'test.png',1,'local','test-flow.png')",[file,t.id]);
  assert.equal((await req('dealer',`/tickets/${t.id}/attachments/${file}`)).status,404);
  assert.equal((await action('contractor',t.id,{action:'assign',org_id:2,assignee_id:2})).status,200);
  assert.equal((await req('dealer',`/tickets/${t.id}`)).status,200);
  assert.equal((await action('contractor',t.id,{action:'comment',visibility:'public',body:'Cannot act after transfer'})).status,403);
  assert.equal((await action('dealer',t.id,{action:'comment',visibility:'public',body:'Must remain private'})).status,403);
  assert.equal((await action('dealer',t.id,{action:'close',body:'Cannot close this request.'})).status,403);
  assert.equal((await action('dealer',t.id,{action:'resolve',body:'Private Verimsoft technical solution.'})).status,200);
  const review=(await req('customer',`/tickets/${t.id}`)).data;
  assert.equal(review.owner_org_id,1); assert.equal(review.status,'review');
  assert.ok(!review.events.some(e=>e.body.includes('Private Verimsoft')));
  assert.equal((await action('contractor',t.id,{action:'close',body:'Final customer resolution.'})).status,400);
  assert.equal((await action('contractor',t.id,{action:'close',body:'Final customer resolution.',confirmed:true})).status,200);
  assert.equal((await req('customer',`/tickets/${t.id}`)).data.resolution.body,'Final customer resolution.');
});
test('Existing requests retain their routing and default dealer-first behavior remains intact', async () => {
  await configure('contractor_first'); const reversed=await create();
  await configure('contractor_only'); const direct=await create();
  await configure('dealer_first'); const original=await create();
  assert.equal((await req('contractor',`/tickets/${reversed.id}`)).data.support_flow,'contractor_first');
  assert.equal((await req('contractor',`/tickets/${direct.id}`)).data.dealer_id,null);
  assert.equal(original.owner_org_id,2);
  assert.equal((await req('contractor',`/tickets/${original.id}`)).status,404);
  assert.equal((await req('dealer','/tickets/1')).data.support_flow,'dealer_first');
  assert.equal((await action('dealer',original.id,{action:'assign',org_id:1})).status,200);
  assert.equal((await action('contractor',original.id,{action:'close',body:'Still cannot close legacy flow.'})).status,403);
  assert.equal((await action('contractor',original.id,{action:'resolve',body:'Original dealer-facing solution.'})).status,200);
  assert.equal((await action('dealer',original.id,{action:'close',body:'Original customer-facing solution.',confirmed:true})).status,200);
});

test('Only the assignee can transfer a personally assigned request until it returns to the queue', async () => {
  await configure('dealer_first');
  const t = await create();
  const colleague = (await db.query("INSERT INTO users(org_id,name,email,password_hash) VALUES(2,'Colleague','colleague@test.local',$1) RETURNING id", [hashPassword('Demo2026!')])).rows[0];
  cookies.colleague = (await req(null,'/login',{email:'colleague@test.local',password:'Demo2026!'})).cookie;
  assert.equal((await action('dealer',t.id,{action:'assign',org_id:2,assignee_id:colleague.id})).status,200);
  assert.equal((await req('dealer',`/tickets/${t.id}`)).data.assignee_name,'Colleague');
  assert.equal((await action('dealer',t.id,{action:'assign',org_id:1})).status,403);
  assert.equal((await action('dealer',t.id,{action:'assign',org_id:2})).status,403);
  assert.equal((await action('colleague',t.id,{action:'assign',org_id:2})).status,200);
  assert.equal((await action('dealer',t.id,{action:'assign',org_id:2,assignee_id:2})).status,200);
  assert.equal((await action('dealer',t.id,{action:'assign',org_id:1})).status,200);
});
