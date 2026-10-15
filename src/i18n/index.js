import React, { useSyncExternalStore } from "react";

import {
  languages,
  languageOf,
  translate,
  messageParts,
  translateEvent,
} from "../../shared/i18n.js";
let language = "tr";
try {
  language = languageOf(
    localStorage.getItem("ticket-language") || navigator.language,
  );
} catch {}
const listeners = new Set();
export const getLanguage = () => language;
export function setLanguage(value) {
  language = languageOf(value);
  try {
    localStorage.setItem("ticket-language", language);
  } catch {}
  document.documentElement.lang = language;
  document
    .querySelectorAll("input, select, textarea")
    .forEach((input) => input.setCustomValidity(""));
  document.title = translate("takipsan_support_center", {}, language);
  listeners.forEach((fn) => fn());
}
export function useLanguage() {
  return useSyncExternalStore((fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, getLanguage);
}
export function tr(key, params = {}) {
  const part = messageParts(key);
  return translate(part.key, { ...part.params, ...params }, language);
}
export const locale = () => languages[language].locale;
export const errorSource = (data) =>
  Object.assign(new Error(data.errorKey || data.error || "action_failed"), {
    params: data.errorParams || {},
  });
export const number = (v, options = {}) =>
  new Intl.NumberFormat(locale(), options).format(v);
export const date = (
  v,
  options = {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
) =>
  new Intl.DateTimeFormat(locale(), {
    timeZone: "Europe/Istanbul",
    ...options,
  }).format(new Date(v));
export function eventText(event) {
  return translateEvent(event, language);
}

export function localizeValidation(event) {
  const input = event.target;
  input.setCustomValidity("");
  const v = input.validity;
  if (v.valid) return;
  input.setCustomValidity(
    v.valueMissing
      ? tr("this_field_is_required")
      : v.typeMismatch && input.type === "email"
        ? tr("enter_a_valid_email_address")
        : v.tooShort
          ? tr("please_enter_at_least_characters", { min: input.minLength })
          : tr("please_enter_a_valid_value"),
  );
}
setLanguage(language);
