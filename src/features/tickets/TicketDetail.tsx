import {
  AttachmentInput,
  AttachmentList,
  formValues,
} from "./TicketAttachments";
import { useLanguage } from "../../i18n/index.js";
import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, ArrowRight } from "lucide-react";

import { tr, date } from "../../i18n/index.js";
import LanguagePicker from "../../components/LanguagePicker";
import Badge from "../../components/StatusBadge";

import TicketTimeline from "./TicketTimeline";
import TicketResolution from "./TicketResolution";
import { customerContactRole, isCustomerContact, previousSupportCompany } from '../../../shared/support-flow.js';
export default function Detail({ ticket: t, user, busy, onAction, back }: any) {
  useLanguage();
  const [formVersion, setFormVersion] = useState(0);
  const [tab, setTab] = useState("comment"),
    [org, setOrg] = useState(String(t.owner_org_id));
  const owned =
    !["customer", "super_admin"].includes(user.role) &&
    user.org_id === t.owner_org_id &&
    t.status !== "closed";
  const canComment = !["dealer", "contractor", "support"].includes(user.role) || owned;
  const canAssign = owned && (t.assignee_id == null || t.assignee_id === user.id);
  const contactRole = customerContactRole(t);
  const isContact = isCustomerContact(t, user);
  const previousCompany = t.support_companies?.find(o => o.id === previousSupportCompany(t));
  useEffect(() => {
    setTab("comment");
    setOrg(String(t.owner_org_id));
  }, [t.owner_org_id, t.assignee_id, t.status]);
  const submit = async (e) => {
    e.preventDefault();
    const data = formValues(e.target);
    const form = e.target;
    try {
      await onAction({
        ...data,
        action: tab,
        confirmed: data.confirmed === "on",
      });
      form.reset();
      setFormVersion((v) => v + 1);
    } catch {
      /* The page displays the mutation error; keep the draft. */
    }
  };
  return (
    <>
      <button className="back" onClick={back}>
        <ArrowLeft size={16} />
        {tr("back_to_tickets")}
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            TK-{String(t.id).padStart(4, "0")} ·{" "}
            {tr(t.type === "Hata" ? "ticket_type_bug" : "ticket_type_request")}{" "}
            · {t.program}
          </div>
          <h1>{t.title}</h1>
          <p>
            {t.customer_name} · {date(t.created_at)}
          </p>
        </div>
        <Badge value={t.status} />
      </div>
      <div className="detail-grid">
        <div>
          <section className="panel detail-section">
            <h2>{tr("request_description")}</h2>
            <p className="preserve">{t.description}</p>
            <AttachmentList attachments={t.attachments} />
          </section>
          <TicketResolution ticket={t} />
          <TicketTimeline events={t.events} />
        </div>
        <div>
          <section className="panel detail-section">
            <h2>{tr("ticket_information")}</h2>
            <dl>
              <dt>{tr("severity_2")}</dt>
              <dd>
                <Badge value={t.severity} />
              </dd>
              {t.sla_status && (
                <>
                  <dt>{tr("sla_status")}</dt>
                  <dd>
                    <span
                      className={
                        "badge " +
                        (t.sla_status === "breached"
                          ? "s1"
                          : t.sla_status === "at_risk"
                            ? "review"
                            : "closed")
                      }
                    >
                      {tr(
                        t.sla_status === "breached"
                          ? "sla_breached"
                          : t.sla_status === "at_risk"
                            ? "sla_at_risk"
                            : t.sla_status === "met"
                              ? "sla_met"
                              : "sla_on_track",
                      )}
                    </span>
                  </dd>
                </>
              )}
              {t.sla_first_response_due_at && (
                <>
                  <dt>{tr("sla_first_response_due")}</dt>
                  <dd>{date(t.sla_first_response_due_at)}</dd>
                </>
              )}
              {t.sla_resolution_due_at && (
                <>
                  <dt>{tr("sla_resolution_due")}</dt>
                  <dd>{date(t.sla_resolution_due_at)}</dd>
                </>
              )}
              <dt>{tr('support_chain')}</dt><dd>{t.support_chain ? t.support_companies?.map(o => o.name).join(' → ') : tr('flow_' + (t.support_flow || 'dealer_first'))}</dd>
              <dt>{tr("responsible_team_2")}</dt>
              <dd>{t.owner_name}</dd>
              <dt>{tr("assignee")}</dt>
              <dd>{t.assignee_name || tr("team_queue")}</dd>
              <dt>{tr("last_updated_2")}</dt>
              <dd>{date(t.updated_at)}</dd>
            </dl>
          </section>
          {t.status !== "closed" && !canComment ? (
            <div className="panel detail-section"><p className="hint">{tr("comment_requires_current_owner")}</p></div>
          ) : t.status !== "closed" ? (
            <section className="panel detail-section action-panel">
              <h2>{tr("take_action")}</h2>
              <div className="action-tabs">
                {[
                  ["comment", tr("comment")],
                  ...(owned
                    ? [
                        ...(canAssign ? [["assign", tr("assign")]] : []),
                        ...(t.support_chain ? [
                          ...(isContact ? [["severity", tr("severity_2")]] : []),
                          ["close", tr("close")],
                          ...(!isContact && canAssign ? [["resolve", tr("resolution")]] : []),
                        ] : isContact
                          ? [
                              ["severity", tr("severity_2")],
                              ["close", tr("close")],
                            ]
                          : canAssign ? [["resolve", tr("resolution")]] : []),
                      ]
                    : []),
                ].map(([k, v]) => (
                  <button
                    key={k}
                    className={tab === k ? "selected" : ""}
                    onClick={() => setTab(k)}
                  >
                    {tr(v)}
                  </button>
                ))}
              </div>
              {owned && !canAssign && <p className="hint">{tr('assignment_requires_assignee')}</p>}
              <form onSubmit={submit} key={tab + formVersion}>
                {tab === "comment" && (
                  <>
                    {isContact ? (
                      <label>
                        {tr("visibility")}
                        <select name="visibility">
                          <option value="internal">{tr("internal")}</option>
                          <option value="public">
                            {tr("customer_visible")}
                          </option>
                        </select>
                      </label>
                    ) : (
                      <>
                        <input
                          type="hidden"
                          name="visibility"
                          value={
                            user.role === "customer" ? "public" : "internal"
                          }
                        />
                        <p className="hint">
                          {user.role === "customer"
                            ? tr(
                                "your_comment_will_be_shared_with_the_support_teams",
                              )
                            : tr(
                                "internal_the_customer_cannot_see_this_comment",
                              )}
                        </p>
                      </>
                    )}
                  </>
                )}
                {["comment", "resolve", "close"].includes(tab) && (
                  <>
                    <label>
                      {tab === "resolve"
                        ? t.support_chain ? tr('resolution_for_support_company', { company: previousCompany?.name || '' }) : tr(contactRole === 'dealer' ? "resolution_details_for_the_dealer" : 'resolution_details_for_contractor')
                        : tab === "close"
                          ? tr("resolution_details_for_the_customer")
                          : tr("your_comment")}
                      <textarea
                        name="body"
                        rows={5}
                        required
                        minLength={tab === "comment" ? 1 : 10}
                        maxLength={10000}
                      />
                    </label>
                    <AttachmentInput disabled={busy} />
                    {tab === "resolve" && (
                      <p className="hint">
                        {t.support_chain ? tr('resolution_returns_previous_company', { company: previousCompany?.name || '' }) : tr(
                          contactRole === 'dealer' ? "the_resolution_is_returned_to_the_dealer_for_testing" : 'resolution_returned_to_contractor_hint',
                        )}
                      </p>
                    )}
                    {tab === "close" && t.status === "review" && (
                      <label className="checkbox">
                        <input name="confirmed" type="checkbox" required />
                        {tr("i_have_tested_and_approved_the_resolution")}
                      </label>
                    )}
                  </>
                )}
                {tab === "assign" && (
                  <>
                    <label>
                      {tr("target_team")}
                      <select
                        name="org_id"
                        value={org}
                        onChange={(e) => setOrg(e.target.value)}
                      >
                        {t.orgs.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {tr("staff_member")}
                      <select name="assignee_id" key={org}>
                        <option value="">{tr("team_queue")}</option>
                        {t.targets
                          .filter((u) => u.org_id === Number(org))
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                )}
                {tab === "severity" && (
                  <label>
                    {tr("severity_level")}
                    <select name="severity" defaultValue={t.severity}>
                      <option value="s1">{tr("s1_critical")}</option>
                      <option value="s2">{tr("s2_medium")}</option>
                      <option value="s3">{tr("s3_low")}</option>
                    </select>
                  </label>
                )}
                <button
                  disabled={busy || (!owned && tab !== "comment")}
                  className="primary"
                >
                  {busy
                    ? tr("saving")
                    : tab === "close"
                      ? tr("notify_and_close")
                      : tab === "resolve"
                        ? t.support_chain ? tr('send_resolution_to_support_company', { company: previousCompany?.name || '' }) : tr(contactRole === 'dealer' ? "send_resolution_to_dealer" : 'send_resolution_to_contractor')
                        : tr("save")}
                  <ArrowRight size={16} />
                </button>
              </form>
            </section>
          ) : (
            <div className="closed-note">
              <CheckCircle2 size={22} />
              <strong>{tr("this_ticket_is_resolved")}</strong>
              <p>{tr("the_process_is_complete_create_a_new_ticket_for")}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
