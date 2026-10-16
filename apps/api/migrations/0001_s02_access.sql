-- Forward-only, additive S02 schema. Run by gcms_s02_migration SET ROLE owner.
-- Existing S01 public schema and retained Docker resources are unchanged.
CREATE TABLE gcms_s02_auth."user" (
  id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE CHECK(email=lower(email)),
  email_verified boolean NOT NULL DEFAULT false, image text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  two_factor_enabled boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
  platform_admin boolean NOT NULL DEFAULT false
);
CREATE TABLE gcms_s02_auth.session (
  id text PRIMARY KEY, token text NOT NULL UNIQUE, user_id text NOT NULL REFERENCES gcms_s02_auth."user"(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text, user_agent text
);
CREATE INDEX session_user_idx ON gcms_s02_auth.session(user_id);
CREATE TABLE gcms_s02_auth.account (
  id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES gcms_s02_auth."user"(id) ON DELETE CASCADE, password text,
  access_token text, refresh_token text, id_token text, scope text,
  access_token_expires_at timestamptz, refresh_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider_id,account_id)
);
CREATE INDEX account_user_idx ON gcms_s02_auth.account(user_id);
CREATE TABLE gcms_s02_auth.verification (
  id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_identifier_idx ON gcms_s02_auth.verification(identifier);
CREATE TABLE gcms_s02_auth.two_factor (
  id text PRIMARY KEY, user_id text NOT NULL UNIQUE REFERENCES gcms_s02_auth."user"(id) ON DELETE CASCADE,
  secret text NOT NULL, backup_codes text NOT NULL, verified boolean NOT NULL DEFAULT false,
  failed_verification_count integer NOT NULL DEFAULT 0, locked_until timestamptz
);
CREATE TABLE gcms_s02_auth.reauth_grant (
  session_id text PRIMARY KEY REFERENCES gcms_s02_auth.session(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, mfa boolean NOT NULL
);
CREATE TABLE gcms_s02.tenant (
  id text PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE gcms_s02.membership (
  tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id), user_id text NOT NULL REFERENCES gcms_s02_auth."user"(id),
  role text NOT NULL DEFAULT 'tenant_admin' CHECK(role='tenant_admin'),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,user_id)
);
CREATE INDEX membership_user_idx ON gcms_s02.membership(user_id,tenant_id);
CREATE TABLE gcms_s02.invitation (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id), email text NOT NULL CHECK(email=lower(email)),
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, accepted_at timestamptz, revoked_at timestamptz,
  created_by text NOT NULL REFERENCES gcms_s02_auth."user"(id), created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(accepted_at IS NULL OR revoked_at IS NULL)
);
CREATE UNIQUE INDEX invitation_one_live_email ON gcms_s02.invitation(tenant_id,email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE TABLE gcms_s02.service_draft (
  tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id), id text NOT NULL,
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160), body text NOT NULL CHECK(length(body)<=30000),
  locale text NOT NULL DEFAULT 'vi' CHECK(locale='vi'), version integer NOT NULL DEFAULT 1 CHECK(version>0),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by text NOT NULL,
  PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,updated_by) REFERENCES gcms_s02.membership(tenant_id,user_id)
);
CREATE TABLE gcms_s02.audit_event (
  id text PRIMARY KEY, tenant_id text REFERENCES gcms_s02.tenant(id), actor_id text NOT NULL REFERENCES gcms_s02_auth."user"(id),
  event text NOT NULL CHECK(length(event)<=100), target_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_tenant_time_idx ON gcms_s02.audit_event(tenant_id,created_at,id);

-- SECURITY DEFINER functions expose narrow current authorization, never drafts,
-- credential hashes, session tokens, factor secrets or unrestricted dynamic SQL.
CREATE FUNCTION gcms_s02.current_actor() RETURNS text LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
  SELECT nullif(current_setting('gcms.actor_id',true),'')
$$;
CREATE FUNCTION gcms_s02.has_membership(p_tenant text, p_mfa boolean DEFAULT true) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM gcms_s02.membership m JOIN gcms_s02_auth."user" u ON u.id=m.user_id
    JOIN gcms_s02_auth.session s ON s.user_id=u.id AND s.id=nullif(current_setting('gcms.session_id',true),'')
    WHERE m.tenant_id=p_tenant AND m.user_id=gcms_s02.current_actor() AND m.status='active'
      AND u.active AND u.email_verified AND (NOT p_mfa OR u.two_factor_enabled)
      AND s.expires_at>now() AND s.created_at>now()-interval '8 hours')
$$;
CREATE FUNCTION gcms_s02.same_tenant_user(p_user text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT p_user=gcms_s02.current_actor() OR (gcms_s02.has_membership(nullif(current_setting('gcms.tenant_id',true),''))
    AND EXISTS(SELECT 1 FROM gcms_s02.membership WHERE tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND user_id=p_user))
$$;
CREATE FUNCTION gcms_s02.lock_actor(p_user text,p_session text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u gcms_s02_auth."user"%ROWTYPE; s gcms_s02_auth.session%ROWTYPE;
BEGIN
  SELECT * INTO u FROM gcms_s02_auth."user" WHERE id=p_user FOR SHARE;
  SELECT * INTO s FROM gcms_s02_auth.session WHERE id=p_session AND user_id=p_user FOR SHARE;
  IF u.id IS NULL OR s.id IS NULL OR NOT u.active OR NOT u.email_verified OR s.expires_at<=clock_timestamp()
     OR s.created_at<=clock_timestamp()-interval '8 hours' THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='28000'; END IF;
  RETURN jsonb_build_object('userId',u.id,'sessionId',s.id,'email',u.email,'name',u.name,'emailVerified',u.email_verified,
    'twoFactorEnabled',u.two_factor_enabled,'platformAdmin',u.platform_admin,'sessionCreatedAt',s.created_at,'sessionExpiresAt',s.expires_at);
END $$;
CREATE FUNCTION gcms_s02.invited_email(p_hash text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT i.email FROM gcms_s02.invitation i JOIN gcms_s02.tenant t ON t.id=i.tenant_id
  WHERE i.token_hash=p_hash AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() AND t.status='active'
$$;

-- Every membership change and user disable takes the same tenant lock before
-- counting active administrators. Row locks keep current actor/session checks
-- valid until the guarded operation commits.
CREATE FUNCTION gcms_s02.retain_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target text;
BEGIN
  target:=OLD.tenant_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(target,7202));
  IF OLD.status='active' AND (TG_OP='DELETE' OR NEW.status<>'active' OR NEW.user_id<>OLD.user_id OR NEW.tenant_id<>OLD.tenant_id) THEN
    IF NOT EXISTS(SELECT 1 FROM gcms_s02.membership m JOIN gcms_s02_auth."user" u ON u.id=m.user_id
      WHERE m.tenant_id=target AND m.user_id<>OLD.user_id AND m.status='active' AND u.active AND u.email_verified) THEN
      RAISE EXCEPTION 'Last active administrator' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER membership_retain_admin BEFORE UPDATE OR DELETE ON gcms_s02.membership FOR EACH ROW EXECUTE FUNCTION gcms_s02.retain_admin();
CREATE FUNCTION gcms_s02.retain_admin_on_disable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t text;
BEGIN
  IF OLD.active AND NOT NEW.active THEN
    FOR t IN SELECT tenant_id FROM gcms_s02.membership WHERE user_id=OLD.id AND status='active' ORDER BY tenant_id LOOP
      PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));
      IF NOT EXISTS(SELECT 1 FROM gcms_s02.membership m JOIN gcms_s02_auth."user" u ON u.id=m.user_id
        WHERE m.tenant_id=t AND m.user_id<>OLD.id AND m.status='active' AND u.active AND u.email_verified) THEN
        RAISE EXCEPTION 'Last active administrator' USING ERRCODE='23514';
      END IF;
    END LOOP;
    DELETE FROM gcms_s02_auth.session WHERE user_id=OLD.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_retain_admin BEFORE UPDATE OF active ON gcms_s02_auth."user" FOR EACH ROW EXECUTE FUNCTION gcms_s02.retain_admin_on_disable();

GRANT USAGE ON SCHEMA gcms_s02_auth TO gcms_s02_auth,gcms_s02_tenant,gcms_s02_platform;
GRANT USAGE ON SCHEMA gcms_s02 TO gcms_s02_auth,gcms_s02_tenant,gcms_s02_platform;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA gcms_s02_auth TO gcms_s02_auth;
GRANT SELECT(id,name,email,email_verified,two_factor_enabled,active,platform_admin,created_at,updated_at) ON gcms_s02_auth."user" TO gcms_s02_tenant,gcms_s02_platform;
GRANT UPDATE(active,updated_at) ON gcms_s02_auth."user" TO gcms_s02_platform;
GRANT SELECT ON gcms_s02_auth.reauth_grant TO gcms_s02_tenant,gcms_s02_platform;
GRANT SELECT,INSERT,UPDATE ON gcms_s02.tenant,gcms_s02.membership,gcms_s02.invitation TO gcms_s02_platform;
GRANT SELECT ON gcms_s02.tenant TO gcms_s02_tenant;
GRANT SELECT,INSERT,UPDATE ON gcms_s02.membership,gcms_s02.invitation,gcms_s02.service_draft TO gcms_s02_tenant;
GRANT SELECT,INSERT ON gcms_s02.audit_event TO gcms_s02_tenant,gcms_s02_platform;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gcms_s02 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_s02.current_actor(),gcms_s02.has_membership(text,boolean),gcms_s02.same_tenant_user(text),gcms_s02.lock_actor(text,text) TO gcms_s02_tenant,gcms_s02_platform;
GRANT EXECUTE ON FUNCTION gcms_s02.invited_email(text) TO gcms_s02_auth;

ALTER TABLE gcms_s02_auth."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_s02_auth."user" FORCE ROW LEVEL SECURITY;
CREATE POLICY user_owner ON gcms_s02_auth."user" TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE POLICY user_auth ON gcms_s02_auth."user" TO gcms_s02_auth USING(true) WITH CHECK(true);
CREATE POLICY user_platform ON gcms_s02_auth."user" TO gcms_s02_platform USING(true) WITH CHECK(true);
CREATE POLICY user_tenant ON gcms_s02_auth."user" FOR SELECT TO gcms_s02_tenant USING(gcms_s02.same_tenant_user(id));
ALTER TABLE gcms_s02.tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_s02.tenant FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_owner ON gcms_s02.tenant TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE POLICY tenant_platform ON gcms_s02.tenant TO gcms_s02_platform USING(true) WITH CHECK(true);
CREATE POLICY tenant_member ON gcms_s02.tenant FOR SELECT TO gcms_s02_tenant USING(gcms_s02.has_membership(id,false));
ALTER TABLE gcms_s02.membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_s02.membership FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_owner ON gcms_s02.membership TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE POLICY membership_platform ON gcms_s02.membership TO gcms_s02_platform USING(true) WITH CHECK(true);
CREATE POLICY membership_read ON gcms_s02.membership FOR SELECT TO gcms_s02_tenant
  USING(user_id=gcms_s02.current_actor() OR (tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id)));
CREATE POLICY membership_write ON gcms_s02.membership FOR ALL TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id));
ALTER TABLE gcms_s02.invitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_s02.invitation FORCE ROW LEVEL SECURITY;
CREATE POLICY invitation_owner ON gcms_s02.invitation TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE POLICY invitation_platform ON gcms_s02.invitation TO gcms_s02_platform USING(true) WITH CHECK(true);
CREATE POLICY invitation_tenant ON gcms_s02.invitation TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id));
ALTER TABLE gcms_s02.service_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_s02.service_draft FORCE ROW LEVEL SECURITY;
CREATE POLICY draft_owner ON gcms_s02.service_draft TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE POLICY draft_tenant ON gcms_s02.service_draft TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id) AND updated_by=gcms_s02.current_actor());
ALTER TABLE gcms_s02.audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_s02.audit_event FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_owner ON gcms_s02.audit_event TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE POLICY audit_platform ON gcms_s02.audit_event TO gcms_s02_platform USING(true) WITH CHECK(true);
CREATE POLICY audit_tenant ON gcms_s02.audit_event TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND actor_id=gcms_s02.current_actor() AND gcms_s02.has_membership(tenant_id));
