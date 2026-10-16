import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { DatabaseService } from "../database/database.service.js";
import { fail } from "../common/domain.js";
import { IAP_CATALOG } from "./billing.module.js";
import { audit } from "../common/admin-domain.js";

export function appOrigin() {
  return (
    process.env.MAIL_APP_URL ||
    process.env.APP_ORIGIN ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

@Injectable()
export class StripeService {
  constructor(private readonly db: DatabaseService) {}

  apiKey() {
    return process.env.STRIPE_SECRET_KEY || "";
  }

  webhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET || "";
  }

  async createCheckoutSession(
    user: any,
    body: { product_id: string; success_url?: string; cancel_url?: string },
  ) {
    if (user.role !== "super_admin")
      fail(403, "this_area_is_restricted_to_super_admins");
    if (!user.email_verified) fail(403, "email_verification_required");

    const productId = String(body.product_id || "");
    const plan = IAP_CATALOG.plans.find((p) => p.product_id === productId);
    const addon = IAP_CATALOG.addons.find((a) => a.product_id === productId);
    if (!plan && !addon) fail(400, "invalid_selection");

    const tenantId = user.tenant_id || 1;
    const tenant = (
      await this.db.query("SELECT * FROM tenants WHERE id=$1", [tenantId])
    ).rows[0];
    if (!tenant) fail(404, "tenant_not_found");

    const origin = appOrigin();
    const successUrl =
      body.success_url || `${origin}/admin/tenants?stripe_status=success`;
    const cancelUrl =
      body.cancel_url || `${origin}/admin/tenants?stripe_status=cancelled`;

    const isPlan = !!plan;
    const priceTry = plan ? plan.price_try : addon!.price_try;
    const productName = plan
      ? `Bekatos Destek — ${plan.tier.toUpperCase()} Paket`
      : addon!.product_id === "bekatos_addon_5_agents"
        ? "Bekatos +5 Destek Personeli"
        : "Bekatos +25 GB Depolama";

    // If Stripe is configured in production or development, initiate real Stripe Checkout
    const secretKey = this.apiKey();
    if (secretKey) {
      const params = new URLSearchParams();
      params.append("mode", isPlan ? "subscription" : "payment");
      params.append("success_url", successUrl);
      params.append("cancel_url", cancelUrl);
      params.append("client_reference_id", `tenant_${tenantId}`);
      if (tenant.stripe_customer_id) {
        params.append("customer", tenant.stripe_customer_id);
      } else {
        params.append("customer_email", user.email);
      }
      params.append("metadata[tenant_id]", String(tenantId));
      params.append("metadata[product_id]", productId);
      params.append("line_items[0][price_data][currency]", "try");
      params.append(
        "line_items[0][price_data][unit_amount]",
        String(Math.round(priceTry * 100)),
      );
      params.append(
        "line_items[0][price_data][product_data][name]",
        productName,
      );
      if (isPlan) {
        params.append(
          "line_items[0][price_data][recurring][interval]",
          "month",
        );
      }
      params.append("line_items[0][quantity]", "1");

      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error?.message || "Stripe checkout session failed");
      }
      return { ok: true, session_id: data.id, url: data.url };
    }

    // Fallback for offline/test environments without Stripe live secret
    const mockSessionId = `cs_test_${tenantId}_${Date.now()}`;
    return {
      ok: true,
      session_id: mockSessionId,
      url: `${successUrl}&session_id=${mockSessionId}`,
    };
  }

  async createPortalSession(user: any, body: { return_url?: string }) {
    if (user.role !== "super_admin")
      fail(403, "this_area_is_restricted_to_super_admins");

    const tenantId = user.tenant_id || 1;
    const tenant = (
      await this.db.query("SELECT * FROM tenants WHERE id=$1", [tenantId])
    ).rows[0];
    if (!tenant) fail(404, "tenant_not_found");
    if (!tenant.stripe_customer_id)
      fail(400, "no_active_stripe_customer");

    const origin = appOrigin();
    const returnUrl = body.return_url || `${origin}/admin/tenants`;

    const secretKey = this.apiKey();
    if (secretKey) {
      const params = new URLSearchParams();
      params.append("customer", tenant.stripe_customer_id);
      params.append("return_url", returnUrl);

      const res = await fetch(
        "https://api.stripe.com/v1/billing_portal/sessions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error?.message || "Stripe portal session failed");
      }
      return { ok: true, url: data.url };
    }

    return {
      ok: true,
      url: `${returnUrl}?portal=mock`,
    };
  }

  verifySignature(
    signatureHeader: string | undefined,
    rawBody: Buffer | string | undefined,
  ): boolean {
    const secret = this.webhookSecret();
    if (!secret && process.env.NODE_ENV === "production") {
      fail(503, "webhook_not_configured");
    }
    if (!secret) return true; // allowed in test/dev when no secret configured

    if (!signatureHeader || !rawBody) return false;

    // Format: t=1614589234,v1=5257a869e7ecebeda32affa62cd...
    const parts = signatureHeader.split(",");
    let timestamp = "";
    let signature = "";
    for (const part of parts) {
      const [k, v] = part.split("=");
      if (k === "t") timestamp = v;
      if (k === "v1") signature = v;
    }

    if (!timestamp || !signature) return false;

    // Tolerance check (5 minutes)
    const tolerance = 300;
    const tsNumber = Number(timestamp);
    if (!Number.isSafeInteger(tsNumber) || Math.abs(Date.now() / 1000 - tsNumber) > tolerance) {
      return false;
    }

    const payload = `${timestamp}.${typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  }

  async handleWebhook(
    signatureHeader: string | undefined,
    rawBody: Buffer | string | undefined,
    body: any,
  ) {
    if (!this.verifySignature(signatureHeader, rawBody)) {
      fail(400, "invalid_or_expired_token");
    }

    const event = body;
    if (!event || !event.type) fail(400, "invalid_json_data");

    const eventId = String(event.id || "");
    const eventType = String(event.type || "");

    return this.db.transaction(async (tx) => {
      // Replay check using iap_transactions
      const seen = (
        await tx.query(
          "SELECT 1 FROM iap_transactions WHERE transaction_id=$1",
          [eventId],
        )
      ).rows[0];
      if (seen) return { ok: true, duplicate: true };

      if (eventType === "checkout.session.completed") {
        const session = event.data?.object;
        if (!session) return { ok: true };

        const clientRef = String(session.client_reference_id || "");
        const tenantIdFromRef = clientRef.startsWith("tenant_")
          ? Number(clientRef.replace(/^tenant_/, ""))
          : null;
        const tenantIdFromMeta = Number(session.metadata?.tenant_id);
        const tenantId = tenantIdFromRef || tenantIdFromMeta;

        if (!tenantId || !Number.isSafeInteger(tenantId)) {
          return { ok: true, ignored: "no_tenant_id" };
        }

        const productId = String(session.metadata?.product_id || "");
        const plan = IAP_CATALOG.plans.find((p) => p.product_id === productId);
        const addon = IAP_CATALOG.addons.find((a) => a.product_id === productId);

        const customerId = session.customer ? String(session.customer) : null;
        const subscriptionId = session.subscription
          ? String(session.subscription)
          : null;

        if (customerId) {
          await tx.query(
            "UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2",
            [customerId, tenantId],
          );
        }
        if (subscriptionId) {
          await tx.query(
            "UPDATE tenants SET stripe_subscription_id = $1 WHERE id = $2",
            [subscriptionId, tenantId],
          );
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
                 store_provider = 'stripe',
                 store_product_id = $6,
                 cancel_at_period_end = false,
                 subscription_expires_at = now() + interval '30 days'
             WHERE id = $7`,
            [
              plan.id,
              plan.agent_limit,
              plan.customer_org_limit,
              plan.monthly_ticket_limit,
              plan.storage_limit_mb,
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

        const priceTry = plan ? plan.price_try : addon?.price_try ?? 0;
        await tx.query(
          `INSERT INTO iap_transactions(tenant_id, store, product_id, event_type, transaction_id, price_currency, price_amount, raw_payload)
           VALUES($1, 'stripe', $2, 'PURCHASE', $3, 'TRY', $4, $5)`,
          [tenantId, productId, eventId, priceTry, JSON.stringify(session)],
        );

        return { ok: true, tenant_id: tenantId, processed: true };
      }

      if (
        eventType === "customer.subscription.updated" ||
        eventType === "customer.subscription.deleted"
      ) {
        const sub = event.data?.object;
        if (!sub) return { ok: true };

        const subId = String(sub.id || "");
        const tenant = (
          await tx.query(
            "SELECT * FROM tenants WHERE stripe_subscription_id=$1 FOR UPDATE",
            [subId],
          )
        ).rows[0];

        if (!tenant) return { ok: true, ignored: "subscription_not_found" };

        const cancelAtPeriodEnd = !!sub.cancel_at_period_end;
        const currentPeriodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null;

        if (eventType === "customer.subscription.deleted" || sub.status === "canceled") {
          // Downgrade to Free
          await tx.query(
            `UPDATE tenants
             SET plan_tier = 'free',
                 agent_limit = 1,
                 customer_org_limit = 3,
                 monthly_ticket_limit = 25,
                 storage_limit_mb = 500,
                 cancel_at_period_end = false,
                 stripe_subscription_id = NULL,
                 subscription_expires_at = now()
             WHERE id = $1`,
            [tenant.id],
          );

          await tx.query(
            `INSERT INTO iap_transactions(tenant_id, store, product_id, event_type, transaction_id, price_currency, price_amount, raw_payload)
             VALUES($1, 'stripe', 'free', 'EXPIRATION', $2, 'TRY', 0, $3)`,
            [tenant.id, eventId, JSON.stringify(sub)],
          );
        } else {
          // Updated subscription status
          const status =
            sub.status === "past_due" || sub.status === "unpaid"
              ? "past_due"
              : tenant.status === "suspended"
                ? "suspended"
                : "active";

          await tx.query(
            `UPDATE tenants
             SET cancel_at_period_end = $1,
                 status = $2,
                 subscription_expires_at = COALESCE($3, subscription_expires_at)
             WHERE id = $4`,
            [cancelAtPeriodEnd, status, currentPeriodEnd, tenant.id],
          );

          await tx.query(
            `INSERT INTO iap_transactions(tenant_id, store, product_id, event_type, transaction_id, price_currency, price_amount, raw_payload)
             VALUES($1, 'stripe', COALESCE($2, 'subscription'), 'UPDATE', $3, 'TRY', 0, $4)`,
            [tenant.id, tenant.store_product_id, eventId, JSON.stringify(sub)],
          );
        }

        return { ok: true, tenant_id: tenant.id, processed: true };
      }

      if (eventType === "invoice.payment_failed") {
        const invoice = event.data?.object;
        const subId = String(invoice?.subscription || "");
        if (subId) {
          await tx.query(
            "UPDATE tenants SET status = CASE WHEN status = 'suspended' THEN status ELSE 'past_due' END WHERE stripe_subscription_id = $1",
            [subId],
          );
        }
        return { ok: true, processed: true };
      }

      if (eventType === "invoice.payment_succeeded") {
        const invoice = event.data?.object;
        const subId = String(invoice?.subscription || "");
        if (subId) {
          await tx.query(
            "UPDATE tenants SET status = CASE WHEN status = 'suspended' THEN status ELSE 'active' END WHERE stripe_subscription_id = $1",
            [subId],
          );
        }
        return { ok: true, processed: true };
      }

      return { ok: true, unhandled: eventType };
    });
  }
}
