import { api } from "../../lib/api";

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

export interface AutomationLog {
  id: number;
  tenant_id: number;
  rule_id: number | null;
  rule_name: string;
  ticket_id: number;
  trigger_event: string;
  actions_taken: any[];
  status: string;
  error_message: string | null;
  created_at: string;
}

export const listAutomationRules = () => api<AutomationRule[]>("/automations");

export const createAutomationRule = (data: Partial<AutomationRule>) =>
  api<AutomationRule>("/automations", data);

export const updateAutomationRule = async (id: number, data: Partial<AutomationRule>) => {
  const res = await fetch(`/api/automations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("rule_update_failed");
  return res.json();
};

export const toggleAutomationRule = async (id: number, is_active: boolean) => {
  const res = await fetch(`/api/automations/${id}/toggle`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active }),
  });
  if (!res.ok) throw new Error("rule_toggle_failed");
  return res.json();
};

export const deleteAutomationRule = async (id: number) => {
  const res = await fetch(`/api/automations/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("rule_delete_failed");
  return res.json();
};

export const testAutomationRule = (rule: any, sampleTicket: any) =>
  api<{
    matched: boolean;
    conditionResults: Array<{
      field: string;
      operator: string;
      expectedValue: string;
      matched: boolean;
    }>;
    plannedActions: AutomationAction[];
  }>("/automations/test", { rule, sample_ticket: sampleTicket });

export const listAutomationLogs = () => api<AutomationLog[]>("/automations/logs");
