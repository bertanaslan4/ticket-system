// Usage: INITIAL_USER_PASSWORD=... node scripts/import-dealer-users.js 'Dealer name' < users.json
// Personal details and plaintext passwords are supplied at runtime, never stored in this script.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { openDb } from '../server/db.js';
import { hashPassword } from '../server/auth.js';

export async function importDealerUsers(db, company, accounts, password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 200 || password !== password.trim())
    throw new Error('Password must contain 8–200 characters without outer whitespace.');
  if (!company || !Array.isArray(accounts) || !accounts.length || accounts.length > 100)
    throw new Error('Company name and 1–100 accounts required.');
  const emails = new Set();
  const normalized = accounts.map(account => {
    const name = typeof account.name === 'string' ? account.name.trim() : '';
    const email = typeof account.email === 'string' ? account.email.trim().toLowerCase() : '';
    if (!name || name.length > 200 || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || emails.has(email))
      throw new Error('Invalid or duplicate account in input.');
    emails.add(email);
    return { name, email };
  });
  return db.transaction(async tx => {
    await tx.query('LOCK TABLE organizations, users IN SHARE ROW EXCLUSIVE MODE');
    const orgs = (await tx.query("SELECT id,COALESCE(tenant_id,1) tenant_id FROM organizations WHERE lower(name)=lower($1) AND kind='dealer'", [company])).rows;
    if (orgs.length !== 1) throw new Error('Exactly one matching dealer company must exist.');
    const results = [];
    for (const account of normalized) {
      const existing = (await tx.query('SELECT org_id,system_role FROM users WHERE lower(email)=$1', [account.email])).rows;
      if (existing.length) {
        if (existing.length !== 1 || existing[0].org_id !== orgs[0].id || existing[0].system_role !== 'member')
          throw new Error(`Account conflict: ${account.email}`);
        results.push({ email: account.email, status: 'exists_unchanged' });
        continue;
      }
      await tx.query("INSERT INTO users(tenant_id,org_id,name,email,password_hash,system_role,active) VALUES($1,$2,$3,$4,$5,'member',true)",
        [orgs[0].tenant_id, orgs[0].id, account.name, account.email, hashPassword(password)]);
      results.push({ email: account.email, status: 'created' });
    }
    return results;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let db;
  try {
    process.loadEnvFile('.env');
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required.');
    const accounts = JSON.parse(readFileSync(0, 'utf8'));
    db = await openDb();
    console.table(await importDealerUsers(db, process.argv[2], accounts, process.env.INITIAL_USER_PASSWORD));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally { await db?.close(); }
}
