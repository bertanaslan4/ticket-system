import {
  Module,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  HttpCode,
  UseGuards,
  Injectable,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard.js";
import { DatabaseService } from "../database/database.service.js";
import { integer, audit } from "../common/admin-domain.js";
import {
  fail,
  DEFAULT_SLA_TARGETS,
  enrichTicketSla,
} from "../common/domain.js";

const SEVERITIES = ["s1", "s2", "s3"] as const;

@Injectable()
export class OperationsService {
  constructor(private readonly db: DatabaseService) {}

  async getSla(user: any) {
    const tenantId = user?.tenant_id || 1;
    await this.db.query(
      "INSERT INTO sla_policies(tenant_id, severity, first_response_target_minutes, resolution_target_minutes) VALUES ($1,'s1',60,240),($1,'s2',240,1440),($1,'s3',480,2880) ON CONFLICT (tenant_id, severity) DO NOTHING",
      [tenantId],
    );
    const policies = (
      await this.db.query(
        "SELECT id, tenant_id, severity, first_response_target_minutes, resolution_target_minutes, updated_at FROM sla_policies WHERE tenant_id=$1 ORDER BY CASE severity WHEN 's1' THEN 1 WHEN 's2' THEN 2 ELSE 3 END",
        [tenantId],
      )
    ).rows;

    const tickets = (
      await this.db.query(
        "SELECT id, status, severity, created_at, updated_at, first_responded_at, closed_at, sla_first_response_due_at, sla_resolution_due_at FROM tickets WHERE tenant_id=$1",
        [tenantId],
      )
    ).rows.map((t) => enrichTicketSla(t));

    const total = tickets.length;
    const firstResponseBreached = tickets.filter(
      (t) => t.sla_first_response_breached,
    ).length;
    const resolutionBreached = tickets.filter(
      (t) => t.sla_resolution_breached,
    ).length;
    const breached = tickets.filter((t) => t.sla_status === "breached").length;
    const atRisk = tickets.filter((t) => t.sla_status === "at_risk").length;
    const complianceRate = total
      ? Math.round(((total - breached) / total) * 100)
      : 100;

    return {
      policies,
      summary: {
        total_tickets: total,
        first_response_breached: firstResponseBreached,
        resolution_breached: resolutionBreached,
        breached_total: breached,
        at_risk: atRisk,
        compliance_rate: complianceRate,
      },
    };
  }

  async saveSla(body: any, user: any) {
    const tenantId = user?.tenant_id || 1;
    const inputPolicies = Array.isArray(body?.policies) ? body.policies : [];
    if (!inputPolicies.length) fail(400, "invalid_selection");

    const parsed: {
      severity: string;
      first_response_target_minutes: number;
      resolution_target_minutes: number;
    }[] = [];

    for (const sev of SEVERITIES) {
      const item = inputPolicies.find((p: any) => p?.severity === sev);
      const fallback = DEFAULT_SLA_TARGETS[sev];
      const firstResp = item
        ? integer(item.first_response_target_minutes)
        : fallback.first_response_target_minutes;
      const resTarget = item
        ? integer(item.resolution_target_minutes)
        : fallback.resolution_target_minutes;
      if (firstResp > 525600 || resTarget > 525600)
        fail(400, "enter_a_valid_positive_integer");
      if (resTarget < firstResp)
        fail(400, "sla_resolution_must_exceed_first_response");
      parsed.push({
        severity: sev,
        first_response_target_minutes: firstResp,
        resolution_target_minutes: resTarget,
      });
    }

    await this.db.transaction(async (tx) => {
      for (const p of parsed) {
        await tx.query(
          `INSERT INTO sla_policies(tenant_id, severity, first_response_target_minutes, resolution_target_minutes, updated_at)
           VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (tenant_id, severity)
           DO UPDATE SET first_response_target_minutes = EXCLUDED.first_response_target_minutes,
                         resolution_target_minutes = EXCLUDED.resolution_target_minutes,
                         updated_at = now()`,
          [
            tenantId,
            p.severity,
            p.first_response_target_minutes,
            p.resolution_target_minutes,
          ],
        );
        await tx.query(
          `UPDATE tickets
           SET sla_first_response_due_at = created_at + make_interval(mins => $1),
               sla_resolution_due_at = created_at + make_interval(mins => $2)
           WHERE tenant_id = $3 AND severity = $4 AND status <> 'closed'`,
          [
            p.first_response_target_minutes,
            p.resolution_target_minutes,
            tenantId,
            p.severity,
          ],
        );
      }

      await audit(tx, user, "sla_updated", tenantId, {
        name: "SLA",
        policies: parsed,
      });
    });

    return this.getSla(user);
  }

  async listOutbox(user: any) {
    const tenantId = user?.tenant_id || 1;
    const rows = (
      await this.db.query(
        `SELECT
           m.id,
           m.event_id,
           m.user_id,
           m.kind,
           m.status,
           m.attempts,
           m.last_error,
           m.created_at,
           m.sent_at,
           u.name AS recipient_name,
           u.email AS recipient_email,
           t.id AS ticket_id,
           t.title AS ticket_title
         FROM mail_outbox m
         JOIN events e ON e.id = m.event_id
         JOIN tickets t ON t.id = e.ticket_id
         JOIN users u ON u.id = m.user_id
         WHERE t.tenant_id = $1
         ORDER BY m.id DESC
         LIMIT 100`,
        [tenantId],
      )
    ).rows;

    const counts = {
      total: rows.length,
      sent: rows.filter((r) => r.status === "sent").length,
      pending: rows.filter((r) => ["pending", "sending"].includes(r.status))
        .length,
      failed: rows.filter((r) => r.status === "failed").length,
      skipped: rows.filter((r) => r.status === "skipped").length,
    };

    return { rows, counts };
  }

  async retryOutbox(routeId: string, user: any) {
    const id = integer(routeId);
    const tenantId = user?.tenant_id || 1;
    return this.db.transaction(async (tx) => {
      const existing = (
        await tx.query(
          `SELECT m.id, t.id AS ticket_id, u.email
           FROM mail_outbox m
           JOIN events e ON e.id = m.event_id
           JOIN tickets t ON t.id = e.ticket_id
           JOIN users u ON u.id = m.user_id
           WHERE m.id = $1 AND t.tenant_id = $2
           FOR UPDATE`,
          [id, tenantId],
        )
      ).rows[0];
      if (!existing) fail(404, "outbox_item_not_found");

      const updated = (
        await tx.query(
          `UPDATE mail_outbox
           SET status = 'pending',
               attempts = 0,
               last_error = NULL,
               locked_at = NULL,
               lock_token = NULL,
               next_attempt_at = now()
           WHERE id = $1
           RETURNING *`,
          [id],
        )
      ).rows[0];

      await audit(tx, user, "mail_outbox_retried", id, {
        name: `TK-${String(existing.ticket_id).padStart(4, "0")}`,
        email: existing.email,
      });

      return updated;
    });
  }

  async exportWorkspace(user: any) {
    const tenantId = user?.tenant_id || 1;
    return this.db.transaction(async (tx) => {
      const tenant = (
        await tx.query("SELECT * FROM tenants WHERE id=$1", [tenantId])
      ).rows[0];
      const slaPolicies = (
        await tx.query(
          "SELECT severity, first_response_target_minutes, resolution_target_minutes, updated_at FROM sla_policies WHERE tenant_id=$1 ORDER BY severity",
          [tenantId],
        )
      ).rows;
      const products = (
        await tx.query(
          "SELECT id, name FROM products WHERE tenant_id=$1 ORDER BY id",
          [tenantId],
        )
      ).rows;
      const organizations = (
        await tx.query(
          "SELECT id, name, kind, dealer_id, product_id, program, daily_limit, support_flow, support_chain FROM organizations WHERE tenant_id=$1 ORDER BY id",
          [tenantId],
        )
      ).rows;
      const users = (
        await tx.query(
          "SELECT id, org_id, name, email, system_role, active, deleted_at FROM users WHERE tenant_id=$1 ORDER BY id",
          [tenantId],
        )
      ).rows;
      const tickets = (
        await tx.query(
          "SELECT * FROM tickets WHERE tenant_id=$1 ORDER BY id",
          [tenantId],
        )
      ).rows.map((t) => enrichTicketSla(t));
      const events = (
        await tx.query(
          "SELECT e.* FROM events e JOIN tickets t ON t.id=e.ticket_id WHERE t.tenant_id=$1 ORDER BY e.id",
          [tenantId],
        )
      ).rows;
      const attachments = (
        await tx.query(
          "SELECT a.id, a.ticket_id, a.event_id, a.name, a.size, a.storage FROM attachments a JOIN tickets t ON t.id=a.ticket_id WHERE t.tenant_id=$1 ORDER BY a.ticket_id, a.name",
          [tenantId],
        )
      ).rows;

      await audit(tx, user, "workspace_exported", tenantId, {
        name: tenant?.name || "Workspace",
      });

      return {
        exported_at: new Date().toISOString(),
        tenant,
        sla_policies: slaPolicies,
        products,
        organizations,
        users,
        tickets,
        events,
        attachments,
      };
    });
  }
}

@Controller("admin")
@UseGuards(AdminGuard)
export class OperationsController {
  constructor(private readonly service: OperationsService) {}

  @Get("sla")
  getSla(@Req() req: any) {
    return this.service.getSla(req.user);
  }

  @Post("sla")
  @HttpCode(200)
  saveSla(@Body() body: any, @Req() req: any) {
    return this.service.saveSla(body, req.user);
  }

  @Get("operations/outbox")
  listOutbox(@Req() req: any) {
    return this.service.listOutbox(req.user);
  }

  @Post("operations/outbox/:id/retry")
  @HttpCode(200)
  retryOutbox(@Param("id") id: string, @Req() req: any) {
    return this.service.retryOutbox(id, req.user);
  }

  @Get("operations/export")
  exportWorkspace(@Req() req: any) {
    return this.service.exportWorkspace(req.user);
  }
}

@Module({
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
