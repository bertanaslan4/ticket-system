import { readFileSync } from "node:fs";

export interface MailTemplateData {
  recipient_name: string;
  ticket_number: string;
  ticket_title: string;
  customer_name: string;
  severity: string;
  date: string;
  resolution?: string;
  ticket_url?: string;
}

const templates = {
  assigned: readFileSync(new URL("./templates/support-request-assigned.html", import.meta.url), "utf8"),
  closed: readFileSync(new URL("./templates/support-request-closed.html", import.meta.url), "utf8"),
};

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function safeLink(value?: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "";
    return url.href;
  } catch { return ""; }
}

/** Only pass the support company's customer-visible resolution for closed notifications. */
export function renderMail(kind: "assigned" | "closed", data: MailTemplateData) {
  if (!(kind in templates)) throw new Error("Unknown mail template");
  const heading = kind === "closed" ? "Destek isteminiz çözümlendi" : "Yeni destek istemi ataması";
  const url = safeLink(data.ticket_url);
  const fields: Record<string, string> = {};
  for (const key of ["recipient_name", "ticket_number", "ticket_title", "customer_name", "severity", "date"] as const) {
    fields[key] = escapeHtml(data[key]);
  }
  fields.heading = heading;
  fields.resolution = kind === "closed" ? escapeHtml(data.resolution).replace(/\r?\n/g, "<br>") : "";
  fields.action = url ? '<p style="margin:28px 0"><a href="' + escapeHtml(url) + '" style="display:inline-block;padding:14px 22px;background:#147bb2;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold">Destek istemini görüntüle</a></p>' : "";
  const html = templates[kind].replace(/{{([a-z_]+)}}/g, (_, key) => fields[key] ?? "");
  const text = [
    heading, "", "Sayın " + data.recipient_name + ",",
    kind === "closed" ? "Destek isteminiz ilgili destek şirketi tarafından çözümlenerek kapatılmıştır." : "Destek istemi size veya şirketinizin destek havuzuna atanmıştır.",
    "", data.ticket_number + " · " + data.date,
    "Konu: " + data.ticket_title, "Firma: " + data.customer_name, "Öncelik: " + data.severity,
    ...(kind === "closed" ? ["", "Çözüm açıklaması:", data.resolution || ""] : []),
    ...(url ? ["", "Destek istemini görüntüle: " + url] : []),
    "", "Bekatos Destek Merkezi",
  ].join("\n");
  return { subject: (heading + " · " + data.ticket_number).replace(/[\r\n]/g, " "), html, text };
}
