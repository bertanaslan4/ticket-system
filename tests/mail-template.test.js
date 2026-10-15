import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMail } from "../build/server/mail/render-mail.js";

const data = {
  recipient_name: 'Ayşe <img src=x onerror="alert(1)">',
  ticket_number: "TK-0005", ticket_title: "<script>alert(1)</script>",
  customer_name: "Yargıcı", severity: "s2", date: "09.10.2026",
  resolution: "Test edildi.\nSorun çözüldü.",
};
test("Local HTML escapes user content and preserves resolution line breaks", () => {
  const { html, text } = renderMail("closed", data);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("Test edildi.<br>Sorun çözüldü."));
  assert.ok(text.includes(data.resolution));
  assert.ok(html.includes("Firma"));
  assert.ok(html.includes("Yargıcı"));
  assert.ok(html.includes("Öncelik"));
  assert.ok(!html.includes(">Program<"));
  assert.ok(!html.includes("Ciddiyet"));
  assert.ok(!html.includes("{{"));
});
test("Assignment contains no resolution and no link without application URL", () => {
  const mail = renderMail("assigned", data);
  assert.ok(!mail.html.includes(data.resolution.split("\n")[0]));
  assert.ok(!mail.text.includes(data.resolution));
  assert.ok(!mail.html.includes('href='));
});
test("Links reject executable URLs and escape attribute content", () => {
  assert.ok(!renderMail("closed", { ...data, ticket_url: "javascript:alert(1)" }).html.includes("href="));
  assert.ok(!renderMail("closed", { ...data, ticket_url: "https://user:pass@example.com/" }).html.includes("href="));
  const mail = renderMail("closed", { ...data, ticket_url: "https://support.example.com/tickets/5?a=1&b=2" });
  assert.ok(mail.html.includes('href="https://support.example.com/tickets/5?a=1&amp;b=2"'));
  assert.ok(mail.text.includes("https://support.example.com/tickets/5?a=1&b=2"));
});
