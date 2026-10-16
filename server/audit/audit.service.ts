import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { fail, text, choice, userSql } from "../common/domain.js";

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}
  async list(user?: any): Promise<any> {
    const db = this.database;
    const tenantId = user?.tenant_id || 1;
    return (
      await db.query(
        "SELECT a.*,u.name actor_name FROM admin_audit a JOIN users u ON u.id=a.actor_id WHERE a.tenant_id=$1 ORDER BY a.id DESC LIMIT 100",
        [tenantId],
      )
    ).rows;
  }
}
