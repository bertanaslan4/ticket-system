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
  role: Role;
  program: string;
  daily_limit: number;
  used: number;
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
