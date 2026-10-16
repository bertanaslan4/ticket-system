import React, { useState } from "react";
import { Sparkles, ArrowRight, Check, Bot, AlertTriangle, MessageSquare, BookOpen } from "lucide-react";
import { tr, useLanguage } from "../../i18n/index.js";
import { generateAiDraft } from "../ai/ai.api";
import type { Ticket, User } from "../../lib/types";

interface TicketAiCopilotProps {
  ticket: Ticket;
  user: User;
  onApplyDraft?: (text: string) => void;
  onUpdateSeverity?: (severity: string) => void;
}

export default function TicketAiCopilot({
  ticket: t,
  user,
  onApplyDraft,
  onUpdateSeverity,
}: TicketAiCopilotProps) {
  useLanguage();
  const [draftType, setDraftType] = useState<"solution" | "first_response" | "clarification">("solution");
  const [draft, setDraft] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // AI draft tools are for internal staff (dealer, contractor, support, admin)
  if (!user || user.role === "customer") {
    return null;
  }

  const tags = t.ai_tags ? t.ai_tags.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const suggestedSeverity = t.ai_suggested_severity || "s2";
  const needsPriorityUpdate = t.severity !== suggestedSeverity && t.status !== "closed";

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await generateAiDraft(t.id, { type: draftType });
      setDraft(res.draft);
    } catch (err: any) {
      setError(err?.message || tr("action_failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleUseDraft = () => {
    if (!draft) return;
    onApplyDraft?.(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section className="panel detail-section ai-copilot-card" data-testid="ai-copilot-panel">
      <div className="ai-copilot-header">
        <div className="ai-badge-wrap">
          <span className="ai-copilot-badge">
            <Sparkles size={14} className="sparkle-icon" />
            {tr("ai_copilot")}
          </span>
          <h3>{tr("ai_triaging")}</h3>
        </div>
        {t.ai_sentiment && (
          <span className={`ai-sentiment-pill sentiment-${t.ai_sentiment}`}>
            {t.ai_sentiment === "urgent" && <AlertTriangle size={12} />}
            {tr(`ai_sentiment_${t.ai_sentiment}`)}
          </span>
        )}
      </div>

      <div className="ai-triaging-grid">
        <div className="ai-triage-item">
          <span className="ai-triage-label">{tr("ai_suggested_priority")}</span>
          <div className="ai-triage-value-row">
            <span className={`badge ${suggestedSeverity}`}>
              {suggestedSeverity.toUpperCase()}
            </span>
            {needsPriorityUpdate && onUpdateSeverity && (
              <button
                type="button"
                className="ai-apply-btn"
                onClick={() => onUpdateSeverity(suggestedSeverity)}
                title={tr("ai_apply_priority")}
              >
                <ArrowRight size={13} />
                {tr("ai_apply_priority")}
              </button>
            )}
          </div>
        </div>

        {tags.length > 0 && (
          <div className="ai-triage-item">
            <span className="ai-triage-label">{tr("ai_detected_topics")}</span>
            <div className="ai-tags-wrap">
              {tags.map((tag) => (
                <span key={tag} className="ai-topic-tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {t.ai_summary && (
          <div className="ai-triage-item" style={{ gridColumn: "1 / -1" }}>
            <span className="ai-triage-label">{tr("ai_summary_label")}</span>
            <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5, color: "var(--text-primary)" }}>
              {t.ai_summary}
            </div>
          </div>
        )}
      </div>

      {/* AI Response Draft Generator */}
      {t.status !== "closed" && (
        <div className="ai-draft-section">
          <div className="ai-draft-tabs">
            {(
              [
                ["solution", tr("ai_draft_type_solution")],
                ["first_response", tr("ai_draft_type_first_response")],
                ["clarification", tr("ai_draft_type_clarification")],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`ai-tab-btn ${draftType === k ? "active" : ""}`}
                onClick={() => setDraftType(k)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ai-draft-trigger">
            <button
              type="button"
              className="ai-generate-btn"
              onClick={handleGenerate}
              disabled={busy}
            >
              <Sparkles size={14} />
              {busy ? tr("ai_generating_draft") : tr("ai_generate_draft")}
            </button>
          </div>

          {error && (
            <div role="alert" className="error" style={{ marginTop: 10 }}>
              {error}
            </div>
          )}

          {draft && (
            <div className="ai-draft-result" data-testid="ai-draft-result">
              <div className="ai-draft-box">
                <pre className="ai-draft-text">{draft}</pre>
              </div>
              <div className="ai-draft-actions">
                <button
                  type="button"
                  className="primary ai-apply-draft-btn"
                  onClick={handleUseDraft}
                >
                  {copied ? <Check size={14} /> : <MessageSquare size={14} />}
                  {copied ? tr("ai_priority_applied") : tr("ai_use_draft")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
