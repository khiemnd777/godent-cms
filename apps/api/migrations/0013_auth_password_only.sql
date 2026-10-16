-- AUTH-001 forward cutover. Applied migrations and encrypted legacy factors stay unchanged.
-- The migration runner checks retained checksums and applies this transaction once.
ALTER TABLE gcms_s02_auth.reauth_grant ALTER COLUMN mfa SET DEFAULT false;

CREATE FUNCTION gcms_s02.has_current_membership(p_tenant text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM gcms_s02.membership m JOIN gcms_s02_auth."user" u ON u.id=m.user_id
    JOIN gcms_s02_auth.session s ON s.user_id=u.id AND s.id=nullif(current_setting('gcms.session_id',true),'')
    WHERE m.tenant_id=p_tenant AND m.user_id=gcms_s02.current_actor() AND m.status='active'
      AND u.active AND u.email_verified AND s.expires_at>now()
      AND s.created_at<=now() AND s.created_at>now()-interval '8 hours')
$$;
-- Preserve the exact legacy argument name/default for existing callers. It is inert.
CREATE OR REPLACE FUNCTION gcms_s02.has_membership(p_tenant text,p_mfa boolean DEFAULT true) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT gcms_s02.has_current_membership(p_tenant)
$$;

-- One clock and one condition for every sensitive operation. A grant proves a
-- password verification for the current valid session; the legacy mfa flag is inert.
CREATE FUNCTION gcms_s02.has_recent_auth() RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
  WITH instant AS MATERIALIZED (SELECT clock_timestamp() AS stamp)
  SELECT EXISTS(SELECT 1 FROM gcms_s02_auth.session s JOIN gcms_s02_auth."user" u ON u.id=s.user_id CROSS JOIN instant i
    WHERE s.id=nullif(current_setting('gcms.session_id',true),'') AND s.user_id=gcms_s02.current_actor()
      AND u.active AND u.email_verified AND s.expires_at>i.stamp AND s.created_at<=i.stamp
      AND s.created_at>i.stamp-interval '8 hours'
      AND (s.created_at>i.stamp-interval '5 minutes' OR EXISTS(SELECT 1 FROM gcms_s02_auth.reauth_grant g
        WHERE g.session_id=s.id AND g.verified_at<=i.stamp AND g.verified_at>i.stamp-interval '5 minutes' AND g.expires_at>i.stamp)))
$$;
REVOKE ALL ON FUNCTION gcms_s02.has_current_membership(text),gcms_s02.has_recent_auth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_s02.has_current_membership(text),gcms_s02.has_recent_auth() TO gcms_s02_tenant,gcms_s02_platform;


CREATE OR REPLACE FUNCTION gcms_s02.lock_actor(p_user text,p_session text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u gcms_s02_auth."user"%ROWTYPE; s gcms_s02_auth.session%ROWTYPE;
BEGIN
  SELECT * INTO u FROM gcms_s02_auth."user" WHERE id=p_user FOR SHARE;
  SELECT * INTO s FROM gcms_s02_auth.session WHERE id=p_session AND user_id=p_user FOR SHARE;
  IF u.id IS NULL OR s.id IS NULL OR NOT u.active OR NOT u.email_verified OR s.expires_at<=clock_timestamp()
     OR s.created_at>clock_timestamp() OR s.created_at<=clock_timestamp()-interval '8 hours' THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='28000'; END IF;
  RETURN jsonb_build_object('userId',u.id,'sessionId',s.id,'email',u.email,'name',u.name,'emailVerified',u.email_verified,
    'platformAdmin',u.platform_admin,
    'sessionCreatedAt',s.created_at,'sessionExpiresAt',s.expires_at);
END $$;

CREATE OR REPLACE FUNCTION gcms_s02.same_tenant_user(p_user text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT p_user=gcms_s02.current_actor() OR (gcms_s02.has_current_membership(nullif(current_setting('gcms.tenant_id',true),''))
    AND EXISTS(SELECT 1 FROM gcms_s02.membership WHERE tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND user_id=p_user))
$$;

CREATE OR REPLACE FUNCTION gcms_s04.has_lead_access(p_tenant text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT p_tenant=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(p_tenant)
    AND EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=p_tenant AND status IN ('active','suspended'))
$$;

CREATE OR REPLACE FUNCTION gcms_s05.eligible(p_tenant text,p_user text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM gcms_s02.membership m JOIN gcms_s02_auth."user" u ON u.id=m.user_id
    WHERE m.tenant_id=p_tenant AND m.user_id=p_user AND m.status='active' AND u.active AND u.email_verified)
$$;

CREATE OR REPLACE FUNCTION gcms_s05.authorize(p_tenant text,p_write boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor jsonb; tenant_status text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
  actor:=gcms_s02.lock_actor(gcms_s02.current_actor(),nullif(current_setting('gcms.session_id',true),''));
  SELECT status INTO tenant_status FROM gcms_s02.tenant WHERE id=p_tenant FOR SHARE;
  PERFORM 1 FROM gcms_s02.membership WHERE tenant_id=p_tenant AND user_id=gcms_s02.current_actor() FOR SHARE;
  IF p_tenant IS DISTINCT FROM nullif(current_setting('gcms.tenant_id',true),'') OR NOT gcms_s02.has_current_membership(p_tenant) OR
    tenant_status IS NULL OR tenant_status NOT IN ('active','suspended') OR (p_write AND tenant_status<>'active') THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
END $$;

CREATE OR REPLACE FUNCTION gcms_s02.guard_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_s02.service_draft%ROWTYPE; s gcms_s02.site_draft%ROWTYPE; latest integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id,7202));
  PERFORM gcms_s02.lock_actor(gcms_s02.current_actor(),nullif(current_setting('gcms.session_id',true),''));
  PERFORM 1 FROM gcms_s02.tenant WHERE id=NEW.tenant_id FOR SHARE;
  PERFORM 1 FROM gcms_s02.membership WHERE tenant_id=NEW.tenant_id AND user_id=gcms_s02.current_actor() FOR SHARE;
  IF NOT gcms_s02.has_current_membership(NEW.tenant_id) OR NEW.published_by<>gcms_s02.current_actor() OR
    NOT EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=NEW.tenant_id AND status='active') THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
  IF NOT gcms_s02.has_recent_auth()
    THEN RAISE EXCEPTION 'Reauthentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO d FROM gcms_s02.service_draft WHERE tenant_id=NEW.tenant_id AND id=NEW.service_id FOR UPDATE;
  SELECT * INTO s FROM gcms_s02.site_draft WHERE tenant_id=NEW.tenant_id FOR UPDATE;
  SELECT coalesce(max(publication_version),0) INTO latest FROM gcms_s02.publication_snapshot WHERE tenant_id=NEW.tenant_id AND service_id=NEW.service_id;
  IF d.id IS NULL OR s.tenant_id IS NULL OR NOT s.public_enabled OR d.slug IS NULL OR
      d.version<>NEW.draft_version OR s.version<>NEW.site_version OR NEW.publication_version<>latest+1 OR
      NOT gcms_s02.valid_document(coalesce(d.body_document,gcms_s02.plain_document(d.body)),20000) OR
      NEW.closure IS DISTINCT FROM gcms_s02.snapshot_closure(d,s) THEN RAISE EXCEPTION 'Publication conflict' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION gcms_s05.settings_command(p_tenant text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s gcms_s05.recipient_settings%ROWTYPE; r gcms_s05.settings_receipt%ROWTYPE; ids text[]; target text; stamp timestamptz; v integer;
BEGIN
  PERFORM gcms_s05.authorize(p_tenant,true); stamp:=clock_timestamp();
  IF NOT gcms_s02.has_recent_auth()
    THEN RETURN '{"code":"REAUTH_REQUIRED"}'; END IF;
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR (c-ARRAY['operationId','expectedVersion','mode','recipientUserIds'])<>'{}'::jsonb OR
    NOT(c ?& ARRAY['operationId','expectedVersion','mode','recipientUserIds']) OR c->>'operationId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR
    jsonb_typeof(c->'expectedVersion') IS DISTINCT FROM 'number' OR c->>'expectedVersion' !~ '^[1-9][0-9]{0,8}$' OR
    jsonb_typeof(c->'mode') IS DISTINCT FROM 'string' OR c->>'mode' NOT IN ('default','selected') OR jsonb_typeof(c->'recipientUserIds') IS DISTINCT FROM 'array' THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
  SELECT coalesce(array_agg(value ORDER BY value),'{}') INTO ids FROM jsonb_array_elements_text(c->'recipientUserIds');
  IF cardinality(ids)>50 OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) OR
    (c->>'mode'='selected' AND cardinality(ids)=0) OR (c->>'mode'='default' AND cardinality(ids)<>0) THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
  SELECT * INTO s FROM gcms_s05.recipient_settings WHERE tenant_id=p_tenant FOR UPDATE;
  IF s.tenant_id IS NULL THEN RETURN '{"code":"RECIPIENT_UNAVAILABLE"}'; END IF;
  SELECT * INTO r FROM gcms_s05.settings_receipt WHERE tenant_id=p_tenant AND operation_id=c->>'operationId';
  IF r.operation_id IS NOT NULL THEN
    IF r.actor_id<>gcms_s02.current_actor() OR r.command<>c THEN RETURN '{"code":"OPERATION_CONFLICT"}'; END IF;
    RETURN jsonb_build_object('operationId',r.operation_id,'appliedVersion',r.applied_version,'replayed',true);
  END IF;
  IF s.version<>(c->>'expectedVersion')::integer THEN RETURN '{"code":"VERSION_CONFLICT"}'; END IF;
  FOREACH target IN ARRAY CASE WHEN c->>'mode'='default' THEN ARRAY[s.initial_user_id] ELSE ids END LOOP
    IF target IS NULL THEN RETURN '{"code":"RECIPIENT_UNAVAILABLE"}'; END IF;
    PERFORM 1 FROM gcms_s02_auth."user" WHERE id=target FOR SHARE;
    PERFORM 1 FROM gcms_s02.membership WHERE tenant_id=p_tenant AND user_id=target FOR SHARE;
    IF NOT gcms_s05.eligible(p_tenant,target) THEN RETURN '{"code":"RECIPIENT_UNAVAILABLE"}'; END IF;
  END LOOP;
  v:=s.version+1; UPDATE gcms_s05.recipient_settings SET version=v,mode=c->>'mode',recipient_user_ids=ids WHERE tenant_id=p_tenant;
  INSERT INTO gcms_s05.settings_receipt VALUES(p_tenant,c->>'operationId',gcms_s02.current_actor(),c,v,stamp);
  INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id,created_at) VALUES(gen_random_uuid()::text,p_tenant,gcms_s02.current_actor(),'lead.recipients_changed',p_tenant,stamp);
  RETURN jsonb_build_object('operationId',c->>'operationId','appliedVersion',v,'replayed',false);
END $$;

ALTER POLICY tenant_member ON gcms_s02.tenant TO gcms_s02_tenant USING(gcms_s02.has_current_membership(id));

ALTER POLICY membership_read ON gcms_s02.membership TO gcms_s02_tenant
  USING(user_id=gcms_s02.current_actor() OR (tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id)));

ALTER POLICY membership_write ON gcms_s02.membership TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id));

ALTER POLICY invitation_tenant ON gcms_s02.invitation TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id));

ALTER POLICY draft_tenant ON gcms_s02.service_draft TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id) AND updated_by=gcms_s02.current_actor());

ALTER POLICY audit_tenant ON gcms_s02.audit_event TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND actor_id=gcms_s02.current_actor() AND gcms_s02.has_current_membership(tenant_id));

ALTER POLICY site_tenant ON gcms_s02.site_draft TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id) AND updated_by=gcms_s02.current_actor());

ALTER POLICY snapshot_tenant ON gcms_s02.publication_snapshot TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id) AND published_by=gcms_s02.current_actor());

ALTER POLICY pointer_tenant ON gcms_s02.publication_pointer TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id));

ALTER POLICY intent_tenant ON gcms_s02.publication_intent TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id));

-- The one-time policy cutover revokes every old cookie and its session-bound grant.
-- No account, credential, membership, content, lead or notification row is changed.
DELETE FROM gcms_s02_auth.reauth_grant;
DELETE FROM gcms_s02_auth.session;

