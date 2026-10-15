import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { verifyPassword } from '../server/auth.js';
import { importDealerUsers } from '../scripts/import-dealer-users.js';

test('Dealer import hashes eight-character passwords, is idempotent, and rolls back company conflicts', async () => {
  const db = await openDb({ url: null, dir: ':memory:' });
  try {
    await db.query("INSERT INTO organizations(name,kind) VALUES('Test Dealer','dealer'),('Other Dealer','dealer')");
    const accounts = [{ name: 'Example User', email: 'user@example.test' }];
    await assert.rejects(importDealerUsers(db, 'Test Dealer', accounts, '1234567'));
    assert.equal((await importDealerUsers(db, 'Test Dealer', accounts, '12345678'))[0].status, 'created');
    const user = (await db.query('SELECT * FROM users')).rows[0];
    assert.equal(user.org_id, 1); assert.equal(user.system_role, 'member');
    assert.ok(verifyPassword('12345678', user.password_hash));
    assert.equal((await importDealerUsers(db, 'Test Dealer', accounts, '87654321'))[0].status, 'exists_unchanged');
    assert.equal((await db.query('SELECT password_hash FROM users')).rows[0].password_hash, user.password_hash);
    await assert.rejects(importDealerUsers(db, 'Other Dealer', [{ name: 'New User', email: 'new@example.test' }, ...accounts], '12345678'));
    assert.equal(Number((await db.query('SELECT count(*) FROM users')).rows[0].count), 1);
  } finally { await db.close(); }
});
