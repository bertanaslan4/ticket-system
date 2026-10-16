import { randomInt } from "node:crypto";

// No 0/O/1/I so codes can be read aloud or typed from a screenshot without mistakes.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 6) {
  let suffix = "";
  for (let i = 0; i < length; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `BKT-${suffix}`;
}

/** Returns a code not used by any tenant. Must run inside the transaction that stores it. */
export async function uniqueInviteCode(tx: any) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode();
    const taken = (
      await tx.query("SELECT 1 FROM tenants WHERE upper(btrim(invite_code))=$1", [code])
    ).rows[0];
    if (!taken) return code;
  }
  throw new Error("invite_code_generation_failed");
}
