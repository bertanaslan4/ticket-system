import React, { useEffect } from "react";
import { Ticket, MessageSquare, Star, X, ArrowUpRight } from "lucide-react";
import { useRealtime, RealtimeToast } from "./RealtimeContext";
import { useNavigate } from "react-router-dom";
import { tr, useLanguage } from "../../i18n/index.js";

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: RealtimeToast;
  onDismiss: (id: string) => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 7000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const handleClick = () => {
    if (toast.ticket_id) {
      navigate(`/tickets/${toast.ticket_id}`);
      onDismiss(toast.id);
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case "created":
        return <Ticket size={18} className="toast-icon-created" />;
      case "csat":
        return <Star size={18} className="toast-icon-csat" />;
      case "updated":
      default:
        return <MessageSquare size={18} className="toast-icon-updated" />;
    }
  };

  return (
    <div
      className={`realtime-toast realtime-toast-${toast.type}`}
      role="alert"
      onClick={handleClick}
      style={{ cursor: toast.ticket_id ? "pointer" : "default" }}
    >
      <div className="realtime-toast-icon-wrap">{getIcon()}</div>
      <div className="realtime-toast-body">
        <div className="realtime-toast-title">
          <strong>{toast.title}</strong>
          {toast.ticket_id && <ArrowUpRight size={14} className="toast-arrow" />}
        </div>
        {toast.message && <p className="realtime-toast-msg">{toast.message}</p>}
        {toast.ticket_id && (
          <span className="realtime-toast-hint">{tr("realtime_toast_click_to_view")}</span>
        )}
      </div>
      <button
        type="button"
        className="realtime-toast-close"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        aria-label={tr("close")}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function RealtimeToasts() {
  useLanguage();
  const { toasts, dismissToast } = useRealtime();

  if (toasts.length === 0) return null;

  return (
    <div className="realtime-toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
