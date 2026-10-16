import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { fail, text, choice, userSql } from "../common/domain.js";
import { str, integer, option, email, audit } from "../common/admin-domain.js";
import { hashPassword } from "../auth.js";
import { supportFlows } from '../../shared/support-flow.js';

@Injectable()
export class OrganizationsService {
  constructor(private readonly database: DatabaseService) {}
  async list(user?: any): Promise<any> {
    const db = this.database;
    const tenantId = user?.tenant_id || 1;
    const rows = (
      await db.query(
        `SELECT o.*,d.name dealer_name,(SELECT count(*)::int FROM users u WHERE u.org_id=o.id AND u.deleted_at IS NULL) user_count FROM organizations o LEFT JOIN organizations d ON d.id=o.dealer_id WHERE o.tenant_id=$1 ORDER BY o.id`,
        [tenantId],
      )
    ).rows;
    const contractors = rows.filter(o => o.kind === 'contractor');
    const legacyContractor = contractors.find(o => ['bekatos', 'takipsan'].includes(o.name.toLowerCase())) || (contractors.length === 1 ? contractors[0] : contractors[0]);
    return rows.map(o => ({ ...o, support_chain: o.kind !== 'customer' ? null : o.support_chain || (
      o.support_flow === 'contractor_only' ? [legacyContractor?.id] : o.support_flow === 'contractor_first' ? [legacyContractor?.id, o.dealer_id] : [o.dealer_id, legacyContractor?.id]
    ).filter(Boolean) }));
  }
  async save(routeId: string | undefined, body: any, user: any): Promise<any> {
    const db = this.database;
    const tenantId = user?.tenant_id || 1;
    const b = body,
      name = str(b.name),
      id = routeId ? integer(routeId) : null;
    const result = await db.transaction(async (tx) => {
      const old = id
        ? (
            await tx.query(
              "SELECT * FROM organizations WHERE id=$1 AND tenant_id=$2 FOR UPDATE",
              [id, tenantId],
            )
          ).rows[0]
        : null;
      if (id && !old) fail(404, "company_not_found");
      const kind =
        old?.kind || option(b.kind, ["customer", "dealer", "contractor", "support"]);
      if (old && b.kind && b.kind !== old.kind)
        fail(400, "the_company_type_cannot_be_changed");
      const chain = kind === 'customer' ? b.support_chain ?? old?.support_chain ?? null : null;
      if (chain !== null) {
        if (!Array.isArray(chain) || !chain.length || chain.some(v => !Number.isSafeInteger(v) || v <= 0) || new Set(chain).size !== chain.length)
          fail(400, 'support_chain_invalid');
        const valid = (await tx.query("SELECT id FROM organizations WHERE id=ANY($1::integer[]) AND tenant_id=$2 AND kind IN ('support','dealer','contractor')", [chain, tenantId])).rows;
        if (valid.length !== chain.length) fail(400, 'support_chain_invalid');
      }
      if (kind === 'customer' && !old && chain === null && b.support_flow === undefined && b.dealer_id === undefined)
        fail(400, 'support_chain_required');
      const flow = kind === 'customer' ? option(b.support_flow ?? old?.support_flow ?? 'dealer_first', supportFlows) : 'dealer_first';
      const dealer = chain ? old?.dealer_id ?? null : kind === "customer" && flow !== 'contractor_only' ? integer(b.dealer_id) : null,
        legacyProgram = kind === "customer" && b.product_id === undefined ? str(b.program ?? old?.program) : null,
        limit = kind === "customer" ? integer(b.daily_limit) : 10;
      const product = kind === 'customer' ? (await tx.query(
        b.product_id !== undefined ? 'SELECT * FROM products WHERE id=$1 AND tenant_id=$2' : 'SELECT * FROM products WHERE lower(btrim(name))=lower(btrim($1)) AND tenant_id=$2',
        [b.product_id !== undefined ? integer(b.product_id) : legacyProgram, tenantId],
      )).rows[0] : null;
      if (kind === 'customer' && !product) fail(400,'select_valid_product');
      const program = product?.name ?? null;
      if (limit > 10000) fail(400, "the_daily_limit_cannot_exceed_10000");
      if (
        dealer &&
        !(
          await tx.query(
            "SELECT id FROM organizations WHERE id=$1 AND tenant_id=$2 AND kind='dealer'",
            [dealer, tenantId],
          )
        ).rows.length
      )
        fail(400, "select_a_valid_dealer");
      if (
        (
          await tx.query(
            "SELECT id FROM organizations WHERE tenant_id=$1 AND lower(name)=lower($2) AND id<>$3",
            [tenantId, name, id || 0],
          )
        ).rows.length
      )
        fail(409, "this_company_name_is_already_in_use");
      const row = (
        await tx.query(
          id
            ? "UPDATE organizations SET name=$1,kind=$2,dealer_id=$3,program=$4,daily_limit=$5,support_flow=$6 WHERE id=$7 AND tenant_id=$8 RETURNING *"
            : "INSERT INTO organizations(tenant_id,name,kind,dealer_id,program,daily_limit,support_flow) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
          id
            ? [name, kind, dealer, program, limit, flow, id, tenantId]
            : [tenantId, name, kind, dealer, program, limit, flow],
        )
      ).rows[0];
      await audit(
        tx,
        user,
        id ? "organization_updated" : "organization_created",
        row.id,
        { name, kind, dealer_id: dealer, daily_limit: limit, support_flow: flow, support_chain: chain, product_id: product?.id ?? null },
      );
      await tx.query('UPDATE organizations SET support_chain=$1,product_id=$2 WHERE id=$3', [chain, product?.id ?? null, row.id]);
      return { ...row, support_chain: chain, product_id: product?.id ?? null };
    });
    return result;
  }
}
