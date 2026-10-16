import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { fail } from "../common/domain.js";

export interface TriageResult {
  suggested_severity: "s1" | "s2" | "s3";
  suggested_type: "Hata" | "İstek";
  sentiment: "urgent" | "negative" | "neutral" | "positive";
  urgency_score: number;
  tags: string[];
  summary: string;
  suggested_articles: Array<{ id: number; title: string; slug: string; category?: string }>;
}

export interface DraftResult {
  draft: string;
  tone: string;
  type: string;
  model: string;
}

const CRITICAL_KEYWORDS = [
  "çöktü", "çalışmıyor", "satış durdu", "hata veriyor", "acil", "kritik",
  "erişilemiyor", "ödeme alınamıyor", "kasa kilitlendi", "sunucu kapandı",
  "crash", "down", "critical", "urgent", "fatal", "outage", "cannot checkout",
  "bloke", "veri kaybı", "sistem kapandı", "patladı", "dondu"
];

const LOW_KEYWORDS = [
  "bilgi", "nasıl yapılır", "ekleme", "tasarım", "öneri", "soru", "istek",
  "raporlama", "question", "info", "feature request", "suggestion", "minor",
  "renk", "yazı tipi", "ikon", "küçük"
];

const BUG_KEYWORDS = [
  "hata", "bozuk", "hata kodu", "yanıt vermiyor", "açılmıyor", "bug", "error",
  "failed", "exception", "çalışmıyor", "donuyor", "yanlış hesaplıyor", "eksik aktardı"
];

const TOPIC_RULES: Array<{ tag: string; keywords: string[] }> = [
  { tag: "POS / Kasa", keywords: ["pos", "kasa", "ödeme", "yazarkasa", "fiş", "terminal", "checkout"] },
  { tag: "Barkod & Okuyucu", keywords: ["barkod", "okuyucu", "scanner", "etiket", "zebra", "datalogic"] },
  { tag: "Veritabanı", keywords: ["veritabanı", "database", "sql", "kayıt", "tablo", "postgres", "sync"] },
  { tag: "Ağ & Bağlantı", keywords: ["ağ", "network", "internet", "bağlantı", "wifi", "ip", "dns", "timeout", "kopma"] },
  { tag: "Entegrasyon & API", keywords: ["entegrasyon", "api", "webhook", "erp", "sap", "logo", "fatura", "e-fatura"] },
  { tag: "Kullanıcı & Yetki", keywords: ["kullanıcı", "yetki", "giriş", "şifre", "login", "parola", "hesap", "izin"] },
  { tag: "Raporlama", keywords: ["rapor", "çıktı", "excel", "yazdırma", "pdf", "export", "grafik", "istatistik"] },
];

@Injectable()
export class AiService {
  constructor(private readonly database: DatabaseService) {}

  async triage(body: { title: string; description: string; tenant_id?: number }, tx?: any): Promise<TriageResult> {
    const title = (body.title || "").toLowerCase();
    const description = (body.description || "").toLowerCase();
    const combined = `${title} ${description}`;
    const tenantId = body.tenant_id || 1;
    const runner = tx || this.database;

    // 1. Severity detection
    let suggested_severity: "s1" | "s2" | "s3" = "s2";
    let urgency_score = 45;

    let criticalMatches = 0;
    for (const kw of CRITICAL_KEYWORDS) {
      if (combined.includes(kw)) criticalMatches++;
    }

    let lowMatches = 0;
    for (const kw of LOW_KEYWORDS) {
      if (combined.includes(kw)) lowMatches++;
    }

    if (criticalMatches > 0) {
      suggested_severity = "s1";
      urgency_score = Math.min(100, 75 + criticalMatches * 10);
    } else if (lowMatches > 0 && combined.length < 300) {
      suggested_severity = "s3";
      urgency_score = Math.max(10, 25 - lowMatches * 5);
    } else {
      suggested_severity = "s2";
      urgency_score = 50;
    }

    // 2. Type detection
    let isBug = false;
    for (const kw of BUG_KEYWORDS) {
      if (combined.includes(kw)) {
        isBug = true;
        break;
      }
    }
    const suggested_type: "Hata" | "İstek" = isBug ? "Hata" : "İstek";

    // 3. Sentiment detection
    let sentiment: "urgent" | "negative" | "neutral" | "positive" = "neutral";
    if (criticalMatches > 0 || urgency_score >= 80) {
      sentiment = "urgent";
    } else if (isBug || combined.includes("sorun") || combined.includes("problem")) {
      sentiment = "negative";
    } else if (combined.includes("teşekkür") || combined.includes("rica") || combined.includes("harika")) {
      sentiment = "positive";
    }

    // 4. Topic / Tag extraction
    const tags: string[] = [];
    for (const rule of TOPIC_RULES) {
      if (rule.keywords.some((kw) => combined.includes(kw))) {
        tags.push(rule.tag);
      }
    }
    if (tags.length === 0) {
      tags.push("Genel Destek");
    }

    // 5. Short AI Summary
    const cleanTitle = (body.title || "").trim();
    const summary = cleanTitle.length > 5 ? cleanTitle : combined.slice(0, 80) + "...";

    // 6. Search matching KB articles
    let suggested_articles: Array<{ id: number; title: string; slug: string; category?: string }> = [];
    try {
      const searchWords = title
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").trim())
        .filter((w) => w.length > 3)
        .slice(0, 4);

      if (searchWords.length > 0) {
        const clauses = searchWords.map((_, i) => `(LOWER(title) LIKE $${i + 2} OR LOWER(content) LIKE $${i + 2})`).join(" OR ");
        const params: any[] = [tenantId, ...searchWords.map((w) => `%${w.toLowerCase()}%`)];
        const kbRows = (
          await runner.query(
            `SELECT id, title, slug, category FROM knowledge_base WHERE tenant_id=$1 AND is_public=true AND (${clauses}) LIMIT 3`,
            params,
          )
        ).rows;
        suggested_articles = kbRows;
      }
    } catch {
      // KB table or search fallback
    }

    return {
      suggested_severity,
      suggested_type,
      sentiment,
      urgency_score,
      tags,
      summary,
      suggested_articles,
    };
  }

  async generateDraft(ticketId: string, user: any, body: { type?: string; tone?: string; customInstruction?: string }): Promise<DraftResult> {
    const db = this.database;
    const t = (
      await db.query(
        `SELECT t.*, c.name as customer_name, o.name as owner_name, u.name as customer_user_name
         FROM tickets t
         JOIN organizations c ON c.id=t.customer_id
         JOIN organizations o ON o.id=t.owner_org_id
         LEFT JOIN users u ON u.id=t.created_by
         WHERE t.id=$1`,
        [ticketId],
      )
    ).rows[0];

    if (!t) fail(404, "ticket_not_found");

    const draftType = body.type || "solution";
    const tone = body.tone || "professional";
    const customerName = t.customer_user_name || t.customer_name || "Müşterimiz";
    const program = t.program || "sistem";
    const title = t.title || "Talebiniz";

    // Generate intelligent contextual response
    let draft = "";

    if (draftType === "first_response") {
      draft = `Merhaba ${customerName},\n\n"${title}" başlıklı destek isteminiz ekibimize ulaşmış olup incelemeye alınmıştır.\n\nİlgili ${program} modülü üzerindeki kontroller teknik ekibimiz tarafından başlatılmıştır. İncelemeler tamamlandığında detaylı bilgi paylaşılacaktır.\n\nİyi çalışmalar dileriz.`;
    } else if (draftType === "clarification") {
      draft = `Merhaba ${customerName},\n\n"${title}" başlıklı talebinizi daha hızlı ve eksiksiz çözümleyebilmemiz için aşağıdaki detayları bizimle paylaşabilir misiniz?\n\n1. Hatanın gerçekleştiği tam ekran görüntüsü veya hata kodu,\n2. Sorunun meydana gelmeden önce yapılan işlem adımları,\n3. İlgili terminal / kullanıcı bilgisi.\n\nBilgileri iletmenizin ardından kontrollerimiz devam edecektir. Teşekkür ederiz.`;
    } else {
      // Solution draft
      draft = `Merhaba ${customerName},\n\n"${title}" başlıklı destek talebiniz teknik ekibimiz tarafından incelenmiş ve çözüme kavuşturulmuştur.\n\nYapılan işlemler:\n- ${program} sistemi üzerindeki ilgili parametreler ve servis bağlantıları kontrol edildi.\n- Bildirilen durum için gerekli güncelleme ve düzeltme uygulandı.\n- Sistemin sağlıklı çalıştığı test edildi ve onaylandı.\n\nKontrollerinizi sağlayarak herhangi bir aksaklık durumunda bu bilet üzerinden bize yanıt verebilirsiniz.\n\nSağlıklı ve verimli çalışmalar dileriz.`;
    }

    if (body.customInstruction) {
      draft += `\n\nNot: ${body.customInstruction.trim()}`;
    }

    return {
      draft,
      tone,
      type: draftType,
      model: "built-in-copilot",
    };
  }
}
