export const fail = (code, message, params = {}) => {
  throw Object.assign(new Error(message), { status: code, params });
};
export const text = (v, min = 1, max = 10000) => {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
    fail(400, "validation_text_length", { min, max });
  return v.trim();
};
export const choice = (v, values) => {
  if (!values.includes(v)) fail(400, "invalid_selection");
  return v;
};
export const userSql = `SELECT u.id,u.name,u.email,u.org_id,u.tenant_id,o.name org_name,t.name tenant_name,t.slug tenant_slug,t.plan_tier,t.status tenant_status,t.agent_limit,t.storage_limit_mb,CASE WHEN u.system_role='super_admin' THEN 'super_admin' ELSE o.kind END role,o.program,o.daily_limit FROM users u JOIN organizations o ON o.id=u.org_id JOIN tenants t ON t.id=u.tenant_id`;
