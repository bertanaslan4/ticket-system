import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock3,
  Mail,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { api } from "../../lib/api";
import { tr, useLanguage, date } from "../../i18n/index.js";
import QueryState from "../../components/QueryState";
import Badge from "../../components/StatusBadge";

interface SlaPolicy {
  severity: "s1" | "s2" | "s3";
  first_response_target_minutes: number;
  resolution_target_minutes: number;
}

export default function OperationsPage() {
  useLanguage();
  const client = useQueryClient();
  const slaQuery = useQuery({
    queryKey: ["admin", "sla"],
    queryFn: ({ signal }) => api<any>("/admin/sla", undefined, signal),
  });
  const outboxQuery = useQuery({
    queryKey: ["admin", "outbox"],
    queryFn: ({ signal }) =>
      api<any>("/admin/operations/outbox", undefined, signal),
  });

  const [policies, setPolicies] = useState<SlaPolicy[]>([
    {
      severity: "s1",
      first_response_target_minutes: 60,
      resolution_target_minutes: 240,
    },
    {
      severity: "s2",
      first_response_target_minutes: 240,
      resolution_target_minutes: 1440,
    },
    {
      severity: "s3",
      first_response_target_minutes: 480,
      resolution_target_minutes: 2880,
    },
  ]);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (slaQuery.data?.policies?.length) {
      setPolicies(
        slaQuery.data.policies.map((p: any) => ({
          severity: p.severity,
          first_response_target_minutes: Number(
            p.first_response_target_minutes,
          ),
          resolution_target_minutes: Number(p.resolution_target_minutes),
        })),
      );
    }
  }, [slaQuery.data]);

  const saveSlaMutation = useMutation({
    mutationFn: (nextPolicies: SlaPolicy[]) =>
      api("/admin/sla", { policies: nextPolicies }),
    onSuccess: (data) => {
      setSaved(true);
      client.setQueryData(["admin", "sla"], data);
      client.invalidateQueries({ queryKey: ["tickets"] });
      client.invalidateQueries({ queryKey: ["admin", "reports"] });
      client.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });

  const retryOutboxMutation = useMutation({
    mutationFn: (id: number) => api(`/admin/operations/outbox/${id}/retry`, {}),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin", "outbox"] });
      client.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const payload = await api<any>("/admin/operations/export");
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug = payload?.tenant?.slug || "workspace";
      a.download = `${slug}-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      client.invalidateQueries({ queryKey: ["admin", "audit"] });
    } finally {
      setExporting(false);
    }
  };

  if (slaQuery.isPending || slaQuery.isError)
    return <QueryState result={slaQuery} />;

  const summary = slaQuery.data?.summary || {
    total_tickets: 0,
    breached_total: 0,
    at_risk: 0,
    compliance_rate: 100,
  };
  const outbox = outboxQuery.data || {
    rows: [],
    counts: { total: 0, sent: 0, pending: 0, failed: 0, skipped: 0 },
  };

  const updatePolicy = (
    severity: "s1" | "s2" | "s3",
    field: "first_response_target_minutes" | "resolution_target_minutes",
    value: number,
  ) => {
    setSaved(false);
    setPolicies((prev) =>
      prev.map((p) => (p.severity === severity ? { ...p, [field]: value } : p)),
    );
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {tr("super_admin_system_administration")}
          </div>
          <h1>
            <Clock3 size={26} /> {tr("operations")}
          </h1>
          <p>{tr("operations_intro")}</p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            slaQuery.refetch();
            outboxQuery.refetch();
          }}
        >
          <RefreshCw size={16} />
          {tr("refresh")}
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <div>
            <span>{tr("sla_compliance_rate")}</span>
            <CheckCircle2 size={19} />
          </div>
          <strong>%{summary.compliance_rate}</strong>
          <small>
            {summary.total_tickets} {tr("tickets")}
          </small>
        </div>
        <div className="stat">
          <div>
            <span>{tr("sla_breached_tickets")}</span>
            <AlertTriangle size={19} />
          </div>
          <strong>{String(summary.breached_total).padStart(2, "0")}</strong>
          <small>{tr("sla_breached")}</small>
        </div>
        <div className="stat">
          <div>
            <span>{tr("sla_at_risk")}</span>
            <Clock3 size={19} />
          </div>
          <strong>{String(summary.at_risk).padStart(2, "0")}</strong>
          <small>{tr("ongoing")}</small>
        </div>
        <div className="stat">
          <div>
            <span>{tr("mail_outbox")}</span>
            <Mail size={19} />
          </div>
          <strong>
            {outbox.counts.sent} / {outbox.counts.total}
          </strong>
          <small>
            {outbox.counts.failed} {tr("outbox_failed")} ·{" "}
            {outbox.counts.pending} {tr("outbox_pending")}
          </small>
        </div>
      </div>

      <div className="detail-grid">
        <section className="panel detail-section">
          <h2>{tr("sla_policies")}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSlaMutation.mutate(policies);
            }}
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tr("severity")}</th>
                    <th>{tr("sla_first_response_target")}</th>
                    <th>{tr("sla_resolution_target")}</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((p) => (
                    <tr key={p.severity}>
                      <td>
                        <Badge value={p.severity} />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          max={525600}
                          required
                          aria-label={`${p.severity.toUpperCase()} ${tr("sla_first_response_target")}`}
                          value={p.first_response_target_minutes}
                          onChange={(e) =>
                            updatePolicy(
                              p.severity,
                              "first_response_target_minutes",
                              Number(e.target.value),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          max={525600}
                          required
                          aria-label={`${p.severity.toUpperCase()} ${tr("sla_resolution_target")}`}
                          value={p.resolution_target_minutes}
                          onChange={(e) =>
                            updatePolicy(
                              p.severity,
                              "resolution_target_minutes",
                              Number(e.target.value),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {saveSlaMutation.error && (
              <div role="alert" className="error">
                {tr(saveSlaMutation.error)}
              </div>
            )}
            {saved && <p role="status">{tr("sla_saved")}</p>}
            <div className="form-row" style={{ marginTop: 14 }}>
              <button
                type="submit"
                className="primary"
                disabled={saveSlaMutation.isPending}
              >
                {tr("save_sla_policies")}
              </button>
            </div>
          </form>
        </section>

        <section className="panel detail-section">
          <h2>{tr("workspace_backup_export")}</h2>
          <p className="hint">{tr("workspace_backup_intro")}</p>
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="primary"
              disabled={exporting}
              onClick={handleExport}
            >
              <Download size={17} />
              {tr("download_workspace_backup")}
            </button>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-title">
          <div>
            <h2>
              {tr("mail_outbox")} <span>{outbox.rows.length}</span>
            </h2>
            <p>{tr("mail_outbox_intro")}</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("date")}</th>
                <th>{tr("tickets")}</th>
                <th>{tr("recipient")}</th>
                <th>{tr("status")}</th>
                <th>{tr("attempts")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {outbox.rows.map((item: any) => (
                <tr key={item.id}>
                  <td>{date(item.created_at)}</td>
                  <td>
                    <strong>TK-{String(item.ticket_id).padStart(4, "0")}</strong>
                    <small>{item.ticket_title}</small>
                  </td>
                  <td>
                    <strong>{item.recipient_name}</strong>
                    <small>{item.recipient_email}</small>
                  </td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (item.status === "sent"
                          ? "closed"
                          : item.status === "failed"
                            ? "s1"
                            : "review")
                      }
                    >
                      {tr(
                        item.status === "sent"
                          ? "outbox_sent"
                          : item.status === "failed"
                            ? "outbox_failed"
                            : item.status === "skipped"
                              ? "outbox_skipped"
                              : "outbox_pending",
                      )}
                    </span>
                    {item.last_error && <small>{item.last_error}</small>}
                  </td>
                  <td>{item.attempts}</td>
                  <td>
                    {item.status !== "sent" && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={retryOutboxMutation.isPending}
                        onClick={() => retryOutboxMutation.mutate(item.id)}
                      >
                        <RotateCcw size={14} />
                        {tr("retry_send")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!outbox.rows.length && (
            <div className="empty">{tr("no_outbox_records")}</div>
          )}
        </div>
      </section>
    </>
  );
}
