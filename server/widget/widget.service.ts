import { Injectable, Optional } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { IntegrationsService } from "../integrations/integrations.service.js";
import { fail, text, choice, applyTicketSlaTargets } from "../common/domain.js";
import { hashPassword } from "../auth.js";

@Injectable()
export class WidgetService {
  constructor(
    private readonly db: DatabaseService,
    @Optional() private readonly integrations?: IntegrationsService,
  ) {}

  private async getTenant(slugOrId?: string) {
    if (!slugOrId) {
      // Default to primary tenant
      const t = (await this.db.query("SELECT * FROM tenants WHERE id = 1")).rows[0];
      if (!t) fail(404, "tenant_not_found");
      return t;
    }

    let tenant: any = null;
    if (/^\d+$/.test(String(slugOrId))) {
      tenant = (
        await this.db.query("SELECT * FROM tenants WHERE id = $1", [Number(slugOrId)])
      ).rows[0];
    } else {
      tenant = (
        await this.db.query("SELECT * FROM tenants WHERE slug = $1", [
          String(slugOrId).toLowerCase().trim(),
        ])
      ).rows[0];
    }

    if (!tenant) fail(404, "tenant_not_found");
    if (tenant.status === "suspended") fail(403, "tenant_account_suspended");
    if (tenant.widget_enabled === false) fail(403, "widget_disabled_by_administrator");
    return tenant;
  }

  async getConfig(slugOrId?: string) {
    const tenant = await this.getTenant(slugOrId);
    return {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      tenant_slug: tenant.slug,
      title: tenant.widget_title || "Canlı Destek",
      color: tenant.widget_color || "#3b4cb8",
      greeting: tenant.widget_greeting || "Merhaba! Size nasıl yardımcı olabiliriz?",
      position: tenant.widget_position || "right",
    };
  }

  async searchKb(slugOrId: string | undefined, queryStr?: string) {
    const tenant = await this.getTenant(slugOrId);
    const q = (queryStr || "").trim().toLowerCase();
    if (!q) return [];

    const sql = `
      SELECT id, title, slug, category, SUBSTRING(content FROM 1 FOR 180) AS snippet
      FROM knowledge_base
      WHERE tenant_id = $1 AND is_public = true AND (LOWER(title) LIKE $2 OR LOWER(content) LIKE $2)
      ORDER BY view_count DESC, id DESC
      LIMIT 5
    `;
    const rows = (await this.db.query(sql, [tenant.id, `%${q}%`])).rows;
    return rows;
  }

  async createTicket(body: any) {
    const tenant = await this.getTenant(body.tenant || body.tenant_slug);
    const tenantId = tenant.id;

    const name = text(body.name, 2, 100);
    const email = text(body.email, 5, 200).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail(400, "enter_a_valid_email_address");
    }
    const title = text(body.title, 3, 180);
    const description = text(body.description, 5, 10000);
    const priority = body.priority ? choice(body.priority, ["s1", "s2", "s3"]) : "s2";

    // Monthly quota check
    const monthlyCount = Number(
      (
        await this.db.query(
          "SELECT count(*) FROM tickets WHERE tenant_id = $1 AND date_trunc('month', created_at AT TIME ZONE 'Europe/Istanbul') = date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul')",
          [tenantId],
        )
      ).rows[0].count,
    );
    if (monthlyCount >= (tenant.monthly_ticket_limit ?? 100000)) {
      fail(403, "monthly_ticket_limit_reached");
    }

    const ticket = await this.db.transaction(async (tx) => {
      // 1. Resolve or create customer user
      let user = (
        await tx.query(
          "SELECT u.id, u.org_id FROM users u WHERE u.email = $1 AND u.tenant_id = $2 AND u.active = true",
          [email, tenantId],
        )
      ).rows[0];

      let customerOrgId: number;

      if (user) {
        customerOrgId = user.org_id;
      } else {
        // Find existing customer organization or create one
        let customerOrg = (
          await tx.query(
            "SELECT id FROM organizations WHERE tenant_id = $1 AND kind = 'customer' ORDER BY id LIMIT 1",
            [tenantId],
          )
        ).rows[0];

        if (!customerOrg) {
          customerOrg = (
            await tx.query(
              "INSERT INTO organizations (tenant_id, name, kind, daily_limit) VALUES ($1, $2, 'customer', 50) RETURNING id",
              [tenantId, "Web Müşterileri"],
            )
          ).rows[0];
        }
        customerOrgId = customerOrg.id;

        // Create new member user for visitor
        const dummyPassword = hashPassword(`WebVisitor-${Date.now()}`);
        user = (
          await tx.query(
            "INSERT INTO users (tenant_id, org_id, name, email, password_hash, system_role, active) VALUES ($1, $2, $3, $4, $5, 'member', true) RETURNING id, org_id",
            [tenantId, customerOrgId, name, email, dummyPassword],
          )
        ).rows[0];
      }

      // 2. Resolve support team / owner organization
      let ownerOrg = (
        await tx.query(
          "SELECT id, name FROM organizations WHERE tenant_id = $1 AND kind IN ('contractor', 'dealer', 'support') ORDER BY id LIMIT 1",
          [tenantId],
        )
      ).rows[0];

      if (!ownerOrg) {
        ownerOrg = (
          await tx.query(
            "INSERT INTO organizations (tenant_id, name, kind, daily_limit) VALUES ($1, 'Destek Ekibi', 'contractor', 100) RETURNING id, name",
            [tenantId],
          )
        ).rows[0];
      }

      // 3. Insert ticket
      const insertSql = `
        INSERT INTO tickets (
          tenant_id, customer_id, created_by, program, title, description,
          type, severity, owner_org_id, support_flow, escalated, dealer_involved, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'İstek', $7, $8, 'contractor_only', true, false, now(), now())
        RETURNING *
      `;
      const t = (
        await tx.query(insertSql, [
          tenantId,
          customerOrgId,
          user.id,
          "Web Widget",
          title,
          description,
          priority,
          ownerOrg.id,
        ])
      ).rows[0];

      await applyTicketSlaTargets(tx, t);

      // 4. Record event
      await tx.query(
        `INSERT INTO events (ticket_id, actor_id, kind, visibility, body, message_key, message_params, created_at)
         VALUES ($1, $2, 'created', 'public', $3, 'event_ticket_created', $4, now())`,
        [t.id, user.id, description, JSON.stringify({ company: ownerOrg.name })],
      );

      return t;
    });

    const ticketNumber = `TK-${String(ticket.id).padStart(4, "0")}`;

    // Dispatch webhook to Teams / Slack
    this.integrations?.dispatchTicketNotification(tenantId, "ticket.created", ticket);

    return {
      ok: true,
      ticket_id: ticket.id,
      ticket_number: ticketNumber,
      title: ticket.title,
      severity: ticket.severity,
      message: "ticket_created_successfully",
    };
  }

  async trackTicket(query: { tenant?: string; number: string; email: string }) {
    const tenant = await this.getTenant(query.tenant);
    const email = (query.email || "").trim().toLowerCase();
    if (!email) fail(400, "enter_a_valid_email_address");

    const rawNum = String(query.number || "").replace(/^TK-/i, "").trim();
    const ticketId = Number(rawNum);
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
      fail(400, "invalid_ticket_number");
    }

    const sql = `
      SELECT t.id, t.title, t.description, t.status, t.severity, t.created_at, t.updated_at,
             u.email AS creator_email, o.name AS owner_name
      FROM tickets t
      JOIN users u ON u.id = t.created_by
      JOIN organizations o ON o.id = t.owner_org_id
      WHERE t.id = $1 AND t.tenant_id = $2
    `;
    const ticket = (await this.db.query(sql, [ticketId, tenant.id])).rows[0];
    if (!ticket) fail(404, "ticket_not_found");

    // Security check: email must match ticket creator
    if (ticket.creator_email.toLowerCase() !== email) {
      fail(403, "ticket_email_mismatch");
    }

    // Get latest public comments
    const events = (
      await this.db.query(
        `SELECT e.kind, e.body, e.created_at, u.name AS actor_name
         FROM events e
         JOIN users u ON u.id = e.actor_id
         WHERE e.ticket_id = $1 AND e.visibility = 'public'
         ORDER BY e.id ASC`,
        [ticketId],
      )
    ).rows;

    return {
      ticket_id: ticket.id,
      ticket_number: `TK-${String(ticket.id).padStart(4, "0")}`,
      title: ticket.title,
      status: ticket.status,
      severity: ticket.severity,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      assigned_team: ticket.owner_name,
      timeline: events,
    };
  }
}
