import { useLanguage } from "../../i18n/index.js";
import { tr, date } from "../../i18n/index.js";

import { kinds, auditLabels, format } from "../administration/admin.shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import QueryState from "../../components/QueryState";
import AdminHeading from "../administration/AdminHeading";
export default function AuditPage() {
  useLanguage();
  const result = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: ({ signal }) => api<any[]>("/admin/audit", undefined, signal),
  });
  const audit = result.data || [];
  return (
    <>
      <AdminHeading view="audit" />
      {result.isPending || result.isError ? (
        <QueryState result={result} />
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("date")}</th>
                  <th>{tr("admin")}</th>
                  <th>{tr("action")}</th>
                  <th>{tr("record")}</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>{format(a.created_at)}</td>
                    <td>{a.actor_name}</td>
                    <td>{tr(auditLabels[a.action] || a.action)}</td>
                    <td>
                      {a.details.name || "#" + a.target_id}
                      <small>
                        {a.details.email ||
                          tr(kinds[a.details.kind] || a.details.kind || "")}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!audit.length && (
              <div className="empty">{tr("no_admin_actions_yet")}</div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
