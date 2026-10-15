import { useLanguage } from "../../i18n/index.js";
import ManagementPage from "../administration/ManagementPage";
export default function UsersPage() {
  useLanguage();
  return <ManagementPage view="users" />;
}
