import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { currentTenantId, RLS_ROLE } from "../common/tenant-context.js";

// A single injectable connection boundary preserves PostgreSQL transactions.
// Inside a tenant request every query runs in a transaction with app.tenant_id set, so RLS filters it.
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger("DatabaseService");
  private roleSwitch?: Promise<boolean>;
  constructor(@Inject("DATABASE") private readonly connection: any) {}

  async query(sql: string, params: any[] = []): Promise<any> {
    const tenantId = currentTenantId();
    if (tenantId == null) return this.connection.query(sql, params);
    const switchRole = await this.needsRoleSwitch();
    return this.connection.transaction(async (tx: any) => {
      await this.enterTenant(tx, tenantId, switchRole);
      return tx.query(sql, params);
    });
  }

  async transaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
    const tenantId = currentTenantId();
    if (tenantId == null) return this.connection.transaction(work);
    const switchRole = await this.needsRoleSwitch();
    return this.connection.transaction(async (tx: any) => {
      await this.enterTenant(tx, tenantId, switchRole);
      return work(tx);
    });
  }

  // Both settings are transaction-local, so a pooled connection never carries them to the next user.
  private enterTenant(tx: any, tenantId: number, switchRole: boolean) {
    return switchRole
      ? tx.query(
          "SELECT set_config('app.tenant_id',$1,true), set_config('role',$2,true)",
          [String(tenantId), RLS_ROLE],
        )
      : tx.query("SELECT set_config('app.tenant_id',$1,true)", [
          String(tenantId),
        ]);
  }

  // Superusers and BYPASSRLS roles ignore policies, so they act through the unprivileged RLS role.
  // Checked once, outside any transaction (PGlite cannot run a second query while one is open).
  private needsRoleSwitch(): Promise<boolean> {
    this.roleSwitch ??= this.connection
      .query(
        "SELECT (r.rolsuper OR r.rolbypassrls) bypass, EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) has_role FROM pg_roles r WHERE r.rolname=current_user",
        [RLS_ROLE],
      )
      .then(({ rows }: any) => {
        const { bypass, has_role } = rows[0] || {};
        if (bypass && !has_role)
          this.logger.warn(
            `Database user bypasses row level security and role ${RLS_ROLE} is missing; tenant isolation relies on application filters only.`,
          );
        return Boolean(bypass && has_role);
      });
    return this.roleSwitch!;
  }

  async onModuleDestroy() {
    await this.connection.close();
  }
}
