import React, { useState, useEffect } from "react";
import {
  Zap,
  Plus,
  Play,
  History,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  Send,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Layers,
} from "lucide-react";
import { tr, useLanguage } from "../../i18n/index.js";
import {
  listAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  toggleAutomationRule,
  deleteAutomationRule,
  testAutomationRule,
  listAutomationLogs,
  AutomationRule,
  AutomationCondition,
  AutomationAction,
  AutomationLog,
} from "./automations.api";

export default function AutomationsPage() {
  useLanguage();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  const [showSimModal, setShowSimModal] = useState(false);
  const [simRule, setSimRule] = useState<AutomationRule | null>(null);
  const [simTitle, setSimTitle] = useState("Kasa POS cihazı kilitlendi, acil satış yapılamıyor");
  const [simDesc, setSimDesc] = useState("USB bağlantı koptu ve sistem hata verdi.");
  const [simSeverity, setSimSeverity] = useState("s3");
  const [simType, setSimType] = useState("Hata");
  const [simResult, setSimResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);

  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTrigger, setFormTrigger] = useState<AutomationRule["trigger_event"]>("ticket.created");
  const [formConditions, setFormConditions] = useState<AutomationCondition[]>([
    { field: "title", operator: "contains", value: "" },
  ]);
  const [formActions, setFormActions] = useState<AutomationAction[]>([
    { type: "set_severity", value: "s1" },
  ]);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadRules = async () => {
    try {
      const data = await listAutomationRules();
      setRules(data);
    } catch {
      setStatusMsg({ type: "error", text: "Kurallar yüklenirken bir hata oluştu." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const openCreateModal = () => {
    setEditingRule(null);
    setFormName("");
    setFormDesc("");
    setFormTrigger("ticket.created");
    setFormConditions([{ field: "title", operator: "contains", value: "" }]);
    setFormActions([{ type: "set_severity", value: "s1" }]);
    setFormActive(true);
    setShowFormModal(true);
  };

  const openEditModal = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormDesc(rule.description || "");
    setFormTrigger(rule.trigger_event);
    setFormConditions(
      Array.isArray(rule.conditions) && rule.conditions.length > 0
        ? rule.conditions
        : [{ field: "title", operator: "contains", value: "" }],
    );
    setFormActions(
      Array.isArray(rule.actions) && rule.actions.length > 0
        ? rule.actions
        : [{ type: "set_severity", value: "s1" }],
    );
    setFormActive(rule.is_active);
    setShowFormModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setSaving(true);
    setStatusMsg(null);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim(),
        trigger_event: formTrigger,
        conditions: formConditions.filter((c) => c.value.trim() !== ""),
        actions: formActions,
        is_active: formActive,
      };

      if (editingRule) {
        await updateAutomationRule(editingRule.id, payload);
        setStatusMsg({ type: "success", text: "Kural başarıyla güncellendi." });
      } else {
        await createAutomationRule(payload);
        setStatusMsg({ type: "success", text: "Yeni otomasyon kuralı başarıyla oluşturuldu." });
      }

      setShowFormModal(false);
      loadRules();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Kural kaydedilemedi." });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: AutomationRule) => {
    try {
      const nextActive = !rule.is_active;
      await toggleAutomationRule(rule.id, nextActive);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: nextActive } : r)));
    } catch {
      setStatusMsg({ type: "error", text: "Kural durumu değiştirilemedi." });
    }
  };

  const handleDeleteRule = async (rule: AutomationRule) => {
    if (!window.confirm(tr("automations_delete_confirm"))) return;
    try {
      await deleteAutomationRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      setStatusMsg({ type: "success", text: "Kural başarıyla silindi." });
    } catch {
      setStatusMsg({ type: "error", text: "Kural silinemedi." });
    }
  };

  const openSimModal = (rule?: AutomationRule) => {
    setSimRule(rule || (rules.length > 0 ? rules[0] : null));
    setSimResult(null);
    setShowSimModal(true);
  };

  const handleRunSimulation = async () => {
    if (!simRule) return;
    setSimulating(true);
    try {
      const sample = {
        title: simTitle,
        description: simDesc,
        severity: simSeverity,
        type: simType,
        status: "open",
      };
      const res = await testAutomationRule(simRule, sample);
      setSimResult(res);
    } catch {
      setStatusMsg({ type: "error", text: "Simülasyon çalıştırılamadı." });
    } finally {
      setSimulating(false);
    }
  };

  const openLogsModal = async () => {
    setShowLogsModal(true);
    setLoadingLogs(true);
    try {
      const data = await listAutomationLogs();
      setLogs(data);
    } catch {
      setStatusMsg({ type: "error", text: "Günlükler alınamadı." });
    } finally {
      setLoadingLogs(false);
    }
  };

  // Helper trigger labels
  const triggerLabels: Record<string, string> = {
    "ticket.created": "⚡ Bilet Oluşturulduğunda",
    "ticket.status_changed": "🔄 Durum Değiştiğinde",
    "ticket.assigned": "👤 Atama Yapıldığında",
    "sla.warning": "⏱️ SLA Süresi Yaklaştığında",
    "inactivity.timeout": "⏳ Hareketsizlik Zaman Aşımında",
  };

  const activeRulesCount = rules.filter((r) => r.is_active).length;
  const totalExecutions = rules.reduce((acc, r) => acc + (r.execution_count || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1040 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="eyebrow">İŞ AKIŞI & OTOMASYON</div>
          <h1 style={{ margin: "4px 0" }}>{tr("automations_title")}</h1>
          <p className="muted" style={{ margin: 0, maxWidth: 640 }}>
            {tr("automations_subtitle")}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="secondary"
            onClick={openLogsModal}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px" }}
          >
            <History size={16} />
            {tr("automations_execution_logs")}
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() => openSimModal()}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px" }}
          >
            <Play size={16} />
            {tr("automations_simulator")}
          </button>

          <button
            type="button"
            className="primary"
            onClick={openCreateModal}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px" }}
          >
            <Plus size={16} />
            {tr("automations_new_rule")}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: statusMsg.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
            border: `1px solid ${statusMsg.type === "success" ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            color: statusMsg.type === "success" ? "#10b981" : "#ef4444",
            fontWeight: 500,
          }}
        >
          {statusMsg.type === "success" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div className="panel" style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(59, 76, 184, 0.12)", color: "#3b4cb8", display: "grid", placeItems: "center" }}>
            <Layers size={22} />
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{tr("automations_total_rules")}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{rules.length}</div>
          </div>
        </div>

        <div className="panel" style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(16, 185, 129, 0.12)", color: "#10b981", display: "grid", placeItems: "center" }}>
            <Zap size={22} />
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{tr("automations_active_rules")}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#10b981" }}>{activeRulesCount}</div>
          </div>
        </div>

        <div className="panel" style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(249, 115, 22, 0.12)", color: "#f97316", display: "grid", placeItems: "center" }}>
            <Clock size={22} />
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{tr("automations_total_triggers")}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{totalExecutions}</div>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="panel" style={{ padding: 0, overflow: "hidden", borderRadius: 14 }}>
        <div style={{ padding: "20px 26px", borderBottom: "1px solid var(--card-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Tanımlı Otomasyon Kuralları</h2>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{rules.length} kural listeleniyor</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>Yükleniyor...</div>
        ) : rules.length === 0 ? (
          <div style={{ padding: "56px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <Zap size={38} color="var(--text-secondary)" style={{ opacity: 0.5 }} />
            <p style={{ margin: 0, color: "var(--text-secondary)", fontWeight: 500 }}>{tr("automations_no_rules")}</p>
            <button type="button" className="primary" onClick={openCreateModal} style={{ marginTop: 8 }}>
              {tr("automations_new_rule")}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rules.map((rule) => {
              const conds = Array.isArray(rule.conditions) ? rule.conditions : [];
              const acts = Array.isArray(rule.actions) ? rule.actions : [];

              return (
                <div
                  key={rule.id}
                  style={{
                    padding: "20px 26px",
                    borderBottom: "1px solid var(--card-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    background: rule.is_active ? "transparent" : "var(--workspace-bg, rgba(0,0,0,0.02))",
                    opacity: rule.is_active ? 1 : 0.75,
                    transition: "background 0.2s ease",
                  }}
                >

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "rgba(59, 76, 184, 0.12)",
                          color: "var(--brand-sky, #3b4cb8)",
                        }}
                      >
                        {triggerLabels[rule.trigger_event] || rule.trigger_event}
                      </span>

                      <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>{rule.name}</strong>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: rule.is_active ? "rgba(16, 185, 129, 0.12)" : "rgba(100, 116, 139, 0.15)",
                          color: rule.is_active ? "#10b981" : "var(--text-secondary)",
                        }}
                      >
                        {rule.is_active ? "Aktif" : "Devre Dışı"}
                      </span>

                      <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: "auto" }}>
                        Tetiklenme: <strong>{rule.execution_count || 0}</strong>
                      </span>
                    </div>

                    {rule.description && (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{rule.description}</p>
                    )}

                    {/* Conditions and Actions summary row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Eğer:</span>
                      {conds.length === 0 ? (
                        <span className="muted">Her zaman</span>
                      ) : (
                        conds.map((c, i) => (
                          <span
                            key={i}
                            style={{
                              background: "rgba(0,0,0,0.06)",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontFamily: "monospace",
                            }}
                          >
                            {c.field} {c.operator} "{c.value}"
                          </span>
                        ))
                      )}

                      <span style={{ fontWeight: 600, color: "var(--text-secondary)", marginLeft: 6 }}>➔ Yap:</span>
                      {acts.map((a, i) => (
                        <span
                          key={i}
                          style={{
                            background: "rgba(79, 70, 229, 0.1)",
                            color: "#4f46e5",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          {a.type === "set_severity"
                            ? `Öncelik: ${(a.value || "").toUpperCase()}`
                            : a.type === "set_status"
                            ? `Durum: ${a.value}`
                            : a.type === "add_internal_note"
                            ? `İç Not Ekle`
                            : `Teams Bildirimi`}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => openSimModal(rule)}
                      title={tr("automations_test_rule")}
                      style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                    >
                      <Play size={13} /> Test
                    </button>

                    <button
                      type="button"
                      className="secondary"
                      onClick={() => openEditModal(rule)}
                      title="Düzenle"
                      style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                    >
                      <Edit2 size={13} /> Düzenle
                    </button>

                    <button
                      type="button"
                      className="secondary"
                      onClick={() => handleToggleActive(rule)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        color: rule.is_active ? "#f59e0b" : "#10b981",
                      }}
                    >
                      {rule.is_active ? "Durdur" : "Etkinleştir"}
                    </button>

                    <button
                      type="button"
                      className="secondary"
                      onClick={() => handleDeleteRule(rule)}
                      title="Sil"
                      style={{ padding: "6px 10px", color: "#ef4444" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal 1: Create / Edit Rule */}
      {showFormModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="panel"
            style={{
              width: "100%",
              maxWidth: 640,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 28,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>
                {editingRule ? "Otomasyon Kuralını Düzenle" : tr("automations_new_rule")}
              </h2>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowFormModal(false)}
                style={{ padding: 6, borderRadius: 6 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{tr("automations_rule_name")} *</span>
                <input
                  type="text"
                  required
                  placeholder="Örn: Acil POS Hatalarını S1 Yap"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{tr("automations_rule_desc")}</span>
                <input
                  type="text"
                  placeholder="Kuralın ne işe yaradığını kısaca açıklayın"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{tr("automations_trigger")} *</span>
                <select
                  value={formTrigger}
                  onChange={(e) => setFormTrigger(e.target.value as any)}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--card-border)" }}
                >
                  <option value="ticket.created">⚡ Bilet Oluşturulduğunda (ticket.created)</option>
                  <option value="ticket.status_changed">🔄 Durum Değiştiğinde (ticket.status_changed)</option>
                  <option value="ticket.assigned">👤 Atama Yapıldığında (ticket.assigned)</option>
                  <option value="sla.warning">⏱️ SLA Süresi Yaklaştığında (sla.warning)</option>
                  <option value="inactivity.timeout">⏳ Hareketsizlik Zaman Aşımında (inactivity.timeout)</option>
                </select>
              </label>

              {/* Conditions Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{tr("automations_conditions")} (EĞER)</span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setFormConditions((prev) => [
                        ...prev,
                        { field: "title", operator: "contains", value: "" },
                      ])
                    }
                    style={{ fontSize: 12, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Plus size={14} /> {tr("automations_add_condition")}
                  </button>
                </div>

                {formConditions.map((cond, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 2fr auto", gap: 8, alignItems: "center" }}>
                    <select
                      value={cond.field}
                      onChange={(e) => {
                        const next = [...formConditions];
                        next[idx].field = e.target.value as any;
                        setFormConditions(next);
                      }}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--card-border)" }}
                    >
                      <option value="title">Başlık (Title)</option>
                      <option value="description">Açıklama (Description)</option>
                      <option value="severity">Önem Derecesi (Severity)</option>
                      <option value="type">Talep Türü (Type)</option>
                      <option value="status">Durum (Status)</option>
                      <option value="customer_org">Müşteri Şirketi</option>
                    </select>

                    <select
                      value={cond.operator}
                      onChange={(e) => {
                        const next = [...formConditions];
                        next[idx].operator = e.target.value as any;
                        setFormConditions(next);
                      }}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--card-border)" }}
                    >
                      <option value="contains">İçerir (contains)</option>
                      <option value="not_contains">İçermez (not contains)</option>
                      <option value="equals">Eşittir (equals)</option>
                      <option value="not_equals">Eşit Değildir</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Değer..."
                      value={cond.value}
                      onChange={(e) => {
                        const next = [...formConditions];
                        next[idx].value = e.target.value;
                        setFormConditions(next);
                      }}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--card-border)" }}
                    />

                    <button
                      type="button"
                      className="secondary"
                      disabled={formConditions.length === 1}
                      onClick={() => setFormConditions((prev) => prev.filter((_, i) => i !== idx))}
                      style={{ padding: 6, color: "#ef4444" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Actions Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{tr("automations_actions")} (YAP)</span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setFormActions((prev) => [...prev, { type: "add_internal_note", text: "" }])
                    }
                    style={{ fontSize: 12, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Plus size={14} /> {tr("automations_add_action")}
                  </button>
                </div>

                {formActions.map((act, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.5fr 2.5fr auto", gap: 8, alignItems: "center" }}>
                    <select
                      value={act.type}
                      onChange={(e) => {
                        const next = [...formActions];
                        next[idx].type = e.target.value as any;
                        if (next[idx].type === "set_severity") next[idx].value = "s1";
                        if (next[idx].type === "set_status") next[idx].value = "closed";
                        setFormActions(next);
                      }}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--card-border)" }}
                    >
                      <option value="set_severity">Önceliği Değiştir</option>
                      <option value="set_status">Durumu Değiştir</option>
                      <option value="add_internal_note">Şirket İçi Not Ekle</option>
                      <option value="send_teams_notification">Teams Kanalına Bildir</option>
                    </select>

                    {act.type === "set_severity" ? (
                      <select
                        value={act.value || "s1"}
                        onChange={(e) => {
                          const next = [...formActions];
                          next[idx].value = e.target.value;
                          setFormActions(next);
                        }}
                        style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--card-border)" }}
                      >
                        <option value="s1">S1 - Kritik (Acil)</option>
                        <option value="s2">S2 - Yüksek</option>
                        <option value="s3">S3 - Normal</option>
                      </select>
                    ) : act.type === "set_status" ? (
                      <select
                        value={act.value || "closed"}
                        onChange={(e) => {
                          const next = [...formActions];
                          next[idx].value = e.target.value;
                          setFormActions(next);
                        }}
                        style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--card-border)" }}
                      >
                        <option value="in_progress">İşlemde (in_progress)</option>
                        <option value="review">İnceleme (review)</option>
                        <option value="closed">Kapatıldı (closed)</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Eklenecek not veya mesaj..."
                        value={act.text || act.value || ""}
                        onChange={(e) => {
                          const next = [...formActions];
                          next[idx].text = e.target.value;
                          next[idx].value = e.target.value;
                          setFormActions(next);
                        }}
                        style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--card-border)" }}
                      />
                    )}

                    <button
                      type="button"
                      className="secondary"
                      disabled={formActions.length === 1}
                      onClick={() => setFormActions((prev) => prev.filter((_, i) => i !== idx))}
                      style={{ padding: 6, color: "#ef4444" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="ruleActive"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <label htmlFor="ruleActive" style={{ cursor: "pointer", fontWeight: 500 }}>
                  Kural Aktif Olarak Çalıştırılsın
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button type="button" className="secondary" onClick={() => setShowFormModal(false)}>
                  Vazgeç
                </button>
                <button type="submit" className="primary" disabled={saving}>
                  {saving ? "Kaydediliyor..." : tr("automations_save_rule")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Simulator & Live Playground */}
      {showSimModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="panel"
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 28,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Play size={20} color="#3b4cb8" />
                <h2 style={{ margin: 0, fontSize: 18 }}>{tr("automations_simulator")}</h2>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowSimModal(false)}
                style={{ padding: 6, borderRadius: 6 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Test Edilecek Kural</span>
                <select
                  value={simRule?.id || ""}
                  onChange={(e) => {
                    const found = rules.find((r) => r.id === Number(e.target.value));
                    setSimRule(found || null);
                    setSimResult(null);
                  }}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--card-border)" }}
                >
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.trigger_event})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Örnek Öncelik</span>
                  <select value={simSeverity} onChange={(e) => setSimSeverity(e.target.value)}>
                    <option value="s1">S1 (Kritik)</option>
                    <option value="s2">S2 (Yüksek)</option>
                    <option value="s3">S3 (Normal)</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Örnek Tür</span>
                  <select value={simType} onChange={(e) => setSimType(e.target.value)}>
                    <option value="Hata">Hata</option>
                    <option value="İstek">İstek</option>
                  </select>
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Örnek Bilet Başlığı</span>
                <input
                  type="text"
                  value={simTitle}
                  onChange={(e) => setSimTitle(e.target.value)}
                  placeholder="Başlık girin..."
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Örnek Açıklama</span>
                <textarea
                  rows={2}
                  value={simDesc}
                  onChange={(e) => setSimDesc(e.target.value)}
                  placeholder="Açıklama girin..."
                />
              </label>

              <button
                type="button"
                className="primary"
                onClick={handleRunSimulation}
                disabled={simulating || !simRule}
                style={{ padding: "10px 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Zap size={16} />
                {simulating ? "Hesaplanıyor..." : "Simülasyonu Çalıştır"}
              </button>

              {simResult && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    background: simResult.matched ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
                    border: `1px solid ${simResult.matched ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: simResult.matched ? "#10b981" : "#ef4444" }}>
                    {simResult.matched ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    <span>{simResult.matched ? tr("automations_conditions_matched") : tr("automations_conditions_not_matched")}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Koşul Eşleşme Kontrolleri:</span>
                    {simResult.conditionResults.map((cr: any, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                        {cr.matched ? <Check size={14} color="#10b981" /> : <X size={14} color="#ef4444" />}
                        <span>
                          <strong>{cr.field}</strong> {cr.operator} "{cr.expectedValue}"
                        </span>
                      </div>
                    ))}
                  </div>

                  {simResult.matched && simResult.plannedActions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981" }}>Planlanan Eylemler:</span>
                      {simResult.plannedActions.map((pa: any, i: number) => (
                        <div key={i} style={{ fontSize: 13, color: "var(--text-primary)" }}>
                          • {pa.type === "set_severity" ? `Öncelik ${pa.value.toUpperCase()} yapılacak` : pa.type === "set_status" ? `Durum ${pa.value} yapılacak` : `Bildirim gönderilecek`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Execution Logs Modal */}
      {showLogsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="panel"
            style={{
              width: "100%",
              maxWidth: 720,
              maxHeight: "85vh",
              overflowY: "auto",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <History size={20} color="#3b4cb8" />
                <h2 style={{ margin: 0, fontSize: 18 }}>{tr("automations_execution_logs")}</h2>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowLogsModal(false)}
                style={{ padding: 6, borderRadius: 6 }}
              >
                <X size={18} />
              </button>
            </div>

            {loadingLogs ? (
              <div style={{ padding: 40, textAlign: "center" }}>Yükleniyor...</div>
            ) : logs.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
                Henüz çalışmış bir otomasyon kaydı bulunmuyor.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 8,
                      border: "1px solid var(--card-border)",
                      background: "var(--workspace-bg, #f8fafc)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{log.rule_name}</span>
                        <span style={{ fontSize: 11, background: "rgba(59, 76, 184, 0.12)", color: "#3b4cb8", padding: "1px 6px", borderRadius: 4 }}>
                          Bilet #{log.ticket_id}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{log.trigger_event}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {new Date(log.created_at).toLocaleString("tr-TR")}
                      </div>
                    </div>

                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        background: log.status === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                        color: log.status === "success" ? "#10b981" : "#ef4444",
                      }}
                    >
                      {log.status === "success" ? "Başarılı" : "Hata"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
