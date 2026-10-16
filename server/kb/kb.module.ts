import {
  Module,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  Injectable,
} from "@nestjs/common";
import { Public } from "../auth/public.decorator.js";
import { DatabaseService } from "../database/database.service.js";
import { str, option, email, audit } from "../common/admin-domain.js";
import { fail, applyTicketSlaTargets } from "../common/domain.js";

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "makale";
}

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly db: DatabaseService) {}

  async list(user: any, q?: string, category?: string) {
    const tenantId = user?.tenant_id || 1;
    const isSuperAdmin = user?.role === "super_admin";

    let query = "SELECT id, tenant_id, title, slug, category, is_public, view_count, created_at, updated_at FROM knowledge_base WHERE tenant_id = $1";
    const params: any[] = [tenantId];

    if (!isSuperAdmin) {
      query += " AND is_public = true";
    }

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    if (q && q.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`);
      query += ` AND (LOWER(title) LIKE $${params.length} OR LOWER(content) LIKE $${params.length})`;
    }

    query += " ORDER BY view_count DESC, id DESC LIMIT 50";

    const rows = (await this.db.query(query, params)).rows;
    return rows;
  }

  async getOne(idStr: string, user: any) {
    const tenantId = user?.tenant_id || 1;
    const id = Number(idStr);
    if (!Number.isSafeInteger(id) || id <= 0) fail(404, "article_not_found");

    const article = (
      await this.db.query(
        "SELECT * FROM knowledge_base WHERE id = $1 AND tenant_id = $2",
        [id, tenantId],
      )
    ).rows[0];

    if (!article) fail(404, "article_not_found");
    if (!article.is_public && user?.role !== "super_admin") {
      fail(403, "access_denied");
    }

    // Atomically increment view count
    await this.db.query(
      "UPDATE knowledge_base SET view_count = view_count + 1 WHERE id = $1",
      [id],
    );
    article.view_count += 1;

    return article;
  }

  async create(user: any, body: any) {
    if (user.role !== "super_admin")
      fail(403, "this_area_is_restricted_to_super_admins");

    const tenantId = user.tenant_id || 1;
    const title = str(body.title, 2, 255);
    const content = str(body.content, 5, 50000);
    const category = body.category ? str(body.category, 2, 64) : "general";
    const isPublic = body.is_public !== false;
    const slug = `${slugify(title)}-${Date.now().toString(36)}`;

    const row = (
      await this.db.query(
        `INSERT INTO knowledge_base(tenant_id, title, slug, content, category, is_public)
         VALUES($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [tenantId, title, slug, content, category, isPublic],
      )
    ).rows[0];

    await audit(this.db, user, "article_created", tenantId, {
      name: title,
      category,
    });

    return row;
  }

  async update(idStr: string, user: any, body: any) {
    if (user.role !== "super_admin")
      fail(403, "this_area_is_restricted_to_super_admins");

    const tenantId = user.tenant_id || 1;
    const id = Number(idStr);
    if (!Number.isSafeInteger(id) || id <= 0) fail(404, "article_not_found");

    const title = str(body.title, 2, 255);
    const content = str(body.content, 5, 50000);
    const category = body.category ? str(body.category, 2, 64) : "general";
    const isPublic = body.is_public !== false;

    const row = (
      await this.db.query(
        `UPDATE knowledge_base
         SET title = $1, content = $2, category = $3, is_public = $4, updated_at = now()
         WHERE id = $5 AND tenant_id = $6
         RETURNING *`,
        [title, content, category, isPublic, id, tenantId],
      )
    ).rows[0];

    if (!row) fail(404, "article_not_found");

    await audit(this.db, user, "article_updated", tenantId, {
      name: title,
    });

    return row;
  }

  async delete(idStr: string, user: any) {
    if (user.role !== "super_admin")
      fail(403, "this_area_is_restricted_to_super_admins");

    const tenantId = user.tenant_id || 1;
    const id = Number(idStr);
    if (!Number.isSafeInteger(id) || id <= 0) fail(404, "article_not_found");

    const existing = (
      await this.db.query(
        "DELETE FROM knowledge_base WHERE id = $1 AND tenant_id = $2 RETURNING title",
        [id, tenantId],
      )
    ).rows[0];

    if (!existing) fail(404, "article_not_found");

    await audit(this.db, user, "article_deleted", tenantId, {
      name: existing.title,
    });

    return { ok: true };
  }
}

@Injectable()
export class OnboardingService {
  constructor(private readonly db: DatabaseService) {}

  async getProgress(user: any) {
    const tenantId = user?.tenant_id || 1;
    const tenant = (
      await this.db.query("SELECT * FROM tenants WHERE id=$1", [tenantId])
    ).rows[0];
    if (!tenant) fail(404, "tenant_not_found");

    const customerOrgsCount = Number(
      (
        await this.db.query(
          "SELECT count(*) FROM organizations WHERE tenant_id=$1 AND kind='customer'",
          [tenantId],
        )
      ).rows[0].count,
    );

    const productsCount = Number(
      (
        await this.db.query(
          "SELECT count(*) FROM products WHERE tenant_id=$1",
          [tenantId],
        )
      ).rows[0].count,
    );

    const ticketsCount = Number(
      (
        await this.db.query(
          "SELECT count(*) FROM tickets WHERE tenant_id=$1",
          [tenantId],
        )
      ).rows[0].count,
    );

    const slaPoliciesCount = Number(
      (
        await this.db.query(
          "SELECT count(*) FROM sla_policies WHERE tenant_id=$1",
          [tenantId],
        )
      ).rows[0].count,
    );

    const steps = [
      {
        id: "invite_customer",
        title_key: "onboarding_step_invite_customer",
        completed: customerOrgsCount > 1, // first one is default portal, >1 means invited customer
        hint_key: "onboarding_step_invite_customer_hint",
      },
      {
        id: "setup_product",
        title_key: "onboarding_step_setup_product",
        completed: productsCount >= 1,
        hint_key: "onboarding_step_setup_product_hint",
      },
      {
        id: "create_ticket",
        title_key: "onboarding_step_create_ticket",
        completed: ticketsCount >= 1,
        hint_key: "onboarding_step_create_ticket_hint",
      },
      {
        id: "configure_sla",
        title_key: "onboarding_step_configure_sla",
        completed: slaPoliciesCount >= 1,
        hint_key: "onboarding_step_configure_sla_hint",
      },
    ];

    const completedCount = steps.filter((s) => s.completed).length;

    return {
      dismissed: Boolean(tenant.onboarding_dismissed),
      completed_count: completedCount,
      total_steps: steps.length,
      is_all_completed: completedCount === steps.length,
      steps,
    };
  }

  async dismiss(user: any) {
    const tenantId = user?.tenant_id || 1;
    await this.db.query(
      "UPDATE tenants SET onboarding_dismissed = true WHERE id = $1",
      [tenantId],
    );
    return { ok: true };
  }
}

@Injectable()
export class InboundEmailService {
  constructor(private readonly db: DatabaseService) {}

  async handleInboundEmail(body: any) {
    const senderEmail = email(body.from || body.sender || "");
    const subject = str(body.subject || body.title || "E-posta Destek Talebi", 2, 200);
    const content = str(body.body || body.text || body.content || "Detay belirtilmedi.", 1, 50000);
    const toAddress = String(body.to || body.recipient || "");

    // Resolve tenant: by explicit slug, or by recipient like destek+slug@domain.com
    let tenantSlug = body.tenant_slug ? str(body.tenant_slug, 2, 64) : null;
    if (!tenantSlug && toAddress.includes("+")) {
      const match = toAddress.match(/\+([a-z0-9-]+)@/i);
      if (match) tenantSlug = match[1].toLowerCase();
    }

    return this.db.transaction(async (tx) => {
      let tenant = null;
      if (tenantSlug) {
        tenant = (
          await tx.query("SELECT * FROM tenants WHERE lower(slug)=$1", [
            tenantSlug.toLowerCase(),
          ])
        ).rows[0];
      }
      if (!tenant) {
        tenant = (await tx.query("SELECT * FROM tenants ORDER BY id ASC LIMIT 1")).rows[0];
      }
      if (!tenant) fail(404, "tenant_not_found");

      const tenantId = tenant.id;

      // Find or provision customer user
      let user = (
        await tx.query(
          "SELECT u.*, o.kind as org_kind FROM users u JOIN organizations o ON o.id=u.org_id WHERE lower(u.email)=lower($1) AND u.tenant_id=$2",
          [senderEmail, tenantId],
        )
      ).rows[0];

      let customerOrg = null;
      if (!user) {
        // Find default customer org in tenant
        customerOrg = (
          await tx.query(
            "SELECT * FROM organizations WHERE tenant_id=$1 AND kind='customer' ORDER BY id ASC LIMIT 1",
            [tenantId],
          )
        ).rows[0];

        if (!customerOrg) {
          customerOrg = (
            await tx.query(
              "INSERT INTO organizations(tenant_id, name, kind, daily_limit) VALUES($1, 'E-posta Müşterileri', 'customer', 25) RETURNING *",
              [tenantId],
            )
          ).rows[0];
        }

        user = (
          await tx.query(
            "INSERT INTO users(tenant_id, org_id, name, email, password_hash, system_role, active) VALUES($1, $2, $3, $4, 'no_login_inbound', 'member', true) RETURNING *",
            [tenantId, customerOrg.id, senderEmail.split("@")[0], senderEmail],
          )
        ).rows[0];
      } else {
        customerOrg = (
          await tx.query("SELECT * FROM organizations WHERE id=$1", [user.org_id])
        ).rows[0];
      }

      // Find support org or contractor
      let supportOrg = (
        await tx.query(
          "SELECT * FROM organizations WHERE tenant_id=$1 AND kind IN ('contractor','support','dealer') ORDER BY CASE WHEN kind='contractor' THEN 1 WHEN kind='support' THEN 2 ELSE 3 END, id ASC LIMIT 1",
          [tenantId],
        )
      ).rows[0];

      const ownerId = (customerOrg.support_chain && customerOrg.support_chain[0])
        || (supportOrg ? supportOrg.id : customerOrg.id);
      const chain = customerOrg.support_chain?.length
        ? customerOrg.support_chain
        : supportOrg ? [supportOrg.id] : [customerOrg.id];

      // Find primary product
      const product = (
        await tx.query(
          "SELECT * FROM products WHERE tenant_id=$1 ORDER BY id ASC LIMIT 1",
          [tenantId],
        )
      ).rows[0];
      const productName = product?.name || "Genel Destek";

      // Insert ticket
      const ticket = (
        await tx.query(
          `INSERT INTO tickets(
             tenant_id,
             customer_id,
             created_by,
             program,
             title,
             description,
             type,
             severity,
             status,
             owner_org_id,
             support_chain,
             visible_support_org_ids
           )
           VALUES($1, $2, $3, $4, $5, $6, 'Hata', 's2', 'open', $7, $8, $9)
           RETURNING *`,
          [
            tenantId,
            customerOrg.id,
            user.id,
            productName,
            subject,
            content,
            ownerId,
            chain,
            [ownerId],
          ],
        )
      ).rows[0];

      if (product?.id) {
        await tx.query("UPDATE tickets SET product_id=$1 WHERE id=$2", [product.id, ticket.id]);
        ticket.product_id = product.id;
      }

      await applyTicketSlaTargets(tx, ticket);

      // Add initial event
      await tx.query(
        "INSERT INTO events(ticket_id, actor_id, kind, visibility, body) VALUES($1, $2, 'comment', 'public', $3)",
        [ticket.id, user.id, `E-posta üzerinden alındı: ${content}`],
      );

      return {
        ok: true,
        ticket_id: ticket.id,
        tenant_id: tenantId,
        user_id: user.id,
      };
    });
  }
}

@Controller()
export class KnowledgeBaseController {
  constructor(
    private readonly kbService: KnowledgeBaseService,
    private readonly onboardingService: OnboardingService,
    private readonly inboundService: InboundEmailService,
  ) {}

  @Get("kb")
  listArticles(
    @Req() req: any,
    @Query("q") q?: string,
    @Query("category") cat?: string,
  ) {
    return this.kbService.list(req.user, q, cat);
  }

  @Get("kb/:id")
  getArticle(@Param("id") id: string, @Req() req: any) {
    return this.kbService.getOne(id, req.user);
  }

  @Post("admin/kb")
  @HttpCode(200)
  createArticle(@Req() req: any, @Body() body: any) {
    return this.kbService.create(req.user, body || {});
  }

  @Post("admin/kb/:id")
  @HttpCode(200)
  updateArticle(@Param("id") id: string, @Req() req: any, @Body() body: any) {
    return this.kbService.update(id, req.user, body || {});
  }

  @Post("admin/kb/:id/delete")
  @HttpCode(200)
  deleteArticle(@Param("id") id: string, @Req() req: any) {
    return this.kbService.delete(id, req.user);
  }

  @Get("me/onboarding")
  getOnboardingProgress(@Req() req: any) {
    return this.onboardingService.getProgress(req.user);
  }

  @Post("me/onboarding/dismiss")
  @HttpCode(200)
  dismissOnboarding(@Req() req: any) {
    return this.onboardingService.dismiss(req.user);
  }

  @Public()
  @Post("webhooks/inbound-email")
  @HttpCode(200)
  inboundEmail(@Body() body: any) {
    return this.inboundService.handleInboundEmail(body || {});
  }
}

@Module({
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService, OnboardingService, InboundEmailService],
  exports: [KnowledgeBaseService, OnboardingService, InboundEmailService],
})
export class KnowledgeBaseModule {}
