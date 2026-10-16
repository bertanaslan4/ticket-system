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
export const userSql = `SELECT u.id,u.name,u.email,u.org_id,u.tenant_id,o.name org_name,t.name tenant_name,t.slug tenant_slug,t.plan_tier,t.status tenant_status,t.agent_limit,t.storage_limit_mb,t.invite_code,t.industry_template,t.customer_org_limit,t.monthly_ticket_limit,CASE WHEN u.system_role='super_admin' THEN 'super_admin' ELSE o.kind END role,o.program,o.daily_limit FROM users u JOIN organizations o ON o.id=u.org_id JOIN tenants t ON t.id=u.tenant_id`;

export const DEFAULT_SLA_TARGETS: Record<string, { first_response_target_minutes: number; resolution_target_minutes: number }> = {
  s1: { first_response_target_minutes: 60, resolution_target_minutes: 240 },
  s2: { first_response_target_minutes: 240, resolution_target_minutes: 1440 },
  s3: { first_response_target_minutes: 480, resolution_target_minutes: 2880 },
};

export function enrichTicketSla(t: any, nowMs = Date.now()) {
  if (!t) return t;
  const createdMs = t.created_at ? new Date(t.created_at).getTime() : nowMs;
  const firstRespDueMs = t.sla_first_response_due_at
    ? new Date(t.sla_first_response_due_at).getTime()
    : null;
  const resDueMs = t.sla_resolution_due_at
    ? new Date(t.sla_resolution_due_at).getTime()
    : null;
  const firstRespMs = t.first_responded_at
    ? new Date(t.first_responded_at).getTime()
    : null;
  const closedMs = t.closed_at
    ? new Date(t.closed_at).getTime()
    : t.status === "closed" && t.updated_at
      ? new Date(t.updated_at).getTime()
      : null;

  const firstResponseBreached =
    firstRespDueMs != null
      ? firstRespMs != null
        ? firstRespMs > firstRespDueMs
        : t.status !== "closed" && nowMs > firstRespDueMs
      : false;

  const resolutionBreached =
    resDueMs != null
      ? t.status === "closed"
        ? closedMs != null && closedMs > resDueMs
        : nowMs > resDueMs
      : false;

  let slaStatus: "breached" | "at_risk" | "met" | "on_track" = "on_track";
  if (firstResponseBreached || resolutionBreached) {
    slaStatus = "breached";
  } else if (t.status === "closed") {
    slaStatus = "met";
  } else {
    const activeDueMs = firstRespMs == null ? firstRespDueMs ?? resDueMs : resDueMs;
    if (
      activeDueMs != null &&
      activeDueMs > createdMs &&
      activeDueMs - nowMs <= 0.25 * (activeDueMs - createdMs)
    ) {
      slaStatus = "at_risk";
    }
  }

  return {
    ...t,
    sla_first_response_breached: firstResponseBreached,
    sla_resolution_breached: resolutionBreached,
    sla_status: slaStatus,
  };
}

export async function applyTicketSlaTargets(tx: any, ticket: any) {
  const tenantId = ticket.tenant_id || 1;
  const severity = ticket.severity || "s2";
  const policy =
    (
      await tx.query(
        "SELECT first_response_target_minutes, resolution_target_minutes FROM sla_policies WHERE tenant_id=$1 AND severity=$2",
        [tenantId, severity],
      )
    ).rows[0] || DEFAULT_SLA_TARGETS[severity] || DEFAULT_SLA_TARGETS.s2;
  const updated = (
    await tx.query(
      "UPDATE tickets SET sla_first_response_due_at = created_at + make_interval(mins => $1), sla_resolution_due_at = created_at + make_interval(mins => $2) WHERE id=$3 RETURNING sla_first_response_due_at, sla_resolution_due_at",
      [
        policy.first_response_target_minutes,
        policy.resolution_target_minutes,
        ticket.id,
      ],
    )
  ).rows[0];
  if (updated) {
    ticket.sla_first_response_due_at = updated.sla_first_response_due_at;
    ticket.sla_resolution_due_at = updated.sla_resolution_due_at;
  }
  return ticket;
}

