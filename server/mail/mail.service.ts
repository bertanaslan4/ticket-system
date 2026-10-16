import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { createHmac, randomUUID } from "node:crypto";

export function buildMailPayload(
  kind: string,
  recipient: any,
  ticket: any,
  resolution = "",
) {
  const closed = kind === "closed";
  const origin = process.env.MAIL_APP_URL || "";
  return {
    title: `${closed ? "Destek isteminiz çözümlendi" : "Destek istemi ataması"} · TK-${String(ticket.id).padStart(4, "0")}`,
    template: closed
      ? process.env.MAIL_TEMPLATE_CLOSED
      : process.env.MAIL_TEMPLATE_ASSIGNED,
    source: process.env.MAIL_API_SOURCE || "ushops",
    lang: "tr",
    reply_to: process.env.MAIL_API_REPLY_TO || "destek@bekatos.com",
    to: [recipient.email],
    data: {
      notification_type: kind,
      recipient_name: recipient.name,
      ticket_id: ticket.id,
      ticket_number: `TK-${String(ticket.id).padStart(4, "0")}`,
      ticket_title: ticket.title,
      program: ticket.program,
      customer_name: ticket.customer_name || "",
      severity: ticket.severity,
      resolution: closed ? resolution : "",
      ticket_url: origin
        ? `${origin.replace(/\/$/, "")}/tickets/${ticket.id}`
        : "",
      date: new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date()),
    },
  };
}
@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running: Promise<void> | undefined;
  constructor(private readonly db: DatabaseService) {}
  enabled() {
    return (
      process.env.MAIL_ENABLED === "true" &&
      !!process.env.MAIL_API_URL &&
      !!process.env.MAIL_API_SECRET &&
      !!process.env.MAIL_TEMPLATE_CLOSED &&
      !!process.env.MAIL_TEMPLATE_ASSIGNED
    );
  }
  onModuleInit() {
    if (this.enabled()) {
      this.timer = setInterval(() => this.tick(), 15000);
      this.timer.unref();
      this.tick();
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
  tick() {
    if (!this.running)
      this.running = this.processBatch()
        .catch(() => {
          console.error("Mail queue processing failed");
        })
        .finally(() => {
          this.running = undefined;
        });
    return this.running;
  }
  async enqueue(
    tx: any,
    eventId: number,
    kind: string,
    ticket: any,
    recipients: any[],
    resolution = "",
  ) {
    const customer = (
      await tx.query("SELECT c.name FROM tickets t JOIN organizations c ON c.id=t.customer_id WHERE t.id=$1", [ticket.id])
    ).rows[0];
    const mailTicket = { ...ticket, customer_name: customer?.name || ticket.customer_name || "" };
    for (const r of recipients) {
      const demo = /@[^@]+\.(?:demo|local|test|invalid|example)$/i.test(
        r.email,
      );
      const payload = buildMailPayload(kind, r, mailTicket, resolution);
      await tx.query(
        "INSERT INTO mail_outbox(event_id,user_id,kind,payload,status,last_error) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(event_id,user_id,kind) DO NOTHING",
        [
          eventId,
          r.id,
          kind,
          JSON.stringify(payload),
          demo ? "skipped" : "pending",
          demo ? "demo_address" : null,
        ],
      );
    }
    await this.enqueuePush(
      tx,
      eventId,
      kind === "closed" ? "closed" : "assigned",
      mailTicket,
      recipients,
      resolution || mailTicket.title,
    );
  }
  async enqueuePush(
    tx: any,
    eventId: number | null,
    kind: "assigned" | "comment" | "resolved" | "closed",
    ticket: any,
    recipients: any[],
    summary = "",
  ) {
    const tenantId = ticket.tenant_id || 1;
    const ticketNum = `TK-${String(ticket.id).padStart(4, "0")}`;
    const title =
      kind === "closed"
        ? `Destek istemi çözümlendi · ${ticketNum}`
        : kind === "comment"
          ? `Yeni yorum · ${ticketNum}`
          : kind === "resolved"
            ? `Çözüm incelemesi · ${ticketNum}`
            : `Yeni destek istemi ataması · ${ticketNum}`;
    const body = `${ticket.title}${summary && summary !== ticket.title ? " — " + summary.slice(0, 120) : ""}`;
    const data = {
      ticketId: ticket.id,
      ticketNumber: ticketNum,
      kind,
      deepLink: `bekatos://tickets/${ticket.id}`,
    };
    const seen = new Set<number>();
    for (const r of recipients) {
      if (!r?.id || seen.has(r.id)) continue;
      seen.add(r.id);
      await tx.query(
        `INSERT INTO push_outbox(tenant_id, user_id, ticket_id, event_id, kind, title, body, data, status)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
        [
          tenantId,
          r.id,
          ticket.id,
          eventId,
          kind,
          title,
          body,
          JSON.stringify(data),
        ],
      );
    }
  }
  async send(payload: any, id: number) {
    const url = new URL(process.env.MAIL_API_URL!);
    if (url.protocol !== "https:") throw Error("configuration");
    const timestamp = String(Math.floor(Date.now() / 1000));
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Mail-Timestamp": timestamp,
        "X-Mail-Signature": createHmac("sha256", process.env.MAIL_API_SECRET!)
          .update(timestamp)
          .digest("hex"),
        "Idempotency-Key": `ticket-mail-${id}`,
      },
      body: JSON.stringify(payload),
    });
    await response.body?.cancel();
    if (!response.ok) throw Error("HTTP_" + response.status);
  }
  async processBatch() {
    if (!this.enabled()) return;
    for (let i = 0; i < 10; i++) {
      const token = randomUUID();
      const job = await this.db.transaction(async (tx) => {
        const row = (
          await tx.query(
            "SELECT * FROM mail_outbox WHERE (status='pending' AND next_attempt_at<=now()) OR (status='sending' AND locked_at<now()-interval '5 minutes') ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED",
          )
        ).rows[0];
        if (!row) return null;
        await tx.query(
          "UPDATE mail_outbox SET status='sending',attempts=attempts+1,locked_at=now(),lock_token=$2 WHERE id=$1",
          [row.id, token],
        );
        return { ...row, attempts: row.attempts + 1 };
      });
      if (!job) return;
      try {
        // Re-check deactivation before dispatch; use the original intended recipient address.
        const user = (
          await this.db.query("SELECT active FROM users WHERE id=$1", [
            job.user_id,
          ])
        ).rows[0];
        if (!user?.active) {
          await this.db.query(
            "UPDATE mail_outbox SET status='skipped',last_error='inactive_user',lock_token=NULL WHERE id=$1 AND lock_token=$2",
            [job.id, token],
          );
          continue;
        }
        const payload = {
          ...job.payload,
          template:
            job.kind === "closed"
              ? process.env.MAIL_TEMPLATE_CLOSED
              : process.env.MAIL_TEMPLATE_ASSIGNED,
        };
        await this.send(payload, job.id);
        await this.db.query(
          "UPDATE mail_outbox SET status='sent',sent_at=now(),last_error=NULL,lock_token=NULL WHERE id=$1 AND lock_token=$2",
          [job.id, token],
        );
      } catch (error: any) {
        const reason = /^HTTP_\d{3}$/.test(error.message)
          ? error.message
          : "delivery_failed";
        await this.db.query(
          "UPDATE mail_outbox SET status=$2,last_error=$3,next_attempt_at=now()+($4 * interval '1 second'),lock_token=NULL WHERE id=$1 AND lock_token=$5",
          [
            job.id,
            job.attempts >= 5 ? "failed" : "pending",
            reason,
            Math.min(3600, 60 * 2 ** (job.attempts - 1)),
            token,
          ],
        );
      }
    }
  }
}
