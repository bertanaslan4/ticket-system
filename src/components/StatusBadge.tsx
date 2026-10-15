import { tr } from "../i18n/index.js";
import { statuses } from "../lib/constants";
export default function Badge({ value }: { value: string }) {
  return (
    <span className={"badge " + value}>
      {tr(statuses[value] || value.toUpperCase())}
    </span>
  );
}
