import { useLanguage } from "../../i18n/index.js";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { tr } from "../../i18n/index.js";
import LanguagePicker from "../../components/LanguagePicker";
import ThemeToggle from "../../components/ThemeToggle";

export default function Login({
  onLogin,
  onSignup,
  onJoin,
  onForgot,
  onReset,
  resetToken,
  notice,
  error,
  busy,
}: any) {
  useLanguage();
  const [mode, setMode] = useState<
    "login" | "signup" | "join" | "forgot" | "reset"
  >(resetToken ? "reset" : "login");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [name, setName] = useState(""),
    [companyName, setCompanyName] = useState(""),
    [industryTemplate, setIndustryTemplate] = useState("it_software"),
    [inviteCode, setInviteCode] = useState("");
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
        <h1>
          {mode === "signup"
            ? tr("create_free_workspace")
            : mode === "join"
              ? tr("join_with_invite_code")
              : mode === "forgot"
                ? tr("forgot_password")
                : mode === "reset"
                  ? tr("set_new_password")
                  : tr("welcome_back")}
        </h1>
        <p>{tr("sign_in_to_access_your_workspace")}</p>
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}

        {mode === "login" && (
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
            <button
              type="button"
              className="link-button"
              onClick={() => setMode("forgot")}
            >
              {tr("forgot_password")}
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onForgot?.({ email });
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
            {error && (
              <div role="alert" className="error">
                {tr(error)}
              </div>
            )}
            <button disabled={busy} className="primary">
              {busy ? tr("sending") : tr("send_reset_link")}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await onReset?.({
                token: resetToken,
                newPassword: password,
                confirmPassword,
              });
              if (ok) {
                setPassword("");
                setConfirmPassword("");
                setMode("login");
              }
            }}
          >
            <label>
              {tr("new_password")}
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label>
              {tr("confirm_new_password")}
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            {error && (
              <div role="alert" className="error">
                {tr(error)}
              </div>
            )}
            <button disabled={busy} className="primary">
              {busy ? tr("updating") : tr("update_password")}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSignup?.({
                company_name: companyName,
                admin_name: name,
                email,
                password,
                industry_template: industryTemplate,
              });
            }}
          >
            <label>
              {tr("workspace_company_name")}
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </label>
            <label>
              {tr("industry_template")}
              <select
                value={industryTemplate}
                onChange={(e) => setIndustryTemplate(e.target.value)}
              >
                <option value="it_software">{tr("template_it_software")}</option>
                <option value="field_service">{tr("template_field_service")}</option>
                <option value="agency">{tr("template_agency")}</option>
                <option value="ecommerce">{tr("template_ecommerce")}</option>
                <option value="general">{tr("template_general")}</option>
              </select>
            </label>
            <label>
              {tr("admin_name")}
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              {tr("email_address")}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tr("name_company_com")}
              />
            </label>
            <label>
              {tr("password")}
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tr("your_password")}
              />
            </label>
            {error && (
              <div role="alert" className="error">
                {tr(error)}
              </div>
            )}
            <button disabled={busy} className="primary">
              {busy ? tr("starting_workspace") : tr("start_free_workspace")}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        {mode === "join" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onJoin?.({
                invite_code: inviteCode,
                name,
                email,
                password,
                company_name: companyName,
              });
            }}
          >
            <label>
              {tr("invite_code")}
              <input
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder={tr("invite_code_placeholder")}
              />
            </label>
            <label>
              {tr("your_company_name")}
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </label>
            <label>
              {tr("full_name")}
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              {tr("email_address")}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tr("name_company_com")}
              />
            </label>
            <label>
              {tr("password")}
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tr("your_password")}
              />
            </label>
            {error && (
              <div role="alert" className="error">
                {tr(error)}
              </div>
            )}
            <button disabled={busy} className="primary">
              {busy ? tr("joining_workspace") : tr("join_workspace")}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {mode !== "login" && (
            <button
              type="button"
              className="secondary"
              onClick={() => setMode("login")}
            >
              {mode === "forgot" || mode === "reset"
                ? tr("back_to_sign_in")
                : tr("sign_in")}
            </button>
          )}
          {mode !== "signup" && (
            <button
              type="button"
              className="secondary"
              onClick={() => setMode("signup")}
            >
              {tr("create_free_workspace")}
            </button>
          )}
          {mode !== "join" && (
            <button
              type="button"
              className="secondary"
              onClick={() => setMode("join")}
            >
              {tr("join_with_invite_code")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
