import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/index.js";

import {
  Ticket,
  Plus,
  ArrowUpRight,
  Search,
  ShieldCheck,
  Clock3,
  CheckCircle2,
  Activity,
  Lock,
  RefreshCw,
} from "lucide-react";

import { tr, date, number, locale } from "../../i18n/index.js";
import LanguagePicker from "../../components/LanguagePicker";
import Badge from "../../components/StatusBadge";
import { statuses } from "../../lib/constants";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useTickets } from "./tickets.api";
import QueryState from "../../components/QueryState";
import { paths } from "../../app/paths";
import OnboardingChecklist from "../dashboard/OnboardingChecklist";
export default function TicketListPage({
  dashboard = false,
}: {
  dashboard?: boolean;
}) {
  useLanguage();
  const { user } = useAuth();
  const view = dashboard ? "dashboard" : "tickets";
  const go = useNavigate();
  const navigate = (v: string) => go(paths[v]);
  const open = (id: number) => go("/tickets/" + id);
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "",
    filter = params.get("status") || "all";
  const change = (key: string, value: string) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        value ? p.set(key, value) : p.delete(key);
        return p;
      },
      { replace: true },
    );
  const setQuery = (v: string) => change("q", v);
  const setFilter = (v: string) => change("status", v);
  const result = useTickets();
  const tickets = result.data || [];
  const busy = result.isFetching;
  const refresh = () => result.refetch();
  const run = (fn: () => unknown) => fn();
  if (!user) return null;
  if (result.isPending || result.isError) return <QueryState result={result} />;
  const list = tickets.filter(
    (t) =>
      (filter === "all" ||
        (filter === "active"
          ? ["open", "in_progress"].includes(t.status)
          : t.status === filter)) &&
      (t.title + " " + t.id + " " + t.customer_name)
        .toLocaleLowerCase(locale())
        .includes(query.toLocaleLowerCase(locale())),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{tr("support_operations")}</div>
          <h1>{view === "dashboard" ? tr("overview") : tr("all_tickets")}</h1>
          <p>
            {user.role === "customer"
              ? tr("track_your_requests_and_their_progress_here")
              : tr("manage_your_team_s_requests_and_track_every_step")}
          </p>
        </div>
        {user.role === "customer" ? (
          <button className="primary" onClick={() => navigate("new")}>
            <Plus size={18} />
            {tr("create_ticket")}
          </button>
        ) : (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => run(refresh)}
          >
            <RefreshCw size={16} />
            {tr("refresh")}
          </button>
        )}
      </div>
      {view === "dashboard" && (
        <>
          <OnboardingChecklist />
          <div className="stats">
            {[
              [
                Ticket,
                tr("total_tickets"),
                tickets.length,
                tr("all_your_requests"),
                "all",
              ],
              [
                Activity,
                tr("ongoing"),
                tickets.filter((t) =>
                  ["open", "in_progress"].includes(t.status),
                ).length,
                tr("teams_are_working_on_them"),
                "active",
              ],
              [
                Clock3,
                tr("dealer_review"),
                tickets.filter((t) => t.status === "review").length,
                tr("final_checks_in_progress"),
                "review",
              ],
              [
                CheckCircle2,
                tr("resolved_tickets"),
                tickets.filter((t) => t.status === "closed").length,
                tr("successfully_completed"),
                "closed",
              ],
            ].map(([Icon, label, n, caption, f]: any) => (
              <button
                className="stat"
                key={label}
                onClick={() => {
                  go("/tickets?status=" + f);
                }}
              >
                <div>
                  <span>{label}</span>
                  <Icon size={19} />
                </div>
                <strong>{String(n).padStart(2, "0")}</strong>
                <small>{caption}</small>
              </button>
            ))}
          </div>
          <div className="overview-banner">
            <div className="banner-mark">
              <ShieldCheck size={30} />
            </div>
            <div>
              <strong>
                {user.role === "customer"
                  ? tr("closer_to_a_solution_together")
                  : tr("the_right_team_seamless_communication")}
              </strong>
              <p>
                {tr(
                  "customer_dealer_takipsan_visible_at_every_stage_secure_at",
                )}
              </p>
            </div>
            {user.role === "customer" && (
              <div className="quota">
                <strong>
                  {user.used}
                  <span> / {user.daily_limit}</span>
                </strong>
                <small>{tr("today_s_ticket_usage")}</small>
                <div>
                  <i
                    style={{
                      width:
                        Math.min(100, (user.used / user.daily_limit) * 100) +
                        "%",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>
              {view === "dashboard" ? tr("recent_tickets") : tr("ticket_queue")}{" "}
              <span>{tickets.length}</span>
            </h2>
            <p>{tr("the_latest_status_of_your_requests")}</p>
          </div>
          <label className="search">
            <Search size={17} />
            <input
              placeholder={tr("search_ticket_number_or_title")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="filters">
          {[
            ["all", tr("all")],
            ...(filter === "active" ? [["active", tr("ongoing")]] : []),
            ...Object.entries(statuses),
          ].map(([k, v]) => (
            <button
              key={k}
              className={filter === k ? "selected" : ""}
              onClick={() => setFilter(k)}
            >
              {tr(v)}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("ticket_subject")}</th>
                <th>{tr("status")}</th>
                <th>{tr("severity")}</th>
                <th>{tr("responsible_team")}</th>
                <th>{tr("opened_at")}</th>
                <th>{tr("last_updated")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} onClick={() => open(t.id)}>
                  <td>
                    <span className="ticket-number">
                      TK-{String(t.id).padStart(4, "0")}{" "}
                      <span>
                        ·{" "}
                        {tr(
                          t.type === "Hata"
                            ? "ticket_type_bug"
                            : "ticket_type_request",
                        )}
                      </span>
                    </span>
                    <Link
                      className="ticket-title"
                      to={"/tickets/" + t.id}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t.title}
                    </Link>
                    <small>
                      {t.customer_name} <b>·</b> {t.program}
                    </small>
                  </td>
                  <td>
                    <Badge value={t.status} />
                  </td>
                  <td>
                    <Badge value={t.severity} />
                    {t.sla_status && (
                      <small style={{ display: "block", marginTop: 4 }}>
                        {tr(
                          t.sla_status === "breached"
                            ? "sla_breached"
                            : t.sla_status === "at_risk"
                              ? "sla_at_risk"
                              : t.sla_status === "met"
                                ? "sla_met"
                                : "sla_on_track",
                        )}
                      </small>
                    )}
                  </td>
                  <td>
                    <span className="team-name">{t.owner_name}</span>
                    <small>{t.assignee_name || tr("team_queue")}</small>
                  </td>
                  <td className="date">{date(t.created_at, {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                  <td className="date">{date(t.updated_at, {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                  <td>
                    <ArrowUpRight size={17} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && (
            <div className="empty">
              <Ticket size={30} />
              <h3>{tr("no_tickets_found")}</h3>
              <p>
                {user.role === "customer"
                  ? tr("try_a_different_search_or_create_a_new_ticket")
                  : tr("try_a_different_search")}
              </p>
            </div>
          )}
        </div>
        <div className="table-footer">
          {tr("showing_tickets", {
            count: number(list.length),
          })}{" "}
          <span>{tr("all_times_are_in_the_istanbul_time_zone")}</span>
        </div>
      </section>
      <div className="bottom-note">
        <Lock size={13} />
        {tr("internal_messages_are_shared_only_with_authorized_support_teams")}
      </div>
    </>
  );
}
