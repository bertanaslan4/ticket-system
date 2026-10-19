import React from "react";
import { Sparkles, Radio } from "lucide-react";
import { useRealtime } from "./RealtimeContext";
import { tr, useLanguage } from "../../i18n/index.js";
import RealtimeUpgradeModal from "./RealtimeUpgradeModal";

export default function RealtimeIndicator() {
  useLanguage();
  const { status, isPremium, showUpgradeModal, setShowUpgradeModal } = useRealtime();

  if (isPremium) {
    const isLive = status === "connected";
    return (
      <>
        <div
          className={`realtime-status-pill ${isLive ? "connected" : "connecting"}`}
          title={tr("realtime_status_tooltip")}
          role="status"
          aria-live="polite"
        >
          <span className={`realtime-pulse-dot ${isLive ? "live" : ""}`} />
          <Radio size={14} className="realtime-icon" />
          <span className="realtime-label">
            {isLive ? tr("realtime_connected") : tr("realtime_connecting")}
          </span>
        </div>
        {showUpgradeModal && (
          <RealtimeUpgradeModal onClose={() => setShowUpgradeModal(false)} />
        )}
      </>
    );
  }

  // Free Tier: Pro upgrade badge
  return (
    <>
      <button
        type="button"
        className="realtime-status-pill upgrade-cta"
        onClick={() => setShowUpgradeModal(true)}
        title={tr("realtime_pro_modal_title")}
        aria-label={tr("realtime_upgrade_pro")}
      >
        <Sparkles size={14} className="realtime-sparkle-icon" />
        <span className="realtime-label">{tr("realtime_upgrade_pro")}</span>
      </button>

      {showUpgradeModal && (
        <RealtimeUpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </>
  );
}
