import {
  AttachmentInput,
  AttachmentList,
  formValues,
} from "./TicketAttachments";
import { useLanguage } from "../../i18n/index.js";

import { Plus, ArrowLeft } from "lucide-react";

import { tr, number } from "../../i18n/index.js";
import LanguagePicker from "../../components/LanguagePicker";

export default function NewTicket({ user, busy, onSubmit, onCancel }: any) {
  useLanguage();
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
            placeholder={tr("briefly_summarize_your_request")}
          />
        </label>
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
