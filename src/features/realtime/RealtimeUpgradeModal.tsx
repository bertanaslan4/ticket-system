import React from "react";
import { Zap, Radio, BellRing, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import Modal from "../../components/Modal";
import { tr, useLanguage } from "../../i18n/index.js";
import { useAuth } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";

export default function RealtimeUpgradeModal({
  onClose,
}: {
  onClose: () => void;
}) {
  useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleUpgradeClick = () => {
    onClose();
    if (user?.role === "super_admin") {
      navigate("/admin/tenants");
    } else {
      // Direct user to profile or contact admin
      navigate("/profile");
    }
  };

  return (
    <Modal
      title={tr("realtime_pro_modal_title")}
      eyebrow={tr("realtime_live_stream")}
      className="realtime-upgrade-modal"
      onClose={onClose}
    >
      <div className="realtime-modal-content">
        <div className="realtime-modal-hero">
          <div className="realtime-hero-badge">
            <Sparkles size={18} />
            <span>PRO & ENTERPRISE</span>
          </div>
          <p className="realtime-modal-lead">{tr("realtime_pro_modal_desc")}</p>
        </div>

        <div className="realtime-features-list">
          <div className="realtime-feature-item">
            <div className="realtime-feature-icon">
              <Zap size={20} />
            </div>
            <div className="realtime-feature-text">
              <strong>{tr("realtime_new_ticket")}</strong>
              <p>{tr("realtime_pro_feature_1")}</p>
            </div>
          </div>

          <div className="realtime-feature-item">
            <div className="realtime-feature-icon">
              <Radio size={20} />
            </div>
            <div className="realtime-feature-text">
              <strong>{tr("realtime_ticket_updated")}</strong>
              <p>{tr("realtime_pro_feature_2")}</p>
            </div>
          </div>

          <div className="realtime-feature-item">
            <div className="realtime-feature-icon">
              <BellRing size={20} />
            </div>
            <div className="realtime-feature-text">
              <strong>{tr("realtime_live_stream")}</strong>
              <p>{tr("realtime_pro_feature_3")}</p>
            </div>
          </div>
        </div>

        <div className="realtime-plan-comparison">
          <div className="realtime-plan-pill current">
            <span className="pill-label">{tr("status")}:</span>
            <span className="pill-value">{(user?.plan_tier || "free").toUpperCase()}</span>
          </div>
          <div className="realtime-plan-pill target">
            <span className="pill-label">{tr("recommended")}:</span>
            <span className="pill-value">PRO / ENTERPRISE</span>
          </div>
        </div>

        <div className="realtime-modal-actions">
          <button
            type="button"
            className="realtime-upgrade-btn"
            onClick={handleUpgradeClick}
          >
            <Sparkles size={18} />
            <span>{tr("realtime_upgrade_button")}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
