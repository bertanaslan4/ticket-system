import { useLanguage } from "../../i18n/index.js";
import { tr, date, number } from "../../i18n/index.js";

import { Download, Star, Award } from "lucide-react";
import { states, format } from "../administration/admin.shared";
import { download } from "./exportReport";
import { useReports } from "./reports.api";
import { useNavigate, useSearchParams } from "react-router-dom";
import QueryState from "../../components/QueryState";
import AdminHeading from "../administration/AdminHeading";
export function ProductReportsPage() { return <ReportsPage productView />; }
export default function ReportsPage({productView=false}:{productView?:boolean}) {
  useLanguage();
  const go = useNavigate();
  const openTicket = (id: number) => go("/tickets/" + id);
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(params);
  const setFilters = (v: any) => setParams(v);
  const { result, orgs, products } = useReports(filters);
  const report = result.data;
  return (
    <>
      <AdminHeading view={productView ? 'productReports' : 'reports'} />
      {result.isPending || result.isError ? (
        <QueryState result={result} />
      ) : (
        <>
          <form
            key={params.toString()}
            className="panel report-filters"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters(
                Object.fromEntries(
                  [...new FormData(e.currentTarget)].filter(([, v]) => v),
                ),
              );
            }}
          >
            <label>{tr('product')}<select name="product_id" defaultValue={filters.product_id || ''}>
              <option value="">{tr('all')}</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
            <label>
              {tr("start_date")}
              <input type="date" name="from" defaultValue={filters.from} />
            </label>
            <label>
              {tr("end_date")}
              <input type="date" name="to" defaultValue={filters.to} />
            </label>
            {[
              ["customer_id", tr("customer"), "customer"],
              ["support_org_id", tr("support_company"), "support"],
            ].map(([key, label, kind]) => (
              <label key={key}>
                {tr(label)}
                <select name={key} defaultValue={filters[key] || ""}>
                  <option value="">{tr("all")}</option>
                  {orgs
                    .filter((o) => kind === "support" ? o.kind !== "customer" : o.kind === kind)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
              </label>
            ))}
            <label>
              {tr("status_2")}
              <select name="status" defaultValue={filters.status || ""}>
                <option value="">{tr("all")}</option>
                {Object.entries(states).map(([k, v]) => (
                  <option key={k} value={k}>
                    {tr(v)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("severity_2")}
              <select name="severity" defaultValue={filters.severity || ""}>
                <option value="">{tr("all")}</option>
                {["s1", "s2", "s3"].map((v) => (
                  <option key={tr(v)} value={tr(v)}>
                    {v.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("ticket_type")}
              <select name="type" defaultValue={filters.type || ""}>
                <option value="">{tr("all")}</option>
                <option value="Hata">{tr("ticket_type_bug")}</option>
                <option value="İstek">{tr("ticket_type_request")}</option>
              </select>
            </label>
            <button className="primary">{tr("run_report")}</button>
            <button
              className="secondary"
              type="button"
              onClick={(e) => {
                e.currentTarget.form?.reset();
                setFilters({});
              }}
            >
              {tr("reset")}
            </button>
            <p className="hint">
              {tr("the_date_range_applies_to_ticket_creation_dates_in")}
            </p>
          </form>
          <div className="stats">
            {[
              [tr("total_tickets"), report.total],
              [tr("open_tickets"), report.open],
              [tr("closed_3"), report.closed],
              [
                tr("avg_resolution_time"),
                report.averageResolutionHours === null
                  ? "—"
                  : tr("hr", {
                      hours: number(report.averageResolutionHours, {
                        maximumFractionDigits: 1,
                        minimumFractionDigits: 1,
                      }),
                    }),
              ],
            ].map(([label, value]) => (
              <div className="stat" key={tr(label)}>
                <div>{tr(label)}</div>
                <strong>{value}</strong>
                <small>
                  {label === tr("avg_resolution_time")
                    ? tr("closed_tickets_calendar_hours")
                    : tr("based_on_selected_filters")}
                </small>
              </div>
            ))}
          </div>
          <div className="report-groups">
            {[
              [tr("by_status"), report.byStatus, states],
              [tr("by_severity"), report.bySeverity, {}],
              [tr("by_dealer"), report.byDealer, {}],
              [tr("by_product"), report.byProduct || [], {}],
            ].map(([label, data, names]) => (
              <section className="panel detail-section" key={tr(label)}>
                <h2>{tr(label)}</h2>
                {data.length ? (
                  data.map((g) => (
                    <div className="report-bar" key={g.name}>
                      <span>{names[g.name] ? tr(names[g.name]) : g.name}</span>
                      <strong>{g.count}</strong>
                      <div>
                        <i
                          style={{
                            width: (report.total ? (g.count / report.total) * 100 : 0) + "%",
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">{tr("no_records")}</p>
                )}
              </section>
            ))}
          </div>
          {report.csat && (
            <div className="panel detail-section csat-report-card">
              <div className="csat-score-big">
                <span className="csat-badge" style={{ marginBottom: 8 }}>
                  <Award size={14} />
                  {tr("csat_satisfaction_survey")}
                </span>
                <div className="csat-big-number">
                  {report.csat.average !== null ? Number(report.csat.average).toFixed(1) : "—"}
                  <small>/ 5.0</small>
                </div>
                <div style={{ display: "flex", gap: 3, margin: "8px 0" }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={18}
                      fill={report.csat.average && s <= Math.round(report.csat.average) ? "#f59e0b" : "none"}
                      color={report.csat.average && s <= Math.round(report.csat.average) ? "#f59e0b" : "#cbd5e1"}
                    />
                  ))}
                </div>
                <small style={{ color: "var(--text-secondary, #64748b)" }}>
                  {tr("csat_total_surveys")}: <strong>{report.csat.total}</strong>
                </small>
              </div>
              <div className="csat-bars">
                <h3 style={{ margin: "0 0 10px 0", fontSize: 15, fontWeight: 600 }}>{tr("csat_score_distribution")}</h3>
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = report.csat.distribution?.[stars] || 0;
                  const pct = report.csat.total > 0 ? Math.round((count / report.csat.total) * 100) : 0;
                  return (
                    <div key={stars} className="csat-bar-row">
                      <span>★ {stars} {tr(`csat_rating_${stars}`)}</span>
                      <div className="csat-bar-track">
                        <div className="csat-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span style={{ textAlign: "right", fontWeight: 600 }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {productView && <section className="panel"><div className="panel-title"><h2>{tr('product_reports')}</h2></div><div className="table-wrap"><table>
            <thead><tr><th>{tr('product')}</th><th>{tr('total_tickets')}</th><th>{tr('open_tickets')}</th><th>{tr('closed_3')}</th></tr></thead>
            <tbody>{(report.byProduct || []).map(p=><tr key={p.id}><td><button className="ticket-title" onClick={()=>setFilters({...filters,product_id:String(p.id)})}>{p.name}</button></td><td>{p.count}</td><td>{p.open}</td><td>{p.closed}</td></tr>)}</tbody>
          </table></div>{!report.byProduct?.length && <div className="empty">{tr('no_records')}</div>}</section>}
          <section className="panel">
            <div className="panel-title">
              <h2>
                {tr("report_results")}{" "}
                <span>{report.total}</span>
              </h2>
              <button
                className="secondary"
                disabled={!report.rows.length}
                onClick={() => download(report.rows)}
              >
                <Download size={16} />
                {tr("download_csv")}
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      tr("ticket_2"),
                      tr("customer_dealer"),
                      tr("product"),
                      tr("status"),
                      tr("severity"),
                      tr("created_2"),
                      tr("closed_4"),
                      tr("csat_score"),
                    ].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <small>TK-{t.id}</small>
                        <button
                          className="ticket-title"
                          onClick={() => openTicket(t.id)}
                        >
                          {t.title}
                        </button>
                      </td>
                      <td>
                        {t.customer_name}
                        <small>{t.dealer_name}</small>
                      </td>
                      <td>{t.program}</td>
                      <td>
                        <span className={"badge " + t.status}>
                          {tr(states[t.status])}
                        </span>
                      </td>
                      <td>
                        <span className={"badge " + t.severity}>
                          {t.severity.toUpperCase()}
                        </span>
                      </td>
                      <td>{format(t.created_at)}</td>
                      <td>{t.closed_at ? format(t.closed_at) : "—"}</td>
                      <td>
                        {t.csat_rating ? (
                          <span style={{ color: "#d97706", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                            ★ {t.csat_rating}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.rows.length && (
                <div className="empty">
                  {tr("no_tickets_match_these_filters")}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
