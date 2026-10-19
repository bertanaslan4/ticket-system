import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { tr, useLanguage } from "../../i18n/index.js";
import { CheckCircle2, Circle, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

export default function OnboardingChecklist() {
  useLanguage();
  const { user } = useAuth();
  const client = useQueryClient();

  const query = useQuery({
    queryKey: ["onboarding", user?.tenant_id],
    queryFn: ({ signal }) => api<any>("/me/onboarding", undefined, signal),
    enabled: user?.role === "super_admin",
  });

  const dismissMutation = useMutation({
    mutationFn: () => api("/me/onboarding/dismiss", {}),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["onboarding"] });
    },
  });

  if (user?.role !== "super_admin" || !query.data) return null;
  if (query.data.dismissed) return null;

  const { steps, completed_count, total_steps, is_all_completed } = query.data;

  const links: Record<string, string> = {
    invite_customer: "/admin/tenants",
    setup_product: "/admin/products",
    create_ticket: "/tickets",
    configure_sla: "/admin/operations",
  };

  return (
    <div
      className="panel"
      style={{
        padding: "24px 28px",
        marginBottom: 24,
        borderRadius: 14,
        backgroundColor: "var(--card-bg, #ffffff)",
        borderColor: is_all_completed ? "#10b981" : "#3b82f6",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 14,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px 0", color: "var(--text-primary)" }}>
            {tr("onboarding_checklist")}{" "}
            <span style={{ fontSize: 14, opacity: 0.8, fontWeight: 500 }}>
              ({completed_count}/{total_steps})
            </span>
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            {is_all_completed
              ? tr("all_steps_completed")
              : tr("onboarding_checklist_intro")}
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          title={tr("dismiss_checklist")}
          style={{ padding: "6px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center" }}
          onClick={() => dismissMutation.mutate()}
        >
          <X size={15} />
        </button>
      </div>

      <div
        style={{
          width: "100%",
          backgroundColor: "var(--card-border, #e2e8f0)",
          height: 6,
          borderRadius: 3,
          overflow: "hidden",
          marginBottom: 18,
          marginTop: 2,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.round((completed_count / total_steps) * 100)}%`,
            backgroundColor: is_all_completed ? "#10b981" : "#3b82f6",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {steps.map((step: any) => (
          <Link
            key={step.id}
            to={links[step.id] || "/dashboard"}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "14px 16px",
              borderRadius: 10,
              backgroundColor: step.completed
                ? "rgba(16, 185, 129, 0.08)"
                : "var(--workspace-bg, rgba(0, 0, 0, 0.02))",
              textDecoration: "none",
              color: "inherit",
              border: `1px solid ${step.completed ? "rgba(16, 185, 129, 0.35)" : "var(--card-border, #e2ebf1)"}`,
              transition: "all 0.15s ease",
            }}
          >
            {step.completed ? (
              <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
            ) : (
              <Circle size={18} color="#94a3b8" style={{ flexShrink: 0, marginTop: 2 }} />
            )}
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: step.completed ? "line-through" : "none",
                  opacity: step.completed ? 0.8 : 1,
                  color: "var(--text-primary)",
                  marginBottom: 2,
                }}
              >
                {tr(step.title_key)}
              </div>
              <small className="muted" style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                {tr(step.hint_key)}
              </small>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
