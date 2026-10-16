import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { mobileApi } from "../api/client";

export default function PaywallScreen({
  onBack,
  onPurchased,
}: {
  onBack: () => void;
  onPurchased: () => void;
}) {
  const [catalog, setCatalog] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingProduct, setBuyingProduct] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await mobileApi.getBillingCatalog();
      setCatalog(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handlePurchase = async (productId: string) => {
    setBuyingProduct(productId);
    try {
      const store = Platform.OS === "android" ? "play_store" : "app_store";
      await mobileApi.purchaseIap(productId, store);
      await load();
      onPurchased();
      Alert.alert(
        "Satın Alma Başarılı",
        "Paketiniz ve çalışma alanı kotalarınız anında güncellendi.",
      );
    } catch (err: any) {
      Alert.alert("Hata", err.message || "Satın alma tamamlanamadı.");
    } finally {
      setBuyingProduct(null);
    }
  };

  if (loading || !catalog) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const tenant = catalog.tenant || {};

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paketler & Satın Alma</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>MÜŞTERİ DAVET KODUNUZ</Text>
          <Text style={styles.inviteCode}>{tenant.invite_code || "BKT-0001"}</Text>
          <Text style={styles.inviteHint}>
            Müşterileriniz mobil uygulamayı indirip bu kodu girerek sözleşmesiz
            şekilde doğrudan çalışma alanınıza katılabilir.
          </Text>
        </View>

        <View style={styles.usageCard}>
          <Text style={styles.sectionTitle}>Anlık Kota Kullanımı</Text>
          <Text style={styles.usageRow}>
            Destek Personeli: {tenant.agent_used} / {tenant.agent_limit}
          </Text>
          <Text style={styles.usageRow}>
            Müşteri Firma: {tenant.customer_org_used} / {tenant.customer_org_limit}
          </Text>
          <Text style={styles.usageRow}>
            Aylık Talep: {tenant.monthly_ticket_used} / {tenant.monthly_ticket_limit}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Aylık Abonelik Paketleri (IAP)</Text>
        {catalog.plans
          ?.filter((p: any) => p.tier !== "free")
          .map((plan: any) => {
            const isCurrent = tenant.plan_tier === plan.tier;
            return (
              <View key={plan.product_id} style={styles.planCard}>
                <View style={styles.planRow}>
                  <Text style={styles.planName}>
                    {plan.tier === "pro" ? "Profesyonel Paket" : "Başlangıç Paketi"}
                  </Text>
                  <Text style={styles.planPrice}>{plan.price_try} TL / ay</Text>
                </View>
                <Text style={styles.planMeta}>
                  {plan.agent_limit} Destek Personeli ·{" "}
                  {(plan.storage_limit_mb / 1024).toFixed(0)} GB Depolama · Sınırsız
                  Talep
                </Text>
                <TouchableOpacity
                  style={[
                    styles.buyBtn,
                    isCurrent && styles.buyBtnDisabled,
                  ]}
                  disabled={isCurrent || buyingProduct !== null}
                  onPress={() => handlePurchase(plan.product_id)}
                >
                  <Text style={styles.buyBtnText}>
                    {isCurrent
                      ? "Mevcut Paketiniz"
                      : buyingProduct === plan.product_id
                        ? "İşleniyor..."
                        : "Uygulama İçi Satın Al"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

        <Text style={styles.sectionTitle}>Ek Kapasite Paketleri (Add-ons)</Text>
        {catalog.addons?.map((addon: any) => (
          <View key={addon.product_id} style={styles.planCard}>
            <View style={styles.planRow}>
              <Text style={styles.planName}>
                {addon.product_id === "bekatos_addon_5_agents"
                  ? "+5 Destek Personeli"
                  : "+25 GB Bulut Depolama"}
              </Text>
              <Text style={styles.planPrice}>+{addon.price_try} TL / ay</Text>
            </View>
            <TouchableOpacity
              style={styles.addonBtn}
              disabled={buyingProduct !== null}
              onPress={() => handlePurchase(addon.product_id)}
            >
              <Text style={styles.buyBtnText}>
                {buyingProduct === addon.product_id
                  ? "İşleniyor..."
                  : "Ek Paketi Ekle"}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  loadingBox: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
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
  backText: {
    color: "#60a5fa",
    fontSize: 15,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  inviteCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#3b82f6",
    alignItems: "center",
  },
  inviteLabel: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  inviteCode: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "800",
    marginVertical: 6,
    letterSpacing: 2,
  },
  inviteHint: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
  },
  usageCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
  },
  usageRow: {
    color: "#cbd5e1",
    fontSize: 13,
    marginTop: 4,
  },
  planCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  planRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planName: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  planPrice: {
    color: "#60a5fa",
    fontSize: 16,
    fontWeight: "800",
  },
  planMeta: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  buyBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  buyBtnDisabled: {
    backgroundColor: "#334155",
  },
  addonBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buyBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
