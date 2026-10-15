import { tr } from "../i18n/index.js";
export default function QueryState({
  result,
}: {
  result: { isPending: boolean; error?: unknown; refetch: () => unknown };
}) {
  return result.isPending ? (
    <div className="panel detail-section" role="status">
      {tr("loading")}
    </div>
  ) : (
    <div role="alert" className="error">
      {tr(result.error)}{" "}
      <button className="secondary" onClick={() => result.refetch()}>
        {tr("refresh")}
      </button>
    </div>
  );
}
