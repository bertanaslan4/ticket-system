import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { tr, useLanguage } from "../../i18n/index.js";
import { useAuth } from "../auth/AuthProvider";
import Modal from "../../components/Modal";
import QueryState from "../../components/QueryState";
import type { Tenant } from "../../lib/types";

const PLAN_PRESETS: Record<
  "starter" | "pro" | "enterprise",
  { agent_limit: number; storage_limit_mb: number }
> = {
  starter: { agent_limit: 5, storage_limit_mb: 10240 },
  pro: { agent_limit: 15, storage_limit_mb: 51200 },
  enterprise: { agent_limit: 100, storage_limit_mb: 256000 },
};

interface TenantFormState {
  id?: number;
  name: string;
  slug: string;
  plan_tier: "starter" | "pro" | "enterprise";
  status: "trial" | "active" | "past_due" | "suspended";
  agent_limit: number;
  storage_limit_mb: number;
  admin_name?: string;
  admin_email?: string;
  admin_password?: string;
}

function formatStorage(bytes: number, limitMb: number) {
  const usedMb = (bytes / (1024 * 1024)).toFixed(1);
  const limitGb =
    limitMb >= 1024 ? `${(limitMb / 1024).toFixed(0)} GB` : `${limitMb} MB`;
  return `${usedMb} MB / ${limitGb}`;
}

export default function TenantsPage() {
  useLanguage();
  const { user, refresh } = useAuth();
  const client = useQueryClient();
  const [editing, setEditing] = useState<TenantFormState | null>(null);

  const query = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: ({ signal }) => api<Tenant[]>("/admin/tenants", undefined, signal),
  });

  const saveMutation = useMutation({
    mutationFn: (body: TenantFormState) =>
      api("/admin/tenants" + (body.id ? "/" + body.id : ""), body),
    onSuccess: async () => {
      setEditing(null);
      await client.invalidateQueries({ queryKey: ["admin"] });
      await refresh();
    },
  });

  const switchMutation = useMutation({
    mutationFn: (tenantId: number) =>
      api(`/admin/tenants/${tenantId}/switch`, {}),
    onSuccess: async () => {
      await refresh();
      await client.invalidateQueries();
    },
  });

  const activeTenantId = user?.tenant_id || 1;

  const planLabel = (tier: string) =>
    tier === "enterprise"
      ? tr("plan_enterprise")
      : tier === "pro"
        ? tr("plan_pro")
        : tr("plan_starter");

  const statusLabel = (status: string) =>
    status === "trial"
      ? tr("status_trial")
      : status === "past_due"
        ? tr("status_past_due")
        : status === "suspended"
          ? tr("status_suspended")
          : tr("status_active");

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{tr("system_administration")}</div>
          <h1>{tr("tenants")}</h1>
          <p>{tr("tenants_intro")}</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            saveMutation.reset();
            setEditing({
              name: "",
              slug: "",
              plan_tier: "pro",
              status: "active",
              agent_limit: 15,
              storage_limit_mb: 51200,
              admin_name: "",
              admin_email: "",
              admin_password: "",
            });
          }}
        >
          {tr("add_tenant")}
        </button>
      </div>

      {editing && (
        <Modal
          title={tr(editing.id ? "edit_tenant" : "add_tenant")}
          busy={saveMutation.isPending}
          onClose={() => setEditing(null)}
        >
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(editing);
            }}
          >
            <div className="form-row">
              <label>
                {tr("tenant_name")}
                <input
                  autoFocus
                  required
                  maxLength={180}
                  value={editing.name}
                  disabled={saveMutation.isPending}
                  onChange={(e) => {
                    const name = e.target.value;
                    const autoSlug = !editing.id
                      ? name
                          .toLowerCase()
                          .replace(/ğ/g, "g")
                          .replace(/ü/g, "u")
                          .replace(/ş/g, "s")
                          .replace(/ı/g, "i")
                          .replace(/ö/g, "o")
                          .replace(/ç/g, "c")
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, "")
                      : editing.slug;
                    setEditing({ ...editing, name, slug: autoSlug });
                  }}
                />
              </label>
              <label>
                {tr("tenant_slug")}
                <input
                  required
                  maxLength={64}
                  value={editing.slug}
                  disabled={saveMutation.isPending}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      slug: e.target.value.toLowerCase(),
                    })
                  }
                />
              </label>
            </div>
            <p className="hint">{tr("tenant_slug_hint")}</p>

            <div className="form-row">
              <label>
                {tr("plan_tier")}
                <select
                  value={editing.plan_tier}
                  disabled={saveMutation.isPending}
                  onChange={(e) => {
                    const tier = e.target.value as
                      | "starter"
                      | "pro"
                      | "enterprise";
                    const preset = PLAN_PRESETS[tier];
                    setEditing({
                      ...editing,
                      plan_tier: tier,
                      agent_limit: preset.agent_limit,
                      storage_limit_mb: preset.storage_limit_mb,
                    });
                  }}
                >
                  <option value="starter">{tr("plan_starter")}</option>
                  <option value="pro">{tr("plan_pro")}</option>
                  <option value="enterprise">{tr("plan_enterprise")}</option>
                </select>
              </label>
              <label>
                {tr("tenant_status")}
                <select
                  value={editing.status}
                  disabled={saveMutation.isPending}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      status: e.target.value as TenantFormState["status"],
                    })
                  }
                >
                  <option value="trial">{tr("status_trial")}</option>
                  <option value="active">{tr("status_active")}</option>
                  <option value="past_due">{tr("status_past_due")}</option>
                  <option value="suspended">{tr("status_suspended")}</option>
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                {tr("agent_limit")}
                <input
                  type="number"
                  min={1}
                  max={100000}
                  required
                  value={editing.agent_limit}
                  disabled={saveMutation.isPending}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      agent_limit: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                {tr("storage_limit_mb")}
                <input
                  type="number"
                  min={1}
                  max={10000000}
                  required
                  value={editing.storage_limit_mb}
                  disabled={saveMutation.isPending}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      storage_limit_mb: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>

            {!editing.id && (
              <fieldset className="support-chain-editor">
                <legend>{tr("initial_admin_optional")}</legend>
                <div className="form-row">
                  <label>
                    {tr("admin_name")}
                    <input
                      value={editing.admin_name || ""}
                      disabled={saveMutation.isPending}
                      onChange={(e) =>
                        setEditing({ ...editing, admin_name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {tr("admin_email")}
                    <input
                      type="email"
                      value={editing.admin_email || ""}
                      disabled={saveMutation.isPending}
                      onChange={(e) =>
                        setEditing({ ...editing, admin_email: e.target.value })
                      }
                    />
                  </label>
                </div>
                {editing.admin_email && (
                  <label>
                    {tr("admin_password")}
                    <input
                      type="password"
                      minLength={8}
                      required
                      value={editing.admin_password || ""}
                      disabled={saveMutation.isPending}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          admin_password: e.target.value,
                        })
                      }
                    />
                  </label>
                )}
              </fieldset>
            )}

            {saveMutation.error && (
              <div className="error" role="alert">
                {tr(saveMutation.error)}
              </div>
            )}

            <div className="form-bottom">
              <button
                type="button"
                className="secondary"
                disabled={saveMutation.isPending}
                onClick={() => setEditing(null)}
              >
                {tr("cancel")}
              </button>
              <button className="primary" disabled={saveMutation.isPending}>
                {tr(saveMutation.isPending ? "saving" : "save")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {query.isPending || query.isError ? (
        <QueryState result={query} />
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("tenant_name")}</th>
                  <th>{tr("plan_tier")}</th>
                  <th>{tr("tenant_status")}</th>
                  <th>{tr("agent_quota_usage")}</th>
                  <th>{tr("storage_quota_usage")}</th>
                  <th>{tr("companies")}</th>
                  <th>{tr("total_tickets")}</th>
                  <th>{tr("take_action")}</th>
                </tr>
              </thead>
              <tbody>
                {query.data.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.name}</strong>
                      <small>{t.slug}</small>
                    </td>
                    <td>{planLabel(t.plan_tier)}</td>
                    <td>
                      <span
                        className={`badge ${
                          t.status === "active"
                            ? "closed"
                            : t.status === "trial"
                              ? "open"
                              : t.status === "past_due"
                                ? "in_progress"
                                : "s1"
                        }`}
                      >
                        {statusLabel(t.status)}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {t.agent_used} / {t.agent_limit}
                      </strong>
                    </td>
                    <td>
                      {formatStorage(t.storage_used_bytes, t.storage_limit_mb)}
                    </td>
                    <td>{t.organization_count}</td>
                    <td>{t.ticket_count}</td>
                    <td>
                      <button
                        className="secondary"
                        aria-label={tr("edit", { name: t.name })}
                        onClick={() => {
                          saveMutation.reset();
                          setEditing({
                            id: t.id,
                            name: t.name,
                            slug: t.slug,
                            plan_tier: t.plan_tier,
                            status: t.status,
                            agent_limit: t.agent_limit,
                            storage_limit_mb: t.storage_limit_mb,
                          });
                        }}
                      >
                        {tr("edit_2")}
                      </button>{" "}
                      {activeTenantId === t.id ? (
                        <span className="badge open">
                          {tr("active_workspace")}
                        </span>
                      ) : (
                        <button
                          className="secondary"
                          disabled={
                            switchMutation.isPending || t.status === "suspended"
                          }
                          onClick={() => switchMutation.mutate(t.id)}
                        >
                          {tr("switch_workspace")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.data.length && <div className="empty">{tr("no_tenants")}</div>}
        </section>
      )}
    </>
  );
}
