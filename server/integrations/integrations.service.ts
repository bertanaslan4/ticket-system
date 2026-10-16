import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { fail, text, choice } from "../common/domain.js";
import crypto from "node:crypto";
import nodemailer from "nodemailer";

const APP_SECRET = process.env.APP_SECRET || "bekatos-saas-enterprise-secret-key-32b";
const CIPHER_KEY = crypto.createHash("sha256").update(APP_SECRET).digest();

export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", CIPHER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(cipherText: string): string {
  if (!cipherText || !cipherText.includes(":")) return "";
  try {
    const [ivHex, tagHex, dataHex] = cipherText.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", CIPHER_KEY, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(dataHex, "hex"), undefined, "utf8") + decipher.final("utf8");
  } catch {
    return "";
  }
}

@Injectable()
export class IntegrationsService {
  constructor(private readonly db: DatabaseService) {}

  private ensureAdmin(user: any) {
    if (user.role !== "super_admin") {
      fail(403, "this_area_is_restricted_to_super_admins");
    }
  }

  async getSmtpConfig(user: any) {
    this.ensureAdmin(user);
    const tenantId = user.tenant_id || 1;
    const row = (
      await this.db.query(
        `SELECT smtp_host, smtp_port, smtp_secure, smtp_user, 
                smtp_from_name, smtp_from_email,
                (smtp_pass_encrypted IS NOT NULL AND smtp_pass_encrypted <> '') AS has_password
         FROM tenants WHERE id = $1`,
        [tenantId],
      )
    ).rows[0];

    return {
      host: row?.smtp_host || "",
      port: row?.smtp_port || 587,
      secure: !!row?.smtp_secure,
      user: row?.smtp_user || "",
      from_name: row?.smtp_from_name || "",
      from_email: row?.smtp_from_email || "",
      has_password: !!row?.has_password,
    };
  }

  async saveSmtpConfig(user: any, body: any) {
    this.ensureAdmin(user);
    const tenantId = user.tenant_id || 1;

    const host = typeof body.host === "string" ? body.host.trim() : "";
    const port = Number(body.port) || 587;
    const secure = !!body.secure;
    const smtpUser = typeof body.user === "string" ? body.user.trim() : "";
    const fromName = typeof body.from_name === "string" ? body.from_name.trim() : "";
    const fromEmail = typeof body.from_email === "string" ? body.from_email.trim() : "";

    const updates: string[] = [
      "smtp_host = $2",
      "smtp_port = $3",
      "smtp_secure = $4",
      "smtp_user = $5",
      "smtp_from_name = $6",
      "smtp_from_email = $7",
    ];
    const params: any[] = [tenantId, host, port, secure, smtpUser, fromName, fromEmail];

    if (body.password !== undefined && typeof body.password === "string") {
      const encrypted = encryptSecret(body.password.trim());
      params.push(encrypted);
      updates.push(`smtp_pass_encrypted = $${params.length}`);
    }

    await this.db.query(
      `UPDATE tenants SET ${updates.join(", ")} WHERE id = $1`,
      params,
    );

    return this.getSmtpConfig(user);
  }

  async testSmtp(user: any, body: any) {
    this.ensureAdmin(user);
    const tenantId = user.tenant_id || 1;
    const targetEmail = body.to || user.email;

    const row = (
      await this.db.query(
        "SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass_encrypted, smtp_from_name, smtp_from_email FROM tenants WHERE id = $1",
        [tenantId],
      )
    ).rows[0];

    if (!row || !row.smtp_host) {
      fail(400, "smtp_not_configured");
    }

    const password = row.smtp_pass_encrypted ? decryptSecret(row.smtp_pass_encrypted) : "";

    const transporter = nodemailer.createTransport({
      host: row.smtp_host,
      port: row.smtp_port || 587,
      secure: !!row.smtp_secure,
      auth: row.smtp_user ? { user: row.smtp_user, pass: password } : undefined,
      tls: { rejectUnauthorized: false },
    });

    try {
      await transporter.verify();
      const fromAddr = `"${row.smtp_from_name || "Bekatos Support"}" <${row.smtp_from_email || row.smtp_user || "noreply@bekatos.com"}>`;
      await transporter.sendMail({
        from: fromAddr,
        to: targetEmail,
        subject: "Bekatos Destek Sistemi - SMTP Test E-postası",
        text: `Tebrikler! Özel SMTP sunucusu yapılandırmanız başarıyla doğrulandı.\nSunucu: ${row.smtp_host}:${row.smtp_port}\nTarih: ${new Date().toISOString()}`,
        html: `<div style="font-family:sans-serif;padding:20px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;">
          <h2 style="color:#0a0b4e;">Bekatos Destek Sistemi - SMTP Test</h2>
          <p>Tebrikler! Özel SMTP sunucunuz (${row.smtp_host}) başarıyla bağlandı ve test e-postası iletildi.</p>
          <small style="color:#64748b;">Tarih: ${new Date().toLocaleString("tr-TR")}</small>
        </div>`,
      });
      return { ok: true, message: "test_email_sent_successfully" };
    } catch (err: any) {
      fail(400, `smtp_connection_failed: ${err.message || String(err)}`);
    }
  }

  async getWebhooksConfig(user: any) {
    this.ensureAdmin(user);
    const tenantId = user.tenant_id || 1;
    const row = (
      await this.db.query(
        "SELECT webhook_teams_url, webhook_slack_url, webhook_events FROM tenants WHERE id = $1",
        [tenantId],
      )
    ).rows[0];

    return {
      webhook_teams_url: row?.webhook_teams_url || "",
      webhook_slack_url: row?.webhook_slack_url || "",
      webhook_events: row?.webhook_events || "ticket.created,ticket.closed,ticket.urgent",
    };
  }

  async saveWebhooksConfig(user: any, body: any) {
    this.ensureAdmin(user);
    const tenantId = user.tenant_id || 1;

    const teamsUrl = typeof body.webhook_teams_url === "string" ? body.webhook_teams_url.trim() : "";
    const slackUrl = typeof body.webhook_slack_url === "string" ? body.webhook_slack_url.trim() : "";
    const events = typeof body.webhook_events === "string" ? body.webhook_events.trim() : "ticket.created,ticket.closed,ticket.urgent";

    if (teamsUrl && !teamsUrl.startsWith("http")) fail(400, "invalid_teams_webhook_url");
    if (slackUrl && !slackUrl.startsWith("http")) fail(400, "invalid_slack_webhook_url");

    await this.db.query(
      `UPDATE tenants SET 
        webhook_teams_url = $2,
        webhook_slack_url = $3,
        webhook_events = $4
       WHERE id = $1`,
      [tenantId, teamsUrl, slackUrl, events],
    );

    return this.getWebhooksConfig(user);
  }

  async testWebhook(user: any, body: { type: "teams" | "slack" }) {
    this.ensureAdmin(user);
    const tenantId = user.tenant_id || 1;
    const config = await this.getWebhooksConfig(user);

    if (body.type === "teams") {
      if (!config.webhook_teams_url) fail(400, "teams_webhook_not_configured");
      
      const adaptiveCard = {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              type: "AdaptiveCard",
              version: "1.4",
              body: [
                {
                  type: "TextBlock",
                  text: "🔔 Bekatos Destek Sistemi - Test Bildirimi",
                  weight: "Bolder",
                  size: "Medium",
                  color: "Accent",
                },
                {
                  type: "TextBlock",
                  text: "Microsoft Teams bildirim entegrasyonunuz başarıyla bağlandı. Bilet ve SLA olayları bu kanala iletilecektir.",
                  wrap: true,
                },
                {
                  type: "FactSet",
                  facts: [
                    { title: "Durum:", value: "Aktif & Bağlandı" },
                    { title: "Zaman:", value: new Date().toLocaleString("tr-TR") },
                  ],
                },
              ],
            },
          },
        ],
      };

      try {
        const res = await fetch(config.webhook_teams_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(adaptiveCard),
        });
        if (!res.ok) {
          const txt = await res.text();
          fail(400, `teams_webhook_returned_error: ${res.status} ${txt}`);
        }
        return { ok: true, message: "teams_webhook_test_sent" };
      } catch (err: any) {
        fail(400, `teams_webhook_failed: ${err.message || String(err)}`);
      }
    } else {
      if (!config.webhook_slack_url) fail(400, "slack_webhook_not_configured");
      try {
        const res = await fetch(config.webhook_slack_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "🔔 *Bekatos Destek Sistemi* - Test bildirimi başarıyla iletildi!",
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          fail(400, `slack_webhook_returned_error: ${res.status} ${txt}`);
        }
        return { ok: true, message: "slack_webhook_test_sent" };
      } catch (err: any) {
        fail(400, `slack_webhook_failed: ${err.message || String(err)}`);
      }
    }
  }

  /**
   * Dispatches notifications to Teams/Slack if configured for the tenant.
   */
  async dispatchTicketNotification(tenantId: number, event: "ticket.created" | "ticket.closed" | "ticket.urgent", ticket: any) {
    try {
      const row = (
        await this.db.query(
          "SELECT webhook_teams_url, webhook_slack_url, webhook_events FROM tenants WHERE id = $1",
          [tenantId],
        )
      ).rows[0];

      if (!row) return;
      const allowedEvents = (row.webhook_events || "").split(",").map((s: string) => s.trim());
      if (!allowedEvents.includes(event)) return;

      const appUrl = process.env.MAIL_APP_URL || "http://localhost:3000";
      const ticketUrl = `${appUrl.replace(/\/$/, "")}/tickets/${ticket.id}`;
      const ticketNum = `TK-${String(ticket.id).padStart(4, "0")}`;

      if (row.webhook_teams_url) {
        const isUrgent = event === "ticket.urgent" || ticket.severity === "s1";
        const titleText = event === "ticket.closed"
          ? `✅ Bilet Çözüldü: ${ticketNum}`
          : isUrgent
            ? `🚨 Acil Destek İstemi Açıldı: ${ticketNum}`
            : `📩 Yeni Destek İstemi: ${ticketNum}`;

        const payload = {
          type: "message",
          attachments: [
            {
              contentType: "application/vnd.microsoft.card.adaptive",
              content: {
                $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                type: "AdaptiveCard",
                version: "1.4",
                body: [
                  {
                    type: "TextBlock",
                    text: titleText,
                    weight: "Bolder",
                    size: "Medium",
                    color: isUrgent ? "Attention" : "Accent",
                  },
                  {
                    type: "FactSet",
                    facts: [
                      { title: "Başlık:", value: ticket.title },
                      { title: "Program/Ürün:", value: ticket.program || "Genel" },
                      { title: "Öncelik:", value: ticket.severity?.toUpperCase() || "Normal" },
                    ],
                  },
                ],
                actions: [
                  {
                    type: "Action.OpenUrl",
                    title: "Bileti İncele ➔",
                    url: ticketUrl,
                  },
                ],
              },
            },
          ],
        };

        fetch(row.webhook_teams_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch((e) => console.error("Teams webhook delivery error:", e.message));
      }

      if (row.webhook_slack_url) {
        const textMsg = `*${ticketNum}*: <${ticketUrl}|${ticket.title}> (${ticket.severity?.toUpperCase()})`;
        fetch(row.webhook_slack_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textMsg }),
        }).catch((e) => console.error("Slack webhook delivery error:", e.message));
      }
    } catch (e: any) {
      console.error("Failed to dispatch ticket webhook:", e.message);
    }
  }

  async sendTenantMail(tenantId: number, mailOptions: { to: string; subject: string; text?: string; html?: string; replyTo?: string }): Promise<boolean> {
    try {
      const row = (
        await this.db.query(
          "SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass_encrypted, smtp_from_name, smtp_from_email FROM tenants WHERE id = $1",
          [tenantId],
        )
      ).rows[0];

      if (!row || !row.smtp_host) return false;

      const password = row.smtp_pass_encrypted ? decryptSecret(row.smtp_pass_encrypted) : "";
      const transporter = nodemailer.createTransport({
        host: row.smtp_host,
        port: row.smtp_port || 587,
        secure: !!row.smtp_secure,
        auth: row.smtp_user ? { user: row.smtp_user, pass: password } : undefined,
        tls: { rejectUnauthorized: false },
      });

      const fromAddr = `"${row.smtp_from_name || "Bekatos Destek"}" <${row.smtp_from_email || row.smtp_user || "noreply@bekatos.com"}>`;
      await transporter.sendMail({
        from: fromAddr,
        to: mailOptions.to,
        subject: mailOptions.subject,
        text: mailOptions.text,
        html: mailOptions.html,
        replyTo: mailOptions.replyTo || row.smtp_from_email,
      });
      return true;
    } catch (err: any) {
      console.error("Custom SMTP send failed, falling back to default mailer:", err.message);
      return false;
    }
  }

  async getWidgetConfig(user: any) {
    this.ensureAdmin(user);
    const tenantId = user.tenant_id || 1;
    const row = (
      await this.db.query(
        "SELECT slug, widget_enabled, widget_title, widget_color, widget_greeting, widget_position FROM tenants WHERE id = $1",
        [tenantId],
      )
    ).rows[0];

    return {
      slug: row?.slug || "primary",
      widget_enabled: row?.widget_enabled !== false,
      widget_title: row?.widget_title || "Canlı Destek",
      widget_color: row?.widget_color || "#3b4cb8",
      widget_greeting: row?.widget_greeting || "Merhaba! Size nasıl yardımcı olabiliriz?",
      widget_position: row?.widget_position || "right",
    };
  }

  async saveWidgetConfig(user: any, body: any) {
    this.ensureAdmin(user);
    const tenantId = user.tenant_id || 1;

    const enabled = body.widget_enabled !== false;
    const title = typeof body.widget_title === "string" ? body.widget_title.trim() : "Canlı Destek";
    const color = typeof body.widget_color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(body.widget_color) ? body.widget_color : "#3b4cb8";
    const greeting = typeof body.widget_greeting === "string" ? body.widget_greeting.trim() : "Merhaba! Size nasıl yardımcı olabiliriz?";
    const position = ["right", "left"].includes(body.widget_position) ? body.widget_position : "right";

    await this.db.query(
      `UPDATE tenants SET 
        widget_enabled = $2,
        widget_title = $3,
        widget_color = $4,
        widget_greeting = $5,
        widget_position = $6
       WHERE id = $1`,
      [tenantId, enabled, title, color, greeting, position],
    );

    return this.getWidgetConfig(user);
  }
}
