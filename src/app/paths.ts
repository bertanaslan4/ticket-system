export const paths: Record<string, string> = {
  profile: "/profile",
  dashboard: "/dashboard",
  tickets: "/tickets",
  new: "/tickets/new",
  users: "/admin/users",
  organizations: "/admin/organizations",
  reports: "/admin/reports",
  products: "/admin/products",
  productReports: "/admin/product-reports",
  storage: "/admin/storage",
  audit: "/admin/audit",
  tenants: "/admin/tenants",
};
export function viewForPath(path: string) {
  return (
    Object.entries(paths).find(([, value]) => value === path)?.[0] ||
    (path.startsWith("/tickets/") ? "detail" : "dashboard")
  );
}
