import { newToken, tokenHash } from "../auth.js";
import type { MailService } from "../mail/mail.service.js";

export type AuthTokenKind = "password_reset" | "email_verify";

const TTL: Record<AuthTokenKind, string> = {
  password_reset: "1 hour",
  email_verify: "24 hours",
};

export function appOrigin() {
  return (
    process.env.MAIL_APP_URL ||
    process.env.APP_ORIGIN ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * Creates a single-use token (stored hashed) and queues the email carrying the link.
 * Older unused tokens of the same kind are revoked so only the newest link works.
 */
export async function issueAuthToken(
  tx: any,
  mail: MailService,
  user: { id: number; name: string; email: string },
  kind: AuthTokenKind,
) {
  await tx.query(
    "UPDATE auth_tokens SET used_at=now() WHERE user_id=$1 AND kind=$2 AND used_at IS NULL",
    [user.id, kind],
  );
  const token = newToken();
  await tx.query(
    "INSERT INTO auth_tokens(user_id,kind,token_hash,expires_at) VALUES($1,$2,$3,now()+$4::interval)",
    [user.id, kind, tokenHash(token), TTL[kind]],
  );
  const param = kind === "password_reset" ? "reset" : "verify";
  await mail.enqueueAuthMail(
    tx,
    user,
    kind,
    `${appOrigin()}/login?${param}=${token}`,
  );
}
