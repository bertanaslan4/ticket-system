CREATE TABLE IF NOT EXISTS organizations (
 id SERIAL PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('customer','dealer','contractor')),
 dealer_id INTEGER REFERENCES organizations(id), program TEXT, daily_limit INTEGER NOT NULL DEFAULT 10 CHECK(daily_limit>0)
);
CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY, org_id INTEGER NOT NULL REFERENCES organizations(id), name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
 id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES organizations(id), dealer_id INTEGER NOT NULL REFERENCES organizations(id),
 created_by INTEGER NOT NULL REFERENCES users(id), program TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('Hata','İstek')), severity TEXT NOT NULL CHECK(severity IN ('s1','s2','s3')),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','review','closed')),
 owner_org_id INTEGER NOT NULL REFERENCES organizations(id), assignee_id INTEGER REFERENCES users(id),
 escalated BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS events (
 id SERIAL PRIMARY KEY, ticket_id INTEGER NOT NULL REFERENCES tickets(id), actor_id INTEGER NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL, visibility TEXT NOT NULL CHECK(visibility IN ('public','internal')), body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_customer_date ON tickets(customer_id,created_at);
CREATE INDEX IF NOT EXISTS events_ticket ON events(ticket_id,id);
CREATE INDEX IF NOT EXISTS tickets_owner ON tickets(owner_org_id,status);

-- Copy the customer's routing policy onto each new request; existing requests keep their workflow.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS support_flow TEXT NOT NULL DEFAULT 'dealer_first' CHECK (support_flow IN ('dealer_first','contractor_first','contractor_only'));
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS support_flow TEXT NOT NULL DEFAULT 'dealer_first' CHECK (support_flow IN ('dealer_first','contractor_first','contractor_only'));
ALTER TABLE tickets ALTER COLUMN dealer_id DROP NOT NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contractor_id INTEGER REFERENCES organizations(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS dealer_involved BOOLEAN NOT NULL DEFAULT true;

-- Ordered customer-specific support companies. NULL retains the legacy policy
-- until configured; new tickets snapshot both the chain and its visibility.
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_kind_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_kind_check CHECK(kind IN ('customer','dealer','contractor','support'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS support_chain INTEGER[] CHECK(cardinality(support_chain)>0);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS support_chain INTEGER[] CHECK(cardinality(support_chain)>0);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS visible_support_org_ids INTEGER[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS tickets_support_visibility ON tickets USING GIN(visible_support_org_ids);

-- Convert the former customer presets once. Existing tickets retain their old
-- policy; future tickets snapshot the converted chain. Ambiguous configurations
-- remain untouched so an administrator can select the intended companies.
WITH legacy_contractor AS (
 SELECT id FROM organizations WHERE kind='contractor'
 AND (lower(name) IN ('bekatos', 'takipsan') OR (SELECT count(*) FROM organizations WHERE kind='contractor')=1)
 ORDER BY id LIMIT 1
)
UPDATE organizations o SET support_chain = CASE
 WHEN o.support_flow='contractor_only' THEN ARRAY[c.id]
 WHEN o.support_flow='contractor_first' THEN ARRAY[c.id,o.dealer_id]
 ELSE ARRAY[o.dealer_id,c.id] END
FROM legacy_contractor c
WHERE o.kind='customer' AND o.support_chain IS NULL
 AND (o.support_flow='contractor_only' OR (o.dealer_id IS NOT NULL AND o.dealer_id<>c.id));

-- Additive migration: existing users retain their organization-based permissions.
ALTER TABLE users ADD COLUMN IF NOT EXISTS system_role TEXT NOT NULL DEFAULT 'member' CHECK(system_role IN ('member','super_admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS message_key TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS message_params JSONB NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS admin_audit (
 id SERIAL PRIMARY KEY, actor_id INTEGER NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, target_id INTEGER NOT NULL, details JSONB NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attachments (id UUID PRIMARY KEY, ticket_id INTEGER NOT NULL REFERENCES tickets(id), event_id INTEGER REFERENCES events(id), name TEXT NOT NULL, size BIGINT NOT NULL, storage TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE);
CREATE INDEX IF NOT EXISTS attachments_ticket_idx ON attachments(ticket_id);

CREATE TABLE IF NOT EXISTS storage_settings(id INTEGER PRIMARY KEY CHECK(id=1), config TEXT NOT NULL, version INTEGER NOT NULL, checked_at TIMESTAMPTZ);

CREATE TABLE IF NOT EXISTS mail_outbox (
 id SERIAL PRIMARY KEY,event_id INTEGER NOT NULL REFERENCES events(id),user_id INTEGER NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('assigned','closed')),payload JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','skipped')),attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),locked_at TIMESTAMPTZ,lock_token TEXT,last_error TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),sent_at TIMESTAMPTZ,UNIQUE(event_id,user_id,kind)
);
CREATE INDEX IF NOT EXISTS mail_outbox_pending ON mail_outbox(status,next_attempt_at);

CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 180));
CREATE UNIQUE INDEX IF NOT EXISTS products_name_unique ON products(lower(btrim(name)));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id);
CREATE INDEX IF NOT EXISTS tickets_product_date ON tickets(product_id,created_at);
-- Preserve historical text while linking existing program names to the catalog.
INSERT INTO products(name)
SELECT min(btrim(program)) FROM (
 SELECT program FROM organizations WHERE product_id IS NULL
 UNION ALL SELECT program FROM tickets WHERE product_id IS NULL
) names WHERE program IS NOT NULL AND btrim(program)<>''
GROUP BY lower(btrim(program)) ON CONFLICT DO NOTHING;
UPDATE organizations o SET product_id=p.id FROM products p WHERE o.product_id IS NULL AND lower(btrim(o.program))=lower(btrim(p.name));
UPDATE tickets t SET product_id=p.id FROM products p WHERE t.product_id IS NULL AND lower(btrim(t.program))=lower(btrim(p.name));

-- Multi-tenant SaaS isolation and subscription quotas.
CREATE TABLE IF NOT EXISTS tenants (
 id SERIAL PRIMARY KEY,
 slug TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 plan_tier TEXT NOT NULL DEFAULT 'starter' CHECK(plan_tier IN ('starter','pro','enterprise')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('trial','active','past_due','suspended')),
 agent_limit INTEGER NOT NULL DEFAULT 5 CHECK(agent_limit > 0),
 storage_limit_mb INTEGER NOT NULL DEFAULT 10240 CHECK(storage_limit_mb > 0),
 trial_ends_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO tenants(id, slug, name, plan_tier, status, agent_limit, storage_limit_mb)
VALUES (1, 'bekatos', 'Bekatos', 'enterprise', 'active', 500, 256000)
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('tenants','id'), GREATEST((SELECT coalesce(max(id),1) FROM tenants), 1));

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id);
ALTER TABLE admin_audit ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id);

DROP INDEX IF EXISTS products_name_unique;
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_name_unique ON products(tenant_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS organizations_tenant_idx ON organizations(tenant_id, id);
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users(tenant_id, id);
CREATE INDEX IF NOT EXISTS tickets_tenant_idx ON tickets(tenant_id, updated_at DESC, id DESC);

-- Phase 2: SLA Policies and Ticket SLA Tracking
CREATE TABLE IF NOT EXISTS sla_policies (
 id SERIAL PRIMARY KEY,
 tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 severity TEXT NOT NULL CHECK(severity IN ('s1','s2','s3')),
 first_response_target_minutes INTEGER NOT NULL CHECK(first_response_target_minutes > 0),
 resolution_target_minutes INTEGER NOT NULL CHECK(resolution_target_minutes > 0),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id, severity)
);

INSERT INTO sla_policies(tenant_id, severity, first_response_target_minutes, resolution_target_minutes)
SELECT t.id, v.severity, v.first_resp, v.res_target
FROM tenants t
CROSS JOIN (
 VALUES ('s1', 60, 240), ('s2', 240, 1440), ('s3', 480, 2880)
) AS v(severity, first_resp, res_target)
ON CONFLICT (tenant_id, severity) DO NOTHING;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS first_responded_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_first_response_due_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_resolution_due_at TIMESTAMPTZ;

-- Backfill SLA due timestamps and response/closed timestamps on existing tickets
UPDATE tickets t
SET
 sla_first_response_due_at = COALESCE(t.sla_first_response_due_at, t.created_at + make_interval(mins => COALESCE(sp.first_response_target_minutes, 240))),
 sla_resolution_due_at = COALESCE(t.sla_resolution_due_at, t.created_at + make_interval(mins => COALESCE(sp.resolution_target_minutes, 1440)))
FROM sla_policies sp
WHERE sp.tenant_id = t.tenant_id AND sp.severity = t.severity
  AND (t.sla_first_response_due_at IS NULL OR t.sla_resolution_due_at IS NULL);

UPDATE tickets t
SET closed_at = sub.closed_at
FROM (
 SELECT ticket_id, max(created_at) AS closed_at
 FROM events
 WHERE kind = 'closed'
 GROUP BY ticket_id
) sub
WHERE t.id = sub.ticket_id AND t.status = 'closed' AND t.closed_at IS NULL;

UPDATE tickets t
SET first_responded_at = sub.first_at
FROM (
 SELECT e.ticket_id, min(e.created_at) AS first_at
 FROM events e
 JOIN users u ON u.id = e.actor_id
 JOIN organizations o ON o.id = u.org_id
 WHERE e.kind IN ('comment', 'assigned', 'resolved', 'resolution', 'closed')
   AND o.kind <> 'customer'
 GROUP BY e.ticket_id
) sub
WHERE t.id = sub.ticket_id AND t.first_responded_at IS NULL;

