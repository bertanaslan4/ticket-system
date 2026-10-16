import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { fail, text, choice } from "../common/domain.js";

const VALID_STATUSES = ["backlog", "todo", "in_progress", "review", "done"];
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

@Injectable()
export class TasksService {
  constructor(private readonly db: DatabaseService) {}

  private ensureStaff(user: any) {
    if (user.role === "customer") {
      fail(403, "customer_cannot_access_internal_tasks");
    }
  }

  async list(user: any, query: {
    status?: string;
    priority?: string;
    assignee_id?: string;
    ticket_id?: string;
    search?: string;
  }) {
    this.ensureStaff(user);
    const tenantId = user.tenant_id || 1;

    let sql = `
      SELECT 
        tsk.id,
        tsk.tenant_id,
        tsk.ticket_id,
        tsk.task_number,
        tsk.title,
        tsk.description,
        tsk.status,
        tsk.priority,
        tsk.assignee_id,
        tsk.reporter_id,
        tsk.estimated_minutes,
        tsk.due_date,
        tsk.created_at,
        tsk.updated_at,
        u_assignee.name AS assignee_name,
        u_assignee.email AS assignee_email,
        u_reporter.name AS reporter_name,
        tick.title AS ticket_title,
        COALESCE((SELECT SUM(minutes_spent) FROM task_worklogs WHERE task_id = tsk.id), 0)::int AS total_logged_minutes
      FROM tasks tsk
      LEFT JOIN users u_assignee ON u_assignee.id = tsk.assignee_id
      LEFT JOIN users u_reporter ON u_reporter.id = tsk.reporter_id
      LEFT JOIN tickets tick ON tick.id = tsk.ticket_id
      WHERE tsk.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (query.status && VALID_STATUSES.includes(query.status)) {
      params.push(query.status);
      sql += ` AND tsk.status = $${params.length}`;
    }

    if (query.priority && VALID_PRIORITIES.includes(query.priority)) {
      params.push(query.priority);
      sql += ` AND tsk.priority = $${params.length}`;
    }

    if (query.assignee_id) {
      const assigneeId = Number(query.assignee_id);
      if (Number.isSafeInteger(assigneeId)) {
        params.push(assigneeId);
        sql += ` AND tsk.assignee_id = $${params.length}`;
      }
    }

    if (query.ticket_id) {
      const ticketId = Number(query.ticket_id);
      if (Number.isSafeInteger(ticketId)) {
        params.push(ticketId);
        sql += ` AND tsk.ticket_id = $${params.length}`;
      }
    }

    if (query.search && query.search.trim()) {
      params.push(`%${query.search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(tsk.title) LIKE $${params.length} OR LOWER(tsk.task_number) LIKE $${params.length} OR LOWER(tsk.description) LIKE $${params.length})`;
    }

    sql += " ORDER BY tsk.updated_at DESC, tsk.id DESC";

    const rows = (await this.db.query(sql, params)).rows;
    return rows;
  }

  async getOne(user: any, idParam: string | number) {
    this.ensureStaff(user);
    const tenantId = user.tenant_id || 1;
    const id = Number(idParam);
    if (!Number.isSafeInteger(id) || id <= 0) fail(404, "task_not_found");

    const sql = `
      SELECT 
        tsk.*,
        u_assignee.name AS assignee_name,
        u_assignee.email AS assignee_email,
        u_reporter.name AS reporter_name,
        tick.title AS ticket_title,
        COALESCE((SELECT SUM(minutes_spent) FROM task_worklogs WHERE task_id = tsk.id), 0)::int AS total_logged_minutes
      FROM tasks tsk
      LEFT JOIN users u_assignee ON u_assignee.id = tsk.assignee_id
      LEFT JOIN users u_reporter ON u_reporter.id = tsk.reporter_id
      LEFT JOIN tickets tick ON tick.id = tsk.ticket_id
      WHERE tsk.id = $1 AND tsk.tenant_id = $2
    `;
    const task = (await this.db.query(sql, [id, tenantId])).rows[0];
    if (!task) fail(404, "task_not_found");

    const worklogs = (
      await this.db.query(
        `SELECT w.*, u.name AS user_name 
         FROM task_worklogs w 
         JOIN users u ON u.id = w.user_id 
         WHERE w.task_id = $1 
         ORDER BY w.id DESC`,
        [id],
      )
    ).rows;

    return { ...task, worklogs };
  }

  async create(user: any, body: any) {
    this.ensureStaff(user);
    const tenantId = user.tenant_id || 1;
    const title = text(body.title, 3, 255);
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const priority = body.priority ? choice(body.priority, VALID_PRIORITIES) : "medium";
    const status = body.status ? choice(body.status, VALID_STATUSES) : "todo";

    let ticketId: number | null = null;
    if (body.ticket_id) {
      const tid = Number(body.ticket_id);
      if (Number.isSafeInteger(tid) && tid > 0) {
        const ticket = (
          await this.db.query("SELECT id FROM tickets WHERE id = $1", [tid])
        ).rows[0];
        if (ticket) ticketId = tid;
      }
    }

    let assigneeId: number | null = null;
    if (body.assignee_id) {
      const aid = Number(body.assignee_id);
      if (Number.isSafeInteger(aid) && aid > 0) {
        const assignee = (
          await this.db.query(
            "SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND active = true AND deleted_at IS NULL",
            [aid, tenantId],
          )
        ).rows[0];
        if (assignee) assigneeId = aid;
      }
    }

    const estimatedMinutes = Math.max(0, Number(body.estimated_minutes) || 0);
    const dueDate = body.due_date ? new Date(body.due_date) : null;

    // Generate task number e.g. TSK-1001
    const nextSeqRes = await this.db.query(
      "SELECT COALESCE(MAX(id), 0) + 1001 AS next_seq FROM tasks",
    );
    const taskNumber = `TSK-${nextSeqRes.rows[0].next_seq}`;

    const insertRes = await this.db.query(
      `INSERT INTO tasks (
        tenant_id, ticket_id, task_number, title, description,
        status, priority, assignee_id, reporter_id,
        estimated_minutes, due_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
      RETURNING *`,
      [
        tenantId,
        ticketId,
        taskNumber,
        title,
        description,
        status,
        priority,
        assigneeId,
        user.id,
        estimatedMinutes,
        dueDate,
      ],
    );

    return this.getOne(user, insertRes.rows[0].id);
  }

  async update(user: any, idParam: string | number, body: any) {
    this.ensureStaff(user);
    const tenantId = user.tenant_id || 1;
    const id = Number(idParam);
    if (!Number.isSafeInteger(id) || id <= 0) fail(404, "task_not_found");

    const existing = (
      await this.db.query("SELECT * FROM tasks WHERE id = $1 AND tenant_id = $2", [
        id,
        tenantId,
      ])
    ).rows[0];
    if (!existing) fail(404, "task_not_found");

    const updates: string[] = ["updated_at = now()"];
    const params: any[] = [id, tenantId];

    if (body.title !== undefined) {
      params.push(text(body.title, 3, 255));
      updates.push(`title = $${params.length}`);
    }

    if (body.description !== undefined) {
      params.push(typeof body.description === "string" ? body.description.trim() : "");
      updates.push(`description = $${params.length}`);
    }

    if (body.priority !== undefined) {
      params.push(choice(body.priority, VALID_PRIORITIES));
      updates.push(`priority = $${params.length}`);
    }

    if (body.status !== undefined) {
      params.push(choice(body.status, VALID_STATUSES));
      updates.push(`status = $${params.length}`);
    }

    if (body.assignee_id !== undefined) {
      const aid = body.assignee_id ? Number(body.assignee_id) : null;
      params.push(aid);
      updates.push(`assignee_id = $${params.length}`);
    }

    if (body.ticket_id !== undefined) {
      const tid = body.ticket_id ? Number(body.ticket_id) : null;
      params.push(tid);
      updates.push(`ticket_id = $${params.length}`);
    }

    if (body.estimated_minutes !== undefined) {
      params.push(Math.max(0, Number(body.estimated_minutes) || 0));
      updates.push(`estimated_minutes = $${params.length}`);
    }

    if (body.due_date !== undefined) {
      params.push(body.due_date ? new Date(body.due_date) : null);
      updates.push(`due_date = $${params.length}`);
    }

    await this.db.query(
      `UPDATE tasks SET ${updates.join(", ")} WHERE id = $1 AND tenant_id = $2`,
      params,
    );

    return this.getOne(user, id);
  }

  async updateStatus(user: any, idParam: string | number, status: string) {
    this.ensureStaff(user);
    choice(status, VALID_STATUSES);
    return this.update(user, idParam, { status });
  }

  async delete(user: any, idParam: string | number) {
    this.ensureStaff(user);
    const tenantId = user.tenant_id || 1;
    const id = Number(idParam);
    if (!Number.isSafeInteger(id) || id <= 0) fail(404, "task_not_found");

    const res = await this.db.query(
      "DELETE FROM tasks WHERE id = $1 AND tenant_id = $2 RETURNING id",
      [id, tenantId],
    );
    if (!res.rows.length) fail(404, "task_not_found");
    return { ok: true, id };
  }

  async addWorklog(user: any, idParam: string | number, body: any) {
    this.ensureStaff(user);
    const tenantId = user.tenant_id || 1;
    const id = Number(idParam);
    if (!Number.isSafeInteger(id) || id <= 0) fail(404, "task_not_found");

    const task = (
      await this.db.query("SELECT id FROM tasks WHERE id = $1 AND tenant_id = $2", [
        id,
        tenantId,
      ])
    ).rows[0];
    if (!task) fail(404, "task_not_found");

    const minutesSpent = Number(body.minutes_spent);
    if (!Number.isSafeInteger(minutesSpent) || minutesSpent <= 0) {
      fail(400, "invalid_minutes_spent");
    }

    const description = typeof body.description === "string" ? body.description.trim() : "";

    const res = await this.db.query(
      `INSERT INTO task_worklogs (task_id, user_id, minutes_spent, description, created_at)
       VALUES ($1, $2, $3, $4, now()) RETURNING *`,
      [id, user.id, minutesSpent, description],
    );

    await this.db.query("UPDATE tasks SET updated_at = now() WHERE id = $1", [id]);

    return { ...res.rows[0], user_name: user.name };
  }
}
