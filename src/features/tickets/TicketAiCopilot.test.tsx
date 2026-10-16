import { it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import TicketAiCopilot from "./TicketAiCopilot";
import { setLanguage, tr } from "../../i18n/index.js";
import * as aiApi from "../ai/ai.api";

afterEach(cleanup);

it("does not render TicketAiCopilot for customer users", () => {
  setLanguage("tr");
  const ticket = { id: 1, title: "Test", severity: "s3" } as any;
  const user = { id: 10, role: "customer", name: "Müşteri" } as any;
  const { container } = render(<TicketAiCopilot ticket={ticket} user={user} />);
  expect(container.textContent).toBe("");
});

it("renders TicketAiCopilot for staff and displays triage metadata", () => {
  setLanguage("tr");
  const ticket = {
    id: 1,
    title: "POS Cihazı Arızası",
    severity: "s3",
    ai_suggested_severity: "s1",
    ai_sentiment: "urgent",
    ai_summary: "Kasa POS kilitlendi, acil müdahale gerekiyor.",
    ai_tags: "pos,kasa,donanım",
  } as any;
  const user = { id: 2, role: "dealer", name: "Bayi Destek" } as any;
  const onUpdateSeverity = vi.fn();

  render(
    <TicketAiCopilot
      ticket={ticket}
      user={user}
      onUpdateSeverity={onUpdateSeverity}
    />,
  );

  // Copilot header
  expect(screen.getByText(/AI Copilot/i)).toBeTruthy();

  // Summary
  expect(screen.getByText("Kasa POS kilitlendi, acil müdahale gerekiyor.")).toBeTruthy();

  // Tags
  expect(screen.getByText("pos")).toBeTruthy();
  expect(screen.getByText("kasa")).toBeTruthy();

  // Suggested severity apply button
  const applyBtn = screen.getByRole("button", { name: new RegExp(tr("ai_apply_priority")) });
  expect(applyBtn).toBeTruthy();
  fireEvent.click(applyBtn);
  expect(onUpdateSeverity).toHaveBeenCalledWith("s1");
});

it("generates AI draft and lets staff apply it to response textarea", async () => {
  setLanguage("tr");
  const ticket = {
    id: 42,
    title: "Barkod okuyucu kopuyor",
    severity: "s2",
  } as any;
  const user = { id: 5, role: "contractor", name: "Bertan" } as any;
  const onApplyDraft = vi.fn();

  vi.spyOn(aiApi, "generateAiDraft").mockResolvedValueOnce({
    draft: "Merhaba, barkod okuyucunun USB sürücüsünü güncellemeyi denediniz mi?",
    tone: "professional",
    type: "solution",
    model: "gemini-pro-triage",
  });

  render(
    <TicketAiCopilot
      ticket={ticket}
      user={user}
      onApplyDraft={onApplyDraft}
    />,
  );

  // Click generate button
  const genBtn = screen.getByRole("button", { name: tr("ai_generate_draft") });
  fireEvent.click(genBtn);

  // Wait for draft to appear
  await waitFor(() => {
    expect(aiApi.generateAiDraft).toHaveBeenCalledWith(42, {
      type: "solution",
    });
    expect(
      screen.getByText("Merhaba, barkod okuyucunun USB sürücüsünü güncellemeyi denediniz mi?"),
    ).toBeTruthy();
  });

  // Apply draft button
  const applyDraftBtn = screen.getByRole("button", { name: tr("ai_use_draft") });
  fireEvent.click(applyDraftBtn);
  expect(onApplyDraft).toHaveBeenCalledWith(
    "Merhaba, barkod okuyucunun USB sürücüsünü güncellemeyi denediniz mi?",
  );
});
