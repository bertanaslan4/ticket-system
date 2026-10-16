import { date } from "../../i18n/index.js";
export const kinds = {
  customer: "customer",
  dealer: "support_company",
  contractor: "support_company",
  support: "support_company",
};
export const states = {
  open: "new",
  in_progress: "in_progress",
  review: "dealer_review",
  closed: "closed",
};
export const auditLabels = {
  tenant_created: "tenant_created",
  tenant_updated: "tenant_updated",
  iap_purchased: "iap_purchased",
  sla_updated: "sla_updated",
  mail_outbox_retried: "mail_outbox_retried",
  workspace_exported: "workspace_exported",
  product_created: 'product_created',
  product_updated: 'product_updated',
  storage_settings_updated: "storage_settings_updated",
  user_created: "user_created",
  user_updated: "user_updated",
  user_deleted: "user_deleted",
  organization_created: "company_created",
  organization_updated: "company_updated",
};
export const format = (v) =>
  date(v, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
