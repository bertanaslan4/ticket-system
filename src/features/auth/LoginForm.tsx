import { useLanguage } from "../../i18n/index.js";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { tr } from "../../i18n/index.js";
import LanguagePicker from "../../components/LanguagePicker";
import ThemeToggle from "../../components/ThemeToggle";

export default function Login({ onLogin, error, busy }: any) {
  useLanguage();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  return (
    <div className="login">
      <div className="login-story">
        <div className="brand">
          <span className="brand-image">
            <img
              src="/bekatos-logo.png"
              alt="Bekatos"
              style={{ maxHeight: 48, width: "auto" }}
            />
          </span>
          <small>{tr("support_center")}</small>
        </div>
        <div>
          <div className="eyebrow">{tr("one_platform_shared_solutions")}</div>
          <h1>
            {tr("great_support")}
            <br />
            {tr("starts_with_communication")}
          </h1>
          <p>
            {tr("from_customer_to_dealer_from_dealer_to_specialist")}
            <br />
            {tr("every_request_in_one_place")}
          </p>
          <div className="login-path">
            {tr("customer")}
            <ArrowRight />
            {tr("support_company")}
          </div>
        </div>
        <small>{tr("transparent_processes_secure_communication")}</small>
      </div>
      <div className="login-form">
        <div className="login-controls">
          <ThemeToggle />
          <LanguagePicker />
        </div>
        <div className="eyebrow">{tr("support_center")}</div>
        <h1>{tr("welcome_back")}</h1>
        <p>{tr("sign_in_to_access_your_workspace")}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLogin({ email, password });
          }}
        >
          <label>
            {tr("email_address")}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tr("name_company_com")}
              autoComplete="username"
            />
          </label>
          <label>
            {tr("password")}
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tr("your_password")}
              autoComplete="current-password"
            />
          </label>
          {error && (
            <div role="alert" className="error">
              {tr(error)}
            </div>
          )}
          <button disabled={busy} className="primary">
            {busy ? tr("signing_in") : tr("sign_in")}
            <ArrowRight size={18} />
          </button>
        </form>

      </div>
    </div>
  );
}
