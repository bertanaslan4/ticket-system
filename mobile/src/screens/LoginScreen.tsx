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
  const [mode, setMode] = useState<"login" | "signup" | "join">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
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
      if (mode === "signup") {
        const user = await mobileApi.signup({
          company_name: companyName.trim(),
          admin_name: name.trim(),
          email: email.trim(),
          password,
          industry_template: "it_software",
        });
        onAuthenticated(user);
      } else if (mode === "join") {
        const user = await mobileApi.join({
          invite_code: inviteCode.trim().toUpperCase(),
          name: name.trim(),
          email: email.trim(),
          password,
          company_name: companyName.trim() || undefined,
        });
        onAuthenticated(user);
      } else {
        const user = await mobileApi.login(email.trim(), password);
        onAuthenticated(user);
      }
    } catch (err: any) {
      setError(err.message || "İşlem tamamlanamadı.");
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
        <Text style={styles.title}>
          {mode === "signup"
            ? "Ücretsiz İşletme Aç"
            : mode === "join"
              ? "Davet Koduyla Katıl"
              : "Çalışma Alanına Giriş"}
        </Text>
        <Text style={styles.subtitle}>
          Müşteri, bayi ve ana destek ekibi süreçlerinizi sahadan yönetin.
        </Text>

        <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
          {(
            [
              ["login", "Giriş Yap"],
              ["signup", "İşletme Aç"],
              ["join", "Davet Kodu"],
            ] as const
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: mode === key ? "#2563eb" : "#0f172a",
                alignItems: "center",
              }}
              onPress={() => {
                setError(null);
                setMode(key);
              }}
            >
              <Text
                style={{
                  color: mode === key ? "#ffffff" : "#94a3b8",
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {mode === "join" && (
          <>
            <Text style={styles.label}>Çalışma Alanı Davet Kodu</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="characters"
              placeholder="Örn: BKT-4829"
              placeholderTextColor="#64748b"
              value={inviteCode}
              onChangeText={setInviteCode}
            />
          </>
        )}

        {(mode === "signup" || mode === "join") && (
          <>
            <Text style={styles.label}>
              {mode === "signup"
                ? "İşletme / Destek Ekibi Adı"
                : "Firmanızın Adı (İsteğe Bağlı)"}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: Nova Yazılım Destek"
              placeholderTextColor="#64748b"
              value={companyName}
              onChangeText={setCompanyName}
            />
            <Text style={styles.label}>Ad Soyad</Text>
            <TextInput
              style={styles.input}
              placeholder="Adınız Soyadınız"
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
            />
          </>
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

        {mode === "login" && (
          <TouchableOpacity
            style={{ marginTop: 10, alignSelf: "flex-start" }}
            onPress={async () => {
              if (!email.trim()) {
                setError("Lütfen e-posta adresinizi girin.");
                return;
              }
              setLoading(true);
              try {
                await setApiBaseUrl(serverUrl);
                await mobileApi.forgotPassword(email.trim());
                setError(null);
                alert("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
              } catch (err: any) {
                setError(err.message || "İşlem başarısız.");
              } finally {
                setLoading(false);
              }
            }}
          >
            <Text style={styles.configToggleText}>Şifremi unuttum</Text>
          </TouchableOpacity>
        )}

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
            <Text style={styles.buttonText}>
              {mode === "signup"
                ? "Ücretsiz Çalışma Alanını Başlat"
                : mode === "join"
                  ? "Çalışma Alanına Katıl"
                  : "Oturum Aç"}
            </Text>
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
