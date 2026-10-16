import {
  Module,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  HttpCode,
  UseGuards,
  Injectable,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard.js";
import { DatabaseService } from "../database/database.service.js";
import { str, integer, option, email, audit } from "../common/admin-domain.js";
import { fail } from "../common/domain.js";
import { hashPassword } from "../auth.js";

const PLAN_TIERS = ["starter", "pro", "enterprise"];
const TENANT_STATUSES = ["trial", "active", "past_due", "suspended"];

@Injectable()
export class TenantsService {
  constructor(private readonly db: DatabaseService) {}

  async list() {
    const rows = (
      await this.db.query(`
        SELECT
          t.*,
          (
            SELECT count(*)::int
            FROM users u
            JOIN organizations o ON o.id = u.org_id
            WHERE u.tenant_id = t.id
              AND u.active = true
              AND u.deleted_at IS NULL
              AND (o.kind <> 'customer' OR u.system_role = 'super_admin')
          ) AS agent_used,
          (
            SELECT count(*)::int
            FROM users u
            JOIN organizations o ON o.id = u.org_id
            WHERE u.tenant_id = t.id
              AND u.active = true
              AND u.deleted_at IS NULL
              AND o.kind = 'customer'
              AND u.system_role = 'member'
          ) AS customer_user_count,
          (
            SELECT count(*)::int
            FROM organizations o
            WHERE o.tenant_id = t.id
          ) AS organization_count,
          (
            SELECT count(*)::int
            FROM tickets tk
            WHERE tk.tenant_id = t.id
          ) AS ticket_count,
          (
            SELECT COALESCE(SUM(a.size), 0)::bigint
            FROM attachments a
            JOIN tickets tk ON tk.id = a.ticket_id
            WHERE tk.tenant_id = t.id
          ) AS storage_used_bytes
        FROM tenants t
        ORDER BY t.id
      `)
    ).rows;
    return rows.map((r) => ({
      ...r,
      storage_used_bytes: Number(r.storage_used_bytes || 0),
    }));
  }

  async save(routeId: string | undefined, body: any, user: any) {
    const id = routeId ? integer(routeId) : null;
    const name = str(body.name, 2, 180);
    const slug = str(body.slug, 2, 64).toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      fail(400, "invalid_tenant_slug");
    const planTier = option(body.plan_tier ?? "starter", PLAN_TIERS);
    const status = option(body.status ?? "active", TENANT_STATUSES);
    const agentLimit = integer(body.agent_limit ?? 5);
    const storageLimitMb = integer(body.storage_limit_mb ?? 10240);
    if (agentLimit > 100000 || storageLimitMb > 10000000)
      fail(400, "enter_a_valid_positive_integer");
    if (id === 1 && status === "suspended")
      fail(400, "cannot_suspend_primary_tenant");

    const adminEmail =
      !id && body.admin_email && String(body.admin_email).trim()
        ? email(body.admin_email)
        : null;
    const adminName = adminEmail
      ? str(body.admin_name || `${name} Admin`, 2, 180)
      : null;
    const adminPassword = adminEmail
      ? str(body.admin_password, 8, 200)
      : null;

    const savedId = await this.db.transaction(async (tx) => {
      if (id) {
        const existing = (
          await tx.query("SELECT * FROM tenants WHERE id=$1 FOR UPDATE", [id])
        ).rows[0];
        if (!existing) fail(404, "tenant_not_found");
      }
      const duplicate = (
        await tx.query(
          "SELECT id FROM tenants WHERE lower(slug)=$1 AND id<>$2",
          [slug, id || 0],
        )
      ).rows[0];
      if (duplicate) fail(409, "tenant_slug_in_use");

      if (adminEmail) {
        const emailTaken = (
          await tx.query("SELECT id FROM users WHERE email=$1", [adminEmail])
        ).rows[0];
        if (emailTaken) fail(409, "this_email_address_is_already_in_use");
      }

      const row = (
        await tx.query(
          id
            ? "UPDATE tenants SET name=$1,slug=$2,plan_tier=$3,status=$4,agent_limit=$5,storage_limit_mb=$6 WHERE id=$7 RETURNING *"
            : "INSERT INTO tenants(name,slug,plan_tier,status,agent_limit,storage_limit_mb) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          id
            ? [name, slug, planTier, status, agentLimit, storageLimitMb, id]
            : [name, slug, planTier, status, agentLimit, storageLimitMb],
        )
      ).rows[0];

      if (!id) {
        const contractorOrg = (
          await tx.query(
            "INSERT INTO organizations(tenant_id,name,kind,daily_limit) VALUES($1,$2,'contractor',10) RETURNING id",
            [row.id, name],
          )
        ).rows[0];

        if (adminEmail && adminPassword) {
          await tx.query(
            "INSERT INTO users(tenant_id,org_id,name,email,password_hash,system_role,active) VALUES($1,$2,$3,$4,$5,'super_admin',true)",
            [
              row.id,
              contractorOrg.id,
              adminName,
              adminEmail,
              hashPassword(adminPassword),
            ],
          );
        }
      }

      await audit(tx, user, id ? "tenant_updated" : "tenant_created", row.id, {
        name,
        slug,
        plan_tier: planTier,
        status,
        agent_limit: agentLimit,
        storage_limit_mb: storageLimitMb,
      });

      return row.id;
    });

    const all = await this.list();
    return all.find((t) => t.id === savedId);
  }

  async switchTenant(routeId: string, user: any) {
    const targetTenantId = integer(routeId);
    return this.db.transaction(async (tx) => {
      const tenant = (
        await tx.query("SELECT * FROM tenants WHERE id=$1", [targetTenantId])
      ).rows[0];
      if (!tenant) fail(404, "tenant_not_found");
      if (tenant.status === "suspended") fail(400, "tenant_account_suspended");

      let org = (
        await tx.query(
          "SELECT id FROM organizations WHERE tenant_id=$1 AND kind='contractor' ORDER BY id LIMIT 1",
          [targetTenantId],
        )
      ).rows[0];
      if (!org) {
        org = (
          await tx.query(
            "INSERT INTO organizations(tenant_id,name,kind,daily_limit) VALUES($1,$2,'contractor',10) RETURNING id",
            [targetTenantId, tenant.name],
          )
        ).rows[0];
      }

      await tx.query("UPDATE users SET tenant_id=$1,org_id=$2 WHERE id=$3", [
        targetTenantId,
        org.id,
        user.id,
      ]);

      return { ok: true, tenant_id: targetTenantId, org_id: org.id };
    });
  }
}

@Controller("admin/tenants")
@UseGuards(AdminGuard)
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.service.save(undefined, body, req.user);
  }

  @Post(":id")
  @HttpCode(200)
  update(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    return this.service.save(id, body, req.user);
  }

  @Post(":id/switch")
  @HttpCode(200)
  switchTenant(@Param("id") id: string, @Req() req: any) {
    return this.service.switchTenant(id, req.user);
  }
}

@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
