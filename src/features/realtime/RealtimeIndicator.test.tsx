import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RealtimeProvider } from "./RealtimeContext";
import RealtimeIndicator from "./RealtimeIndicator";
import RealtimeToasts from "./RealtimeToasts";
import { tr } from "../../i18n/index.js";

afterEach(() => {
  cleanup();
});

// Mock AuthProvider to control user plan_tier
let mockUser: any = null;

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RealtimeProvider>{ui}</RealtimeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("Realtime live notification & tier gating", () => {
  it("renders live connected indicator for premium (enterprise/pro) plan users", () => {
    mockUser = {
      id: 1,
      name: "Admin User",
      email: "admin@example.com",
      role: "super_admin",
      org_id: 1,
      org_name: "Bekatos",
      plan_tier: "enterprise",
    };

    renderWithProviders(<RealtimeIndicator />);

    // Check that live connected indicator is displayed
    const liveIndicator = screen.getByText(tr("realtime_connected"));
    expect(liveIndicator).toBeDefined();
    expect(screen.queryByText(tr("realtime_upgrade_pro"))).toBeNull();
  });

  it("renders PRO upgrade pill for free tier users and gates live streaming", () => {
    mockUser = {
      id: 2,
      name: "Free User",
      email: "free@example.com",
      role: "customer",
      org_id: 2,
      org_name: "Customer Org",
      plan_tier: "free",
    };

    renderWithProviders(<RealtimeIndicator />);

    // Check that PRO upgrade pill is rendered instead of live indicator
    const upgradePill = screen.getByText(tr("realtime_upgrade_pro"));
    expect(upgradePill).toBeDefined();
    expect(screen.queryByText(tr("realtime_connected"))).toBeNull();
  });

  it("opens upgrade modal when PRO pill is clicked by free tier user", () => {
    mockUser = {
      id: 2,
      name: "Free User",
      email: "free@example.com",
      role: "customer",
      org_id: 2,
      org_name: "Customer Org",
      plan_tier: "free",
    };

    renderWithProviders(<RealtimeIndicator />);

    const upgradePill = screen.getByRole("button", {
      name: tr("realtime_upgrade_pro"),
    });
    fireEvent.click(upgradePill);

    // Modal should now be opened
    expect(screen.getByText(tr("realtime_pro_modal_title"))).toBeDefined();
    expect(screen.getByText(tr("realtime_pro_modal_desc"))).toBeDefined();
    expect(screen.getByText(tr("realtime_upgrade_button"))).toBeDefined();
  });
});
