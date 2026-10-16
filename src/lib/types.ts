export interface Attachment {
  id: string;
  name: string;
  size: number;
  url: string;
}
export type Role = "customer" | "dealer" | "contractor" | "support" | "super_admin";
export interface User {
  id: number;
  name: string;
  email: string;
  org_id: number;
  org_name: string;
  tenant_id?: number;
  tenant_name?: string;
  tenant_slug?: string;
  invite_code?: string;
  industry_template?: string;
  plan_tier?: "free" | "starter" | "pro" | "enterprise";
  tenant_status?: "trial" | "active" | "past_due" | "suspended";
  agent_limit?: number;
  customer_org_limit?: number;
  monthly_ticket_limit?: number;
  storage_limit_mb?: number;
  role: Role;
  program: string;
  daily_limit: number;
  used: number;
}
export interface Tenant {
  id: number;
  slug: string;
  name: string;
  invite_code?: string;
  industry_template?: string;
  plan_tier: "free" | "starter" | "pro" | "enterprise";
  status: "trial" | "active" | "past_due" | "suspended";
  agent_limit: number;
  agent_used: number;
  customer_org_limit?: number;
  monthly_ticket_limit?: number;
  customer_user_count: number;
  storage_limit_mb: number;
  storage_used_bytes: number;
  organization_count: number;
  ticket_count: number;
  created_at: string;
}
export interface Ticket {
  product_id?: number;
  support_chain?: number[];
  support_flow?: 'dealer_first' | 'contractor_first' | 'contractor_only';
  attachments?: Attachment[];
  resolution?: {
    attachments?: Attachment[];
    body: string;
    created_at: string;
    actor_name: string;
    org_name: string;
  } | null;
  id: number;
  title: string;
  description: string;
  type: "Hata" | "İstek";
  status: "open" | "in_progress" | "review" | "closed";
  severity: "s1" | "s2" | "s3";
  customer_name: string;
  owner_name: string;
  assignee_name: string | null;
  owner_org_id: number;
  program: string;
  created_at: string;
  updated_at: string;
  first_responded_at?: string | null;
  closed_at?: string | null;
  sla_first_response_due_at?: string | null;
  sla_resolution_due_at?: string | null;
  sla_first_response_breached?: boolean;
  sla_resolution_breached?: boolean;
  sla_status?: "on_track" | "at_risk" | "breached" | "met";
  events?: TicketEvent[];
  targets?: User[];
  orgs?: Organization[];
}
export interface TicketEvent {
  id: number;
  kind: string;
  visibility: "public" | "internal";
  body: string;
  actor_name: string;
  org_name: string;
  created_at: string;
  message_key?: string;
  message_params?: Record<string, unknown>;
}
export interface Organization {
  product_id?: number;
  support_chain?: number[];
  support_flow?: 'dealer_first' | 'contractor_first' | 'contractor_only';
  id: number;
  name: string;
  kind: "customer" | "dealer" | "contractor" | "support";
  dealer_id?: number;
  program?: string;
  daily_limit: number;
}
export type FormValues = Record<string, unknown>;
export interface Product {
  id: number;
  name: string;
  customer_count: number;
  ticket_count: number;
}
