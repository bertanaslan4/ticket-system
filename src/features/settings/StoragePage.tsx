import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cloud, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { tr, useLanguage, date } from "../../i18n/index.js";
import QueryState from "../../components/QueryState";
export default function StoragePage() {
  useLanguage();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "storage"],
    queryFn: () => api("/admin/storage"),
  });
  if (query.isPending || query.isError) return <QueryState result={query} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{tr("system_administration")}</div>
          <h1>
            <Cloud size={26} /> {tr("cloud_settings")}
          </h1>
          <p>{tr("cloud_settings_intro")}</p>
        </div>
        <button
          className="secondary"
          onClick={() =>
            client.invalidateQueries({ queryKey: ["admin", "storage"] })
          }
        >
          <RefreshCw size={16} />
          {tr("refresh")}
        </button>
      </div>
      <StorageForm key={query.data.version} data={query.data} />
    </>
  );
}
function StorageForm({ data }: any) {
  const client = useQueryClient();
  const [form, setForm] = useState({ ...data, accessKey: "", secret: "" }),
    [result, setResult] = useState<any>(null),
    [saved, setSaved] = useState(false);
  const update = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
    setResult(null);
    setSaved(false);
  };
  const mutation = useMutation({
    mutationFn: async (action: string) => {
      const response = await api(
        "/admin/storage" + (action === "test" ? "/test" : ""),
        form,
      );
      if (action === "test") setResult(response);
      else {
        setSaved(true);
        setForm({ ...response, accessKey: "", secret: "" });
        client.setQueryData(["admin", "storage"], response);
      }
      return response;
    },
  });
  return (
    <div className="detail-grid">
      <section className="panel detail-section">
        <h2>{tr("storage_connection")}</h2>
        {form.provider === "local" && <p className="hint">{tr("storage_local_path_hint")}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate("save");
          }}
        >
          <fieldset
            disabled={mutation.isPending}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            <label>
              {tr("storage_provider")}
              <select
                value={form.provider}
                onChange={(e) => update("provider", e.target.value)}
              >
                <option value="local">{tr("storage_local")}</option>
                <option value="r2">Cloudflare R2</option>
              </select>
            </label>
            <label>
              Cloudflare Account ID
              <input
                value={form.account}
                onChange={(e) => update("account", e.target.value)}
                readOnly={!!data.account}
                required={form.provider === "r2"}
                maxLength={32}
              />
            </label>
            <label>
              Bucket
              <input
                value={form.bucket}
                onChange={(e) => update("bucket", e.target.value)}
                readOnly={!!data.bucket}
                required={form.provider === "r2"}
                maxLength={63}
              />
            </label>
            <label>
              Access Key ID
              <input
                type="password"
                autoComplete="new-password"
                value={form.accessKey}
                onChange={(e) => update("accessKey", e.target.value)}
                maxLength={256}
              />
            </label>
            <label>
              Secret Access Key
              <input
                type="password"
                autoComplete="new-password"
                value={form.secret}
                onChange={(e) => update("secret", e.target.value)}
                maxLength={256}
              />
            </label>
            <p className="hint">
              {tr(
                data.hasCredentials
                  ? "storage_keys_saved"
                  : "storage_keys_needed",
              )}
            </p>
            <p className="hint">{tr("storage_private_hint")}</p>
            {mutation.error && (
              <div role="alert" className="error">
                {tr(mutation.error)}
              </div>
            )}
            {result && (
              <p role="status" className={result.ok ? "hint" : "error"}>
                {tr(result.ok ? "storage_test_success" : result.errorKey)} ·{" "}
                {result.latency_ms} ms · {date(result.checked_at)}
              </p>
            )}
            {saved && <p role="status">{tr("storage_saved")}</p>}
            <div className="form-row">
              <button
                type="button"
                className="secondary"
                onClick={() => mutation.mutate("test")}
              >
                {tr("storage_test")}
              </button>
              <button className="primary">
                {mutation.isPending ? tr("saving") : tr("storage_save")}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
      <section className="panel detail-section">
        <h2>{tr("storage_status")}</h2>
        <dl>
          <dt>{tr("storage_provider")}</dt>
          <dd>
            {data.provider === "r2" ? "Cloudflare R2" : tr("storage_local")}
          </dd>
          <dt>{tr("storage_app")}</dt>
          <dd>{tr("storage_reachable")}</dd>
          <dt>{tr("storage_database")}</dt>
          <dd>{tr("storage_reachable")}</dd>
          <dt>{tr("storage_uptime")}</dt>
          <dd>
            {Math.floor(data.uptime_seconds / 60)} {tr("storage_minutes")}
          </dd>
          <dt>{tr("storage_last_check")}</dt>
          <dd>
            {data.checked_at ? date(data.checked_at) : tr("storage_not_tested")}
          </dd>
        </dl>
        <p className="hint">{tr("storage_status_hint")}</p>
        <h2>{tr("storage_usage")}</h2>
        {["local", "r2"].map((provider) => {
          const usage = data.usage.find((u: any) => u.storage === provider);
          return (
            <p key={provider}>
              {provider === "r2" ? "Cloudflare R2" : tr("storage_local")}:{" "}
              {usage?.files || 0} {tr("storage_files")} ·{" "}
              {(Number(usage?.bytes || 0) / 1024 / 1024).toFixed(2)} MB
            </p>
          );
        })}
        <p className="hint">{tr("storage_usage_hint")}</p>
      </section>
    </div>
  );
}
