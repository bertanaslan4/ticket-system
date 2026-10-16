import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { fail } from "../common/domain.js";

export interface AutomationCondition {
  field: "title" | "description" | "severity" | "type" | "status" | "customer_org";
  operator: "contains" | "not_contains" | "equals" | "not_equals";
  value: string;
}

export interface AutomationAction {
  type: "set_severity" | "set_status" | "add_internal_note" | "send_teams_notification";
  value?: string;
  text?: string;
}

export interface AutomationRule {
  id: number;
  tenant_id: number;
  name: string;
  description: string;
  trigger_event: "ticket.created" | "ticket.status_changed" | "ticket.assigned" | "sla.warning" | "inactivity.timeout";
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  is_active: boolean;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(private readonly database: DatabaseService) {}

  /**
   * Evaluate conditions of a rule against a ticket context
   */
  evaluateCondition(condition: AutomationCondition, ticket: any): boolean {
    const fieldMap: Record<string, string> = {
      title: String(ticket?.title || ""),
      description: String(ticket?.description || ""),
      severity: String(ticket?.severity || ""),
      type: String(ticket?.type || ""),
      status: String(ticket?.status || ""),
      customer_org: String(ticket?.customer_org || ticket?.customer_name || ticket?.org_name || ""),
    };

    const actualVal = (fieldMap[condition.field] || "").toLowerCase().trim();
    const targetVal = String(condition.value || "").toLowerCase().trim();

    switch (condition.operator) {
      case "contains":
        return actualVal.includes(targetVal);
      case "not_contains":
        return !actualVal.includes(targetVal);
      case "equals":
        return actualVal === targetVal;
      case "not_equals":
        return actualVal !== targetVal;
      default:
        return false;
    }
  }

  /**
   * Run rules matching a specific trigger event
   */
  async evaluateAndExecute(
    triggerEvent: string,
    context: { ticket: any; user?: any; prevStatus?: string },
  ): Promise<any[]> {
    const ticket = context.ticket;
    if (!ticket || !ticket.id) return [];

    const tenantId = ticket.tenant_id || 1;
    const rulesRes = await this.database.query(
      "SELECT * FROM automation_rules WHERE tenant_id = $1 AND trigger_event = $2 AND is_active = true ORDER BY id ASC",
      [tenantId, triggerEvent],
    );

    const executedActions: any[] = [];
    const actorId = context.user?.id || 1;

    for (const rule of rulesRes.rows) {
      const conditions: AutomationCondition[] = Array.isArray(rule.conditions)
        ? rule.conditions
        : typeof rule.conditions === "string"
        ? JSON.parse(rule.conditions)
        : [];

      // Check if all conditions match
      const allMatched = conditions.every((c) => this.evaluateCondition(c, ticket));
      if (!allMatched) continue;

      const actions: AutomationAction[] = Array.isArray(rule.actions)
        ? rule.actions
        : typeof rule.actions === "string"
        ? JSON.parse(rule.actions)
        : [];

      const actionsTaken: any[] = [];

      for (const action of actions) {
        try {
          if (action.type === "set_severity" && action.value) {
            const sev = action.value.toLowerCase();
            if (["s1", "s2", "s3"].includes(sev) && ticket.severity !== sev) {
              await this.database.query(
                "UPDATE tickets SET severity = $1, updated_at = now() WHERE id = $2",
                [sev, ticket.id],
              );
              await this.database.query(
                "INSERT INTO events (ticket_id, actor_id, kind, visibility, body) VALUES ($1, $2, 'severity', 'public', $3)",
                [ticket.id, actorId, `Otomasyon kuralı (${rule.name}) tarafından öncelik ${sev.toUpperCase()} olarak güncellendi.`],
              );
              ticket.severity = sev;
              actionsTaken.push({ action: "set_severity", new_severity: sev });
            }
          } else if (action.type === "set_status" && action.value) {
            const st = action.value.toLowerCase();
            if (["open", "in_progress", "review", "closed"].includes(st) && ticket.status !== st) {
              await this.database.query(
                "UPDATE tickets SET status = $1, closed_at = CASE WHEN $1 = 'closed' THEN now() ELSE closed_at END, updated_at = now() WHERE id = $2",
                [st, ticket.id],
              );
              await this.database.query(
                "INSERT INTO events (ticket_id, actor_id, kind, visibility, body) VALUES ($1, $2, 'status', 'public', $3)",
                [ticket.id, actorId, `Otomasyon kuralı (${rule.name}) tarafından durum ${st} olarak güncellendi.`],
              );
              ticket.status = st;
              actionsTaken.push({ action: "set_status", new_status: st });
            }
          } else if (action.type === "add_internal_note" && (action.text || action.value)) {
            const noteText = action.text || action.value;
            await this.database.query(
              "INSERT INTO events (ticket_id, actor_id, kind, visibility, body) VALUES ($1, $2, 'comment', 'internal', $3)",
              [ticket.id, actorId, `[Otomasyon Notu - ${rule.name}]: ${noteText}`],
            );
            actionsTaken.push({ action: "add_internal_note", note: noteText });
          } else if (action.type === "send_teams_notification") {
            const tenantRow = (
              await this.database.query(
                "SELECT webhook_teams_url, webhook_slack_url FROM tenants WHERE id = $1",
                [tenantId],
              )
            ).rows[0];

            const hookUrl = tenantRow?.webhook_teams_url || tenantRow?.webhook_slack_url;
            if (hookUrl) {
              const cardPayload = {
                type: "message",
                attachments: [
                  {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    content: {
                      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                      type: "AdaptiveCard",
                      version: "1.2",
                      body: [
                        {
                          type: "TextBlock",
                          text: `⚡ Otomasyon Uyarısı: ${rule.name}`,
                          weight: "Bolder",
                          size: "Medium",
                          color: "Attention",
                        },
                        {
                          type: "TextBlock",
                          text: `Bilet #${ticket.id}: ${ticket.title}\nÖncelik: ${(ticket.severity || "s2").toUpperCase()}`,
                          wrap: true,
                        },
                      ],
                    },
                  },
                ],
              };

              fetch(hookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cardPayload),
              }).catch((e) => this.logger.warn(`Failed to dispatch automation webhook: ${e.message}`));

              actionsTaken.push({ action: "send_teams_notification", sent: true });
            }
          }
        } catch (err: any) {
          this.logger.error(`Error executing action ${action.type}: ${err.message}`);
        }
      }

      // Update rule metrics
      await this.database.query(
        "UPDATE automation_rules SET execution_count = execution_count + 1, last_executed_at = now() WHERE id = $1",
        [rule.id],
      );

      // Record to automation logs
      await this.database.query(
        "INSERT INTO automation_logs (tenant_id, rule_id, rule_name, ticket_id, trigger_event, actions_taken, status) VALUES ($1, $2, $3, $4, $5, $6, 'success')",
        [tenantId, rule.id, rule.name, ticket.id, triggerEvent, JSON.stringify(actionsTaken)],
      );

      executedActions.push({ rule_id: rule.id, rule_name: rule.name, actions_taken: actionsTaken });
    }

    return executedActions;
  }

  /**
   * Test/simulate rule against a sample ticket
   */
  testRule(ruleData: any, sampleTicket: any) {
    const conditions: AutomationCondition[] = Array.isArray(ruleData.conditions) ? ruleData.conditions : [];
    const conditionResults = conditions.map((c) => ({
      field: c.field,
      operator: c.operator,
      expectedValue: c.value,
      matched: this.evaluateCondition(c, sampleTicket),
    }));

    const allMatched = conditionResults.length === 0 || conditionResults.every((cr) => cr.matched);
    const actions: AutomationAction[] = Array.isArray(ruleData.actions) ? ruleData.actions : [];

    return {
      matched: allMatched,
      conditionResults,
      plannedActions: allMatched ? actions : [],
    };
  }

  async listRules(tenantId: number): Promise<AutomationRule[]> {
    const res = await this.database.query(
      "SELECT * FROM automation_rules WHERE tenant_id = $1 ORDER BY id DESC",
      [tenantId],
    );
    return res.rows;
  }

  async getRule(id: number, tenantId: number): Promise<AutomationRule> {
    const res = await this.database.query(
      "SELECT * FROM automation_rules WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
    if (!res.rows[0]) fail(404, "rule_not_found");
    return res.rows[0];
  }

  async createRule(tenantId: number, data: any): Promise<AutomationRule> {
    const name = String(data.name || "").trim();
    if (!name) fail(400, "rule_name_required");

    const triggerEvent = String(data.trigger_event || "ticket.created");
    const description = String(data.description || "").trim();
    const conditions = Array.isArray(data.conditions) ? JSON.stringify(data.conditions) : "[]";
    const actions = Array.isArray(data.actions) ? JSON.stringify(data.actions) : "[]";
    const isActive = data.is_active !== false;

    const res = await this.database.query(
      `INSERT INTO automation_rules (tenant_id, name, description, trigger_event, conditions, actions, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, name, description, triggerEvent, conditions, actions, isActive],
    );
    return res.rows[0];
  }

  async updateRule(id: number, tenantId: number, data: any): Promise<AutomationRule> {
    await this.getRule(id, tenantId); // ensure existence & tenant access

    const name = String(data.name || "").trim();
    if (!name) fail(400, "rule_name_required");

    const triggerEvent = String(data.trigger_event || "ticket.created");
    const description = String(data.description || "").trim();
    const conditions = Array.isArray(data.conditions) ? JSON.stringify(data.conditions) : "[]";
    const actions = Array.isArray(data.actions) ? JSON.stringify(data.actions) : "[]";
    const isActive = data.is_active !== false;

    const res = await this.database.query(
      `UPDATE automation_rules
       SET name = $1, description = $2, trigger_event = $3, conditions = $4, actions = $5, is_active = $6, updated_at = now()
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [name, description, triggerEvent, conditions, actions, isActive, id, tenantId],
    );
    return res.rows[0];
  }

  async toggleRule(id: number, tenantId: number, isActive: boolean): Promise<AutomationRule> {
    await this.getRule(id, tenantId);
    const res = await this.database.query(
      "UPDATE automation_rules SET is_active = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3 RETURNING *",
      [isActive, id, tenantId],
    );
    return res.rows[0];
  }

  async deleteRule(id: number, tenantId: number): Promise<{ ok: boolean }> {
    await this.getRule(id, tenantId);
    await this.database.query("DELETE FROM automation_rules WHERE id = $1 AND tenant_id = $2", [id, tenantId]);
    return { ok: true };
  }

  async listLogs(tenantId: number, limit = 50): Promise<any[]> {
    const res = await this.database.query(
      "SELECT * FROM automation_logs WHERE tenant_id = $1 ORDER BY id DESC LIMIT $2",
      [tenantId, limit],
    );
    return res.rows;
  }
}
