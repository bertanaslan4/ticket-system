import { useLanguage } from "../../i18n/index.js";
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import LoginForm from "./LoginForm";
import QueryState from "../../components/QueryState";
import { tr } from "../../i18n/index.js";
import { api } from "../../lib/api";
export default function LoginPage() {
  useLanguage();
  const auth = useAuth(),
    location = useLocation(),
    navigate = useNavigate();
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string | null>(null);
  const query = new URLSearchParams(location.search);
  const resetToken = query.get("reset");
  const verifyToken = query.get("verify");
  const verifying = useRef(false);
  // Emailed verification links land here: confirm once, then drop the token from the URL.
  useEffect(() => {
    if (!verifyToken || verifying.current) return;
    verifying.current = true;
    api("/public/verify-email", { token: verifyToken })
      .then(() => {
        setNotice("email_verified_success");
        return auth.refresh();
      })
      .catch((e) => setError(e))
      .finally(() => navigate("/login", { replace: true, state: location.state }));
  }, [verifyToken]);
  const from = location.state?.from;
  const target =
    typeof from === "string" &&
    from.startsWith("/") &&
    !from.startsWith("//") &&
    !from.startsWith("/login") &&
    (!/^\/admin(?:\/|\?|$)/.test(from) || auth.user?.role === "super_admin") &&
    (!/^\/tickets\/new(?:\/|\?|$)/.test(from) || auth.user?.role === "customer")
      ? from
      : "/dashboard";
  if (auth.loading || auth.error)
    return (
      <QueryState
        result={{
          isPending: auth.loading,
          error: auth.error,
          refetch: auth.refresh,
        }}
      />
    );
  if (auth.user) return <Navigate to={target} replace />;
  return (
    <LoginForm
      busy={busy}
      error={tr(error)}
      notice={notice ? tr(notice) : null}
      resetToken={resetToken}
      onForgot={async (body: unknown) => {
        setBusy(true);
        setError(null);
        try {
          await api("/public/forgot-password", body);
          setNotice("reset_link_sent");
          return true;
        } catch (e) {
          setError(e);
          return false;
        } finally {
          setBusy(false);
        }
      }}
      onReset={async (body: unknown) => {
        setBusy(true);
        setError(null);
        try {
          await api("/public/reset-password", body);
          setNotice("password_reset_done");
          navigate("/login", { replace: true, state: location.state });
          return true;
        } catch (e) {
          setError(e);
          return false;
        } finally {
          setBusy(false);
        }
      }}
      onLogin={async (body: unknown) => {
        setBusy(true);
        setError(null);
        try {
          await auth.login(body);
        } catch (e) {
          setError(e);
        } finally {
          setBusy(false);
        }
      }}
      onSignup={async (body: unknown) => {
        setBusy(true);
        setError(null);
        try {
          await api("/public/signup", body);
          await auth.refresh();
        } catch (e) {
          setError(e);
        } finally {
          setBusy(false);
        }
      }}
      onJoin={async (body: unknown) => {
        setBusy(true);
        setError(null);
        try {
          await api("/public/join", body);
          await auth.refresh();
        } catch (e) {
          setError(e);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
