import { AsyncLocalStorage } from "node:async_hooks";

// The tenant that database queries of the current request are limited to.
// null means no limit: public endpoints, background workers and platform admin routes.
const storage = new AsyncLocalStorage<{ tenantId: number | null }>();

export const PLATFORM_TENANT_ID = 1;
export const RLS_ROLE = "bekatos_tenant_rls";

export function currentTenantId(): number | null {
  return storage.getStore()?.tenantId ?? null;
}

export function runWithTenant<T>(tenantId: number | null, work: () => T): T {
  return storage.run({ tenantId }, work);
}

// A workspace owner is also a super_admin; only the platform's own admins may manage all tenants.
export function isPlatformAdmin(user: any): boolean {
  return (
    user?.role === "super_admin" &&
    (user.platform_admin === true || Number(user.tenant_id) === PLATFORM_TENANT_ID)
  );
}
