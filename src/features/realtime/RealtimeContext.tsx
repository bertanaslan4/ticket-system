import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { tr } from "../../i18n/index.js";

export type RealtimeStatus = "connected" | "connecting" | "upgrade_required" | "disconnected";

export interface RealtimeToast {
  id: string;
  type: "created" | "updated" | "csat";
  title: string;
  message?: string;
  ticket_id?: number;
  timestamp: number;
}

export interface RealtimeContextValue {
  status: RealtimeStatus;
  isPremium: boolean;
  toasts: RealtimeToast[];
  dismissToast: (id: string) => void;
  showUpgradeModal: boolean;
  setShowUpgradeModal: (open: boolean) => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  status: "disconnected",
  isPremium: false,
  toasts: [],
  dismissToast: () => {},
  showUpgradeModal: false,
  setShowUpgradeModal: () => {},
});

export const useRealtime = () => useContext(RealtimeContext);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<RealtimeToast[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const planTier = user?.plan_tier || "free";
  const isPremium = planTier === "pro" || planTier === "enterprise";

  const [status, setStatus] = useState<RealtimeStatus>(
    isPremium ? "connecting" : "upgrade_required"
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<RealtimeToast, "id" | "timestamp">) => {
    const newToast: RealtimeToast = {
      ...toast,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    setToasts((prev) => [newToast, ...prev.slice(0, 4)]); // Keep max 5 toasts
  }, []);

  useEffect(() => {
    if (!user) {
      setStatus("disconnected");
      return;
    }

    if (!isPremium) {
      setStatus("upgrade_required");
      return;
    }

    // Pro / Enterprise tier: connect SSE
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      setStatus("connected");
      return;
    }

    setStatus("connecting");
    let eventSource: EventSource | null = null;
    let retryTimer: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource("/api/realtime/stream", { withCredentials: true });

      eventSource.onopen = () => {
        setStatus("connected");
      };

      eventSource.onerror = (err) => {
        if (eventSource?.readyState === EventSource.CLOSED) {
          setStatus("disconnected");
        } else {
          setStatus("connecting");
        }
      };

      eventSource.addEventListener("connected", () => {
        setStatus("connected");
      });

      eventSource.addEventListener("ticket:created", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
          queryClient.invalidateQueries({ queryKey: ["reports"] });
          addToast({
            type: "created",
            title: tr("realtime_new_ticket"),
            message: data.title || "",
            ticket_id: data.ticket_id,
          });
        } catch {}
      });

      eventSource.addEventListener("ticket:updated", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
          if (data.ticket_id) {
            queryClient.invalidateQueries({ queryKey: ["ticket", data.ticket_id] });
          }
          addToast({
            type: "updated",
            title: tr("realtime_ticket_updated"),
            message: data.title || tr("realtime_new_comment"),
            ticket_id: data.ticket_id,
          });
        } catch {}
      });

      eventSource.addEventListener("ticket:csat", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
          if (data.ticket_id) {
            queryClient.invalidateQueries({ queryKey: ["ticket", data.ticket_id] });
          }
          addToast({
            type: "csat",
            title: `★ ${data.rating} / 5 CSAT`,
            message: tr("event_csat_rated", { rating: data.rating }),
            ticket_id: data.ticket_id,
          });
        } catch {}
      });
    } catch {
      setStatus("disconnected");
    }

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [user?.id, user?.plan_tier, isPremium, queryClient, addToast]);

  return (
    <RealtimeContext.Provider
      value={{
        status,
        isPremium,
        toasts,
        dismissToast,
        showUpgradeModal,
        setShowUpgradeModal,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}
