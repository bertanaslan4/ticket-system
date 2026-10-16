import { useLanguage } from "../i18n/index.js";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Ticket,
  Plus,
  LogOut,
  ShieldCheck,
  Users,
  Building2,
  BarChart3,
  Cloud,
  UserRound,
} from "lucide-react";

import { tr, locale } from "../i18n/index.js";
import LanguagePicker from "../components/LanguagePicker";
import ThemeToggle from "../components/ThemeToggle";

import { roles } from "../lib/constants";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { paths, viewForPath } from "../app/paths";
import { useTickets } from "../features/tickets/tickets.api";
export default function AppLayout() {
  useLanguage();
  const { user, logout } = useAuth();
  const [error, setError] = useState<any>(null);
  const location = useLocation();
  const view = viewForPath(location.pathname);
  const go = useNavigate();
  const navigate = (v: string) => go(paths[v]);
  const ticketCount = useTickets().data?.length ?? 0;
  useEffect(() => setError(null), [location.pathname]);
  if (!user) return null;
  return (
    <div className="app">
      <aside>
        <button
          className="brand"
          aria-label={tr("u_shops_overview")}
          onClick={() => navigate("dashboard")}
        >
          <span className="brand-image">
            <img
              src="/bekatos-logo.png"
              alt="Bekatos"
              style={{ maxHeight: 38, width: "auto" }}
            />
          </span>
          <small>{tr("support_center")}</small>
        </button>
        <div className="workspace">
          <span className="org-icon">{user.org_name[0]}</span>
          <div>
            <strong>{user.org_name}</strong>
            <small>
              {tr(roles[user.role])}{" "}
              {tr("workspace")}
            </small>
          </div>
          <span className="online" />
        </div>
        <div className="nav-label">{tr("workspace_2")}</div>
        <nav>
          <button className={view === 'profile' ? 'active' : ''} onClick={() => navigate('profile')}><UserRound size={18} />{tr('my_profile')}</button>
          {user.role === "super_admin" &&
            [
              ["tenants", tr("tenants"), Building2],
              ["organizations", tr("companies"), Building2],
              ["products", tr("products"), Building2],
              ["users", tr("users"), Users],
              ["reports", tr("reports"), BarChart3],
              ["productReports", tr("product_reports"), BarChart3],
              ["audit", tr("admin_activity"), ShieldCheck],
              ["storage", tr("cloud_settings"), Cloud],
            ].map(([key, label, Icon]: any) => (
              <button
                key={key}
                className={view === key ? "active" : ""}
                onClick={() => navigate(key)}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          <button
            className={view === "dashboard" ? "active" : ""}
            onClick={() => navigate("dashboard")}
          >
            <LayoutDashboard size={18} />
            {tr("overview")}
          </button>
          <button
            className={["tickets", "detail"].includes(view) ? "active" : ""}
            onClick={() => navigate("tickets")}
          >
            <Ticket size={18} />
            {tr("tickets")}
            <span>{ticketCount}</span>
          </button>
          {user.role === "customer" && (
            <button
              className={view === "new" ? "active" : ""}
              onClick={() => navigate("new")}
            >
              <Plus size={18} />
              {tr("create_ticket")}
            </button>
          )}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={22} />
          <strong>{tr("every_step_tracked")}</strong>
          <p>
            {tr("your_requests_reach_the_right_team_through_a_transparent")}
          </p>
        </div>
        <div className="profile">
          <span className="avatar">
            {user.name
              .split(" ")
              .map((s) => s[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <strong>{user.name}</strong>
            <small>{tr(roles[user.role])}</small>
          </div>
          <button
            title={tr("sign_out")}
            onClick={() => logout().then(() => go('/login', { replace: true, state: null })).catch(setError)}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="content">
        <header>
          <span>
            {tr("workspace_3")}
            <b>/</b>{" "}
            <strong>
              {[
                "tenants",
                "organizations",
                "products",
                "productReports",
                "users",
                "reports",
                "audit",
                "storage",
              ].includes(view)
                ? tr("system_administration")
                : view === "new"
                  ? tr("new_ticket")
                  : view === "detail"
                    ? tr("ticket_details")
                    : view === "tickets"
                      ? tr("tickets")
                      : view === 'profile' ? tr('my_profile') : tr("overview")}
            </strong>
          </span>
          <div className="header-controls">
            <ThemeToggle />
            <LanguagePicker />
          </div>
          <span className="header-right">
            <span className="online" />
            {tr("system_online")} <span className="divider" />{" "}
            {new Date().toLocaleDateString(locale(), {
              timeZone: "Europe/Istanbul",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </header>
        <main>
          {error && (
            <div role="alert" className="error">
              {tr(error)}
            </div>
          )}
          <Outlet />
        </main>
        <footer>
          © {new Date().getFullYear()} Bekatos{" "}
          <span>{tr("support_is_a_team_effort")}</span>
        </footer>
      </div>
    </div>
  );
}
