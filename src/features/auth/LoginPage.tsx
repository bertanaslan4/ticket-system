import { useLanguage } from "../../i18n/index.js";
import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import LoginForm from "./LoginForm";
import QueryState from "../../components/QueryState";
import { tr } from "../../i18n/index.js";
export default function LoginPage() {
  useLanguage();
  const auth = useAuth(),
    location = useLocation();
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
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
    />
  );
}
