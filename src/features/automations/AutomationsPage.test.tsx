import { it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import AutomationsPage from "./AutomationsPage";
import { setLanguage, tr } from "../../i18n/index.js";
import * as autoApi from "./automations.api";

afterEach(cleanup);

it("renders AutomationsPage header, KPI stats, and lists existing rules", async () => {
  setLanguage("tr");

  vi.spyOn(autoApi, "listAutomationRules").mockResolvedValueOnce([
    {
      id: 1,
      tenant_id: 1,
      name: "Acil Kilitlenme Kuralı",
      description: "Kasada kilitlenme olan biletleri S1 yap",
      trigger_event: "ticket.created",
      conditions: [{ field: "title", operator: "contains", value: "kilitlendi" }],
      actions: [{ type: "set_severity", value: "s1" }],
      is_active: true,
      execution_count: 5,
      last_executed_at: "2026-10-16T12:00:00Z",
      created_at: "2026-10-16T10:00:00Z",
      updated_at: "2026-10-16T10:00:00Z",
    },
  ]);

  render(<AutomationsPage />);

  // Title
  expect(screen.getByRole("heading", { name: tr("automations_title") })).toBeTruthy();

  // Wait for rules to load
  await waitFor(() => {
    expect(screen.getByText("Acil Kilitlenme Kuralı")).toBeTruthy();
    expect(screen.getByText("Kasada kilitlenme olan biletleri S1 yap")).toBeTruthy();
  });

  // KPI stat counts
  expect(screen.getByText(tr("automations_total_rules"))).toBeTruthy();
  expect(screen.getByText(tr("automations_active_rules"))).toBeTruthy();
  expect(screen.getByText(tr("automations_total_triggers"))).toBeTruthy();
});

it("opens create modal when new rule button is clicked and saves a rule", async () => {
  setLanguage("tr");

  vi.spyOn(autoApi, "listAutomationRules").mockResolvedValue([]);
  const createSpy = vi.spyOn(autoApi, "createAutomationRule").mockResolvedValueOnce({
    id: 2,
    tenant_id: 1,
    name: "Yeni Otomasyon Kuralı",
    description: "Açıklama",
    trigger_event: "ticket.created",
    conditions: [],
    actions: [{ type: "set_severity", value: "s1" }],
    is_active: true,
    execution_count: 0,
    last_executed_at: null,
    created_at: "2026-10-16T12:00:00Z",
    updated_at: "2026-10-16T12:00:00Z",
  });

  render(<AutomationsPage />);

  // Click new rule button
  const newBtn = screen.getByRole("button", { name: new RegExp(tr("automations_new_rule")) });
  fireEvent.click(newBtn);

  // Modal appears
  const modalHeading = screen.getByRole("heading", { name: tr("automations_new_rule") });
  expect(modalHeading).toBeTruthy();

  // Type name
  const nameInput = screen.getByPlaceholderText(/Acil POS/i);
  fireEvent.change(nameInput, { target: { value: "Yeni Otomasyon Kuralı" } });

  // Submit form
  const saveBtn = screen.getByRole("button", { name: tr("automations_save_rule") });
  fireEvent.click(saveBtn);

  await waitFor(() => {
    expect(createSpy).toHaveBeenCalled();
  });
});

it("runs rule simulation in the simulator modal", async () => {
  setLanguage("tr");

  vi.spyOn(autoApi, "listAutomationRules").mockResolvedValueOnce([
    {
      id: 1,
      tenant_id: 1,
      name: "Test Kuralı",
      description: "Açıklama",
      trigger_event: "ticket.created",
      conditions: [{ field: "title", operator: "contains", value: "acil" }],
      actions: [{ type: "set_severity", value: "s1" }],
      is_active: true,
      execution_count: 0,
      last_executed_at: null,
      created_at: "2026-10-16T12:00:00Z",
      updated_at: "2026-10-16T12:00:00Z",
    },
  ]);

  const testSpy = vi.spyOn(autoApi, "testAutomationRule").mockResolvedValueOnce({
    matched: true,
    conditionResults: [
      {
        field: "title",
        operator: "contains",
        expectedValue: "acil",
        matched: true,
      },
    ],
    plannedActions: [{ type: "set_severity", value: "s1" }],
  });

  render(<AutomationsPage />);

  await waitFor(() => {
    expect(screen.getByText("Test Kuralı")).toBeTruthy();
  });

  // Open simulator
  const simBtn = screen.getByRole("button", { name: new RegExp(tr("automations_simulator")) });
  fireEvent.click(simBtn);

  // Click run simulation
  const runBtn = screen.getByRole("button", { name: /Simülasyonu Çalıştır/i });
  fireEvent.click(runBtn);

  await waitFor(() => {
    expect(testSpy).toHaveBeenCalled();
    expect(screen.getByText(tr("automations_conditions_matched"))).toBeTruthy();
  });
});
