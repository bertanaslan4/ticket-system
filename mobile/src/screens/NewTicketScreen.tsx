import React, { useState } from "react";
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

export default function NewTicketScreen({
  onCreated,
  onCancel,
}: {
  onCreated: (ticketId: number) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"Hata" | "İstek">("Hata");
  const [severity, setSeverity] = useState<"s1" | "s2" | "s3">("s2");
  const [files, setFiles] = useState<MediaAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Kamera izni verilmedi.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setFiles((prev) =>
        [
          ...prev,
          {
            uri: asset.uri,
            name:
              asset.fileName ||
              `kamera-${Date.now()}.${asset.type === "video" ? "mp4" : "jpg"}`,
            type:
              asset.mimeType ||
              (asset.type === "video" ? "video/mp4" : "image/jpeg"),
          },
        ].slice(0, 5),
      );
    }
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Galeri erişim izni verilmedi.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const picked = result.assets.map((asset, idx) => ({
        uri: asset.uri,
        name:
          asset.fileName ||
          `medya-${Date.now()}-${idx}.${asset.type === "video" ? "mp4" : "jpg"}`,
        type:
          asset.mimeType ||
          (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      }));
      setFiles((prev) => [...prev, ...picked].slice(0, 5));
    }
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const created = await mobileApi.createTicket(
        { title, description, type, severity },
        files,
      );
      onCreated(created.id);
    } catch (err: any) {
      setError(err.message || "Destek istemi oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.backText}>← Listeye Dön</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Yeni Destek İstemi</Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>Konu Başlığı</Text>
      <TextInput
        style={styles.input}
        placeholder="Örn: POS Entegrasyon Hatası"
        placeholderTextColor="#64748b"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>İstem Türü</Text>
      <View style={styles.row}>
        {(["Hata", "İstek"] as const).map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.choice, type === k && styles.choiceSelected]}
            onPress={() => setType(k)}
          >
            <Text style={styles.choiceText}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Öncelik Seviyesi</Text>
      <View style={styles.row}>
        {(
          [
            ["s1", "S1 · Acil"],
            ["s2", "S2 · Normal"],
            ["s3", "S3 · Düşük"],
          ] as const
        ).map(([k, label]) => (
          <TouchableOpacity
            key={k}
            style={[styles.choice, severity === k && styles.choiceSelected]}
            onPress={() => setSeverity(k)}
          >
            <Text style={styles.choiceText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Ayrıntılı Açıklama</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        multiline
        numberOfLines={5}
        placeholder="Sorunu veya talebinizi ayrıntılı olarak açıklayın..."
        placeholderTextColor="#64748b"
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>Fotoğraf / Video Ekle ({files.length}/5)</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.mediaBtn} onPress={captureFromCamera}>
          <Text style={styles.mediaBtnText}>📷 Kameradan Çek</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mediaBtn} onPress={pickFromGallery}>
          <Text style={styles.mediaBtnText}>🖼️ Galeriden Seç</Text>
        </TouchableOpacity>
      </View>

      {files.map((f, idx) => (
        <View key={idx} style={styles.fileChip}>
          <Text style={styles.fileChipText} numberOfLines={1}>
            {f.name}
          </Text>
          <TouchableOpacity
            onPress={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
          >
            <Text style={styles.removeFileText}>Kaldır</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
        disabled={submitting}
        onPress={submit}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitBtnText}>Destek İstemini Gönder</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 18,
    paddingTop: 52,
  },
  topRow: {
    marginBottom: 16,
  },
  backText: {
    color: "#60a5fa",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  heading: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "700",
  },
  label: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f8fafc",
    fontSize: 15,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  choice: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    alignItems: "center",
  },
  choiceSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#3b82f6",
  },
  choiceText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "600",
  },
  mediaBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 10,
    alignItems: "center",
  },
  mediaBtnText: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "600",
  },
  fileChip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  fileChipText: {
    color: "#e2e8f0",
    fontSize: 13,
    flex: 1,
  },
  removeFileText: {
    color: "#fca5a5",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 10,
  },
  submitBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 32,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#ef4444",
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
  },
});
