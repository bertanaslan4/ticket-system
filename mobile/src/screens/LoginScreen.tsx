import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { mobileApi, getApiBaseUrl, setApiBaseUrl } from "../api/client";

export default function LoginScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: any) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("http://localhost:3000/api");
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getApiBaseUrl().then(setServerUrl);
  }, []);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await setApiBaseUrl(serverUrl);
      const user = await mobileApi.login(email.trim(), password);
      onAuthenticated(user);
    } catch (err: any) {
      setError(err.message || "Giriş yapılamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>BEKATOS · DESTEK MERKEZİ</Text>
        </View>
        <Text style={styles.title}>Çalışma Alanına Giriş</Text>
        <Text style={styles.subtitle}>
          Müşteri, bayi ve ana destek ekibi süreçlerinizi sahadan yönetin.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.label}>E-posta Adresi</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="ornek@firma.com"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Şifre</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          onPress={() => setShowServerConfig((v) => !v)}
          style={styles.configToggle}
        >
          <Text style={styles.configToggleText}>
            {showServerConfig
              ? "Sunucu Ayarlarını Gizle"
              : "Sunucu / Çalışma Alanı Bağlantısı"}
          </Text>
        </TouchableOpacity>

        {showServerConfig && (
          <>
            <Text style={styles.label}>API Sunucu Adresi</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              value={serverUrl}
              onChangeText={setServerUrl}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          disabled={loading}
          onPress={submit}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Oturum Aç</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#334155",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#213159",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 12,
  },
  badgeText: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  label: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f8fafc",
    fontSize: 15,
  },
  configToggle: {
    marginTop: 12,
    marginBottom: 4,
  },
  configToggleText: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
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
    marginBottom: 10,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
  },
});
