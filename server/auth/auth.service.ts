import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { fail, text, choice, userSql } from "../common/domain.js";
import { verifyPassword, hashPassword, tokenHash, newToken } from "../auth.js";

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}
  async changePassword(user: any, token: string, body: any) {
    const current = text(body.currentPassword, 1, 200);
    const password = text(body.newPassword, 8, 200);
    if (password !== body.newPassword) fail(400, "password_no_outer_spaces");
    if (password !== body.confirmPassword) fail(400, "password_confirmation_mismatch");
    if (current === password) fail(400, "password_must_be_different");
    await this.database.transaction(async tx => {
      const found = (await tx.query('SELECT password_hash FROM users WHERE id=$1 AND active=true FOR UPDATE', [user.id])).rows[0];
      const session = (await tx.query('SELECT 1 FROM sessions WHERE user_id=$1 AND token_hash=$2 AND expires_at>now()', [user.id, tokenHash(token)])).rows[0];
      if (!found || !session) fail(401, "your_session_has_expired");
      if (!verifyPassword(current, found.password_hash)) fail(400, "current_password_incorrect");
      await tx.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hashPassword(password), user.id]);
      await tx.query('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2', [user.id, tokenHash(token)]);
    });
    return { ok: true };
  }
  async login(body: any): Promise<any> {
    const db = this.database;
    const email = text(body.email, 3, 200).toLowerCase(),
      password = text(body.password, 1, 200);
    const found = (
      await db.query("SELECT u.*,t.status tenant_status FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.email=$1", [email])
    ).rows[0];
    if (
      !found ||
      !found.active ||
      !verifyPassword(password, found.password_hash)
    )
      fail(401, "incorrect_email_or_password");
    if (found.tenant_status === "suspended")
      fail(403, "tenant_account_suspended");
    const token = newToken();
    await db.query(
      "INSERT INTO sessions VALUES($1,$2,now()+interval '8 hours')",
      [tokenHash(token), found.id],
    );
    return token;
  }
  async me(user: any): Promise<any> {
    const db = this.database;
    const used = Number(
      (
        await db.query(
          "SELECT count(*) FROM tickets WHERE customer_id=$1 AND (created_at AT TIME ZONE 'Europe/Istanbul')::date=(now() AT TIME ZONE 'Europe/Istanbul')::date",
          [user.org_id],
        )
      ).rows[0].count,
    );
    return { ...user, used };
  }
  async logout(token: string): Promise<any> {
    const db = this.database;
    await db.query("DELETE FROM sessions WHERE token_hash=$1", [
      tokenHash(token),
    ]);
    return { ok: true };
  }
  async authenticate(cookie: string | undefined): Promise<any> {
    const db = this.database;
    const token = cookie?.match(/(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (!token) fail(401, "please_sign_in");
    const user = (
      await db.query(
        `${userSql} JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true`,
        [tokenHash(token)],
      )
    ).rows[0];
    if (!user) fail(401, "your_session_has_expired");
    if (user.tenant_status === "suspended") fail(403, "tenant_account_suspended");
    return { user, token };
  }
}
