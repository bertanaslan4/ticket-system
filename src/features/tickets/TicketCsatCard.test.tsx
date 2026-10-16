import { it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import TicketCsatCard from "./TicketCsatCard";
import { setLanguage, tr } from "../../i18n/index.js";
import * as api from "./tickets.api";

afterEach(cleanup);

it("does not render CSAT card for unclosed tickets", () => {
  setLanguage("tr");
  const ticket = { id: 1, status: "open", csat: null } as any;
  const user = { id: 10, role: "customer", name: "Ahmet" } as any;
  const { container } = render(<TicketCsatCard ticket={ticket} user={user} />);
  expect(container.textContent).toBe("");
});

it("shows CSAT rating form for customer on closed ticket and handles submission", async () => {
  setLanguage("tr");
  const ticket = { id: 101, status: "closed", csat: null } as any;
  const user = { id: 10, role: "customer", name: "Ahmet" } as any;
  const onRated = vi.fn();

  vi.spyOn(api, "submitTicketCsat").mockResolvedValueOnce({
    id: 1,
    rating: 5,
    comment: "Çok memnun kaldım.",
    created_at: "2026-10-16T12:00:00Z",
  } as any);

  render(<TicketCsatCard ticket={ticket} user={user} onRated={onRated} />);

  // Heading and interactive star buttons
  expect(screen.getByRole("heading", { name: tr("csat_how_satisfied") })).toBeTruthy();
  const starButtons = screen.getAllByRole("radio");
  expect(starButtons).toHaveLength(5);

  // Submit button is disabled before selecting a star
  const submitBtn = screen.getByRole("button", { name: tr("csat_submit") });
  expect(submitBtn.hasAttribute("disabled")).toBe(true);

  // Click 5th star
  fireEvent.click(starButtons[4]);
  expect(submitBtn.hasAttribute("disabled")).toBe(false);

  // Type comment
  const textarea = screen.getByPlaceholderText(tr("csat_feedback_placeholder"));
  fireEvent.change(textarea, { target: { value: "Çok memnun kaldım." } });

  // Submit
  fireEvent.click(submitBtn);

  await waitFor(() => {
    expect(api.submitTicketCsat).toHaveBeenCalledWith("101", {
      rating: 5,
      comment: "Çok memnun kaldım.",
    });
    expect(onRated).toHaveBeenCalled();
  });

  // Now displays the rated state
  expect(screen.getByTestId("csat-rated-card")).toBeTruthy();
  expect(screen.getByText("★ 5 / 5")).toBeTruthy();
  expect(screen.getByText("Çok memnun kaldım.")).toBeTruthy();
});

it("displays submitted CSAT rating for staff on a closed ticket", () => {
  setLanguage("tr");
  const ticket = {
    id: 102,
    status: "closed",
    csat: {
      rating: 4,
      comment: "Zamanında çözüldü, teşekkürler.",
      created_at: "2026-10-16T10:00:00Z",
      customer_name: "Yargıcı Destek Ekibi",
    },
  } as any;
  const user = { id: 2, role: "dealer", name: "Can" } as any;

  render(<TicketCsatCard ticket={ticket} user={user} />);

  expect(screen.getByTestId("csat-rated-card")).toBeTruthy();
  expect(screen.getByText("★ 4 / 5")).toBeTruthy();
  expect(screen.getByText("Zamanında çözüldü, teşekkürler.")).toBeTruthy();
  expect(screen.getByText(/Yargıcı Destek Ekibi/)).toBeTruthy();
});

it("displays waiting note for staff when customer has not yet rated", () => {
  setLanguage("tr");
  const ticket = { id: 103, status: "closed", csat: null } as any;
  const user = { id: 2, role: "dealer", name: "Can" } as any;

  render(<TicketCsatCard ticket={ticket} user={user} />);

  expect(screen.getByText(tr("csat_not_rated_yet"))).toBeTruthy();
});
