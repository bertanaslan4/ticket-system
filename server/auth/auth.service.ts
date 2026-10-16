import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { MailService } from "../mail/mail.service.js";
import { fail, text, choice, userSql } from "../common/domain.js";
import { issueAuthToken } from "../common/auth-tokens.js";
import { verifyPassword, hashPassword, tokenHash, newToken } from "../auth.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly mail: MailService,
  ) {}
  /** Always answers ok so the endpoint cannot be used to discover registered addresses. */
  async forgotPassword(body: any) {
    const email = text(body.email, 3, 200).toLowerCase();
    await this.database.transaction(async (tx) => {
      const found = (
        await tx.query(
          "SELECT u.id,u.name,u.email FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.email=$1 AND u.active=true AND u.deleted_at IS NULL AND t.status<>'suspended'",
          [email],
        )
      ).rows[0];
      if (found) await issueAuthToken(tx, this.mail, found, "password_reset");
    });
    return { ok: true };
  }
  async resetPassword(body: any) {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!/^[a-f0-9]{64}$/.test(token)) fail(400, "invalid_or_expired_token");
    const password = text(body.newPassword, 8, 200);
    if (password !== body.newPassword) fail(400, "password_no_outer_spaces");
    if (body.confirmPassword !== undefined && password !== body.confirmPassword)
      fail(400, "password_confirmation_mismatch");
    await this.database.transaction(async (tx) => {
      const row = (
        await tx.query(
          "SELECT id,user_id FROM auth_tokens WHERE token_hash=$1 AND kind='password_reset' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
          [tokenHash(token)],
        )
      ).rows[0];
      if (!row) fail(400, "invalid_or_expired_token");
      const user = (
        await tx.query(
          "SELECT id FROM users WHERE id=$1 AND active=true AND deleted_at IS NULL FOR UPDATE",
          [row.user_id],
        )
      ).rows[0];
      if (!user) fail(400, "invalid_or_expired_token");
      // Receiving the link proves control of the mailbox, so the address counts as verified.
      await tx.query(
        "UPDATE users SET password_hash=$1,email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$2",
        [hashPassword(password), user.id],
      );
      await tx.query(
        "UPDATE auth_tokens SET used_at=now() WHERE user_id=$1 AND kind='password_reset' AND used_at IS NULL",
        [user.id],
      );
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
    });
    return { ok: true };
  }
  async verifyEmail(body: any) {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!/^[a-f0-9]{64}$/.test(token)) fail(400, "invalid_or_expired_token");
    await this.database.transaction(async (tx) => {
      const row = (
        await tx.query(
          "SELECT id,user_id FROM auth_tokens WHERE token_hash=$1 AND kind='email_verify' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
          [tokenHash(token)],
        )
      ).rows[0];
      if (!row) fail(400, "invalid_or_expired_token");
      await tx.query("UPDATE auth_tokens SET used_at=now() WHERE id=$1", [
        row.id,
      ]);
      await tx.query(
        "UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$1",
        [row.user_id],
      );
    });
    return { ok: true };
  }
  async resendVerification(user: any) {
    await this.database.transaction(async (tx) => {
      const current = (
        await tx.query(
          "SELECT id,name,email,email_verified_at FROM users WHERE id=$1 FOR UPDATE",
          [user.id],
        )
      ).rows[0];
      if (!current || current.email_verified_at) return;
      const recent = (
        await tx.query(
          "SELECT 1 FROM auth_tokens WHERE user_id=$1 AND kind='email_verify' AND created_at>now()-interval '60 seconds'",
          [user.id],
        )
      ).rows[0];
      if (recent) fail(429, "verification_resend_too_soon");
      await issueAuthToken(tx, this.mail, current, "email_verify");
    });
    return { ok: true };
  }
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
  async authenticate(
    cookie: string | undefined,
    authorization?: string | undefined,
  ): Promise<any> {
    const db = this.database;
    const cookieToken = cookie?.match(
      /(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/,
    )?.[1];
    const bearerToken = authorization?.match(
      /^Bearer\s+([a-f0-9]{64})$/i,
    )?.[1];
    const token = cookieToken || bearerToken;
    if (!token) fail(401, "please_sign_in");
    const user = (
      await db.query(
        `${userSql} JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true`,
        [tokenHash(token)],
      )
    ).rows[0];
    if (!user) fail(401, "your_session_has_expired");
    if (user.tenant_status === "suspended")
      fail(403, "tenant_account_suspended");
    return { user, token };
  }
  async registerPushToken(user: any, body: any) {
    const token = text(body.token, 8, 256);
    const platform = choice(body.platform ?? "expo", [
      "expo",
      "ios",
      "android",
    ]);
    const tenantId = user.tenant_id || 1;
    const row = (
      await this.database.query(
        `INSERT INTO push_tokens(tenant_id, user_id, token, platform, updated_at)
         VALUES($1, $2, $3, $4, now())
         ON CONFLICT(user_id, token)
         DO UPDATE SET platform = EXCLUDED.platform, updated_at = now()
         RETURNING id, user_id, tenant_id, token, platform, updated_at`,
        [tenantId, user.id, token, platform],
      )
    ).rows[0];
    return row;
  }
  async removePushToken(user: any, body: any) {
    const token = text(body.token, 8, 256);
    await this.database.query(
      "DELETE FROM push_tokens WHERE user_id=$1 AND token=$2",
      [user.id, token],
    );
    return { ok: true };
  }
  async listNotifications(user: any) {
    const tenantId = user.tenant_id || 1;
    return (
      await this.database.query(
        `SELECT id, ticket_id, event_id, kind, title, body, data, status, created_at
         FROM push_outbox
         WHERE user_id = $1 AND tenant_id = $2
         ORDER BY id DESC
         LIMIT 50`,
        [user.id, tenantId],
      )
    ).rows;
  }
}
