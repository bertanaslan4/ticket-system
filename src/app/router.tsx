import { Navigate, Outlet, useLocation, Link } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import LoginPage from "../features/auth/LoginPage";
import { useAuth } from "../features/auth/AuthProvider";
import TicketListPage from "../features/tickets/TicketListPage";

import QueryState from "../components/QueryState";
import { tr, useLanguage } from "../i18n/index.js";
import type { RouteObject } from "react-router-dom";
import type { Role } from "../lib/types";
function ProtectedRoute({ roles }: { roles?: Role[] }) {
  useLanguage();
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  if (loading || error)
    return (
      <QueryState result={{ isPending: loading, error, refetch: refresh }} />
    );
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (roles && !roles.includes(user.role))
    return (
      <div className="error" role="alert">
        {tr(
          roles.includes("customer")
            ? "only_customers_can_create_tickets"
            : "this_area_is_restricted_to_super_admins",
        )}{" "}
        <Link to="/dashboard">{tr("overview")}</Link>
      </div>
    );
  return <Outlet />;
}
function NotFound() {
  useLanguage();
  return (
    <div className="panel detail-section">
      <h1>404</h1>
      <p>{tr("endpoint_not_found")}</p>
      <Link to="/dashboard">{tr("overview")}</Link>
    </div>
  );
}
function RouteLoading() {
  useLanguage();
  return (
    <div role="status" className="loading">
      {tr("loading")}
    </div>
  );
}
export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    HydrateFallback: RouteLoading,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <TicketListPage dashboard /> },
          { path: "tickets", element: <TicketListPage /> },
          { path: "kb", lazy: async () => ({ Component: (await import('../features/kb/KnowledgeBasePage')).default }) },
          { path: "profile", lazy: async () => ({ Component: (await import('../features/profile/ProfilePage')).default }) },
          { path: "tasks", lazy: async () => ({ Component: (await import('../features/tasks/TasksPage')).default }) },
          {
            element: <ProtectedRoute roles={["customer"]} />,
            children: [
              {
                path: "tickets/new",
                lazy: async () => ({
                  Component: (await import("../features/tickets/NewTicketPage"))
                    .default,
                }),
              },
            ],
          },
          {
            path: "tickets/:id",
            lazy: async () => ({
              Component: (await import("../features/tickets/TicketDetailPage"))
                .default,
            }),
          },
          {
            element: <ProtectedRoute roles={["super_admin"]} />,
            children: [
              {
                path: "admin/integrations",
                lazy: async () => ({
                  Component: (await import("../features/admin/IntegrationsPage"))
                    .default,
                }),
              },
              {
                path: "admin/tenants",
                lazy: async () => ({
                  Component: (await import("../features/tenants/TenantsPage"))
                    .default,
                }),
              },
              {
                path: "admin/operations",
                lazy: async () => ({
                  Component: (
                    await import("../features/operations/OperationsPage")
                  ).default,
                }),
              },
              {path:'admin/products',lazy:async()=>({Component:(await import('../features/products/ProductsPage')).default})},
              {path:'admin/product-reports',lazy:async()=>({Component:(await import('../features/reports/ReportsPage')).ProductReportsPage})},
              {
                path: "admin/storage",
                lazy: async () => ({
                  Component: (await import("../features/settings/StoragePage"))
                    .default,
                }),
              },
              {
                path: "admin/users",
                lazy: async () => ({
                  Component: (await import("../features/users/UsersPage"))
                    .default,
                }),
              },
              {
                path: "admin/organizations",
                lazy: async () => ({
                  Component: (
                    await import("../features/organizations/OrganizationsPage")
                  ).default,
                }),
              },
              {
                path: "admin/reports",
                lazy: async () => ({
                  Component: (await import("../features/reports/ReportsPage"))
                    .default,
                }),
              },
              {
                path: "admin/audit",
                lazy: async () => ({
                  Component: (await import("../features/audit/AuditPage"))
                    .default,
                }),
              },
            ],
          },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
];
