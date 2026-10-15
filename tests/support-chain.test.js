import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/auth.js';
import { readFile } from 'node:fs/promises';
let db, app, base, c, outsider;
const cookies = {};
async function req(role, path, body) {
  const r = await fetch(base + '/api' + path, {headers:{Cookie:cookies[role] || '', 'Content-Type':'application/json'}, ...(body ? {method:'POST',body:JSON.stringify(body)} : {})});
  return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const action = (role,id,body) => req(role,`/tickets/${id}/actions`,body);
const configure = chain => req('admin','/admin/organizations/3',{name:'Yargıcı',kind:'customer',program:'ushops',daily_limit:100,support_chain:chain});
async function create(role='customer') {
  const r=await req(role,'/tickets',{title:'Dynamic chain',description:'Customer-specific support routing.',type:'Hata',severity:'s2',support_chain:[999],owner_org_id:999});
  assert.equal(r.status,201); return r.data;
}
before(async () => {
  db=await openDb({url:null,dir:':memory:'}); await seed(db);
  await db.query("INSERT INTO users(org_id,name,email,password_hash,system_role) VALUES(1,'Admin','admin@test.local',$1,'super_admin')",[hashPassword('Demo2026!')]);
  app=await createApp(db); await app.listen(0,'127.0.0.1'); base=await app.getUrl();
  for(const [role,email] of Object.entries({admin:'admin@test.local',customer:'musteri@yargici.demo',a:'bayi@verimsoft.demo',colleague:'mehmet@verimsoft.demo',b:'bertan@bekatos.demo'})) cookies[role]=(await req(null,'/login',{email,password:'Demo2026!'})).cookie;
  for (const role of ['c','outsider']) {
    const company=await req('admin','/admin/organizations',{name:'Support '+role,kind:'support'});
    assert.equal(company.status,201);
    if(role==='c') c=company.data.id; else outsider=company.data.id;
    await req('admin','/admin/users',{name:'Agent '+role,email:role+'@test.local',org_id:company.data.id,password:'Demo2026!',system_role:'member',active:true});
    cookies[role]=(await req(null,'/login',{email:role+'@test.local',password:'Demo2026!'})).cookie;
  }
});
after(async () => {await app?.close();});

test('Admin defines ordered support companies without global dealer/contractor restrictions',async()=>{
  for(const chain of [[],[2,2],[3],[999999],[0],['2']]) assert.equal((await configure(chain)).status,400);
  assert.equal((await req('a','/admin/organizations/3',{support_chain:[2,1,c]})).status,403);
  assert.equal((await configure([2,1,c])).status,200);
  const org=(await req('admin','/admin/organizations')).data.find(o=>o.id===3);
  assert.deepEqual(org.support_chain,[2,1,c]);
  const audit=(await req('admin','/admin/audit')).data;
  assert.ok(audit.some(a=>JSON.stringify(a.details).includes('support_chain')));
});
test('Requests start with the first company; visibility, targets and mail follow adjacent assignments',async()=>{
  const t=await create();
  assert.deepEqual(t.support_chain,[2,1,c]); assert.equal(t.owner_org_id,2);
  const file='00000000-0000-4000-8000-000000000002';
  await db.query("INSERT INTO attachments(id,ticket_id,name,size,storage,object_key) VALUES($1,$2,'chain.png',1,'local','chain.png')",[file,t.id]);
  assert.equal((await req('c',`/tickets/${t.id}/attachments/${file}`)).status,404);
  for(const role of ['b','c','outsider']) {
    assert.equal((await req(role,`/tickets/${t.id}`)).status,404);
    assert.ok(!(await req(role,'/tickets')).data.some(x=>x.id===t.id));
  }
  let detail=(await req('a',`/tickets/${t.id}`)).data;
  assert.deepEqual(detail.orgs.map(o=>o.id),[2,1]);
  assert.ok(detail.targets.every(u=>[2,1].includes(u.org_id)));
  assert.equal((await action('a',t.id,{action:'assign',org_id:c})).status,403);
  assert.equal((await action('a',t.id,{action:'assign',org_id:outsider})).status,403);
  assert.equal((await action('a',t.id,{action:'assign',org_id:1,assignee_id:2})).status,400);
  assert.equal((await action('a',t.id,{action:'assign',org_id:2,assignee_id:3})).status,200);
  assert.equal((await action('a',t.id,{action:'assign',org_id:1})).status,403);
  assert.equal((await action('colleague',t.id,{action:'assign',org_id:1})).status,200);
  assert.equal((await action('a',t.id,{action:'assign',org_id:2})).status,403);
  assert.equal((await action('a',t.id,{action:'close',body:'Not current owner.'})).status,403);
  assert.equal((await req('c',`/tickets/${t.id}`)).status,404);
  detail=(await req('b',`/tickets/${t.id}`)).data;
  assert.deepEqual(detail.orgs.map(o=>o.id),[2,1,c]);
  assert.equal((await action('b',t.id,{action:'assign',org_id:c})).status,200);
  const mails=(await db.query('SELECT u.org_id FROM mail_outbox m JOIN users u ON u.id=m.user_id JOIN events e ON e.id=m.event_id WHERE e.ticket_id=$1',[t.id])).rows;
  assert.ok(mails.some(m=>m.org_id===c)); assert.ok(mails.every(m=>[2,1,c].includes(m.org_id)));
  assert.equal((await action('c',t.id,{action:'assign',org_id:2})).status,403);
  assert.equal((await action('c',t.id,{action:'resolve',body:'Private C solution.'})).status,200);
  assert.equal((await req('b',`/tickets/${t.id}`)).data.owner_org_id,1);
  assert.equal((await action('b',t.id,{action:'resolve',body:'Private B validation.'})).status,200);
  assert.equal((await action('a',t.id,{action:'close',body:'Public final solution.',confirmed:true})).status,200);
  const customer=(await req('customer',`/tickets/${t.id}`)).data;
  assert.equal(customer.resolution.body,'Public final solution.');
  assert.ok(!JSON.stringify(customer).includes('Private C solution'));
  assert.ok(!JSON.stringify(customer).includes('Private B validation'));
});
test('Every current support level may close with a public resolution, including the last company',async()=>{
  for(const level of [0,1,2]) {
    const t=await create();
    if(level>=1) await action('a',t.id,{action:'assign',org_id:1});
    if(level>=2) await action('b',t.id,{action:'assign',org_id:c});
    const role=['a','b','c'][level];
    await action(role,t.id,{action:'comment',visibility:'internal',body:'Internal technical note'});
    if(level===2) {
      const event=(await db.query("SELECT id FROM events WHERE ticket_id=$1 AND visibility='internal' ORDER BY id DESC LIMIT 1",[t.id])).rows[0];
      const file='00000000-0000-4000-8000-000000000003';
      await db.query("INSERT INTO attachments(id,ticket_id,event_id,name,size,storage,object_key) VALUES($1,$2,$3,'private.png',1,'local','chain-private.png')",[file,t.id,event.id]);
      assert.equal((await req('customer',`/tickets/${t.id}/attachments/${file}`)).status,404);
    }
    assert.equal((await action(role,t.id,{action:'close',body:'Public resolution at level '+level})).status,200);
    const detail=(await req('customer',`/tickets/${t.id}`)).data;
    assert.equal(detail.resolution.body,'Public resolution at level '+level);
    assert.ok(!JSON.stringify(detail).includes('Internal technical note'));
    const payload=(await db.query("SELECT payload FROM mail_outbox WHERE kind='closed' AND event_id IN (SELECT id FROM events WHERE ticket_id=$1)",[t.id])).rows;
    assert.equal(payload.length,1); assert.ok(!JSON.stringify(payload).includes('Internal technical note'));
  }
});
test('Different customers can place the same company at different levels; changes do not affect existing tickets',async()=>{
  const old=await create();
  assert.equal((await configure([1,c,2])).status,200);
  const newer=await create(); assert.equal(newer.owner_org_id,1);
  assert.equal((await req('a',`/tickets/${newer.id}`)).status,404);
  assert.deepEqual((await req('a',`/tickets/${old.id}`)).data.support_chain,[2,1,c]);
  const customer=await req('admin','/admin/organizations',{name:'Customer Y',kind:'customer',program:'ERP',daily_limit:10,support_chain:[c,2]});
  assert.equal(customer.status,201);
  await req('admin','/admin/users',{name:'Y',email:'y@test.local',org_id:customer.data.id,password:'Demo2026!',system_role:'member',active:true});
  cookies.y=(await req(null,'/login',{email:'y@test.local',password:'Demo2026!'})).cookie;
  const y=await create('y'); assert.equal(y.owner_org_id,c);
  assert.equal((await req('customer',`/tickets/${y.id}`)).status,404);
  const report=(await req('admin','/admin/reports?support_org_id='+c)).data;
  assert.ok(report.rows.some(r=>r.id===y.id));
  assert.ok(report.rows.some(r=>r.id===newer.id));
});
test('One support company can handle and close a request without a fixed Takipsan dependency',async()=>{
  await configure([c]); const t=await create();
  const detail=(await req('c',`/tickets/${t.id}`)).data;
  assert.deepEqual(detail.orgs.map(o=>o.id),[c]);
  assert.equal((await action('c',t.id,{action:'resolve',body:'Cannot return further.'})).status,403);
  assert.equal((await action('c',t.id,{action:'comment',visibility:'public',body:'Public progress'})).status,200);
  assert.equal((await action('c',t.id,{action:'close',body:'One-company resolution.'})).status,200);
  assert.equal((await req('b',`/tickets/${t.id}`)).status,404);
});
test('Startup migration preserves explicit chains and historical tickets and converts legacy customer presets once',async()=>{
  const sql=await readFile(new URL('../server/schema.sql',import.meta.url),'utf8');
  const before=(await db.query('SELECT count(*) FROM tickets')).rows[0].count;
  await db.exec(sql); await db.exec(sql);
  assert.deepEqual((await db.query('SELECT support_chain FROM organizations WHERE id=3')).rows[0].support_chain,[c]);
  assert.deepEqual((await db.query('SELECT support_chain FROM organizations WHERE id=5')).rows[0].support_chain,[4,1]);
  assert.equal((await db.query('SELECT support_chain FROM tickets WHERE id=1')).rows[0].support_chain,null);
  assert.equal((await db.query('SELECT count(*) FROM tickets')).rows[0].count,before);
});
