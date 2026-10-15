import { AttachmentList } from "./TicketAttachments";
import { useLanguage } from "../../i18n/index.js";

import { Activity, MessageSquare, Lock } from "lucide-react";

import { tr, date, eventText } from "../../i18n/index.js";
import LanguagePicker from "../../components/LanguagePicker";

export default function TicketTimeline({ events }: any) {
  useLanguage();
  return (
    <section className="panel detail-section timeline">
      <h2>
        <Activity size={19} />
        {tr("timeline")}
      </h2>
      <p className="muted">{tr("every_step_of_the_request_in_one_place")}</p>
      {events.map((e) => (
        <div className={"event " + e.visibility} key={e.id}>
          <span className="event-dot">
            {["comment", "resolution"].includes(e.kind) ? (
              <MessageSquare size={13} />
            ) : (
              <Activity size={13} />
            )}
          </span>
          <div>
            <div className="event-meta">
              <strong>{e.actor_name}</strong>
              <span>{e.org_name}</span>
              <time>{date(e.created_at)}</time>
            </div>
            {e.visibility === "internal" && (
              <span className="internal-label">
                <Lock size={11} />
                {tr("internal")}
              </span>
            )}
            <p className="preserve">{eventText(e)}</p>
            <AttachmentList attachments={e.attachments} />
          </div>
        </div>
      ))}
    </section>
  );
}
