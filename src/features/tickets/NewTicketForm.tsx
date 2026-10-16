import {
  AttachmentInput,
  AttachmentList,
  formValues,
} from "./TicketAttachments";
import { useLanguage } from "../../i18n/index.js";

import { Plus, ArrowLeft } from "lucide-react";

import { tr, number } from "../../i18n/index.js";
import { useState, useEffect } from "react";
import { api } from "../../lib/api";

export default function NewTicket({ user, busy, onSubmit, onCancel }: any) {
  useLanguage();
  const [title, setTitle] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    if (title.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      api<any[]>(`/kb?q=${encodeURIComponent(title.trim())}`)
        .then((res) => {
          setSuggestions(Array.isArray(res) ? res.slice(0, 3) : []);
        })
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [title]);
  return (
    <>
      <button className="back" onClick={onCancel}>
        <ArrowLeft size={16} />
        {tr("back_to_overview")}
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{tr("new_request")}</div>
          <h1>{tr("how_can_we_help")}</h1>
          <p>{tr("share_your_request_so_the_right_team_can_start")}</p>
        </div>
      </div>
      <form
        className="panel form-panel"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(formValues(e.target));
        }}
      >
        <div className="form-row">
          <label>
            {tr("ticket_type")}
            <select name="type">
              <option value="Hata">{tr("ticket_type_bug")}</option>
              <option value="İstek">{tr("ticket_type_request")}</option>
            </select>
          </label>
          <label>
            {tr("severity_level")}
            <select name="severity" defaultValue="s2">
              <option value="s1">{tr("s1_critical_work_has_stopped")}</option>
              <option value="s2">{tr("s2_medium_work_is_affected")}</option>
              <option value="s3">{tr("s3_low_general_request")}</option>
            </select>
          </label>
        </div>
        <label>
          {tr("title")}
          <input
            name="title"
            minLength={3}
            maxLength={180}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr("briefly_summarize_your_request")}
          />
        </label>
        {suggestions.length > 0 && (
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "rgba(59, 130, 246, 0.08)",
              borderRadius: 8,
              border: "1px solid rgba(59, 130, 246, 0.25)",
              marginTop: 4,
              marginBottom: 12,
            }}
          >
            <strong style={{ fontSize: 13, color: "#60a5fa" }}>
              💡 {tr("suggested_solutions")}
            </strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
              {suggestions.map((s) => (
                <li key={s.id}>
                  <a
                    href={`/kb`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--accent-color, #38bdf8)" }}
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <label>
          {tr("description")}
          <textarea
            name="description"
            minLength={10}
            maxLength={10000}
            required
            rows={7}
            placeholder={tr("what_happened_how_can_it_be_reproduced_what_did")}
          />
        </label>
        <AttachmentInput disabled={busy} />
        <div className="form-bottom">
          <span>
            {tr("you_can_create_more_tickets_today", {
              count: number(user.daily_limit - user.used),
            })}
          </span>
          <button
            className="primary"
            disabled={busy || user.used >= user.daily_limit}
          >
            <Plus size={17} />
            {busy ? tr("creating") : tr("create_ticket_2")}
          </button>
        </div>
      </form>
    </>
  );
}
