import { useLanguage } from "../../i18n/index.js";
import ManagementPage from "../administration/ManagementPage";
export default function OrganizationsPage() {
  useLanguage();
  return <ManagementPage view="organizations" />;
}
