import { tr, number, locale } from "../../i18n/index.js";
import { states, format } from "../administration/admin.shared";
export function download(rows) {
  const cell = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const data = [
    [
      tr("ticket"),
      tr("title"),
      tr("product"),
      tr("customer"),
      tr("first_support_company"),
      tr("responsible_team_2"),
      tr("staff_member"),
      tr("type"),
      tr("status_2"),
      tr("severity_2"),
      tr("created"),
      tr("closed_2"),
      tr("resolution_time_hours"),
    ],
    ...rows.map((t) => [
      t.id,
      t.title,
      t.program,
      t.customer_name,
      t.dealer_name,
      t.owner_name,
      t.assignee_name,
      tr(t.type === "Hata" ? "ticket_type_bug" : "ticket_type_request"),
      tr(states[t.status]),
      t.severity,
      format(t.created_at),
      t.closed_at ? format(t.closed_at) : "",
      t.resolution_hours === null
        ? ""
        : number(Number(t.resolution_hours), {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + data.map((row) => row.map(cell).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = locale().startsWith("tr")
    ? "destek-istemleri-raporu.csv"
    : "support-request-report.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
