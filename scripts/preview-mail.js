import { mkdirSync, writeFileSync } from "node:fs";
import { renderMail } from "../build/server/mail/render-mail.js";

// Sample data only: this command never sends email or reads the database.
const data = {
  recipient_name: "Ayşe Demir", ticket_number: "TK-0005",
  ticket_title: "Sipariş ekranında kayıt güncelleme",
  customer_name: "Yargıcı", severity: "S2", date: "09.10.2026",
  resolution: "Sipariş kayıtları kontrol edildi ve güncelleme tamamlandı.\nBayi tarafından test edilerek işlemin sorunsuz çalıştığı doğrulandı.",
  ticket_url: "",
};
mkdirSync("build/mail-previews", { recursive: true });
for (const kind of ["assigned", "closed"]) {
  const mail = renderMail(kind, data);
  writeFileSync("build/mail-previews/" + kind + ".html", mail.html);
  writeFileSync("build/mail-previews/" + kind + ".txt", mail.text);
}
console.log("Mail previews created in build/mail-previews (no email sent).");
