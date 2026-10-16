import { Controller, Get, Req } from "@nestjs/common";
import { Public } from "./auth/public.decorator.js";
import { DatabaseService } from "./database/database.service.js";
import { fail } from "./common/domain.js";

@Controller()
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get("health")
  async health(@Req() req: any) {
    const detailed =
      req.query?.detailed === "1" ||
      req.query?.detailed === "true" ||
      req.query?.full === "1";

    if (!detailed) {
      return { ok: true };
    }

    const t0 = Date.now();
    await this.db.query("SELECT 1");
    const latencyMs = Date.now() - t0;
    const mem = process.memoryUsage();

    return {
      ok: true,
      status: "healthy",
      version: "1.0.0",
      db: "connected",
      latency_ms: latencyMs,
      uptime_seconds: Math.floor(process.uptime()),
      memory_rss_mb: Math.round(mem.rss / (1024 * 1024)),
      memory_heap_used_mb: Math.round(mem.heapUsed / (1024 * 1024)),
      timestamp: new Date().toISOString(),
    };
  }

  @Get("admin/operations/metrics")
  async getMetrics(@Req() req: any) {
    if (req.user?.role !== "super_admin") {
      fail(403, "this_area_is_restricted_to_super_admins");
    }

    const tenantId = req.user?.tenant_id || 1;

    const [ticketsRow, orgsRow, usersRow, outboxRow, storageRow] = await Promise.all([
      this.db.query(
        "SELECT count(*)::int as total, count(CASE WHEN status='open' THEN 1 END)::int as open_count, count(CASE WHEN status='closed' THEN 1 END)::int as closed_count FROM tickets WHERE tenant_id=$1",
        [tenantId],
      ),
      this.db.query(
        "SELECT count(*)::int as total FROM organizations WHERE tenant_id=$1",
        [tenantId],
      ),
      this.db.query(
        "SELECT count(*)::int as total, count(CASE WHEN active=true THEN 1 END)::int as active_count FROM users WHERE tenant_id=$1 AND deleted_at IS NULL",
        [tenantId],
      ),
      this.db.query(
        "SELECT count(CASE WHEN status='pending' THEN 1 END)::int as pending_mail, count(CASE WHEN status='failed' THEN 1 END)::int as failed_mail FROM auth_mail_outbox",
      ),
      this.db.query(
        "SELECT COALESCE(SUM(size), 0)::bigint as total_bytes FROM attachments a JOIN tickets t ON t.id=a.ticket_id WHERE t.tenant_id=$1",
        [tenantId],
      ),
    ]);

    return {
      ok: true,
      tenant_id: tenantId,
      tickets: ticketsRow.rows[0],
      organizations: orgsRow.rows[0],
      users: usersRow.rows[0],
      outbox: outboxRow.rows[0],
      storage_bytes: Number(storageRow.rows[0]?.total_bytes || 0),
    };
  }
}

