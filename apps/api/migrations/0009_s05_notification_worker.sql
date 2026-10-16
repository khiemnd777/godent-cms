-- Explicitly selected S05 local fixture tenants only. Migration/API startup never dispatches.
CREATE TABLE gcms_s05.worker_scope (
  tenant_id text PRIMARY KEY REFERENCES gcms_s02.tenant(id), enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE gcms_s05.delivery (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text, tenant_id text NOT NULL, lead_id text NOT NULL, recipient_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','blocked','captured','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5), fence integer NOT NULL DEFAULT 0 CHECK(fence>=0),
  worker_id text, lease_until timestamptz, available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  started_at timestamptz, completed_at timestamptz, failure_reason text,
  UNIQUE(tenant_id,lead_id,recipient_user_id),
  FOREIGN KEY(tenant_id,lead_id) REFERENCES gcms_s04.lead(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX delivery_ready ON gcms_s05.delivery(tenant_id,status,available_at,id);
ALTER TABLE gcms_s04.notification_intent ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp();
CREATE INDEX intent_ready ON gcms_s04.notification_intent(tenant_id,next_attempt_at,created_at,lead_id) WHERE status IN ('pending','blocked','processing');
ALTER TABLE gcms_s05.worker_scope ENABLE ROW LEVEL SECURITY; ALTER TABLE gcms_s05.worker_scope FORCE ROW LEVEL SECURITY;
CREATE POLICY worker_scope_owner ON gcms_s05.worker_scope TO gcms_s02_owner USING(true) WITH CHECK(true);
ALTER TABLE gcms_s05.delivery ENABLE ROW LEVEL SECURITY; ALTER TABLE gcms_s05.delivery FORCE ROW LEVEL SECURITY;
CREATE POLICY delivery_owner ON gcms_s05.delivery TO gcms_s02_owner USING(true) WITH CHECK(true);

CREATE FUNCTION gcms_s05.current_recipients(p_tenant text) RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT CASE WHEN s.mode='default' THEN CASE WHEN s.initial_user_id IS NULL THEN '{}'::text[] ELSE ARRAY[s.initial_user_id] END ELSE s.recipient_user_ids END
  FROM gcms_s05.recipient_settings s WHERE s.tenant_id=p_tenant
$$;
CREATE FUNCTION gcms_s05.worker_claim(p_tenant text,p_worker text,p_limit integer DEFAULT 10) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE stamp timestamptz; i record; d record; ids text[]; target text; found_eligible boolean; result jsonb:='[]';
BEGIN
  IF p_worker IS NULL OR p_worker !~ '^[a-f0-9-]{36}$' OR p_limit IS NULL OR p_limit<1 OR p_limit>10 OR NOT EXISTS(SELECT 1 FROM gcms_s05.worker_scope WHERE tenant_id=p_tenant AND enabled)
    THEN RAISE EXCEPTION 'Invalid local worker scope' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202)); stamp:=clock_timestamp();
  FOR i IN SELECT n.*,l.status AS lead_status,l.expires_at,t.status AS tenant_status FROM gcms_s04.notification_intent n
    JOIN gcms_s04.lead l ON l.tenant_id=n.tenant_id AND l.id=n.lead_id JOIN gcms_s02.tenant t ON t.id=n.tenant_id
    WHERE n.tenant_id=p_tenant AND n.status IN ('pending','blocked','processing') AND n.next_attempt_at<=stamp
    ORDER BY n.next_attempt_at,n.created_at,n.lead_id LIMIT 10 FOR UPDATE OF n SKIP LOCKED LOOP
    IF i.expires_at<=stamp OR i.created_at+interval '24 hours'<=stamp THEN
      UPDATE gcms_s04.notification_intent SET status='failed',blocked_reason=CASE WHEN i.expires_at<=stamp THEN 'lead_expired' ELSE 'delivery_deadline' END
        WHERE tenant_id=p_tenant AND lead_id=i.lead_id;
      CONTINUE;
    END IF;
    IF i.lead_status='closed' THEN
      UPDATE gcms_s04.notification_intent SET status='cancelled',blocked_reason=NULL WHERE tenant_id=p_tenant AND lead_id=i.lead_id;
      UPDATE gcms_s05.delivery SET status='cancelled',failure_reason='lead_closed' WHERE tenant_id=p_tenant AND lead_id=i.lead_id AND status IN ('pending','blocked'); CONTINUE;
    END IF;
    IF i.tenant_status<>'active' THEN
      UPDATE gcms_s04.notification_intent SET status='blocked',blocked_reason='tenant_suspended',next_attempt_at=stamp+interval '1 minute' WHERE tenant_id=p_tenant AND lead_id=i.lead_id; CONTINUE;
    END IF;
    ids:=coalesce(gcms_s05.current_recipients(p_tenant),'{}'); found_eligible:=false;
    FOREACH target IN ARRAY ids LOOP
      IF gcms_s05.eligible(p_tenant,target) THEN
        found_eligible:=true;
        INSERT INTO gcms_s05.delivery(tenant_id,lead_id,recipient_user_id) VALUES(p_tenant,i.lead_id,target) ON CONFLICT(tenant_id,lead_id,recipient_user_id) DO NOTHING;
        UPDATE gcms_s05.delivery SET status='pending',failure_reason=NULL WHERE tenant_id=p_tenant AND lead_id=i.lead_id AND recipient_user_id=target AND status='cancelled' AND failure_reason='recipient_changed';
      END IF;
    END LOOP;
    UPDATE gcms_s05.delivery SET status='cancelled',failure_reason='recipient_changed' WHERE tenant_id=p_tenant AND lead_id=i.lead_id AND status IN ('pending','blocked') AND NOT(recipient_user_id=ANY(ids));
    IF NOT found_eligible THEN
      UPDATE gcms_s04.notification_intent SET status='blocked',blocked_reason='recipient_unavailable',next_attempt_at=stamp+interval '1 minute' WHERE tenant_id=p_tenant AND lead_id=i.lead_id; CONTINUE;
    END IF;
    FOR d IN SELECT x.* FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=i.lead_id AND x.status='processing'
      AND x.attempts>=5 AND x.lease_until<=stamp AND x.available_at<=stamp FOR UPDATE SKIP LOCKED LOOP
      IF pg_try_advisory_xact_lock(hashtextextended(d.id,7505)) THEN
        UPDATE gcms_s05.delivery SET status='failed',failure_reason='attempts_exhausted',lease_until=NULL WHERE id=d.id;
      END IF;
    END LOOP;
    FOR d IN SELECT x.* FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=i.lead_id AND x.recipient_user_id=ANY(ids)
      AND gcms_s05.eligible(p_tenant,x.recipient_user_id) AND x.attempts<5 AND x.available_at<=stamp
      AND (x.status IN ('pending','blocked') OR (x.status='processing' AND x.lease_until<=stamp)) ORDER BY x.id FOR UPDATE SKIP LOCKED LOOP
      EXIT WHEN jsonb_array_length(result)>=p_limit;
      -- A live worker retains this session advisory lock until its actual I/O promise settles.
      -- An elapsed lease or a timer does not establish cancellation of I/O.
      IF NOT pg_try_advisory_xact_lock(hashtextextended(d.id,7505)) THEN CONTINUE; END IF;
      UPDATE gcms_s05.delivery SET status='processing',fence=fence+1,worker_id=p_worker,lease_until=stamp+interval '30 seconds',failure_reason=NULL
        WHERE id=d.id RETURNING fence INTO d.fence;
      result:=result||jsonb_build_array(jsonb_build_object('id',d.id,'tenantId',p_tenant,'fence',d.fence));
    END LOOP;
    IF EXISTS(SELECT 1 FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=i.lead_id AND x.recipient_user_id=ANY(ids) AND gcms_s05.eligible(p_tenant,x.recipient_user_id) AND x.status='captured')
      AND NOT EXISTS(SELECT 1 FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=i.lead_id AND x.recipient_user_id=ANY(ids) AND gcms_s05.eligible(p_tenant,x.recipient_user_id) AND x.status<>'captured') THEN
      UPDATE gcms_s04.notification_intent SET status='captured',blocked_reason=NULL WHERE tenant_id=p_tenant AND lead_id=i.lead_id;
    ELSIF NOT EXISTS(SELECT 1 FROM unnest(ids) target WHERE gcms_s05.eligible(p_tenant,target) AND NOT EXISTS(
      SELECT 1 FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=i.lead_id AND x.recipient_user_id=target AND x.status IN ('captured','failed'))) THEN
      UPDATE gcms_s04.notification_intent SET status='failed',blocked_reason='attempts_exhausted' WHERE tenant_id=p_tenant AND lead_id=i.lead_id;
    ELSE
      UPDATE gcms_s04.notification_intent SET status=CASE WHEN EXISTS(SELECT 1 FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=i.lead_id AND x.status='processing') THEN 'processing' ELSE 'pending' END,
        blocked_reason=NULL,next_attempt_at=stamp+interval '1 second' WHERE tenant_id=p_tenant AND lead_id=i.lead_id;
    END IF;
    EXIT WHEN jsonb_array_length(result)>=p_limit;
  END LOOP;
  RETURN result;
END $$;

-- Invocation initiates one attempt atomically after fresh eligibility checks. The narrow
-- response contains an administrator address, never a lead name/contact/message.
CREATE FUNCTION gcms_s05.worker_start(p_tenant text,p_delivery text,p_worker text,p_fence integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_s05.delivery%ROWTYPE; l gcms_s04.lead%ROWTYPE; i gcms_s04.notification_intent%ROWTYPE;
  stamp timestamptz; tenant_status text; recipient_email text; ids text[];
BEGIN
  IF NOT EXISTS(SELECT 1 FROM gcms_s05.worker_scope WHERE tenant_id=p_tenant AND enabled) THEN RAISE EXCEPTION 'Invalid local worker scope' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202)); stamp:=clock_timestamp();
  SELECT * INTO d FROM gcms_s05.delivery WHERE tenant_id=p_tenant AND id=p_delivery FOR UPDATE;
  IF d.id IS NULL OR d.status<>'processing' OR d.worker_id IS DISTINCT FROM p_worker OR d.fence IS DISTINCT FROM p_fence OR d.lease_until<=stamp THEN RETURN NULL; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended(d.id,7505)) THEN RETURN NULL; END IF;
  SELECT status INTO tenant_status FROM gcms_s02.tenant WHERE id=p_tenant FOR SHARE;
  SELECT * INTO l FROM gcms_s04.lead WHERE tenant_id=p_tenant AND id=d.lead_id FOR SHARE;
  SELECT * INTO i FROM gcms_s04.notification_intent WHERE tenant_id=p_tenant AND lead_id=d.lead_id FOR UPDATE;
  SELECT email INTO recipient_email FROM gcms_s02_auth."user" WHERE id=d.recipient_user_id FOR SHARE;
  PERFORM 1 FROM gcms_s02.membership WHERE tenant_id=p_tenant AND user_id=d.recipient_user_id FOR SHARE;
  ids:=coalesce(gcms_s05.current_recipients(p_tenant),'{}');
  IF l.id IS NULL OR l.expires_at<=stamp OR i.created_at+interval '24 hours'<=stamp OR d.attempts>=5 OR i.status IN ('failed','cancelled','captured') OR l.status='closed' THEN
    UPDATE gcms_s05.delivery SET status=CASE WHEN l.status='closed' OR i.status='cancelled' THEN 'cancelled' ELSE 'failed' END,failure_reason='unavailable',lease_until=NULL WHERE id=d.id;
    IF l.status='closed' THEN UPDATE gcms_s04.notification_intent SET status='cancelled',blocked_reason=NULL WHERE tenant_id=p_tenant AND lead_id=d.lead_id;
    ELSIF l.id IS NULL OR l.expires_at<=stamp OR i.created_at+interval '24 hours'<=stamp THEN
      UPDATE gcms_s04.notification_intent SET status='failed',blocked_reason=CASE WHEN l.expires_at<=stamp THEN 'lead_expired' ELSE 'delivery_deadline' END WHERE tenant_id=p_tenant AND lead_id=d.lead_id;
    END IF;
    RETURN NULL;
  END IF;
  IF tenant_status<>'active' OR NOT(d.recipient_user_id=ANY(ids)) OR NOT gcms_s05.eligible(p_tenant,d.recipient_user_id) THEN
    UPDATE gcms_s05.delivery SET status='blocked',failure_reason=CASE WHEN tenant_status<>'active' THEN 'tenant_suspended' ELSE 'recipient_unavailable' END,
      available_at=stamp+interval '1 minute',lease_until=NULL WHERE id=d.id;
    UPDATE gcms_s04.notification_intent SET status='blocked',blocked_reason=CASE WHEN tenant_status<>'active' THEN 'tenant_suspended' ELSE 'recipient_unavailable' END,next_attempt_at=stamp+interval '1 minute'
      WHERE tenant_id=p_tenant AND lead_id=d.lead_id; RETURN NULL;
  END IF;
  -- Persist crash-safe retry eligibility before I/O. Completion can delay retry further.
  UPDATE gcms_s05.delivery SET attempts=attempts+1,started_at=stamp,lease_until=stamp+interval '30 seconds',
    available_at=stamp+CASE d.attempts WHEN 0 THEN interval '1 minute' WHEN 1 THEN interval '5 minutes' WHEN 2 THEN interval '30 minutes' ELSE interval '2 hours' END WHERE id=d.id;
  RETURN jsonb_build_object('deliveryId',d.id,'recipientEmail',recipient_email,'transport','local_capture','signInUrl','http://127.0.0.1:5891/sign-in');
END $$;

CREATE FUNCTION gcms_s05.worker_finish(p_tenant text,p_delivery text,p_worker text,p_fence integer,p_outcome text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_s05.delivery%ROWTYPE; stamp timestamptz; born timestamptz; next_at timestamptz; ids text[];
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('captured','transient','permanent') OR NOT EXISTS(SELECT 1 FROM gcms_s05.worker_scope WHERE tenant_id=p_tenant AND enabled) THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202)); stamp:=clock_timestamp();
  SELECT * INTO d FROM gcms_s05.delivery WHERE tenant_id=p_tenant AND id=p_delivery FOR UPDATE;
  IF d.id IS NULL OR d.status<>'processing' OR d.worker_id IS DISTINCT FROM p_worker OR d.fence IS DISTINCT FROM p_fence OR d.started_at IS NULL THEN RETURN false; END IF;
  SELECT created_at INTO born FROM gcms_s04.notification_intent WHERE tenant_id=p_tenant AND lead_id=d.lead_id FOR UPDATE;
  next_at:=stamp+CASE d.attempts WHEN 1 THEN interval '1 minute' WHEN 2 THEN interval '5 minutes' WHEN 3 THEN interval '30 minutes' ELSE interval '2 hours' END;
  UPDATE gcms_s05.delivery SET status=CASE WHEN p_outcome='captured' THEN 'captured' WHEN p_outcome='permanent' OR d.attempts>=5 OR next_at>=born+interval '24 hours' THEN 'failed' ELSE 'pending' END,
    failure_reason=CASE WHEN p_outcome='captured' THEN NULL ELSE p_outcome END,completed_at=CASE WHEN p_outcome='captured' THEN stamp END,available_at=next_at,lease_until=NULL WHERE id=d.id;
  ids:=coalesce(gcms_s05.current_recipients(p_tenant),'{}');
  IF NOT EXISTS(SELECT 1 FROM unnest(ids) target WHERE gcms_s05.eligible(p_tenant,target)) THEN
    UPDATE gcms_s04.notification_intent SET status='blocked',blocked_reason='recipient_unavailable',next_attempt_at=stamp+interval '1 minute' WHERE tenant_id=p_tenant AND lead_id=d.lead_id AND status<>'cancelled';
  ELSIF NOT EXISTS(SELECT 1 FROM unnest(ids) target WHERE gcms_s05.eligible(p_tenant,target) AND NOT EXISTS(
    SELECT 1 FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=d.lead_id AND x.recipient_user_id=target AND x.status='captured')) THEN
    UPDATE gcms_s04.notification_intent SET status='captured',blocked_reason=NULL WHERE tenant_id=p_tenant AND lead_id=d.lead_id AND status<>'cancelled';
  ELSIF NOT EXISTS(SELECT 1 FROM unnest(ids) target WHERE gcms_s05.eligible(p_tenant,target) AND NOT EXISTS(
    SELECT 1 FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=d.lead_id AND x.recipient_user_id=target AND x.status IN ('captured','failed'))) THEN
    UPDATE gcms_s04.notification_intent SET status='failed',blocked_reason='attempts_exhausted' WHERE tenant_id=p_tenant AND lead_id=d.lead_id AND status<>'cancelled';
  ELSE
    UPDATE gcms_s04.notification_intent SET status='pending',next_attempt_at=stamp,blocked_reason=NULL WHERE tenant_id=p_tenant AND lead_id=d.lead_id AND status NOT IN ('cancelled','failed');
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON gcms_s05.worker_scope,gcms_s05.delivery FROM PUBLIC,gcms_s02_tenant,gcms_s02_auth,gcms_s02_platform,gcms_s04_intake,gcms_s05_worker;
REVOKE ALL ON FUNCTION gcms_s05.current_recipients(text),gcms_s05.worker_claim(text,text,integer),gcms_s05.worker_start(text,text,text,integer),gcms_s05.worker_finish(text,text,text,integer,text) FROM PUBLIC;
GRANT USAGE ON SCHEMA gcms_s05 TO gcms_s05_worker;
GRANT EXECUTE ON FUNCTION gcms_s05.worker_claim(text,text,integer),gcms_s05.worker_start(text,text,text,integer),gcms_s05.worker_finish(text,text,text,integer,text) TO gcms_s05_worker;
