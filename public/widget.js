/**
 * Bekatos Destek Sistemi - Gömülebilir Web Widget (Embeddable Support Widget)
 * Herhangi bir web sitesine tek satır script ile eklenebilir.
 */
(function () {
  "use strict";

  if (window.__BEKATOS_WIDGET_LOADED__) return;
  window.__BEKATOS_WIDGET_LOADED__ = true;

  const currentScript =
    document.currentScript ||
    document.querySelector("script[src*='widget.js']");

  const baseUrl = currentScript
    ? new URL(currentScript.src).origin
    : window.location.origin;

  const tenantSlug = currentScript?.getAttribute("data-tenant") || "1";
  const customColor = currentScript?.getAttribute("data-color") || "#3b4cb8";
  const customPosition = currentScript?.getAttribute("data-position") || "right";
  const customTitle = currentScript?.getAttribute("data-title") || "Canlı Destek";

  // State
  let isOpen = false;
  let activeTab = "new"; // 'new' | 'kb' | 'track'
  let config = {
    title: customTitle,
    color: customColor,
    greeting: "Merhaba! Size nasıl yardımcı olabiliriz?",
    position: customPosition,
  };

  // Create isolated container
  const container = document.createElement("div");
  container.id = "bekatos-widget-root";
  document.body.appendChild(container);

  // Inject Styles
  const style = document.createElement("style");
  style.textContent = `
    #bekatos-widget-root {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1e293b;
      position: fixed;
      ${config.position === "left" ? "left: 24px;" : "right: 24px;"}
      bottom: 24px;
      z-index: 999999;
    }
    #bekatos-widget-root * {
      box-sizing: border-box;
    }
    .bkt-launcher {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: ${config.color};
      color: #ffffff;
      border: none;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.18), 0 4px 10px rgba(0, 0, 0, 0.12);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }
    .bkt-launcher:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.25);
    }
    .bkt-badge-pulse {
      position: absolute;
      top: 0;
      right: 0;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #10b981;
      border: 2px solid #ffffff;
    }
    .bkt-window {
      position: absolute;
      bottom: 74px;
      ${config.position === "left" ? "left: 0;" : "right: 0;"}
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 560px;
      max-height: calc(100vh - 120px);
      background: #ffffff;
      border-radius: 18px;
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08);
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      transform-origin: bottom ${config.position === "left" ? "left" : "right"};
    }
    .bkt-window.bkt-hidden {
      opacity: 0;
      pointer-events: none;
      transform: scale(0.92) translateY(14px);
    }
    .bkt-header {
      background: linear-gradient(135deg, ${config.color} 0%, #0a0b4e 100%);
      color: #ffffff;
      padding: 18px 20px;
      position: relative;
    }
    .bkt-header h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
    }
    .bkt-header p {
      margin: 4px 0 0;
      font-size: 13px;
      opacity: 0.9;
    }
    .bkt-close-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255, 255, 255, 0.18);
      border: none;
      color: #ffffff;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      transition: background 0.2s;
    }
    .bkt-close-btn:hover {
      background: rgba(255, 255, 255, 0.32);
    }
    .bkt-tabs {
      display: flex;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 4px 6px;
      gap: 4px;
    }
    .bkt-tab {
      flex: 1;
      padding: 8px 6px;
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 12px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
    }
    .bkt-tab.active {
      background: #ffffff;
      color: ${config.color};
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    }
    .bkt-body {
      flex: 1;
      overflow-y: auto;
      padding: 18px;
      background: #ffffff;
    }
    .bkt-form label {
      display: block;
      margin-bottom: 12px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
    .bkt-form input,
    .bkt-form textarea,
    .bkt-form select {
      width: 100%;
      margin-top: 4px;
      padding: 9px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 13px;
      color: #1e293b;
      font-family: inherit;
      outline: none;
      transition: border 0.2s, box-shadow 0.2s;
    }
    .bkt-form input:focus,
    .bkt-form textarea:focus,
    .bkt-form select:focus {
      border-color: ${config.color};
      box-shadow: 0 0 0 3px rgba(59, 76, 184, 0.15);
    }
    .bkt-submit-btn {
      width: 100%;
      padding: 11px;
      background: ${config.color};
      color: #ffffff;
      border: none;
      border-radius: 9px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      margin-top: 6px;
      transition: opacity 0.2s;
    }
    .bkt-submit-btn:hover {
      opacity: 0.92;
    }
    .bkt-submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .bkt-success-card {
      text-align: center;
      padding: 24px 10px;
    }
    .bkt-success-icon {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      margin-bottom: 14px;
    }
    .bkt-ticket-badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      background: #eff6ff;
      color: #2563eb;
      font-weight: 700;
      font-size: 15px;
      margin: 10px 0;
      letter-spacing: 0.5px;
    }
    .bkt-article-item {
      padding: 12px;
      border-radius: 9px;
      border: 1px solid #e2e8f0;
      margin-bottom: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .bkt-article-item:hover {
      border-color: ${config.color};
      background: #f8fafc;
    }
    .bkt-article-title {
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .bkt-article-snippet {
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
    }
    .bkt-track-result {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
      margin-top: 14px;
    }
    .bkt-status-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .bkt-status-open { background: #fef3c7; color: #b45309; }
    .bkt-status-in_progress { background: #e0f2fe; color: #0369a1; }
    .bkt-status-review { background: #ede9fe; color: #6d28d9; }
    .bkt-status-closed { background: #dcfce7; color: #15803d; }
  `;
  document.head.appendChild(style);

  // Fetch tenant widget config
  fetch(`${baseUrl}/api/widget/config?tenant=${encodeURIComponent(tenantSlug)}`)
    .then((r) => r.ok && r.json())
    .then((data) => {
      if (data) {
        config = { ...config, ...data };
        render();
      }
    })
    .catch(() => {});

  function render() {
    container.innerHTML = `
      <div id="bkt-window" class="bkt-window bkt-hidden">
        <div class="bkt-header">
          <h3 id="bkt-title">${config.title}</h3>
          <p id="bkt-greeting">${config.greeting}</p>
          <button type="button" class="bkt-close-btn" id="bkt-close">✕</button>
        </div>
        <div class="bkt-tabs">
          <button type="button" class="bkt-tab ${activeTab === "new" ? "active" : ""}" data-tab="new">✍ Bilet Aç</button>
          <button type="button" class="bkt-tab ${activeTab === "kb" ? "active" : ""}" data-tab="kb">🔍 Yardım & SSS</button>
          <button type="button" class="bkt-tab ${activeTab === "track" ? "active" : ""}" data-tab="track">📍 Durum Sorgula</button>
        </div>
        <div class="bkt-body" id="bkt-body-content">
          ${renderTabContent()}
        </div>
      </div>

      <button type="button" class="bkt-launcher" id="bkt-launcher" title="${config.title}">
        <span class="bkt-badge-pulse"></span>
        <svg id="bkt-icon-chat" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
    `;

    bindEvents();
  }

  function renderTabContent() {
    if (activeTab === "new") {
      return `
        <form id="bkt-form-ticket" class="bkt-form">
          <label>
            Adınız Soyadınız *
            <input type="text" name="name" required placeholder="Örn: Ahmet Yılmaz" />
          </label>
          <label>
            E-posta Adresiniz *
            <input type="email" name="email" required placeholder="ad@sirket.com" />
          </label>
          <label>
            Konu / Başlık *
            <input type="text" name="title" required placeholder="Hangi konuda yardıma ihtiyacınız var?" />
          </label>
          <label>
            Mesajınız / Detaylar *
            <textarea name="description" rows="3" required placeholder="Sorunu veya talebinizi detaylıca açıklayın..."></textarea>
          </label>
          <label>
            Aciliyet Durumu
            <select name="priority">
              <option value="s2">Normal (Standart Destek)</option>
              <option value="s1">Acil (İş Durdurucu Sorun)</option>
              <option value="s3">Düşük (Bilgi / İyileştirme)</option>
            </select>
          </label>
          <button type="submit" class="bkt-submit-btn" id="bkt-submit-ticket">Talebi Gönder</button>
        </form>
      `;
    }

    if (activeTab === "kb") {
      return `
        <div>
          <input
            type="text"
            id="bkt-kb-search"
            placeholder="Bilgi bankasında arayın (örn: entegrasyon, fatura)..."
            style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 14px;"
          />
          <div id="bkt-kb-results">
            <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 30px;">
              Aramak istediğiniz konuyu yukarıya yazın.
            </p>
          </div>
        </div>
      `;
    }

    if (activeTab === "track") {
      return `
        <form id="bkt-form-track" class="bkt-form">
          <label>
            Bilet Numarası *
            <input type="text" name="number" required placeholder="Örn: TK-0012 veya 12" />
          </label>
          <label>
            Kayıtlı E-posta Adresiniz *
            <input type="email" name="email" required placeholder="ad@sirket.com" />
          </label>
          <button type="submit" class="bkt-submit-btn">Durumu Sorgula</button>
          <div id="bkt-track-container"></div>
        </form>
      `;
    }

    return "";
  }

  function bindEvents() {
    const launcher = document.getElementById("bkt-launcher");
    const closeBtn = document.getElementById("bkt-close");
    const win = document.getElementById("bkt-window");

    launcher?.addEventListener("click", () => {
      isOpen = !isOpen;
      if (isOpen) {
        win?.classList.remove("bkt-hidden");
      } else {
        win?.classList.add("bkt-hidden");
      }
    });

    closeBtn?.addEventListener("click", () => {
      isOpen = false;
      win?.classList.add("bkt-hidden");
    });

    // Tab buttons
    container.querySelectorAll(".bkt-tab").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = (e.currentTarget as HTMLElement).getAttribute("data-tab");
        if (tab) {
          activeTab = tab;
          render();
        }
      });
    });

    // New Ticket Submit
    const ticketForm = document.getElementById("bkt-form-ticket") as HTMLFormElement;
    if (ticketForm) {
      ticketForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById("bkt-submit-ticket") as HTMLButtonElement;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Gönderiliyor...";
        }

        const formData = new FormData(ticketForm);
        const payload = {
          tenant: tenantSlug,
          name: formData.get("name"),
          email: formData.get("email"),
          title: formData.get("title"),
          description: formData.get("description"),
          priority: formData.get("priority"),
        };

        try {
          const res = await fetch(`${baseUrl}/api/widget/tickets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (res.ok) {
            const bodyContent = document.getElementById("bkt-body-content");
            if (bodyContent) {
              bodyContent.innerHTML = `
                <div class="bkt-success-card">
                  <div class="bkt-success-icon">✓</div>
                  <h4 style="margin: 0; font-size: 18px; color: #1e293b;">Talebiniz Alındı!</h4>
                  <p style="color: #64748b; font-size: 13px; margin: 8px 0;">Destek ekibimiz en kısa sürede sizinle iletişime geçecektir.</p>
                  <div class="bkt-ticket-badge">${data.ticket_number}</div>
                  <p style="font-size: 12px; color: #94a3b8;">Lütfen bu bilet numarasını saklayın. Durum sorgulamak için kullanabilirsiniz.</p>
                  <button type="button" class="bkt-submit-btn" id="bkt-new-ticket-again" style="margin-top: 14px;">Yeni Talep Aç</button>
                </div>
              `;
              document.getElementById("bkt-new-ticket-again")?.addEventListener("click", () => {
                render();
              });
            }
          } else {
            alert(`Hata: ${data.error || "Bilet oluşturulamadı."}`);
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Talebi Gönder";
            }
          }
        } catch (err) {
          alert("Sunucuya bağlanılamadı. Lütfen tekrar deneyin.");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Talebi Gönder";
          }
        }
      });
    }

    // KB Search
    const kbInput = document.getElementById("bkt-kb-search") as HTMLInputElement;
    if (kbInput) {
      let debounceTimer: any;
      kbInput.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        const query = (e.target as HTMLInputElement).value.trim();
        debounceTimer = setTimeout(async () => {
          if (!query) {
            const results = document.getElementById("bkt-kb-results");
            if (results) results.innerHTML = "<p style='color: #64748b; font-size: 13px; text-align: center; margin-top: 30px;'>Aramak istediğiniz konuyu yukarıya yazın.</p>";
            return;
          }
          try {
            const res = await fetch(`${baseUrl}/api/widget/kb?tenant=${encodeURIComponent(tenantSlug)}&q=${encodeURIComponent(query)}`);
            if (res.ok) {
              const items = await res.json();
              const results = document.getElementById("bkt-kb-results");
              if (!results) return;
              if (items.length === 0) {
                results.innerHTML = "<p style='color: #64748b; font-size: 13px; text-align: center; margin-top: 20px;'>Eşleşen yardım makalesi bulunamadı.</p>";
                return;
              }
              results.innerHTML = items
                .map(
                  (item: any) => `
                <div class="bkt-article-item">
                  <div class="bkt-article-title">${item.title}</div>
                  <div class="bkt-article-snippet">${item.snippet}...</div>
                </div>
              `,
                )
                .join("");
            }
          } catch {}
        }, 300);
      });
    }

    // Track Ticket Form
    const trackForm = document.getElementById("bkt-form-track") as HTMLFormElement;
    if (trackForm) {
      trackForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(trackForm);
        const num = formData.get("number");
        const mail = formData.get("email");
        const container = document.getElementById("bkt-track-container");
        if (!container) return;

        container.innerHTML = "<p style='color: #64748b; font-size: 12px; margin-top: 10px;'>Sorgulanıyor...</p>";

        try {
          const res = await fetch(
            `${baseUrl}/api/widget/track?tenant=${encodeURIComponent(tenantSlug)}&number=${encodeURIComponent(String(num))}&email=${encodeURIComponent(String(mail))}`,
          );
          const data = await res.json();
          if (res.ok) {
            const stClass = `bkt-status-${data.status}`;
            const stLabel = {
              open: "Açık / İnceleniyor",
              in_progress: "İşlemde",
              review: "Test Aşamasında",
              closed: "Çözümlendi",
            }[data.status] || data.status;

            container.innerHTML = `
              <div class="bkt-track-result">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <strong style="color: ${config.color};">${data.ticket_number}</strong>
                  <span class="bkt-status-pill ${stClass}">${stLabel}</span>
                </div>
                <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${data.title}</div>
                <div style="font-size: 11px; color: #64748b;">Sorumlu: ${data.assigned_team} · ${new Date(data.created_at).toLocaleDateString("tr-TR")}</div>
              </div>
            `;
          } else {
            container.innerHTML = `<p style="color: #ef4444; font-size: 12px; margin-top: 10px;">❌ ${data.error || "Bilet bulunamadı veya e-posta eşleşmiyor."}</p>`;
          }
        } catch {
          container.innerHTML = "<p style='color: #ef4444; font-size: 12px; margin-top: 10px;'>❌ Bağlantı hatası.</p>";
        }
      });
    }
  }

  // Initial render
  render();
})();
