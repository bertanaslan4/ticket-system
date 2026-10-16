import { MailService } from "../mail/mail.service.js";
import { AttachmentStorage } from "./attachments.js";
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { fail, text, choice, userSql, enrichTicketSla, applyTicketSlaTargets } from "../common/domain.js";
import { translate } from "../../shared/i18n.js";
import { customerContactRole, isCustomerContact, adjacentSupportCompanies, previousSupportCompany } from '../../shared/support-flow.js';
function access(u, t) {
  if ((t.tenant_id || 1) !== (u.tenant_id || 1)) return false;
  if (u.role === "super_admin") return true;
  if (t.support_chain?.length) return u.role === 'customer'
    ? t.customer_id === u.org_id
    : t.support_chain.includes(u.org_id) && t.visible_support_org_ids.includes(u.org_id);
  return u.role === "customer"
    ? t.customer_id === u.org_id
    : u.role === "dealer"
      ? t.dealer_id === u.org_id && t.dealer_involved !== false
      : u.role === 'contractor' && t.escalated && (!t.contractor_id || t.contractor_id === u.org_id);
}

const getTicket = async (tx, id, u, lock = false) => {
  if (!/^\d+$/.test(String(id))) fail(400, "invalid_ticket");
  const t = (
    await tx.query(
      "SELECT * FROM tickets WHERE id=$1" + (lock ? " FOR UPDATE" : ""),
      [id],
    )
  ).rows[0];
  if (!t || !access(u, t)) fail(404, "ticket_not_found");
  return t;
};
const event = (tx, t, u, kind, body, visibility = "public") => {
  const message = ["comment", "resolution"].includes(kind)
    ? null
    : typeof body === "object"
      ? body
      : { key: body, params: {} };
  return tx.query(
    "INSERT INTO events(ticket_id,actor_id,kind,visibility,body,message_key,message_params) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [
      t.id,
      u.id,
      kind,
      visibility,
      message ? translate(message.key, message.params, "tr") : body,
      message?.key || null,
      JSON.stringify(message?.params || {}),
    ],
  );
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: AttachmentStorage,
    private readonly mail: MailService,
  ) {}
  async withFiles(files: any[], work: (items: any[]) => Promise<any>) {
    const items = await this.storage.save(files);
    try {
      return await work(items);
    } catch (error) {
      await this.storage.remove(items);
      throw error;
    }
  }
  async attach(tx: any, t: any, eventId: any, items: any[]) {
    if (items.length) {
      const tenantId = t.tenant_id || 1;
      const tenant = (
        await tx.query("SELECT storage_limit_mb FROM tenants WHERE id=$1", [tenantId])
      ).rows[0];
      const usedBytes = Number(
        (
          await tx.query(
            "SELECT COALESCE(SUM(a.size),0) total FROM attachments a JOIN tickets tk ON tk.id=a.ticket_id WHERE tk.tenant_id=$1",
            [tenantId],
          )
        ).rows[0].total,
      );
      const addedBytes = items.reduce((sum, a) => sum + Number(a.size || 0), 0);
      if (usedBytes + addedBytes > (tenant?.storage_limit_mb ?? 256000) * 1024 * 1024)
        fail(413, "tenant_storage_quota_exceeded", { limit_mb: tenant?.storage_limit_mb ?? 10240 });
    }
    for (const a of items)
      await tx.query(
        "INSERT INTO attachments(id,ticket_id,event_id,name,size,storage,object_key) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [a.id, t.id, eventId, a.name, a.size, a.storage, a.object_key],
      );
  }
  async download(id: string, attachmentId: string, user: any) {
    const t = await getTicket(this.database, id, user);
    const a = (
      await this.database.query(
        `SELECT a.* FROM attachments a LEFT JOIN events e ON e.id=a.event_id WHERE a.ticket_id=$1 AND a.id::text=$2 ${user.role === "customer" ? "AND (a.event_id IS NULL OR e.visibility='public')" : ""}`,
        [t.id, attachmentId],
      )
    ).rows[0];
    if (!a) fail(404, "attachment_not_found");
    return { attachment: a, stream: await this.storage.read(a) };
  }
  async list(user: any): Promise<any> {
    const db = this.database;
    const u = user;
    const tenantId = u.tenant_id || 1;
    const legacyFilter =
      u.role === "customer"
        ? "t.customer_id=$1"
        : u.role === "dealer"
          ? "t.dealer_id=$1 AND t.dealer_involved=true"
          : u.role === "super_admin"
            ? "true"
            : u.role === 'contractor' ? "t.escalated=true AND (t.contractor_id IS NULL OR t.contractor_id=$1)" : "false";
    const filter = ['customer', 'super_admin'].includes(u.role) ? legacyFilter
      : `(t.support_chain IS NOT NULL AND $1=ANY(t.support_chain) AND $1=ANY(t.visible_support_org_ids)) OR (t.support_chain IS NULL AND (${legacyFilter}))`;
    return (
      await db.query(
        `SELECT t.*,c.name customer_name,o.name owner_name,a.name assignee_name FROM tickets t JOIN organizations c ON c.id=t.customer_id JOIN organizations o ON o.id=t.owner_org_id LEFT JOIN users a ON a.id=t.assignee_id WHERE t.tenant_id=${u.role === "super_admin" ? "$1" : "$2"} AND (${filter}) ORDER BY t.updated_at DESC,t.id DESC`,
        u.role === "super_admin" ? [tenantId] : [u.org_id, tenantId],
      )
    ).rows.map((r) => enrichTicketSla(r));
  }
  async detail(id: string, user: any): Promise<any> {
    const db = this.database;
    const t = enrichTicketSla(await getTicket(db, id, user));
    const events = (
      await db.query(
        `SELECT e.*,u.name actor_name,o.name org_name FROM events e JOIN users u ON u.id=e.actor_id JOIN organizations o ON o.id=u.org_id WHERE e.ticket_id=$1 ${user.role === "customer" ? "AND e.visibility='public'" : ""} ORDER BY e.id`,
        [t.id],
      )
    ).rows;
    const targets =
      user.role === "customer"
        ? []
        : (
            await db.query(
              t.support_chain ? `${userSql} WHERE o.id=ANY($1::integer[]) AND u.active=true AND u.system_role='member' ORDER BY u.name` : `${userSql} WHERE (o.id=$1 OR (o.kind='contractor' AND ($2::integer IS NULL OR o.id=$2))) AND u.active=true AND u.system_role='member' ORDER BY o.kind,u.name`,
              t.support_chain ? [adjacentSupportCompanies(t)] : [t.dealer_id, t.contractor_id],
            )
          ).rows;
    const orgs =
      user.role === "customer"
        ? []
        : (
            await db.query(
              t.support_chain ? 'SELECT id,name,kind FROM organizations WHERE id=ANY($1::integer[]) ORDER BY array_position($1::integer[],id)' : "SELECT id,name,kind FROM organizations WHERE id=$1 OR (kind='contractor' AND ($2::integer IS NULL OR id=$2)) ORDER BY id",
              t.support_chain ? [adjacentSupportCompanies(t)] : [t.dealer_id, t.contractor_id],
            )
          ).rows;
    const names = (
      await db.query(
        "SELECT c.name customer_name,o.name owner_name,a.name assignee_name FROM tickets t JOIN organizations c ON c.id=t.customer_id JOIN organizations o ON o.id=t.owner_org_id LEFT JOIN users a ON a.id=t.assignee_id WHERE t.id=$1",
        [t.id],
      )
    ).rows[0];
    // Only an authorized support company's public closing note is a customer resolution.
    // Older tickets used 'comment' for this same immediately preceding event.
    const resolution =
      t.status === "closed"
        ? (
            await db.query(
              `SELECT note.id, note.body, note.created_at, u.name actor_name, o.name org_name
       FROM (SELECT * FROM events WHERE ticket_id=$1 AND kind='closed' ORDER BY id DESC LIMIT 1) closing
       JOIN LATERAL (SELECT * FROM events WHERE ticket_id=closing.ticket_id AND id<closing.id ORDER BY id DESC LIMIT 1) note ON true
       JOIN users u ON u.id=note.actor_id JOIN organizations o ON o.id=u.org_id
       WHERE note.kind IN ('resolution','comment') AND note.visibility='public'
         AND note.actor_id=closing.actor_id AND o.id=ANY($2::integer[])`,
              [t.id, t.support_chain ?? [customerContactRole(t) === 'dealer' ? t.dealer_id : t.contractor_id]],
            )
          ).rows[0] || null
        : null;
    const attachments = (
      await db.query(
        `SELECT a.id,a.event_id,a.name,a.size FROM attachments a LEFT JOIN events e ON e.id=a.event_id WHERE a.ticket_id=$1 ${user.role === "customer" ? "AND (a.event_id IS NULL OR e.visibility='public')" : ""} ORDER BY a.name`,
        [t.id],
      )
    ).rows.map((a) => ({
      ...a,
      url: "/api/tickets/" + t.id + "/attachments/" + a.id,
    }));
    for (const e of events)
      e.attachments = attachments.filter((a) => a.event_id === e.id);
    if (resolution)
      resolution.attachments = attachments.filter(
        (a) => a.event_id === resolution.id,
      );
    return {
      ...t,
      ...names,
      events,
      targets,
      orgs,
      support_companies: t.support_chain ? (await db.query('SELECT id,name FROM organizations WHERE id=ANY($1::integer[]) ORDER BY array_position($1::integer[],id)', [t.support_chain])).rows : [],
      resolution,
      attachments: attachments.filter((a) => a.event_id === null),
    };
  }
  async create(body: any, user: any, items: any[] = []): Promise<any> {
    const db = this.database;
    const u = user;
    if (u.role !== "customer") fail(403, "only_customers_can_create_tickets");
    const title = text(body.title, 3, 180),
      description = text(body.description, 10),
      type = choice(body.type, ["Hata", "İstek"]),
      severity = choice(body.severity, ["s1", "s2", "s3"]);
    const ticket = await db.transaction(async (tx) => {
      const org = (
        await tx.query("SELECT * FROM organizations WHERE id=$1 FOR UPDATE", [
          u.org_id,
        ])
      ).rows[0];
      const tenantId = org.tenant_id || u.tenant_id || 1;
      const product = (await tx.query('SELECT id,name FROM products WHERE id=$1 AND tenant_id=$2',[org.product_id, tenantId])).rows[0];
      if (!product) fail(400,'customer_product_missing');
      org.program = product.name;
      const count = Number(
        (
          await tx.query(
            "SELECT count(*) FROM tickets WHERE customer_id=$1 AND (created_at AT TIME ZONE 'Europe/Istanbul')::date=(now() AT TIME ZONE 'Europe/Istanbul')::date",
            [org.id],
          )
        ).rows[0].count,
      );
      if (count >= org.daily_limit)
        fail(429, "you_have_reached_your_daily_ticket_limit_please_try");
      const tenantRow = (
        await tx.query("SELECT monthly_ticket_limit FROM tenants WHERE id=$1", [
          tenantId,
        ])
      ).rows[0];
      const monthlyCount = Number(
        (
          await tx.query(
            "SELECT count(*) FROM tickets WHERE tenant_id=$1 AND date_trunc('month', created_at AT TIME ZONE 'Europe/Istanbul') = date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul')",
            [tenantId],
          )
        ).rows[0].count,
      );
      if (monthlyCount >= (tenantRow?.monthly_ticket_limit ?? 100000))
        fail(403, "monthly_ticket_limit_reached", {
          limit: tenantRow?.monthly_ticket_limit ?? 25,
        });
      if (org.support_chain?.length) {
        const companies = (await tx.query("SELECT id,name FROM organizations WHERE id=ANY($1::integer[]) AND tenant_id=$2 AND kind IN ('support','dealer','contractor')", [org.support_chain, tenantId])).rows;
        if (companies.length !== org.support_chain.length) fail(400, 'support_chain_invalid');
        const ownerId = org.support_chain[0];
        const t = (await tx.query('INSERT INTO tickets(tenant_id,customer_id,created_by,program,title,description,type,severity,owner_org_id,support_chain,visible_support_org_ids) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [tenantId,org.id,u.id,org.program,title,description,type,severity,ownerId,org.support_chain,[ownerId]])).rows[0];
        await tx.query('UPDATE tickets SET product_id=$1 WHERE id=$2',[product.id,t.id]);
        t.product_id = product.id;
        await applyTicketSlaTargets(tx, t);
        const created = await event(tx,t,u,'created',{key:'event_ticket_created',params:{company:companies.find(c => c.id === ownerId).name}});
        await this.attach(tx,t,null,items);
        const recipients = (await tx.query("SELECT id,name,email FROM users WHERE org_id=$1 AND active=true AND system_role='member'",[ownerId])).rows;
        await this.mail.enqueue(tx,created.rows[0].id,'assigned',t,recipients);
        return enrichTicketSla(t);
      }
      const flow = org.support_flow || 'dealer_first';
      const contractors = (await tx.query("SELECT id,name FROM organizations WHERE kind='contractor' AND tenant_id=$1 ORDER BY id", [tenantId])).rows;
      const contractor = contractors.find(c => ['bekatos', 'takipsan'].includes(c.name.toLowerCase())) || (contractors.length === 1 ? contractors[0] : contractors[0]);
      if (!contractor) fail(400, 'support_contractor_missing');
      const dealerId = flow === 'contractor_only' ? null : org.dealer_id;
      const ownerId = flow === 'dealer_first' ? dealerId : contractor.id;
      if (!ownerId || (flow !== 'contractor_only' && !dealerId)) fail(400, 'select_a_valid_dealer');
      const t = (
        await tx.query(
          "INSERT INTO tickets(tenant_id,customer_id,dealer_id,created_by,program,title,description,type,severity,owner_org_id,support_flow,contractor_id,escalated,dealer_involved) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *",
          [
            tenantId,
            org.id,
            dealerId,
            u.id,
            org.program,
            title,
            description,
            type,
            severity,
            ownerId, flow, contractor.id, flow !== 'dealer_first', flow === 'dealer_first',
          ],
        )
      ).rows[0];
      const receivingTeam = (
        await tx.query("SELECT name FROM organizations WHERE id=$1", [
          ownerId,
        ])
      ).rows[0];
      await tx.query('UPDATE tickets SET product_id=$1 WHERE id=$2',[product.id,t.id]);
      t.product_id = product.id;
      await applyTicketSlaTargets(tx, t);
      const created = await event(tx, t, u, "created", {
        key: "event_ticket_created",
        params: { company: receivingTeam.name },
      });
      await this.attach(tx, t, null, items);
      const recipients = (await tx.query("SELECT id,name,email FROM users WHERE org_id=$1 AND active=true AND system_role='member'", [ownerId])).rows;
      await this.mail.enqueue(tx, created.rows[0].id, 'assigned', t, recipients);
      return enrichTicketSla(t);
    });
    return ticket;
  }
  async action(
    id: string,
    body: any,
    user: any,
    items: any[] = [],
  ): Promise<any> {
    const db = this.database;
    const u = user,
      b = body;
    if (items.length && !["comment", "resolve", "close"].includes(b.action))
      fail(400, "attachment_invalid");
    await db.transaction(async (tx) => {
      const t = await getTicket(tx, id, u, true);
      if (t.status === "closed") fail(409, "closed_tickets_cannot_be_changed");
      if (b.action === "comment") {
        if (
          ["dealer", "contractor", "support"].includes(u.role) &&
          u.org_id !== t.owner_org_id
        )
          fail(403, "comment_requires_current_owner");
        const visibility =
          u.role === "customer"
            ? "public"
            : choice(b.visibility, ["public", "internal"]);
        if (
          u.role !== 'customer' && !isCustomerContact(t, u) &&
          visibility === "public"
        )
          fail(403, "direct_customer_replies_are_not_allowed_use_an_internal");
        const note = await event(tx, t, u, "comment", text(b.body), visibility);
        await this.attach(tx, t, note.rows[0].id, items);
        if (u.role !== "customer" && !t.first_responded_at) {
          await tx.query("UPDATE tickets SET first_responded_at=now() WHERE id=$1 AND first_responded_at IS NULL", [t.id]);
        }
        const commentRecipients =
          u.role === "customer"
            ? (
                await tx.query(
                  t.assignee_id
                    ? "SELECT id,name,email FROM users WHERE id=$1 AND active=true"
                    : "SELECT id,name,email FROM users WHERE org_id=$1 AND active=true AND system_role='member'",
                  [t.assignee_id || t.owner_org_id],
                )
              ).rows
            : visibility === "public"
              ? (
                  await tx.query(
                    "SELECT id,name,email FROM users WHERE id=$1 AND active=true",
                    [t.created_by],
                  )
                ).rows
              : t.assignee_id && t.assignee_id !== u.id
                ? (
                    await tx.query(
                      "SELECT id,name,email FROM users WHERE id=$1 AND active=true",
                      [t.assignee_id],
                    )
                  ).rows
                : [];
        if (commentRecipients.length) {
          await this.mail.enqueuePush(
            tx,
            note.rows[0].id,
            "comment",
            t,
            commentRecipients,
            text(b.body),
          );
        }
      } else {
        if (
          ["customer", "super_admin"].includes(u.role) ||
          u.org_id !== t.owner_org_id
        )
          fail(
            403,
            "only_the_company_currently_handling_the_ticket_can_perform",
          );
        if (b.action === "severity") {
          if (!isCustomerContact(t, u))
            fail(403, "only_customer_contact_can_update_priority");
          const severity = choice(b.severity, ["s1", "s2", "s3"]);
          if (severity === t.severity)
            fail(400, "the_severity_level_is_already_the_same");
          const prevSeverity = t.severity;
          await tx.query("UPDATE tickets SET severity=$1 WHERE id=$2", [
            severity,
            t.id,
          ]);
          t.severity = severity;
          await applyTicketSlaTargets(tx, t);
          await event(tx, t, u, "severity", {
            key: "event_severity_changed",
            params: {
              from: prevSeverity.toUpperCase(),
              to: severity.toUpperCase(),
            },
          });
        } else if (b.action === "assign" || b.action === "resolve") {
          if (t.assignee_id != null && t.assignee_id !== u.id)
            fail(403, "assignment_requires_assignee");
          let orgId = Number(b.org_id),
            assignee = b.assignee_id ? Number(b.assignee_id) : null;
          const resolving = b.action === "resolve";
          if (resolving) {
            if (t.support_chain ? !previousSupportCompany(t) : t.support_flow === 'contractor_only' || isCustomerContact(t, u))
              fail(403, "only_support_team_can_return_resolution");
            orgId = t.support_chain ? previousSupportCompany(t) : customerContactRole(t) === 'dealer' ? t.dealer_id : t.contractor_id;
            assignee = null;
          }
          const org = (
            await tx.query("SELECT * FROM organizations WHERE id=$1", [orgId])
          ).rows[0];
          if (!org || (t.support_chain ? !adjacentSupportCompanies(t).includes(org.id) : (org.id !== t.dealer_id && !(org.kind === "contractor" && (!t.contractor_id || t.contractor_id === org.id)))))
            fail(403, "assignment_to_this_company_is_not_allowed");
          let target = null;
          if (assignee) {
            target = (
              await tx.query(
                "SELECT * FROM users WHERE id=$1 AND org_id=$2 AND active=true AND system_role='member'",
                [assignee, orgId],
              )
            ).rows[0];
            if (!target)
              fail(400, "the_assignee_does_not_belong_to_the_selected_company");
          }
          if (resolving) {
            const note = await event(
              tx,
              t,
              u,
              "comment",
              text(b.body, 10),
              "internal",
            );
            await this.attach(tx, t, note.rows[0].id, items);
          }
          await tx.query(
            "UPDATE tickets SET owner_org_id=$1,assignee_id=$2,status=$3,escalated=escalated OR $4,dealer_involved=dealer_involved OR $6,first_responded_at=COALESCE(first_responded_at,now()) WHERE id=$5",
            [
              orgId,
              assignee,
              resolving ? "review" : "in_progress",
              org.kind === "contractor",
              t.id,
              org.kind === 'dealer',
            ],
          );
          if (t.support_chain && !t.visible_support_org_ids.includes(orgId))
            await tx.query('UPDATE tickets SET visible_support_org_ids=array_append(visible_support_org_ids,$1) WHERE id=$2',[orgId,t.id]);
          const assignmentEvent = await event(
            tx,
            t,
            u,
            resolving ? "resolved" : "assigned",
            resolving
              ? {
                  key: t.support_chain ? 'event_returned_to_support_company' : customerContactRole(t) === 'dealer' ? "event_returned_to_dealer" : 'event_returned_to_contractor',
                  params: { company: org.name },
                }
              : {
                  key: target
                    ? "event_assigned_to_person"
                    : "event_assigned_to_queue",
                  params: {
                    company: org.name,
                    ...(target ? { person: target.name } : {}),
                  },
                },
          );
          const recipients = target
            ? [target]
            : (
                await tx.query(
                  "SELECT id,name,email FROM users WHERE org_id=$1 AND active=true AND system_role='member'",
                  [orgId],
                )
              ).rows;
          await this.mail.enqueue(
            tx,
            assignmentEvent.rows[0].id,
            "assigned",
            t,
            recipients,
          );
        } else if (b.action === "close") {
          if (!t.support_chain && !isCustomerContact(t, u))
            fail(403, "only_customer_contact_can_close_ticket");
          if (t.status === "review" && b.confirmed !== true)
            fail(400, "confirm_that_you_have_tested_the_resolution");
          const note = await event(
            tx,
            t,
            u,
            "resolution",
            text(b.body, 10),
            "public",
          );
          await this.attach(tx, t, note.rows[0].id, items);
          await tx.query("UPDATE tickets SET status='closed',closed_at=COALESCE(closed_at,now()),first_responded_at=COALESCE(first_responded_at,now()) WHERE id=$1", [
            t.id,
          ]);
          const closingEvent = await event(
            tx,
            t,
            u,
            "closed",
            t.support_chain ? "event_support_ticket_closed" : "event_ticket_closed",
          );
          const recipients = (
            await tx.query(
              "SELECT id,name,email FROM users WHERE id=$1 AND org_id=$2 AND active=true",
              [t.created_by, t.customer_id],
            )
          ).rows;
          await this.mail.enqueue(
            tx,
            closingEvent.rows[0].id,
            "closed",
            t,
            recipients,
            text(b.body, 10),
          );
        } else fail(400, "invalid_action");
      }
      await tx.query("UPDATE tickets SET updated_at=now() WHERE id=$1", [t.id]);
    });
    return { ok: true };
  }
}
