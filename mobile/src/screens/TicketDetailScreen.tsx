import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { mobileApi, MediaAttachment } from "../api/client";

export default function TicketDetailScreen({
  ticketId,
  user,
  onBack,
}: {
  ticketId: number;
  user: any;
  onBack: () => void;
}) {
  const [ticket, setTicket] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionTab, setActionTab] = useState<
    "comment" | "assign" | "resolve" | "close"
  >("comment");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal">(
    "internal",
  );
  const [targetOrgId, setTargetOrgId] = useState<number | null>(null);
  const [targetUserId, setTargetUserId] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [files, setFiles] = useState<MediaAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTicket = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mobileApi.getTicket(ticketId);
      setTicket(data);
      setTargetOrgId(data.owner_org_id);
    } catch (err: any) {
      setError(err.message || "İstem yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  const addCameraMedia = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
    });
    if (!res.canceled && res.assets.length > 0) {
      const a = res.assets[0];
      setFiles((prev) =>
        [
          ...prev,
          {
            uri: a.uri,
            name: a.fileName || `ek-${Date.now()}.jpg`,
            type: a.mimeType || "image/jpeg",
          },
        ].slice(0, 5),
      );
    }
  };

  const submitAction = async () => {
    if (!ticket) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, any> = { action: actionTab };
      if (actionTab === "comment") {
        payload.body = body;
        payload.visibility = user.role === "customer" ? "public" : visibility;
      } else if (actionTab === "assign") {
        payload.org_id = targetOrgId;
        payload.assignee_id = targetUserId;
      } else if (actionTab === "resolve") {
        payload.body = body;
      } else if (actionTab === "close") {
        payload.body = body;
        payload.confirmed = confirmed;
      }
      await mobileApi.ticketAction(ticket.id, payload, files);
      setBody("");
      setFiles([]);
      await loadTicket();
    } catch (err: any) {
      setError(err.message || "İşlem gerçekleştirilemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !ticket) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#60a5fa" size="large" />
      </View>
    );
  }

  const owned =
    !["customer", "super_admin"].includes(user.role) &&
    user.org_id === ticket.owner_org_id &&
    ticket.status !== "closed";

  const orgUsers = (ticket.targets || []).filter(
    (u: any) => u.org_id === targetOrgId,
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backText}>← Listeye Dön</Text>
      </TouchableOpacity>

      <View style={styles.headerCard}>
        <Text style={styles.code}>
          TK-{String(ticket.id).padStart(4, "0")} · {ticket.type} ·{" "}
          {ticket.program}
        </Text>
        <Text style={styles.title}>{ticket.title}</Text>
        <Text style={styles.meta}>
          {ticket.customer_name} · Sorumlu: {ticket.owner_name} (
          {ticket.assignee_name || "Ekip Havuzu"})
        </Text>
        {ticket.sla_status && (
          <Text style={styles.slaInfo}>
            SLA Durumu: {ticket.sla_status.toUpperCase()}
            {ticket.sla_resolution_due_at
              ? ` · Çözüm Hedefi: ${new Date(ticket.sla_resolution_due_at).toLocaleString("tr-TR")}`
              : ""}
          </Text>
        )}
        <Text style={styles.description}>{ticket.description}</Text>
      </View>

      {ticket.resolution && (
        <View style={styles.resolutionCard}>
          <Text style={styles.sectionTitle}>Çözüm Özeti</Text>
          <Text style={styles.resolutionBody}>{ticket.resolution.body}</Text>
          <Text style={styles.meta}>
            {ticket.resolution.actor_name} · {ticket.resolution.org_name}
          </Text>
        </View>
      )}

      {ticket.status !== "closed" && (
        <View style={styles.actionCard}>
          <Text style={styles.sectionTitle}>İşlem Yap</Text>
          <View style={styles.tabs}>
            {(
              [
                ["comment", "Yorum"],
                ...(owned
                  ? [
                      ["assign", "Atama"],
                      ["resolve", "Çözüm İade"],
                      ["close", "Kapat"],
                    ]
                  : []),
              ] as [typeof actionTab, string][]
            ).map(([k, label]) => (
              <TouchableOpacity
                key={k}
                style={[styles.tab, actionTab === k && styles.tabActive]}
                onPress={() => setActionTab(k)}
              >
                <Text style={styles.tabText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {actionTab === "comment" && user.role !== "customer" && (
            <View style={styles.row}>
              {(
                [
                  ["internal", "Şirket İçi Not"],
                  ["public", "Müşteriye Açık"],
                ] as const
              ).map(([k, label]) => (
                <TouchableOpacity
                  key={k}
                  style={[
                    styles.choice,
                    visibility === k && styles.choiceSelected,
                  ]}
                  onPress={() => setVisibility(k)}
                >
                  <Text style={styles.choiceText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {actionTab === "assign" && (
            <>
              <Text style={styles.label}>Hedef Destek Şirketi</Text>
              <View style={styles.row}>
                {(ticket.orgs || []).map((o: any) => (
                  <TouchableOpacity
                    key={o.id}
                    style={[
                      styles.choice,
                      targetOrgId === o.id && styles.choiceSelected,
                    ]}
                    onPress={() => {
                      setTargetOrgId(o.id);
                      setTargetUserId(null);
                    }}
                  >
                    <Text style={styles.choiceText}>{o.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Personel Seçimi</Text>
              <View style={styles.rowWrap}>
                <TouchableOpacity
                  style={[
                    styles.choice,
                    targetUserId === null && styles.choiceSelected,
                  ]}
                  onPress={() => setTargetUserId(null)}
                >
                  <Text style={styles.choiceText}>Ekip Havuzu</Text>
                </TouchableOpacity>
                {orgUsers.map((u: any) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[
                      styles.choice,
                      targetUserId === u.id && styles.choiceSelected,
                    ]}
                    onPress={() => setTargetUserId(u.id)}
                  >
                    <Text style={styles.choiceText}>{u.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {["comment", "resolve", "close"].includes(actionTab) && (
            <>
              <TextInput
                style={styles.textArea}
                multiline
                placeholder={
                  actionTab === "comment"
                    ? "Mesajınızı yazın..."
                    : "Çözüm açıklamasını yazın (en az 10 karakter)..."
                }
                placeholderTextColor="#64748b"
                value={body}
                onChangeText={setBody}
              />
              {actionTab === "close" && ticket.status === "review" && (
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setConfirmed((v) => !v)}
                >
                  <Text style={styles.checkboxText}>
                    {confirmed ? "☑️" : "⬜"} Çözümü test ettiğimi ve
                    onayladığımı beyan ederim.
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.cameraBtn}
                onPress={addCameraMedia}
              >
                <Text style={styles.cameraBtnText}>
                  📷 Kameradan Fotoğraf/Video Ekle ({files.length}/5)
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.submitBtn}
            disabled={submitting}
            onPress={submitAction}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? "Gönderiliyor..." : "Uygula"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.timelineCard}>
        <Text style={styles.sectionTitle}>Zaman Çizelgesi</Text>
        {(ticket.events || []).map((ev: any) => (
          <View key={ev.id} style={styles.eventItem}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventActor}>
                {ev.actor_name} · {ev.org_name}
              </Text>
              <Text style={styles.eventDate}>
                {new Date(ev.created_at).toLocaleString("tr-TR")}
              </Text>
            </View>
            <Text style={styles.eventBody}>{ev.body}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 16,
    paddingTop: 52,
    paddingBottom: 36,
  },
  loadingWrap: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
  },
  backText: {
    color: "#60a5fa",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  headerCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 14,
  },
  code: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  title: {
    color: "#f8fafc",
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 6,
  },
  meta: {
    color: "#94a3b8",
    fontSize: 12,
    marginBottom: 6,
  },
  slaInfo: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10,
  },
  description: {
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 20,
  },
  resolutionCard: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#10b981",
    marginBottom: 14,
  },
  resolutionBody: {
    color: "#ecfdf5",
    fontSize: 14,
    marginBottom: 6,
  },
  actionCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  tabActive: {
    backgroundColor: "#2563eb",
    borderColor: "#3b82f6",
  },
  tabText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
  },
  label: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  choiceSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#3b82f6",
  },
  choiceText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
  },
  textArea: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 12,
    color: "#f8fafc",
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  checkboxRow: {
    marginBottom: 10,
  },
  checkboxText: {
    color: "#cbd5e1",
    fontSize: 13,
  },
  cameraBtn: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  cameraBtnText: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "600",
  },
  submitBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  timelineCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  eventItem: {
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingVertical: 10,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  eventActor: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "600",
  },
  eventDate: {
    color: "#64748b",
    fontSize: 11,
  },
  eventBody: {
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#ef4444",
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 12,
  },
});
