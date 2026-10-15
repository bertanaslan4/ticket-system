import { fail } from "./domain.js";
export const str = (v, min = 1, max = 180) => {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
    fail(400, "validation_text_length", { min, max });
  return v.trim();
};
export const integer = (v) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 1)
    fail(400, "enter_a_valid_positive_integer");
  return n;
};
export const option = (v, a) => {
  if (!a.includes(v)) fail(400, "invalid_selection");
  return v;
};
export const email = (v) => {
  v = str(v, 3, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    fail(400, "enter_a_valid_email_address");
  return v;
};
export const audit = (tx, u, action, id, details) =>
  tx.query(
    "INSERT INTO admin_audit(actor_id,action,target_id,details) VALUES($1,$2,$3,$4)",
    [u.id, action, id, JSON.stringify(details)],
  );
