import { useLanguage } from "../../i18n/index.js";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { tr } from "../../i18n/index.js";
import LanguagePicker from "../../components/LanguagePicker";
import ThemeToggle from "../../components/ThemeToggle";
import LoginThreeBackground from "./LoginThreeBackground";

export default function LoginForm({
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

  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem("ticket_remembered_email") || "";
    } catch {
      return "";
    }
  });
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return !!localStorage.getItem("ticket_remembered_email");
    } catch {
      return false;
    }
  });

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industryTemplate, setIndustryTemplate] = useState("it_software");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (rememberMe && email) {
        localStorage.setItem("ticket_remembered_email", email);
      } else {
        localStorage.removeItem("ticket_remembered_email");
      }
    } catch {}
    onLogin({ email, password });
  };

  return (
    <div className="login">
      {/* 3D Three.js animation running in background across the wide screen */}
      <LoginThreeBackground />

      {/* Floating Theme and Language controls at top-right */}
      <div className="login-top-controls">
        <ThemeToggle />
        <LanguagePicker />
      </div>

      {/* Centered Tixia login card */}
      <div className="login-card login-form">
        <div className="login-card-brand">
          <div className="bekatos-brand-wrap">
            <img
              src="/bekatos-logo.png"
              alt="Bekatos"
              className="bekatos-logo"
            />
          </div>
          <div className="bekatos-brand-caption">
            <span className="bekatos-badge">{tr("support_center")}</span>
          </div>
        </div>

        <h1 className="login-card-title">
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
        {mode === "login" && (
          <p className="login-card-subtitle">{tr("sign_in_your_account")}</p>
        )}

        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}

        {error && (
          <div role="alert" className="error">
            {tr(error)}
          </div>
        )}

        {mode === "login" && (
          <form onSubmit={handleLoginSubmit}>
            <label>
              {tr("email_address")}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={tr("enter_username")}
                autoComplete="username"
              />
            </label>

            <label>
              {tr("password")}
              <div className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tr("enter_password")}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? tr("hide_password") : tr("show_password")}
                  title={showPassword ? tr("hide_password") : tr("show_password")}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <div className="login-options-row">
              <label className="remember-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>{tr("remember_my_preference")}</span>
              </label>
              <button
                type="button"
                className="forgot-link-btn"
                onClick={() => setMode("forgot")}
              >
                {tr("forgot_password")}?
              </button>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="tixia-login-btn primary"
            >
              {busy ? tr("signing_in") : tr("sign_in")}
            </button>

            <div className="login-card-footer">
              <span>{tr("dont_have_an_account")} </span>
              <button
                type="button"
                className="link-inline"
                onClick={() => setMode("signup")}
              >
                {tr("sign_up")}
              </button>
              <div className="login-footer-secondary">
                <button
                  type="button"
                  className="link-muted"
                  onClick={() => setMode("join")}
                >
                  {tr("join_with_invite_code")}
                </button>
              </div>
            </div>
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
                placeholder="Örn: ABC Teknoloji Ltd."
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
                placeholder="Adınız Soyadınız"
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
              <div className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tr("your_password")}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? tr("hide_password") : tr("show_password")}
                  title={showPassword ? tr("hide_password") : tr("show_password")}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="tixia-login-btn primary"
              style={{ marginTop: 14 }}
            >
              {busy ? tr("starting_workspace") : tr("start_free_workspace")}
            </button>
            <div className="login-card-footer">
              <span>{tr("already_have_an_account")} </span>
              <button
                type="button"
                className="link-inline"
                onClick={() => setMode("login")}
              >
                {tr("sign_in")}
              </button>
            </div>
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
                placeholder="Firma veya Şube Adı"
              />
            </label>
            <label>
              {tr("full_name")}
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adınız Soyadınız"
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
              <div className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tr("your_password")}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? tr("hide_password") : tr("show_password")}
                  title={showPassword ? tr("hide_password") : tr("show_password")}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="tixia-login-btn primary"
              style={{ marginTop: 14 }}
            >
              {busy ? tr("joining_workspace") : tr("join_workspace")}
            </button>
            <div className="login-card-footer">
              <span>{tr("already_have_an_account")} </span>
              <button
                type="button"
                className="link-inline"
                onClick={() => setMode("login")}
              >
                {tr("sign_in")}
              </button>
            </div>
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
            <button
              type="submit"
              disabled={busy}
              className="tixia-login-btn primary"
              style={{ marginTop: 14 }}
            >
              {busy ? tr("sending") : tr("send_reset_link")}
            </button>
            <div className="login-card-footer">
              <button
                type="button"
                className="link-inline"
                onClick={() => setMode("login")}
              >
                {tr("back_to_sign_in")}
              </button>
            </div>
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
              <div className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? tr("hide_password") : tr("show_password")}
                  title={showPassword ? tr("hide_password") : tr("show_password")}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <label>
              {tr("confirm_new_password")}
              <div className="password-input-wrap">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  aria-label={showConfirmPassword ? tr("hide_password") : tr("show_password")}
                  title={showConfirmPassword ? tr("hide_password") : tr("show_password")}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="tixia-login-btn primary"
              style={{ marginTop: 14 }}
            >
              {busy ? tr("updating") : tr("update_password")}
            </button>
            <div className="login-card-footer">
              <button
                type="button"
                className="link-inline"
                onClick={() => setMode("login")}
              >
                {tr("back_to_sign_in")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
