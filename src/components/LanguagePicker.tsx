import { Globe } from "lucide-react";
import { languages } from "../../shared/i18n.js";
import { tr, useLanguage, setLanguage } from "../i18n/index.js";
export default function LanguagePicker() {
  const language = useLanguage();
  return (
    <label className="language-picker">
      <Globe size={16} />
      <span className="sr-only">{tr("language")}</span>
      <select
        aria-label={tr("language")}
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        {Object.entries(languages).map(([key, v]) => (
          <option key={key} value={key}>
            {v.name}
          </option>
        ))}
      </select>
    </label>
  );
}
