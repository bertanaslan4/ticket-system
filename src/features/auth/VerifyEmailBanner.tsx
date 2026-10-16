import { useState } from "react";
import { api } from "../../lib/api";
import { tr, useLanguage } from "../../i18n/index.js";

/** Shown to users who signed up themselves until they confirm the emailed link. */
export default function VerifyEmailBanner() {
  useLanguage();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="verify-banner" role="status">
      <span>
        {state === "sent" ? tr("verification_sent") : tr("email_unverified_banner")}
        {error ? <strong> {tr(error)}</strong> : null}
      </span>
      {state !== "sent" && (
        <button
          type="button"
          className="secondary"
          disabled={state === "sending"}
          onClick={async () => {
            setState("sending");
            setError(null);
            try {
              await api("/me/verify-email/resend", {});
              setState("sent");
            } catch (e) {
              setError(e);
              setState("idle");
            }
          }}
        >
          {tr("resend_verification")}
        </button>
      )}
    </div>
  );
}
