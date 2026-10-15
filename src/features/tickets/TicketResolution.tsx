import { AttachmentList } from "./TicketAttachments";
import { CheckCircle2 } from "lucide-react";
import { tr, date, useLanguage } from "../../i18n/index.js";
import type { Ticket } from "../../lib/types";
export default function TicketResolution({ ticket }: { ticket: Ticket }) {
  useLanguage();
  if (ticket.status !== "closed" || !ticket.resolution) return null;
  const resolution = ticket.resolution;
  return (
    <section
      className="panel detail-section"
      aria-label={tr("dealer_resolution")}
    >
      <h2>
        <CheckCircle2 size={19} /> {tr("dealer_resolution")}
      </h2>
      <p className="preserve">{resolution.body}</p>
      <AttachmentList attachments={resolution.attachments} />
      <p className="muted">
        {resolution.org_name} · {resolution.actor_name} ·{" "}
        {date(resolution.created_at)}
      </p>
    </section>
  );
}
