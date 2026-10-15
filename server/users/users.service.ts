import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { fail, text, choice, userSql } from "../common/domain.js";
import { str, integer, option, email, audit } from "../common/admin-domain.js";
import { hashPassword } from "../auth.js";

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}
  async list(): Promise<any> {
    const db = this.database;
    return (
      await db.query(
        "SELECT u.id,u.name,u.email,u.org_id,u.system_role,u.active,o.name org_name,o.kind org_kind FROM users u JOIN organizations o ON o.id=u.org_id WHERE u.deleted_at IS NULL ORDER BY u.id",
      )
    ).rows;
  }
  async save(routeId: string | undefined, body: any, user: any): Promise<any> {
    const db = this.database;
    const b = body,
      id = routeId ? integer(routeId) : null,
      name = str(b.name),
      address = email(b.email),
      role = option(b.system_role, ["member", "super_admin"]);
    if (typeof b.active !== "boolean") fail(400, "account_status_is_required");
    const password = b.password ? str(b.password, 8, 200) : null;
    if (!id && !password)
      fail(400, "a_password_of_at_least_8_characters_is_required");
    const result = await db.transaction(async (tx) => {
      await tx.query("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
      const actor = (
        await tx.query("SELECT * FROM users WHERE id=$1", [user.id])
      ).rows[0];
      if (!actor.active || actor.system_role !== "super_admin")
        fail(403, "your_admin_permissions_have_changed");
      const old = id
        ? (await tx.query("SELECT * FROM users WHERE id=$1", [id])).rows[0]
        : null;
      if (id && (!old || old.deleted_at)) fail(404, "user_not_found");
      if (id === user.id && (!b.active || role !== "super_admin"))
        fail(400, "you_cannot_remove_your_own_super_admin_role_or");
      const org = integer(b.org_id);
      if (old && old.org_id !== org)
        fail(400, "to_preserve_historical_records_a_user_s_company_cannot");
      if (
        !(await tx.query("SELECT id FROM organizations WHERE id=$1", [org]))
          .rows.length
      )
        fail(400, "company_not_found");
      if (
        (
          await tx.query("SELECT id FROM users WHERE email=$1 AND id<>$2", [
            address,
            id || 0,
          ])
        ).rows.length
      )
        fail(409, "this_email_address_is_already_in_use");
      const hash = password ? hashPassword(password) : old.password_hash;
      const row = (
        await tx.query(
          id
            ? "UPDATE users SET name=$1,email=$2,org_id=$3,password_hash=$4,system_role=$5,active=$6 WHERE id=$7 RETURNING id,name,email,org_id,system_role,active"
            : "INSERT INTO users(name,email,org_id,password_hash,system_role,active) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,email,org_id,system_role,active",
          id
            ? [name, address, org, hash, role, b.active, id]
            : [name, address, org, hash, role, b.active],
        )
      ).rows[0];
      if (id && (password || !b.active || old.system_role !== role))
        await tx.query("DELETE FROM sessions WHERE user_id=$1", [id]);
      await audit(tx, user, id ? "user_updated" : "user_created", row.id, {
        name,
        email: address,
        org_id: org,
        system_role: role,
        active: b.active,
        password_changed: !!password,
      });
      return row;
    });
    return result;
  }
  async remove(routeId: string, user: any) {
    const id = integer(routeId);
    return this.database.transaction(async tx => {
      await tx.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const actor = (await tx.query('SELECT * FROM users WHERE id=$1', [user.id])).rows[0];
      if (!actor?.active || actor.deleted_at || actor.system_role !== 'super_admin')
        fail(403, 'your_admin_permissions_have_changed');
      if (id === user.id) fail(400, 'cannot_delete_own_account');
      const target = (await tx.query('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL', [id])).rows[0];
      if (!target) fail(404, 'user_not_found');
      await tx.query('UPDATE users SET active=false,deleted_at=now() WHERE id=$1', [id]);
      await tx.query('DELETE FROM sessions WHERE user_id=$1', [id]);
      await audit(tx, user, 'user_deleted', id, { name: target.name, email: target.email, org_id: target.org_id });
      return { ok: true };
    });
  }
}
