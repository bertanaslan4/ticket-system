import { api } from "../../lib/api";

export interface TriageResponse {
  suggested_severity: "s1" | "s2" | "s3";
  suggested_type: "Hata" | "İstek";
  sentiment: "urgent" | "negative" | "neutral" | "positive";
  urgency_score: number;
  tags: string[];
  summary: string;
  suggested_articles: Array<{ id: number; title: string; slug: string; category?: string }>;
}

export interface DraftResponse {
  draft: string;
  tone: string;
  type: string;
  model: string;
}

export interface AiConfig {
  ai_copilot_enabled: boolean;
  ai_auto_triage: boolean;
  ai_tone: string;
}

export const triageTicket = (title: string, description: string) =>
  api<TriageResponse>("/ai/triage", { title, description });

export const generateAiDraft = (
  ticketId: string | number,
  params?: { type?: string; tone?: string; customInstruction?: string },
) =>
  api<DraftResponse>("/ai/draft", {
    ticket_id: String(ticketId),
    type: params?.type || "solution",
    tone: params?.tone || "professional",
    customInstruction: params?.customInstruction || "",
  });

export const getAiConfig = () =>
  api<AiConfig>("/ai/config");

export const updateAiConfig = (config: Partial<AiConfig>) =>
  api<{ ok: boolean } & AiConfig>("/ai/config", config);
