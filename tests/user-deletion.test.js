import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/auth.js';
let db, app, base, admin, customer;
async function req(cookie, path, body) {
  const r = await fetch(base + '/api' + path, { headers: { Cookie: cookie || '', 'Content-Type': 'application/json' }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
  return { status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
before(async () => {
  db = await openDb({ url: null, dir: ':memory:' }); await seed(db);
  await db.query("INSERT INTO users(org_id,name,email,password_hash,system_role) VALUES(1,'Admin','admin@test.local',$1,'super_admin')", [hashPassword('AdminPassword!')]);
  app = await createApp(db); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
  admin = (await req(null, '/login', { email: 'admin@test.local', password: 'AdminPassword!' })).cookie;
  customer = (await req(null, '/login', { email: 'musteri@yargici.demo', password: 'Demo2026!' })).cookie;
});
after(async () => { await app?.close(); });
test('Deletion requires super admin and protects own account', async () => {
  assert.equal((await req(null, '/admin/users/2/delete', {})).status, 401);
  assert.equal((await req(customer, '/admin/users/2/delete', {})).status, 403);
  const me = (await req(admin, '/me')).data;
  assert.equal((await req(admin, `/admin/users/${me.id}/delete`, {})).status, 400);
  assert.equal((await req(admin, '/admin/users/99999/delete', {})).status, 404);
});
test('Deletion hides user, revokes access, preserves history and cannot be undone through edit', async () => {
  const tickets = (await db.query('SELECT count(*) FROM tickets')).rows[0].count;
  const events = (await db.query('SELECT count(*) FROM events')).rows[0].count;
  assert.equal((await req(admin, '/admin/users/1/delete', {})).status, 200);
  assert.equal((await req(admin, '/admin/users')).data.some(u => u.id === 1), false);
  assert.equal((await req(customer, '/me')).status, 401);
  assert.equal((await req(null, '/login', { email: 'musteri@yargici.demo', password: 'Demo2026!' })).status, 401);
  assert.equal((await req(admin, '/admin/users/1', { name:'Restored', email:'musteri@yargici.demo', org_id:3, system_role:'member', active:true })).status, 404);
  assert.equal((await req(admin, '/admin/users/1/delete', {})).status, 404);
  const stored = (await db.query('SELECT active,deleted_at FROM users WHERE id=1')).rows[0];
  assert.equal(stored.active, false); assert.ok(stored.deleted_at);
  assert.equal((await db.query('SELECT count(*) FROM tickets')).rows[0].count, tickets);
  assert.equal((await db.query('SELECT count(*) FROM events')).rows[0].count, events);
  assert.equal((await req(admin, '/tickets/1')).status, 200);
  const audit = (await db.query("SELECT details FROM admin_audit WHERE action='user_deleted' AND target_id=1")).rows;
  assert.equal(audit.length, 1); assert.equal(JSON.stringify(audit).includes('password'), false);
});
