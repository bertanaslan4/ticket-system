import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { fail, text, choice, userSql } from "../common/domain.js";
import { integer, option } from "../common/admin-domain.js";

@Injectable()
export class ReportsService {
  constructor(private readonly database: DatabaseService) {}
  async list(query: any, user?: any): Promise<any> {
    const db = this.database;
    const tenantId = user?.tenant_id || 1;
    const clauses = [],
      params = [];
    const add = (sql, v) => {
      params.push(v);
      clauses.push(sql.replace("?", `$${params.length}`));
    };
    add("t.tenant_id=?", tenantId);
    for (const key of ["from", "to"])
      if (query[key]) {
        const v = String(query[key]);
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          !Number.isFinite(Date.parse(v)) ||
          new Date(v).toISOString().slice(0, 10) !== v
        )
          fail(400, "invalid_date");
        add(
          `(t.created_at AT TIME ZONE 'Europe/Istanbul')::date ${key === "from" ? ">=" : "<="} ?::date`,
          v,
        );
      }
    if (query.from && query.to && query.from > query.to)
      fail(400, "the_start_date_cannot_be_after_the_end_date");
    for (const key of ["customer_id", "dealer_id", "owner_org_id", "product_id"])
      if (query[key]) add(`t.${key}=?`, integer(query[key]));
    if (query.support_org_id) {
      params.push(integer(query.support_org_id));
      const value = `$${params.length}`;
      clauses.push(`(${value}=ANY(t.support_chain) OR (t.support_chain IS NULL AND (t.dealer_id=${value} OR t.contractor_id=${value})))`);
    }
    for (const [key, values] of [
      ["status", ["open", "in_progress", "review", "closed"]],
      ["severity", ["s1", "s2", "s3"]],
      ["type", ["Hata", "İstek"]],
    ] as [string, string[]][])
      if (query[key]) add(`t.${key}=?`, option(query[key], values));
    const rows = (
      await db.query(
        `SELECT t.id,t.product_id,t.title,t.type,t.status,t.severity,t.program,t.created_at,t.updated_at,c.name customer_name,COALESCE(d.name,'—') dealer_name,o.name owner_name,u.name assignee_name,closed.closed_at,EXTRACT(EPOCH FROM (closed.closed_at-t.created_at))/3600 resolution_hours FROM tickets t JOIN organizations c ON c.id=t.customer_id LEFT JOIN organizations d ON d.id=COALESCE(t.support_chain[1],t.dealer_id) JOIN organizations o ON o.id=t.owner_org_id LEFT JOIN users u ON u.id=t.assignee_id LEFT JOIN LATERAL (SELECT max(created_at) closed_at FROM events WHERE ticket_id=t.id AND kind='closed') closed ON true ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY t.created_at DESC,t.id DESC`,
        params,
      )
    ).rows;
    const products = (await db.query('SELECT id,name FROM products WHERE tenant_id=$1 ORDER BY name,id', [tenantId])).rows;
    const byProduct = products.filter(p => !query.product_id || p.id === Number(query.product_id)).map(p => {
      const matching = rows.filter(r => r.product_id === p.id);
      return {id:p.id,name:p.name,count:matching.length,open:matching.filter(r => r.status !== 'closed').length,closed:matching.filter(r => r.status === 'closed').length};
    });
    const group = (key) =>
      Object.entries(
        rows.reduce((acc, r) => {
          acc[r[key]] = (acc[r[key]] || 0) + 1;
          return acc;
        }, {}),
      ).map(([name, count]) => ({ name, count }));
    const resolved = rows.filter(
      (r) => r.status === "closed" && r.resolution_hours !== null,
    );
    return {
      rows,
      total: rows.length,
      open: rows.filter((r) => r.status !== "closed").length,
      closed: rows.filter((r) => r.status === "closed").length,
      averageResolutionHours: resolved.length
        ? resolved.reduce((n, r) => n + Number(r.resolution_hours), 0) /
          resolved.length
        : null,
      byStatus: group("status"),
      bySeverity: group("severity"),
      byCustomer: group("customer_name"),
      byDealer: group("dealer_name"),
      byProduct,
    };
  }
}
