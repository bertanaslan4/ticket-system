import Modal from '../../components/Modal';
import { useLanguage } from "../../i18n/index.js";
import { tr, number } from "../../i18n/index.js";

import { Pencil, Trash2 } from "lucide-react";
import { kinds } from "../administration/admin.shared";
import { useManagement } from "./useManagement";
import QueryState from "../../components/QueryState";
import AdminHeading from "./AdminHeading";
import SupportChainEditor from './SupportChainEditor';
export default function ManagementPage({
  view,
}: {
  view: "users" | "organizations";
}) {
  useLanguage();
  const {
    user,
    orgs,
    products,
    users,
    editing,
    setEditing,
    kind,
    setKind,
    error,
    success,
    busy,
    start,
    save,
    result,
    supportChain, setSupportChain,
    deleting, setDeleting, startDelete, deleteUser, deleteBusy, deleteError,
  } = useManagement(view);
  if (!user) return null;
  return (
    <>
      <AdminHeading view={view} onAdd={() => start()} />
      {deleting && <Modal title={tr('delete_user')} busy={deleteBusy} onClose={() => setDeleting(null)}>
        <div className="detail-section">
          <p>{tr('delete_user_confirmation', { name: deleting.name })}</p>
          <p className="hint">{tr('delete_user_history_hint')}</p>
          {deleteError && <div className="error" role="alert">{tr(deleteError)}</div>}
          <div className="form-bottom">
            <button className="secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>{tr('cancel')}</button>
            <button className="danger-button" disabled={deleteBusy} onClick={deleteUser}>{tr(deleteBusy ? 'deleting_user' : 'delete_user')}</button>
          </div>
        </div>
      </Modal>}
      {error && !editing && (
        <div className="error" role="alert">
          {tr(error)}
        </div>
      )}
      {success && (
        <div className="admin-success" role="status">
          {tr(success)}
        </div>
      )}
      {result.isPending || result.isError ? (
        <QueryState result={result} />
      ) : (
        <>
          {editing && (
            <Modal title={editing.id ? tr("edit_record") : tr(view === "users" ? "add_user" : "add_company")} busy={busy} onClose={() => setEditing(null)}>
            <form
              className="form-panel admin-form"
              onSubmit={save}
              key={view + "-" + (editing.id || "new")}
            >
              {error && <div className="error" role="alert">{tr(error)}</div>}
              <fieldset disabled={busy} className="form-fields">
              <div className="form-row">
                <label>
                  {view === "users" ? tr("full_name") : tr("company_name")}
                  <input
                    name="name"
                    required
                    maxLength={180}
                    defaultValue={editing.name || ""}
                  />
                </label>
                {view === "users" ? (
                  <label>
                    {tr("email")}
                    <input
                      type="email"
                      name="email"
                      required
                      maxLength={200}
                      defaultValue={editing.email || ""}
                    />
                    <small className="hint">{tr("user_email_notifications_hint")}</small>
                  </label>
                ) : (
                  <label>
                    {tr("company_type")}
                    <select
                      value={kind}
                      disabled={!!editing.id}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      {Object.entries({ customer: 'customer', support: 'support_company' }).map(([k, v]) => (
                        <option key={k} value={k}>
                          {tr(v)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {view === "users" ? (
                <>
                  <div className="form-row">
                    <label>
                      {tr("company")}
                      <select
                        name="org_id"
                        disabled={!!editing.id}
                        defaultValue={editing.org_id || ""}
                        required
                      >
                        <option value="">{tr("select_a_company")}</option>
                        {orgs.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} · {tr(kinds[o.kind])}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {tr("system_role")}
                      <select
                        name="system_role"
                        defaultValue={editing.system_role || "member"}
                      >
                        <option value="member">
                          {tr("standard_company_role")}
                        </option>
                        <option value="super_admin">
                          {tr("super_admin_entire_system")}
                        </option>
                      </select>
                    </label>
                  </div>
                  <label>
                    {editing.id
                      ? tr("new_password_leave_blank_to_keep_current")
                      : tr("password")}
                    <input
                      type="password"
                      name="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={200}
                      required={!editing.id}
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={editing.active !== false}
                    />
                    {tr("account_active")}
                  </label>
                  <p className="hint">
                    {tr(
                      "password_or_permission_changes_end_existing_sessions_inactive_users",
                    )}
                  </p>
                  {editing.id === user.id && (
                    <p className="hint">
                      {tr(
                        "you_cannot_deactivate_your_own_account_or_remove_your",
                      )}
                    </p>
                  )}
                </>
              ) : (
                kind === "customer" && (
                  <>
                    <SupportChainEditor chain={supportChain} onChange={setSupportChain} organizations={orgs} />
                    <div className="form-row">
                      <label>
                        {tr("application_used")}
                        <select
                          name="product_id"
                          required
                          defaultValue={editing.product_id || ""}
                        >
                          <option value="">{tr('select_product')}</option>
                          {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        {!products.length && <small className="hint">{tr('create_product_first')}</small>}
                      </label>
                    </div>
                    <label>
                      {tr("daily_ticket_limit")}
                      <input
                        type="number"
                        name="daily_limit"
                        min="1"
                        max="10000"
                        required
                        defaultValue={editing.daily_limit || 10}
                      />
                    </label>
                    {editing.id && (
                      <p className="hint">
                        {tr(
                          "support_flow_changes_new_tickets_only",
                        )}
                      </p>
                    )}
                  </>
                )
              )}
              </fieldset>
              <div className="form-bottom">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  {tr("cancel")}
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? tr("saving") : tr("save")}
                </button>
              </div>
            </form>
            </Modal>
          )}
          <section className="panel">
            <div className="panel-title">
              <h2>
                {view === "users" ? tr("users") : tr("companies")}{" "}
                <span>{view === "users" ? users.length : orgs.length}</span>
              </h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {(view === "users"
                      ? [
                          tr("user"),
                          tr("company_2"),
                          tr("role"),
                          tr("status"),
                          "",
                        ]
                      : [
                          tr("company_2"),
                          tr("type_2"),
                          tr("dealer_application"),
                          tr("daily_limit"),
                          "",
                        ]
                    ).map((v, i) => (
                      <th key={i}>{tr(v)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(view === "users" ? users : orgs).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                        <small>
                          {view === "users"
                            ? row.email
                            : tr("users_2", {
                                count: number(row.user_count),
                              })}
                        </small>
                      </td>
                      {view === "users" ? (
                        <>
                          <td>{row.org_name}</td>
                          <td>
                            {row.system_role === "super_admin"
                              ? tr("super_admin")
                              : tr(kinds[row.org_kind])}
                          </td>
                          <td>
                            <span
                              className={
                                "badge " + (row.active ? "closed" : "s1")
                              }
                            >
                              {row.active ? tr("active") : tr("inactive")}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{tr(kinds[row.kind])}</td>
                          <td>
                            {row.support_chain?.map((id: number) => orgs.find(o => o.id === id)?.name || id).join(" → ") || "—"}
                            <small>{row.program}</small>

                          </td>
                          <td>
                            {row.kind === "customer" ? row.daily_limit : "—"}
                          </td>
                        </>
                      )}
                      <td>
                        <button
                          className="secondary"
                          aria-label={tr("edit", {
                            name: row.name,
                          })}
                          onClick={() => start(row)}
                        >
                          <Pencil size={14} />
                          {tr("edit_2")}
                        </button>
                        {view === 'users' && row.id !== user.id && <button className="secondary user-delete-button" aria-label={tr('delete_user_named', { name: row.name })} onClick={() => startDelete(row)}><Trash2 size={14} />{tr('delete_user')}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
