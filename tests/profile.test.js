import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/auth.js';
let db, app, base;
async function request(path, body, cookie) {
  return fetch(base + '/api' + path, { headers: { 'Content-Type': 'application/json', Cookie: cookie || '' }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
}
async function login(email, password = 'Demo2026!') {
  const r = await request('/login', { email, password });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}
before(async () => {
  db = await openDb({ url: null, dir: ':memory:' });
  await seed(db);
  await db.query("INSERT INTO users(org_id,name,email,password_hash,system_role) VALUES(1,'Admin','admin@test.local',$1,'super_admin')", [hashPassword('Demo2026!')]);
  app = await createApp(db); await app.listen(0, '127.0.0.1'); base = await app.getUrl();
});
after(async () => { await app?.close(); });
const change = (cookie, currentPassword, newPassword = 'New2026!', confirmPassword = newPassword, extra = {}) => request('/me/password', { currentPassword, newPassword, confirmPassword, ...extra }, cookie);
test('Password changes require authentication and validate current password, length and confirmation', async () => {
  assert.equal((await change(null, 'Demo2026!')).status, 401);
  const cookie = await login('musteri@yargici.demo');
  for (const args of [['wrong'], ['Demo2026!', '1234567'], ['Demo2026!', 'New2026!', 'different'], ['Demo2026!', ' New2026!']]) {
    assert.equal((await change(cookie, ...args)).status, 400);
  }
  await login('musteri@yargici.demo');
});
test('All roles can change only their own password; other sessions expire', async () => {
  for (const email of ['musteri@yargici.demo', 'bayi@verimsoft.demo', 'bertan@bekatos.demo', 'admin@test.local']) {
    const cookie = await login(email), other = await login(email);
    const beforeOther = (await db.query('SELECT password_hash FROM users WHERE id=3')).rows[0].password_hash;
    assert.equal((await change(cookie, 'Demo2026!', undefined, undefined, { userId: 3 })).status, 200);
    assert.equal((await request('/me', null, cookie)).status, 200);
    assert.equal((await request('/me', null, other)).status, 401);
    assert.equal((await request('/login', { email, password: 'Demo2026!' })).status, 401);
    await login(email, 'New2026!');
    assert.equal((await db.query('SELECT password_hash FROM users WHERE id=3')).rows[0].password_hash, beforeOther);
  }
});
test('Repeated password change requests are rate limited', async () => {
  const cookie = await login('musteri@yargici.demo', 'New2026!');
  let response;
  for (let i = 0; i < 11; i++) response = await change(cookie, 'incorrect');
  assert.equal(response.status, 429);
});
