import { useLanguage } from "../../i18n/index.js";

import { Plus } from "lucide-react";
import { tr } from "../../i18n/index.js";
export default function AdminHeading({
  view,
  onAdd,
}: {
  view: string;
  onAdd?: () => void;
}) {
  useLanguage();
  const titles = {
    users: "user_management",
    organizations: "company_management",
    reports: "ticket_report",
    productReports: "product_reports",
    audit: "admin_activity",
  };
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{tr("super_admin_system_administration")}</div>
        <h1>{tr(titles[view])}</h1>
        <p>
          {tr(
            view === "reports" || view === 'productReports'
              ? "compare_requests_across_companies_and_export_the_results"
              : view === "audit"
                ? "the_last_100_admin_actions_user_and_company_changes"
                : "manage_companies_and_access_permissions_in_one_place",
          )}
        </p>
      </div>
      {onAdd && (
        <button className="primary" onClick={onAdd}>
          <Plus size={17} />
          {tr(view === "users" ? "add_user" : "add_company")}
        </button>
      )}
    </div>
  );
}
