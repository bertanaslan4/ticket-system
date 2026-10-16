import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { mobileApi } from "../api/client";

type QueueTab = "assigned_to_me" | "team_pool" | "all";

const STATUS_LABELS: Record<string, string> = {
  open: "Yeni",
  in_progress: "İşlemde",
  review: "Bayi İncelemesinde",
  closed: "Kapandı",
};

const SLA_LABELS: Record<string, { label: string; color: string }> = {
  on_track: { label: "SLA Süresinde", color: "#10b981" },
  at_risk: { label: "Risk Altında", color: "#f59e0b" },
  breached: { label: "SLA Aşıldı", color: "#ef4444" },
  met: { label: "Hedefe Uygun", color: "#3b82f6" },
};

export default function TicketListScreen({
  user,
  onSelectTicket,
  onNewTicket,
  onOpenPaywall,
  onLogout,
}: {
  user: any;
  onSelectTicket: (ticketId: number) => void;
  onNewTicket: () => void;
  onOpenPaywall?: () => void;
  onLogout: () => void;
}) {
  const isCustomer = user.role === "customer";
  const [tab, setTab] = useState<QueueTab>(
    isCustomer ? "all" : "assigned_to_me",
  );
  const [tickets, setTickets] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [ticketList, notifList] = await Promise.all([
        mobileApi.getTickets(),
        mobileApi.getNotifications().catch(() => []),
      ]);
      setTickets(ticketList);
      setNotifications(notifList);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = tickets.filter((t) => {
    if (isCustomer || tab === "all") return true;
    if (tab === "assigned_to_me") {
      return t.assignee_id === user.id && t.status !== "closed";
    }
    if (tab === "team_pool") {
      return (
        t.owner_org_id === user.org_id &&
        t.assignee_id == null &&
        t.status !== "closed"
      );
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.workspaceTag}>
            {user.tenant_name || "Bekatos"} · {user.org_name}
          </Text>
          <Text style={styles.headerTitle}>Destek İstemleri</Text>
        </View>
        <View style={styles.headerActions}>
          {!isCustomer && onOpenPaywall && (
            <TouchableOpacity style={styles.notifBtn} onPress={onOpenPaywall}>
              <Text style={styles.notifBtnText}>Paket / Kod</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => setShowNotifications((v) => !v)}
          >
            <Text style={styles.notifBtnText}>
              Bildirimler ({notifications.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>Çıkış</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showNotifications && (
        <View style={styles.notifDrawer}>
          <Text style={styles.notifDrawerTitle}>Son Anlık Bildirimler</Text>
          {notifications.length === 0 ? (
            <Text style={styles.emptyText}>Henüz bildirim yok.</Text>
          ) : (
            notifications.slice(0, 6).map((n) => (
              <TouchableOpacity
                key={n.id}
                style={styles.notifItem}
                onPress={() => {
                  setShowNotifications(false);
                  onSelectTicket(n.ticket_id);
                }}
              >
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifBody} numberOfLines={1}>
                  {n.body}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {!isCustomer ? (
        <View style={styles.tabs}>
          {(
            [
              ["assigned_to_me", "Bana Atananlar"],
              ["team_pool", "Ekip Havuzu"],
              ["all", "Tümü"],
            ] as [QueueTab, string][]
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => setTab(key)}
            >
              <Text
                style={[styles.tabText, tab === key && styles.tabTextActive]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.customerBar}>
          <Text style={styles.quotaText}>
            Günlük Kota: {user.used} / {user.daily_limit}
          </Text>
          <TouchableOpacity style={styles.newTicketBtn} onPress={onNewTicket}>
            <Text style={styles.newTicketBtnText}>+ Destek İstemi Aç</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadData}
            tintColor="#60a5fa"
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Bu görünümde destek istemi bulunmuyor.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const sla = SLA_LABELS[item.sla_status] || SLA_LABELS.on_track;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onSelectTicket(item.id)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.ticketCode}>
                  TK-{String(item.id).padStart(4, "0")} ·{" "}
                  {item.severity?.toUpperCase()}
                </Text>
                <View style={[styles.slaBadge, { borderColor: sla.color }]}>
                  <Text style={[styles.slaBadgeText, { color: sla.color }]}>
                    {sla.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {item.customer_name} · {item.program}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.statusText}>
                  {STATUS_LABELS[item.status] || item.status}
                </Text>
                <Text style={styles.ownerText}>
                  {item.owner_name} ({item.assignee_name || "Ekip Havuzu"})
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: "#1e293b",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  workspaceTag: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  notifBtn: {
    backgroundColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  notifBtnText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600",
  },
  logoutBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: "#fca5a5",
    fontSize: 12,
    fontWeight: "600",
  },
  notifDrawer: {
    backgroundColor: "#1e293b",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  notifDrawerTitle: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  notifItem: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  notifTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "600",
  },
  notifBody: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2,
  },
  tabs: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  tabActive: {
    backgroundColor: "#2563eb",
    borderColor: "#3b82f6",
  },
  tabText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  customerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quotaText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },
  newTicketBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  newTicketBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    padding: 14,
    gap: 12,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  ticketCode: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "700",
  },
  slaBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  slaBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardMeta: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingTop: 8,
  },
  statusText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
  },
  ownerText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  emptyBox: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
  },
});
