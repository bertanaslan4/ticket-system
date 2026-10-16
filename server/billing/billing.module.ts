import {
  Module,
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Headers,
  HttpCode,
  Injectable,
} from "@nestjs/common";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Public } from "../auth/public.decorator.js";
import { DatabaseService } from "../database/database.service.js";
import { str, option, email, audit } from "../common/admin-domain.js";
import { fail, userSql } from "../common/domain.js";
import { hashPassword, newToken, tokenHash } from "../auth.js";
import { MailService } from "../mail/mail.service.js";
import { issueAuthToken } from "../common/auth-tokens.js";
import { uniqueInviteCode } from "../common/invite-code.js";

const INDUSTRY_TEMPLATES = [
  "general",
  "technical_service",
  "field_service",
  "agency",
  "facility",
  "ecommerce",
  "software",
  "it_software",
] as const;

const TEMPLATE_PRODUCTS: Record<string, string[]> = {
  technical_service: ["Bakım & Arıza Servisi", "Kurulum & Montaj"],
  field_service: ["Bakım & Arıza Servisi", "Kurulum & Montaj"],
  agency: ["Web & Tasarım", "Dijital Pazarlama"],
  facility: ["Teknik & Bina Bakım", "Güvenlik & Temizlik"],
  ecommerce: ["Sipariş & Kargo Destek", "Bayi & İade İşlemleri"],
  software: ["Yazılım & ERP", "Entegrasyon"],
  it_software: ["Yazılım & ERP", "Entegrasyon"],
  general: ["Genel Destek", "Teknik Hizmetler"],
};

export const IAP_CATALOG = {
  plans: [
    {
      id: "free",
      tier: "free",
      product_id: "bekatos_free",
      name_key: "plan_free",
      price_try: 0,
      price_usd: 0,
      agent_limit: 1,
      customer_org_limit: 3,
      monthly_ticket_limit: 25,
      storage_limit_mb: 500,
    },
    {
      id: "starter",
      tier: "starter",
      product_id: "bekatos_starter_monthly",
      name_key: "plan_starter",
      price_try: 349,
      price_usd: 9.99,
      agent_limit: 5,
      customer_org_limit: 50,
      monthly_ticket_limit: 100000,
      storage_limit_mb: 10240,
    },
    {
      id: "pro",
      tier: "pro",
      product_id: "bekatos_pro_monthly",
      name_key: "plan_pro",
      price_try: 999,
      price_usd: 29.99,
      agent_limit: 15,
      customer_org_limit: 500,
      monthly_ticket_limit: 100000,
      storage_limit_mb: 51200,
    },
  ],
  addons: [
    {
      product_id: "bekatos_addon_5_agents",
      name_key: "addon_5_agents",
      title_key: "addon_5_agents",
      price_try: 179,
      price_usd: 4.99,
      added_agents: 5,
      added_storage_mb: 0,
    },
    {
      product_id: "bekatos_addon_25gb_storage",
      name_key: "addon_25gb_storage",
      title_key: "addon_25gb_storage",
      price_try: 179,
      price_usd: 4.99,
      added_agents: 0,
      added_storage_mb: 25600,
    },
  ],
};

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length >= 2 ? base : `alan-${randomBytes(3).toString("hex")}`;
}

@Injectable()
export class BillingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
  ) {}

  async publicSignup(body: any) {
    const companyName = str(body.company_name, 2, 180);
    const industryTemplate = option(
      body.industry_template ?? "general",
      INDUSTRY_TEMPLATES as unknown as string[],
    );
    const userName = str(body.admin_name ?? body.name, 2, 180);
    const userEmail = email(body.email);
    const password = str(body.password, 8, 200);
    if (password !== body.password) fail(400, "password_no_outer_spaces");

    const rawSlug = body.slug
      ? str(body.slug, 2, 64).toLowerCase()
      : slugify(companyName);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawSlug))
      fail(400, "invalid_tenant_slug");

    return this.db.transaction(async (tx) => {
      const emailTaken = (
        await tx.query("SELECT id FROM users WHERE email=$1", [userEmail])
      ).rows[0];
      if (emailTaken) fail(409, "this_email_address_is_already_in_use");

      let slug = rawSlug;
      const slugTaken = (
        await tx.query("SELECT id FROM tenants WHERE lower(slug)=$1", [slug])
      ).rows[0];
      if (slugTaken) {
        if (body.slug) fail(409, "tenant_slug_in_use");
        slug = `${rawSlug}-${randomBytes(2).toString("hex")}`;
      }

      const tenant = (
        await tx.query(
          `INSERT INTO tenants(name, slug, plan_tier, status, agent_limit, customer_org_limit, monthly_ticket_limit, storage_limit_mb, industry_template)
           VALUES($1, $2, 'free', 'active', 1, 3, 25, 500, $3)
           RETURNING *`,
          [companyName, slug, industryTemplate],
        )
      ).rows[0];

      const inviteCode = await uniqueInviteCode(tx);
      await tx.query("UPDATE tenants SET invite_code=$1 WHERE id=$2", [
        inviteCode,
        tenant.id,
      ]);
      tenant.invite_code = inviteCode;

      await tx.query(
        "INSERT INTO sla_policies(tenant_id, severity, first_response_target_minutes, resolution_target_minutes) VALUES ($1,'s1',60,240),($1,'s2',240,1440),($1,'s3',480,2880) ON CONFLICT (tenant_id, severity) DO NOTHING",
        [tenant.id],
      );

      const templateProducts =
        TEMPLATE_PRODUCTS[industryTemplate] || TEMPLATE_PRODUCTS.general;
      let firstProductId: number | null = null;
      let firstProductName = templateProducts[0];
      for (const prodName of templateProducts) {
        const p = (
          await tx.query(
            "INSERT INTO products(tenant_id, name) VALUES($1, $2) RETURNING id, name",
            [tenant.id, prodName],
          )
        ).rows[0];
        if (!firstProductId) {
          firstProductId = p.id;
          firstProductName = p.name;
        }
      }

      const contractorOrg = (
        await tx.query(
          "INSERT INTO organizations(tenant_id, name, kind, daily_limit) VALUES($1, $2, 'contractor', 10) RETURNING id",
          [tenant.id, companyName],
        )
      ).rows[0];

      await tx.query(
        "INSERT INTO organizations(tenant_id, name, kind, product_id, program, daily_limit, support_flow, support_chain) VALUES($1, $2, 'customer', $3, $4, 25, 'contractor_only', $5)",
        [
          tenant.id,
          `${companyName} Müşteri Portalı`,
          firstProductId,
          firstProductName,
          [contractorOrg.id],
        ],
      );

      const createdUser = (
        await tx.query(
          "INSERT INTO users(tenant_id, org_id, name, email, password_hash, system_role, active, email_verified_at) VALUES($1, $2, $3, $4, $5, 'super_admin', true, NULL) RETURNING id",
          [
            tenant.id,
            contractorOrg.id,
            userName,
            userEmail,
            hashPassword(password),
          ],
        )
      ).rows[0];

      const token = newToken();
      await tx.query(
        "INSERT INTO sessions VALUES($1, $2, now() + interval '8 hours')",
        [tokenHash(token), createdUser.id],
      );
      await issueAuthToken(
        tx,
        this.mail,
        { id: createdUser.id, name: userName, email: userEmail },
        "email_verify",
      );

      const fullUser = (
        await tx.query(`${userSql} WHERE u.id=$1`, [createdUser.id])
      ).rows[0];

      await audit(tx, fullUser, "tenant_created", tenant.id, {
        name: companyName,
        slug,
        plan_tier: "free",
        invite_code: inviteCode,
      });

      return { token, tenant, user: { ...fullUser, used: 0 } };
    });
  }

  async publicJoin(body: any) {
    const inviteCode = str(body.invite_code, 4, 24).toUpperCase();
    const userName = str(body.name, 2, 180);
    const userEmail = email(body.email);
    const password = str(body.password, 8, 200);
    if (password !== body.password) fail(400, "password_no_outer_spaces");
    const customerCompanyName = body.company_name
      ? str(body.company_name, 2, 180)
      : null;

    return this.db.transaction(async (tx) => {
      const tenant = (
        await tx.query(
          "SELECT * FROM tenants WHERE upper(btrim(invite_code))=$1 FOR UPDATE",
          [inviteCode],
        )
      ).rows[0];
      if (!tenant) fail(404, "invalid_invite_code");
      if (tenant.status === "suspended") fail(403, "tenant_account_suspended");

      const emailTaken = (
        await tx.query("SELECT id FROM users WHERE email=$1", [userEmail])
      ).rows[0];
      if (emailTaken) fail(409, "this_email_address_is_already_in_use");

      let customerOrg: any = null;
      if (customerCompanyName) {
        customerOrg = (
          await tx.query(
            "SELECT * FROM organizations WHERE tenant_id=$1 AND kind='customer' AND lower(name)=lower($2)",
            [tenant.id, customerCompanyName],
          )
        ).rows[0];

        if (!customerOrg) {
          const custOrgCount = Number(
            (
              await tx.query(
                "SELECT count(*) FROM organizations WHERE tenant_id=$1 AND kind='customer'",
                [tenant.id],
              )
            ).rows[0].count,
          );
          if (custOrgCount >= (tenant.customer_org_limit ?? 3)) {
            fail(403, "customer_org_limit_reached", {
              limit: tenant.customer_org_limit ?? 3,
            });
          }
          const contractor = (
            await tx.query(
              "SELECT id FROM organizations WHERE tenant_id=$1 AND kind='contractor' ORDER BY id LIMIT 1",
              [tenant.id],
            )
          ).rows[0];
          const prod = (
            await tx.query(
              "SELECT id, name FROM products WHERE tenant_id=$1 ORDER BY id LIMIT 1",
              [tenant.id],
            )
          ).rows[0];
          customerOrg = (
            await tx.query(
              "INSERT INTO organizations(tenant_id, name, kind, product_id, program, daily_limit, support_flow, support_chain) VALUES($1, $2, 'customer', $3, $4, 20, 'contractor_only', $5) RETURNING *",
              [
                tenant.id,
                customerCompanyName,
                prod?.id ?? null,
                prod?.name ?? "Genel Destek",
                contractor ? [contractor.id] : null,
              ],
            )
          ).rows[0];
        }
      } else {
        customerOrg = (
          await tx.query(
            "SELECT * FROM organizations WHERE tenant_id=$1 AND kind='customer' ORDER BY id LIMIT 1",
            [tenant.id],
          )
        ).rows[0];
        if (!customerOrg) fail(400, "company_not_found");
      }

      const createdUser = (
        await tx.query(
          "INSERT INTO users(tenant_id, org_id, name, email, password_hash, system_role, active, email_verified_at) VALUES($1, $2, $3, $4, $5, 'member', true, NULL) RETURNING id",
          [
            tenant.id,
            customerOrg.id,
            userName,
            userEmail,
            hashPassword(password),
          ],
        )
      ).rows[0];

      const token = newToken();
      await tx.query(
        "INSERT INTO sessions VALUES($1, $2, now() + interval '8 hours')",
        [tokenHash(token), createdUser.id],
      );
      await issueAuthToken(
        tx,
        this.mail,
        { id: createdUser.id, name: userName, email: userEmail },
        "email_verify",
      );

      const fullUser = (
        await tx.query(`${userSql} WHERE u.id=$1`, [createdUser.id])
      ).rows[0];

      // Joining customers never need to see the workspace's invite code or limits.
      const { invite_code: _hidden, ...publicTenant } = tenant;
      return { token, tenant: publicTenant, user: { ...fullUser, used: 0 } };
    });
  }

  async getCatalog(user: any) {
    const tenantId = user?.tenant_id || 1;
    const tenant = (
      await this.db.query("SELECT * FROM tenants WHERE id=$1", [tenantId])
    ).rows[0];
    const agentUsed = Number(
      (
        await this.db.query(
          `SELECT count(*) FROM users u JOIN organizations o ON o.id=u.org_id
           WHERE u.tenant_id=$1 AND u.active=true AND u.deleted_at IS NULL AND (o.kind<>'customer' OR u.system_role='super_admin')`,
          [tenantId],
        )
      ).rows[0].count,
    );
    const customerOrgUsed = Number(
      (
        await this.db.query(
          "SELECT count(*) FROM organizations WHERE tenant_id=$1 AND kind='customer'",
          [tenantId],
        )
      ).rows[0].count,
    );
    const monthlyTicketsUsed = Number(
      (
        await this.db.query(
          "SELECT count(*) FROM tickets WHERE tenant_id=$1 AND date_trunc('month', created_at AT TIME ZONE 'Europe/Istanbul') = date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul')",
          [tenantId],
        )
      ).rows[0].count,
    );
    const storageUsedBytes = Number(
      (
        await this.db.query(
          "SELECT COALESCE(SUM(a.size),0) total FROM attachments a JOIN tickets t ON t.id=a.ticket_id WHERE t.tenant_id=$1",
          [tenantId],
        )
      ).rows[0].total,
    );
    const transactions = (
      await this.db.query(
        "SELECT id, store, product_id, event_type, transaction_id, price_currency, price_amount, created_at FROM iap_transactions WHERE tenant_id=$1 ORDER BY id DESC LIMIT 20",
        [tenantId],
      )
    ).rows;

    const workspace = {
      tenant_id: tenant.id,
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan_tier: tenant.plan_tier,
      invite_code: user.role === "super_admin" ? tenant.invite_code : undefined,
      agent_used: agentUsed,
      agent_limit: tenant.agent_limit,
      customer_org_used: customerOrgUsed,
      customer_org_limit: tenant.customer_org_limit,
      monthly_tickets_used: monthlyTicketsUsed,
      monthly_ticket_used: monthlyTicketsUsed,
      monthly_ticket_limit: tenant.monthly_ticket_limit,
      storage_used_bytes: storageUsedBytes,
      storage_limit_mb: tenant.storage_limit_mb,
      store_provider: tenant.store_provider,
      store_product_id: tenant.store_product_id,
      subscription_expires_at: tenant.subscription_expires_at,
    };

    return {
      ...IAP_CATALOG,
      workspace,
      tenant: workspace,
      transactions: user.role === "super_admin" ? transactions : [],
    };
  }

  async purchase(body: any, user: any) {
    if (user.role !== "super_admin")
      fail(403, "this_area_is_restricted_to_super_admins");
    // Client-reported purchases carry no proof of payment. In production, plans change only through
    // the store webhook (or a verified payment provider) unless this switch is turned on explicitly.
    if (
      process.env.NODE_ENV === "production" &&
      process.env.BILLING_ALLOW_CLIENT_PURCHASES !== "true"
    )
      fail(403, "client_purchases_disabled");
    if (!user.email_verified) fail(403, "email_verification_required");
    const tenantId = user.tenant_id || 1;
    const store = option(body.store ?? "app_store", [
      "app_store",
      "play_store",
      "stripe",
      "promo",
    ]);
    const productId = str(body.product_id, 3, 128);
    const transactionId = body.transaction_id
      ? str(body.transaction_id, 4, 128)
      : `iap_${Date.now()}_${randomBytes(4).toString("hex")}`;

    const plan = IAP_CATALOG.plans.find((p) => p.product_id === productId);
    const addon = IAP_CATALOG.addons.find((a) => a.product_id === productId);
    if (!plan && !addon) fail(400, "invalid_selection");

    await this.db.transaction(async (tx) => {
      const dup = (
        await tx.query(
          "SELECT id FROM iap_transactions WHERE transaction_id=$1",
          [transactionId],
        )
      ).rows[0];
      if (dup) fail(409, "transaction_already_processed");

      if (plan) {
        await tx.query(
          `UPDATE tenants
           SET plan_tier = $1,
               status = CASE WHEN status = 'suspended' THEN status ELSE 'active' END,
               agent_limit = GREATEST(agent_limit, $2),
               customer_org_limit = GREATEST(customer_org_limit, $3),
               monthly_ticket_limit = GREATEST(monthly_ticket_limit, $4),
               storage_limit_mb = GREATEST(storage_limit_mb, $5),
               store_provider = $6,
               store_product_id = $7,
               subscription_expires_at = now() + interval '30 days'
           WHERE id = $8`,
          [
            plan.id,
            plan.agent_limit,
            plan.customer_org_limit,
            plan.monthly_ticket_limit,
            plan.storage_limit_mb,
            store,
            productId,
            tenantId,
          ],
        );
      } else if (addon) {
        await tx.query(
          `UPDATE tenants
           SET agent_limit = agent_limit + $1,
               storage_limit_mb = storage_limit_mb + $2
           WHERE id = $3`,
          [addon.added_agents, addon.added_storage_mb, tenantId],
        );
      }

      const priceTry = plan ? plan.price_try : addon!.price_try;
      await tx.query(
        `INSERT INTO iap_transactions(tenant_id, store, product_id, event_type, transaction_id, price_currency, price_amount, raw_payload)
         VALUES($1, $2, $3, 'PURCHASE', $4, 'TRY', $5, $6)`,
        [
          tenantId,
          store,
          productId,
          transactionId,
          priceTry,
          JSON.stringify({ store, product_id: productId }),
        ],
      );

      await audit(tx, user, "iap_purchased", tenantId, {
        name: productId,
        store,
        transaction_id: transactionId,
      });
    });

    return this.getCatalog(user);
  }

  async handleRevenueCatWebhook(authHeader: string | undefined, body: any) {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    // Without a secret anyone could upgrade any workspace, so production refuses to run unprotected.
    if (!secret && process.env.NODE_ENV === "production")
      fail(503, "webhook_not_configured");
    if (secret) {
      const expected = Buffer.from(`Bearer ${secret}`);
      const given = Buffer.from(authHeader || "");
      if (given.length !== expected.length || !timingSafeEqual(given, expected))
        fail(401, "please_sign_in");
    }
    const ev = body?.event || body;
    if (!ev || !ev.app_user_id || !ev.type) fail(400, "invalid_json_data");

    const tenantId = Number(String(ev.app_user_id).replace(/^tenant_/, ""));
    if (!Number.isSafeInteger(tenantId) || tenantId <= 0)
      fail(400, "tenant_not_found");

    const PURCHASE_EVENTS = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"];
    const KNOWN_EVENTS = [...PURCHASE_EVENTS, "EXPIRATION", "BILLING_ISSUE"];
    if (!KNOWN_EVENTS.includes(ev.type))
      return { ok: true, tenant_id: tenantId, ignored: "unhandled_event" };

    const productId = String(ev.product_id || "");
    const plan = IAP_CATALOG.plans.find(
      (p) => p.product_id === productId && p.tier !== "free",
    );
    // An unknown product must never be mapped to a paid plan; acknowledge so the sender stops retrying.
    if (PURCHASE_EVENTS.includes(ev.type) && !plan)
      return { ok: true, tenant_id: tenantId, ignored: "unknown_product" };

    const txId = String(
      ev.transaction_id ||
        ev.id ||
        `rc_${Date.now()}_${randomBytes(3).toString("hex")}`,
    );
    const storeName =
      (
        {
          APP_STORE: "app_store",
          MAC_APP_STORE: "app_store",
          PLAY_STORE: "play_store",
          STRIPE: "stripe",
          PROMOTIONAL: "promo",
        } as Record<string, string>
      )[String(ev.store || "").toUpperCase()] || "app_store";
    const eventMs = Number(ev.event_timestamp_ms);
    const eventAt =
      Number.isFinite(eventMs) && eventMs > 0 ? new Date(eventMs) : null;
    const expiryMs = Number(ev.expiration_at_ms);
    const expiresAt =
      Number.isFinite(expiryMs) && expiryMs > Date.now()
        ? new Date(expiryMs)
        : new Date(Date.now() + 30 * 86400 * 1000);

    return this.db.transaction(async (tx) => {
      const tenant = (
        await tx.query("SELECT * FROM tenants WHERE id=$1 FOR UPDATE", [
          tenantId,
        ])
      ).rows[0];
      if (!tenant) fail(404, "tenant_not_found");

      // Replays of an already processed event must not touch the plan again.
      const seen = (
        await tx.query(
          "SELECT 1 FROM iap_transactions WHERE transaction_id=$1",
          [txId],
        )
      ).rows[0];
      if (seen) return { ok: true, tenant_id: tenantId, duplicate: true };

      const recordedProduct = productId || tenant.store_product_id || "unknown";
      const record = () =>
        tx.query(
          `INSERT INTO iap_transactions(tenant_id, store, product_id, event_type, transaction_id, price_currency, price_amount, raw_payload)
           VALUES($1, $2, $3, $4, $5, 'TRY', 0, $6)`,
          [
            tenantId,
            storeName,
            recordedProduct,
            ev.type,
            txId,
            JSON.stringify(ev),
          ],
        );

      // An older event arriving late (e.g. a stale RENEWAL after EXPIRATION) is logged but not applied.
      if (
        eventAt &&
        tenant.store_event_at &&
        eventAt.getTime() < new Date(tenant.store_event_at).getTime()
      ) {
        await record();
        return { ok: true, tenant_id: tenantId, ignored: "stale_event" };
      }

      if (plan) {
        await tx.query(
          `UPDATE tenants
           SET plan_tier = $1,
               status = CASE WHEN status = 'suspended' THEN status ELSE 'active' END,
               agent_limit = GREATEST(agent_limit, $2),
               customer_org_limit = $3,
               monthly_ticket_limit = $4,
               storage_limit_mb = GREATEST(storage_limit_mb, $5),
               store_provider = $6,
               store_product_id = $7,
               subscription_expires_at = $8
           WHERE id = $9`,
          [
            plan.id,
            plan.agent_limit,
            plan.customer_org_limit,
            plan.monthly_ticket_limit,
            plan.storage_limit_mb,
            storeName,
            productId,
            expiresAt,
            tenantId,
          ],
        );
      } else if (ev.type === "EXPIRATION") {
        await tx.query(
          `UPDATE tenants
           SET plan_tier = 'free',
               agent_limit = 1,
               customer_org_limit = 3,
               monthly_ticket_limit = 25,
               storage_limit_mb = 500,
               subscription_expires_at = now()
           WHERE id = $1`,
          [tenantId],
        );
      } else if (ev.type === "BILLING_ISSUE") {
        await tx.query(
          "UPDATE tenants SET status = CASE WHEN status = 'suspended' THEN status ELSE 'past_due' END WHERE id = $1",
          [tenantId],
        );
      }
      if (eventAt)
        await tx.query(
          "UPDATE tenants SET store_event_at = GREATEST(COALESCE(store_event_at, $1), $1) WHERE id = $2",
          [eventAt, tenantId],
        );
      await record();

      return { ok: true, tenant_id: tenantId, event_type: ev.type };
    });
  }

  async rotateInviteCode(user: any) {
    if (user.role !== "super_admin")
      fail(403, "this_area_is_restricted_to_super_admins");
    const tenantId = user.tenant_id || 1;
    const code = await this.db.transaction(async (tx) => {
      const next = await uniqueInviteCode(tx);
      await tx.query("UPDATE tenants SET invite_code=$1 WHERE id=$2", [
        next,
        tenantId,
      ]);
      await audit(tx, user, "invite_code_rotated", tenantId, {
        name: user.tenant_name,
      });
      return next;
    });
    return { ok: true, invite_code: code };
  }
}

@Controller()
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Public()
  @Post("public/signup")
  @HttpCode(200)
  async signup(@Body() body: any, @Res({ passthrough: true }) res: any) {
    const result = await this.service.publicSignup(body || {});
    res.setHeader(
      "Set-Cookie",
      `session=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    return {
      ok: true,
      token: result.token,
      tenant: result.tenant,
      user: result.user,
    };
  }

  @Public()
  @Post("public/join")
  @HttpCode(200)
  async join(@Body() body: any, @Res({ passthrough: true }) res: any) {
    const result = await this.service.publicJoin(body || {});
    res.setHeader(
      "Set-Cookie",
      `session=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    return {
      ok: true,
      token: result.token,
      tenant: result.tenant,
      user: result.user,
    };
  }

  @Get("billing/catalog")
  getCatalog(@Req() req: any) {
    return this.service.getCatalog(req.user);
  }

  @Post("billing/invite-code/rotate")
  @HttpCode(200)
  rotateInviteCode(@Req() req: any) {
    return this.service.rotateInviteCode(req.user);
  }

  @Post("billing/purchase")
  @HttpCode(200)
  purchase(@Body() body: any, @Req() req: any) {
    return this.service.purchase(body || {}, req.user);
  }

  @Public()
  @Post("webhooks/revenuecat")
  @HttpCode(200)
  revenueCatWebhook(
    @Headers("authorization") auth: string | undefined,
    @Body() body: any,
  ) {
    return this.service.handleRevenueCatWebhook(auth, body || {});
  }
}

@Module({
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
