import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/auth.js';
let db,app,base,product,first;
const cookies={};
async function req(role,path,body) {
 const r=await fetch(base+'/api'+path,{headers:{Cookie:cookies[role]||'','Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const configure=product_id=>req('admin','/admin/organizations/3',{name:'Yargıcı',kind:'customer',product_id,program:'Spoofed name',daily_limit:100,support_chain:[2,1]});
async function create() {
 const r=await req('customer','/tickets',{title:'Product request',description:'Report by selected catalog product.',type:'Hata',severity:'s2',product_id:99999,program:'Spoofed product'});
 assert.equal(r.status,201);return r.data;
}
before(async()=>{
 db=await openDb({url:null,dir:':memory:'});await seed(db);
 await db.query("INSERT INTO users(org_id,name,email,password_hash,system_role) VALUES(1,'Admin','admin@test.local',$1,'super_admin')",[hashPassword('Demo2026!')]);
 app=await createApp(db);await app.listen(0,'127.0.0.1');base=await app.getUrl();
 for(const [role,email] of Object.entries({admin:'admin@test.local',customer:'musteri@yargici.demo',dealer:'bayi@verimsoft.demo',contractor:'bertan@bekatos.demo'})) cookies[role]=(await req(null,'/login',{email,password:'Demo2026!'})).cookie;
});
after(async()=>{await app?.close();});
test('Product catalog and reports are restricted to super admins',async()=>{
 assert.equal((await req(null,'/admin/products')).status,401);
 for(const role of ['customer','dealer','contractor']) {
  assert.equal((await req(role,'/admin/products')).status,403);
  assert.equal((await req(role,'/admin/products',{name:'Forbidden'})).status,403);
  assert.equal((await req(role,'/admin/products/1',{name:'Forbidden'})).status,403);
  assert.equal((await req(role,'/admin/reports?product_id=1')).status,403);
 }
});
test('Products validate names, reject case-insensitive duplicates and record audit events',async()=>{
 assert.equal((await req('admin','/admin/products',{name:' '})).status,400);
 const r=await req('admin','/admin/products',{name:' Catalog ERP '});assert.equal(r.status,201);product=r.data;
 assert.equal(product.name,'Catalog ERP');
 assert.equal((await req('admin','/admin/products',{name:'catalog erp'})).status,409);
 assert.equal((await req('admin','/admin/products/999999',{name:'Missing'})).status,404);
 assert.ok((await req('admin','/admin/audit')).data.some(a=>a.action==='product_created'));
});
test('Customers select valid catalog products and tickets snapshot the server-side selection',async()=>{
 assert.equal((await configure(999999)).status,400);
 const saved=await configure(product.id);assert.equal(saved.status,200);assert.equal(saved.data.program,'Catalog ERP');
 first=await create();assert.equal(first.product_id,product.id);assert.equal(first.program,'Catalog ERP');
 const products=(await req('admin','/admin/products')).data;
 assert.equal(products.find(p=>p.id===product.id).ticket_count,1);
 assert.equal(products.find(p=>p.id===product.id).customer_count,1);
});
test('Product renames and customer product changes preserve historical identity and names',async()=>{
 assert.equal((await req('admin','/admin/products/'+product.id,{name:'Renamed ERP'})).status,200);
 const old=(await req('customer','/tickets/'+first.id)).data;
 assert.equal(old.program,'Catalog ERP');assert.equal(old.product_id,product.id);
 const next=await create();assert.equal(next.program,'Renamed ERP');assert.equal(next.product_id,product.id);
 const another=(await req('admin','/admin/products',{name:'New Application'})).data;
 await configure(another.id);await create();
 await req('dealer',`/tickets/${first.id}/actions`,{action:'close',body:'Product issue resolved.'});
 const report=(await req('admin','/admin/reports?product_id='+product.id)).data;
 assert.equal(report.total,2);assert.ok(report.rows.every(t=>t.product_id===product.id));
 assert.deepEqual(report.byProduct,[{id:product.id,name:'Renamed ERP',count:2,open:1,closed:1}]);
 const closed=(await req('admin',`/admin/reports?product_id=${product.id}&status=closed`)).data;
 assert.equal(closed.total,1);assert.equal(closed.byProduct[0].closed,1);
 const empty=(await req('admin',`/admin/reports?product_id=${product.id}&from=2099-01-01`)).data;
 assert.equal(empty.total,0);assert.equal(empty.byProduct[0].count,0);
});
test('Legacy program migration consolidates names, preserves ticket text, and is idempotent',async()=>{
 await db.query("UPDATE organizations SET product_id=NULL,program=' Legacy CRM ' WHERE id=5");
 await db.query("UPDATE tickets SET product_id=NULL,program='legacy crm' WHERE id=1");
 const sql=await readFile(new URL('../server/schema.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql);
 const company=(await db.query('SELECT * FROM organizations WHERE id=5')).rows[0];
 const ticket=(await db.query('SELECT * FROM tickets WHERE id=1')).rows[0];
 assert.equal(ticket.product_id,company.product_id);assert.ok(ticket.product_id);
 assert.equal(ticket.program,'legacy crm');
 assert.equal((await db.query("SELECT count(*)::int count FROM products WHERE lower(btrim(name))='legacy crm'")).rows[0].count,1);
 assert.equal((await db.query('SELECT program,product_id FROM tickets WHERE id=$1',[first.id])).rows[0].product_id,product.id);
});
