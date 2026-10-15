import en from "./en.js";
import tr from "./tr.js";
import legacyEventKeys from "./legacy-event-keys.js";
export const languages = {
  tr: { name: "Türkçe", locale: "tr-TR" },
  en: { name: "English", locale: "en-GB" },
};
export const catalogs = {
  tr,
  en,
};
export function languageOf(value = "tr") {
  const code = String(value)
    .trim()
    .toLowerCase()
    .split(/[,;_-]/)[0];
  return Object.hasOwn(languages, code) ? code : "tr";
}
export function translate(key, params = {}, language = "tr") {
  const lang = languageOf(language),
    template = Object.hasOwn(catalogs[lang], key) ? catalogs[lang][key] : key;
  return String(template ?? "").replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined ? match : String(params[name]),
  );
}
export function messageParts(message) {
  if (message && typeof message === "object")
    return {
      key: message.message || message.key,
      params: message.params || {},
    };
  const match = String(message).match(
    /^Metin (\d+)–(\d+) karakter olmalıdır\.$/,
  );
  return match
    ? {
        key: "validation_text_length",
        params: { min: match[1], max: match[2] },
      }
    : { key: message, params: {} };
}
export function eventParts(event) {
  if (["comment", "resolution"].includes(event.kind)) return null;
  if (event.message_key)
    return {
      key: legacyEventKeys[event.message_key] || event.message_key,
      params: event.message_params || {},
    };
  const patterns = [
    [
      "created",
      /^Bilet oluşturuldu ve (.+) havuzuna iletildi\.$/,
      "event_ticket_created",
      ["company"],
    ],
    [
      "severity",
      /^Ciddiyet seviyesi (s[123]) → (s[123]) olarak güncellendi\.$/i,
      "event_severity_changed",
      ["from", "to"],
    ],
    [
      "resolved",
      /^(.+) bayisine test ve onay için iade edildi\.$/,
      "event_returned_to_dealer",
      ["company"],
    ],
    [
      "assigned",
      /^(.+) havuzuna atandı\.$/,
      "event_assigned_to_queue",
      ["company"],
    ],
    [
      "assigned",
      /^(.+) · (.+) atandı\.$/,
      "event_assigned_to_person",
      ["company", "person"],
    ],
  ];
  for (const [kind, regex, key, fields] of patterns) {
    if (event.kind !== kind) continue;
    const m = event.body.match(regex);
    if (m)
      return {
        key,
        params: Object.fromEntries(fields.map((field, i) => [field, m[i + 1]])),
      };
  }
  return { key: legacyEventKeys[event.body] || event.body, params: {} };
}

// A newer server may emit keys not yet present in an open client's catalog.
// Keep user comments verbatim and use the stored description for unknown events.
export function translateEvent(event, language = "tr") {
  const part = eventParts(event);
  if (!part || !Object.hasOwn(catalogs[languageOf(language)], part.key))
    return event.body;
  return translate(part.key, part.params, language);
}
