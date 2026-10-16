import React, { useState, useEffect } from "react";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Shield,
  MessageSquare,
  MessageCircle,
  Lock,
  Globe,
  Radio,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { tr } from "../../i18n/index.js";

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<"smtp" | "webhooks" | "widget">("smtp");
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // SMTP Form State
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testingSmtp, setTestingSmtp] = useState(false);

  // Webhooks Form State
  const [teamsUrl, setTeamsUrl] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [events, setEvents] = useState("ticket.created,ticket.closed,ticket.urgent");
  const [testingTeams, setTestingTeams] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);

  // Widget Form State
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [widgetTitle, setWidgetTitle] = useState("Canlı Destek");
  const [widgetColor, setWidgetColor] = useState("#3b4cb8");
  const [widgetGreeting, setWidgetGreeting] = useState("Merhaba! Size nasıl yardımcı olabiliriz?");
  const [widgetPosition, setWidgetPosition] = useState("right");
  const [tenantSlug, setTenantSlug] = useState("primary");
  const [copied, setCopied] = useState(false);

  const fetchConfigs = async () => {
    try {
      const [smtpRes, hookRes, widgetRes] = await Promise.all([
        fetch("/api/admin/integrations/smtp"),
        fetch("/api/admin/integrations/webhooks"),
        fetch("/api/admin/integrations/widget"),
      ]);

      if (smtpRes.ok) {
        const s = await smtpRes.json();
        setSmtpHost(s.host || "");
        setSmtpPort(s.port || 587);
        setSmtpSecure(!!s.secure);
        setSmtpUser(s.user || "");
        setSmtpFromName(s.from_name || "");
        setSmtpFromEmail(s.from_email || "");
        setHasPassword(!!s.has_password);
      }

      if (hookRes.ok) {
        const h = await hookRes.json();
        setTeamsUrl(h.webhook_teams_url || "");
        setSlackUrl(h.webhook_slack_url || "");
        setEvents(h.webhook_events || "ticket.created,ticket.closed,ticket.urgent");
      }

      if (widgetRes.ok) {
        const w = await widgetRes.json();
        setWidgetEnabled(w.widget_enabled !== false);
        setWidgetTitle(w.widget_title || "Canlı Destek");
        setWidgetColor(w.widget_color || "#3b4cb8");
        setWidgetGreeting(w.widget_greeting || "Merhaba! Size nasıl yardımcı olabiliriz?");
        setWidgetPosition(w.widget_position || "right");
        setTenantSlug(w.slug || "primary");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/integrations/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort),
          secure: smtpSecure,
          user: smtpUser,
          password: smtpPass ? smtpPass : undefined,
          from_name: smtpFromName,
          from_email: smtpFromEmail,
        }),
      });

      if (res.ok) {
        setStatusMsg({ type: "success", text: "Özel SMTP ayarları başarıyla kaydedildi." });
        setSmtpPass("");
        fetchConfigs();
      } else {
        const err = await res.json();
        setStatusMsg({ type: "error", text: err.error || "SMTP kaydedilemedi." });
      }
    } catch (e: any) {
      setStatusMsg({ type: "error", text: e.message });
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/integrations/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmailTo || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: "success", text: "✅ Test e-postası başarıyla iletildi! Bağlantı doğrulandı." });
      } else {
        setStatusMsg({ type: "error", text: `❌ SMTP Hatası: ${data.error || "Bağlantı kurulamadı."}` });
      }
    } catch (e: any) {
      setStatusMsg({ type: "error", text: e.message });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSaveWebhooks = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/integrations/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_teams_url: teamsUrl,
          webhook_slack_url: slackUrl,
          webhook_events: events,
        }),
      });

      if (res.ok) {
        setStatusMsg({ type: "success", text: "Webhook entegrasyon ayarları başarıyla kaydedildi." });
      } else {
        const err = await res.json();
        setStatusMsg({ type: "error", text: err.error || "Kaydedilemedi." });
      }
    } catch (e: any) {
      setStatusMsg({ type: "error", text: e.message });
    }
  };

  const handleTestWebhook = async (type: "teams" | "slack") => {
    if (type === "teams") setTestingTeams(true);
    else setTestingSlack(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/admin/integrations/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg({
          type: "success",
          text: `✅ ${type === "teams" ? "Microsoft Teams" : "Slack"} test kartı kanala başarıyla iletildi!`,
        });
      } else {
        setStatusMsg({ type: "error", text: `❌ Webhook Hatası: ${data.error || "İletilemedi."}` });
      }
    } catch (e: any) {
      setStatusMsg({ type: "error", text: e.message });
    } finally {
      setTestingTeams(false);
      setTestingSlack(false);
    }
  };

  const handleSaveWidget = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/integrations/widget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widget_enabled: widgetEnabled,
          widget_title: widgetTitle,
          widget_color: widgetColor,
          widget_greeting: widgetGreeting,
          widget_position: widgetPosition,
        }),
      });

      if (res.ok) {
        setStatusMsg({ type: "success", text: "Web Destek Widget ayarları başarıyla kaydedildi." });
      } else {
        const err = await res.json();
        setStatusMsg({ type: "error", text: err.error || "Kaydedilemedi." });
      }
    } catch (e: any) {
      setStatusMsg({ type: "error", text: e.message });
    }
  };

  const embedScriptCode = `<script\n  src="${window.location.origin}/widget.js"\n  data-tenant="${tenantSlug}"\n  data-color="${widgetColor}"\n  data-title="${widgetTitle}"\n  data-position="${widgetPosition}"\n  defer\n></script>`;

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 940 }}>
      {/* Heading */}
      <div>
        <div className="eyebrow">KURUMSAL ENTEGRASYONLAR</div>
        <h1 style={{ margin: "4px 0" }}>E-Posta, Webhook & Web Widget</h1>
        <p className="muted" style={{ margin: 0 }}>
          Şirketinize ait özel SMTP e-posta sunucusunu, Teams bildirimlerini ve web sitenize eklenecek canlı destek balonunu yönetin.
        </p>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: statusMsg.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
            border: `1px solid ${statusMsg.type === "success" ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            color: statusMsg.type === "success" ? "#10b981" : "#ef4444",
            fontWeight: 500,
          }}
        >
          {statusMsg.type === "success" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--card-border)", paddingBottom: 6 }}>
        <button
          type="button"
          onClick={() => setActiveTab("smtp")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "smtp" ? "var(--brand-sky, #3b4cb8)" : "transparent",
            color: activeTab === "smtp" ? "#fff" : "var(--text-secondary)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Mail size={18} /> Özel SMTP Sunucusu
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("webhooks")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "webhooks" ? "var(--brand-sky, #3b4cb8)" : "transparent",
            color: activeTab === "webhooks" ? "#fff" : "var(--text-secondary)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Radio size={18} /> Microsoft Teams & Slack
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("widget")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "widget" ? "var(--brand-sky, #3b4cb8)" : "transparent",
            color: activeTab === "widget" ? "#fff" : "var(--text-secondary)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <MessageCircle size={18} /> Web Destek Balonu (Widget)
        </button>
      </div>

      {/* Tab 1: SMTP Settings */}
      {activeTab === "smtp" && (
        <div className="panel" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(59, 76, 184, 0.12)", color: "#3b4cb8", display: "grid", placeItems: "center" }}>
              <Mail size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Giden E-posta (Outbound Custom SMTP)</h2>
              <small className="muted">Bildirim ve bilet güncellemelerini şirketinizin kendi kurumsal posta sunucusu üzerinden gönderin.</small>
            </div>
          </div>

          <form onSubmit={handleSaveSmtp} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
              <label>
                SMTP Sunucu Adresi (Host) *
                <input
                  type="text"
                  placeholder="smtp.office365.com veya mail.sirketim.com"
                  required
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                />
              </label>

              <label>
                Port *
                <input
                  type="number"
                  placeholder="587 veya 465"
                  required
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                />
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                id="smtpSecure"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <label htmlFor="smtpSecure" style={{ margin: 0, cursor: "pointer", fontWeight: 500 }}>
                SSL / TLS kullan (Port 465 için işaretleyin; Port 587 STARTTLS için boş bırakın)
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label>
                Kullanıcı Adı (Username / E-posta)
                <input
                  type="text"
                  placeholder="destek@sirketim.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                />
              </label>

              <label>
                Parola {hasPassword && <span style={{ color: "#10b981", fontSize: 11 }}>(Kayıtlı: ••••••••)</span>}
                <input
                  type="password"
                  placeholder={hasPassword ? "Mevcut parolayı korumak için boş bırakın" : "SMTP şifresi"}
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <label>
                Gönderici Adı (From Name)
                <input
                  type="text"
                  placeholder="Bekatos Destek Ekibi"
                  value={smtpFromName}
                  onChange={(e) => setSmtpFromName(e.target.value)}
                />
              </label>

              <label>
                Gönderici E-posta (From Email)
                <input
                  type="email"
                  placeholder="destek@sirketim.com"
                  value={smtpFromEmail}
                  onChange={(e) => setSmtpFromEmail(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 16, borderTop: "1px solid var(--card-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="email"
                  placeholder="Test için e-posta..."
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  style={{ width: 220 }}
                />
                <button
                  type="button"
                  className="secondary"
                  disabled={testingSmtp || !smtpHost}
                  onClick={handleTestSmtp}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Send size={15} /> {testingSmtp ? "Test ediliyor..." : "Bağlantıyı Test Et"}
                </button>
              </div>

              <button type="submit" className="primary" style={{ padding: "10px 24px" }}>
                Ayarları Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Teams & Slack Webhooks */}
      {activeTab === "webhooks" && (
        <div className="panel" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(16, 185, 129, 0.12)", color: "#10b981", display: "grid", placeItems: "center" }}>
              <Radio size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Takım İletişim Kanalları (Teams & Slack)</h2>
              <small className="muted">Yeni biletler veya acil durumlar oluştuğunda Microsoft Teams kanalınıza etkileşimli Adaptive Card fırlatın.</small>
            </div>
          </div>

          <form onSubmit={handleSaveWebhooks} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Teams Webhook */}
            <div style={{ background: "var(--workspace-bg)", padding: 18, borderRadius: 12, border: "1px solid var(--card-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <strong style={{ fontSize: 14 }}>Microsoft Teams Incoming Webhook</strong>
                <button
                  type="button"
                  className="secondary"
                  disabled={testingTeams || !teamsUrl}
                  onClick={() => handleTestWebhook("teams")}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                >
                  {testingTeams ? "Gönderiliyor..." : "Teams Test Kartı Gönder"}
                </button>
              </div>
              <input
                type="url"
                placeholder="https://outlook.office.com/webhook/..."
                value={teamsUrl}
                onChange={(e) => setTeamsUrl(e.target.value)}
                style={{ width: "100%" }}
              />
              <small className="muted" style={{ display: "block", marginTop: 6 }}>
                Teams kanalınızda "Bağlayıcılar (Connectors)" ➔ "Incoming Webhook" ekleyerek URL alabilirsiniz.
              </small>
            </div>

            {/* Slack Webhook */}
            <div style={{ background: "var(--workspace-bg)", padding: 18, borderRadius: 12, border: "1px solid var(--card-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <strong style={{ fontSize: 14 }}>Slack Incoming Webhook (Opsiyonel)</strong>
                <button
                  type="button"
                  className="secondary"
                  disabled={testingSlack || !slackUrl}
                  onClick={() => handleTestWebhook("slack")}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                >
                  {testingSlack ? "Gönderiliyor..." : "Slack Test Mesajı Gönder"}
                </button>
              </div>
              <input
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            {/* Events Trigger */}
            <label>
              Bildirim Gönderilecek Olaylar
              <select value={events} onChange={(e) => setEvents(e.target.value)}>
                <option value="ticket.created,ticket.closed,ticket.urgent">Tüm Olaylar (Yeni Bilet, Kapanış, Acil Durum)</option>
                <option value="ticket.urgent">Yalnızca Acil ve SLA Riski Olan Biletler</option>
                <option value="ticket.created,ticket.urgent">Yeni Biletler ve Acil Biletler</option>
              </select>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button type="submit" className="primary" style={{ padding: "10px 24px" }}>
                Entegrasyonları Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Embeddable Support Widget */}
      {activeTab === "widget" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Customization Form */}
          <div className="panel" style={{ padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(59, 76, 184, 0.12)", color: "#3b4cb8", display: "grid", placeItems: "center" }}>
                <MessageCircle size={22} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Web Sitesi Destek Balonu Özelleştirme</h2>
                <small className="muted">Web sitenize gömeceğiniz destek balonunun renk, başlık ve mesaj ayarlarını yapılandırın.</small>
              </div>
            </div>

            <form onSubmit={handleSaveWidget} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  id="widgetEnabled"
                  checked={widgetEnabled}
                  onChange={(e) => setWidgetEnabled(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <label htmlFor="widgetEnabled" style={{ margin: 0, cursor: "pointer", fontWeight: 600 }}>
                  Widget'ı Web Sitelerinde Aktif Et
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <label>
                  Widget Başlığı
                  <input
                    type="text"
                    required
                    value={widgetTitle}
                    onChange={(e) => setWidgetTitle(e.target.value)}
                  />
                </label>

                <label>
                  Tema / Buton Rengi
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                    <input
                      type="color"
                      value={widgetColor}
                      onChange={(e) => setWidgetColor(e.target.value)}
                      style={{ width: 44, height: 38, padding: 2, cursor: "pointer", borderRadius: 8 }}
                    />
                    <input
                      type="text"
                      value={widgetColor}
                      onChange={(e) => setWidgetColor(e.target.value)}
                      style={{ flex: 1, margin: 0 }}
                    />
                  </div>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
                <label>
                  Karşılama Mesajı
                  <input
                    type="text"
                    value={widgetGreeting}
                    onChange={(e) => setWidgetGreeting(e.target.value)}
                  />
                </label>

                <label>
                  Ekran Konumu
                  <select value={widgetPosition} onChange={(e) => setWidgetPosition(e.target.value)}>
                    <option value="right">Sağ Alt Köşe</option>
                    <option value="left">Sol Alt Köşe</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button type="submit" className="primary" style={{ padding: "10px 24px" }}>
                  Widget Ayarlarını Kaydet
                </button>
              </div>
            </form>
          </div>

          {/* Embed Code Snippet Card */}
          <div className="panel" style={{ padding: 28, background: "var(--workspace-bg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <strong style={{ fontSize: 16 }}>Web Sitenize Eklenecek Kod</strong>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                  Aşağıdaki tek satırlık kodu web sitenizin &lt;/body&gt; etiketinin hemen öncesine yapıştırın.
                </p>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href="/widget-demo.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="secondary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <ExternalLink size={15} /> Demoyu Canlı Aç
                </a>

                <button
                  type="button"
                  className="primary"
                  onClick={copyEmbedCode}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    fontSize: 13,
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Kopyalandı!" : "Kodu Kopyala"}
                </button>
              </div>
            </div>

            <pre
              style={{
                background: "#0f172a",
                color: "#38bdf8",
                padding: "16px 20px",
                borderRadius: 12,
                fontSize: 13,
                lineHeight: 1.5,
                overflowX: "auto",
                margin: "12px 0 0",
              }}
            >
              {embedScriptCode}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
