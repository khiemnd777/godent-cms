-- Approved M2/S06. Forward only; existing deadlines are the backfill source.
DO $$ BEGIN
  IF current_user<>'gcms_s02_owner' OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='gcms_s06' AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
    THEN RAISE EXCEPTION 'S06 bootstrap ownership required'; END IF;
END $$;
REVOKE ALL ON SCHEMA gcms_s06 FROM PUBLIC;
ALTER TABLE gcms_s04.lead ADD COLUMN normal_expires_at timestamptz, ADD COLUMN extension_expires_at timestamptz,
  ADD COLUMN retention_revision integer NOT NULL DEFAULT 1 CHECK(retention_revision>0);
UPDATE gcms_s04.lead SET normal_expires_at=expires_at;
ALTER TABLE gcms_s04.lead ALTER COLUMN normal_expires_at SET NOT NULL;
ALTER TABLE gcms_s04.lead ADD CONSTRAINT retention_finite CHECK(isfinite(normal_expires_at) AND isfinite(expires_at) AND
  (extension_expires_at IS NULL OR isfinite(extension_expires_at))),
  ADD CONSTRAINT retention_effective CHECK(expires_at=greatest(normal_expires_at,extension_expires_at));
CREATE INDEX lead_retention_due ON gcms_s04.lead(tenant_id,expires_at,id);

-- The durable denial identity has no contact, message, reason, actor name or command.
-- Its lifetime is intentionally not invented here; D5 must settle pre-live restore policy.
CREATE TABLE gcms_s06.deletion_decision (
  tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id), lead_id text NOT NULL,
  retention_revision integer NOT NULL, expired_at timestamptz NOT NULL, deleted_at timestamptz NOT NULL,
  PRIMARY KEY(tenant_id,lead_id)
);
CREATE TABLE gcms_s06.extension_receipt (
  tenant_id text NOT NULL, operation_id text NOT NULL, lead_id text NOT NULL, actor_id text NOT NULL,
  command jsonb NOT NULL, applied_version integer NOT NULL, created_at timestamptz NOT NULL,
  PRIMARY KEY(tenant_id,operation_id), FOREIGN KEY(tenant_id,lead_id) REFERENCES gcms_s04.lead(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE gcms_s06.worker_scope (
  tenant_id text PRIMARY KEY REFERENCES gcms_s02.tenant(id), enabled boolean NOT NULL DEFAULT false
);
-- Positive per-lead allowlist. Enabling a tenant never makes retained backlog deletable.
CREATE TABLE gcms_s06.lead_scope (
  tenant_id text NOT NULL REFERENCES gcms_s06.worker_scope(tenant_id), lead_id text NOT NULL,
  PRIMARY KEY(tenant_id,lead_id)
);
-- Explicit identities also permit exercising tenant-less authentication audit expiry
-- without sweeping historical global audit records during bounded local execution.
CREATE TABLE gcms_s06.audit_scope (
  tenant_id text NOT NULL REFERENCES gcms_s06.worker_scope(tenant_id), source text NOT NULL CHECK(source='s02'), record_id text NOT NULL,
  PRIMARY KEY(tenant_id,source,record_id)
);
CREATE TABLE gcms_s06.notice (
  tenant_id text NOT NULL, lead_id text NOT NULL, revision integer NOT NULL, expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','blocked','captured','failed')),
  blocked_reason text, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant_id,lead_id,revision), FOREIGN KEY(tenant_id,lead_id) REFERENCES gcms_s04.lead(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE gcms_s06.job (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text, tenant_id text NOT NULL, lead_id text NOT NULL,
  revision integer NOT NULL, kind text NOT NULL CHECK(kind IN ('notice','delete')), recipient_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','blocked','captured','failed','cancelled','completed')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5), fence integer NOT NULL DEFAULT 0 CHECK(fence>=0),
  worker_id text, lease_until timestamptz, available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  started_at timestamptz, completed_at timestamptz, failure_reason text,
  UNIQUE(tenant_id,lead_id,revision,kind,recipient_id),
  FOREIGN KEY(tenant_id,lead_id) REFERENCES gcms_s04.lead(tenant_id,id) ON DELETE CASCADE,
  CHECK((kind='delete' AND recipient_id='system') OR kind='notice')
);
CREATE INDEX retention_job_ready ON gcms_s06.job(tenant_id,status,available_at,id);
CREATE TABLE gcms_s06.audit_event (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text, tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id),
  actor_kind text NOT NULL DEFAULT 'system' CHECK(actor_kind='system'), event text NOT NULL CHECK(event IN ('lead.deleted','audit.expired')),
  target_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Anonymous audit remains useful after physical deletion, without a lead foreign key.
ALTER TABLE gcms_s04.audit_event DROP CONSTRAINT audit_event_tenant_id_target_id_fkey;
CREATE INDEX audit_s04_expiry ON gcms_s04.audit_event(tenant_id,created_at,id);
CREATE INDEX audit_s06_expiry ON gcms_s06.audit_event(tenant_id,created_at,id);

CREATE FUNCTION gcms_s06.guard_deadline() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM gcms_s06.deletion_decision WHERE tenant_id=NEW.tenant_id AND lead_id=NEW.id) THEN
    RAISE EXCEPTION 'Deleted lead identity denied' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN NEW.normal_expires_at:=coalesce(NEW.normal_expires_at,NEW.expires_at);
  ELSE
    -- S05 contact is the sole substantive activity command. Keep its existing definition.
    IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at THEN NEW.normal_expires_at:=NEW.last_activity_at+interval '180 days';
    ELSIF NEW.status='closed' AND (OLD.status<>'closed' OR NEW.closed_at IS DISTINCT FROM OLD.closed_at) THEN
      NEW.normal_expires_at:=least(OLD.normal_expires_at,NEW.closed_at+interval '90 days',NEW.last_activity_at+interval '180 days');
      IF NEW.closure_reason='spam' THEN NEW.normal_expires_at:=least(NEW.normal_expires_at,NEW.closed_at+interval '30 days'); END IF;
    ELSE NEW.normal_expires_at:=OLD.normal_expires_at; END IF;
  END IF;
  NEW.expires_at:=greatest(NEW.normal_expires_at,NEW.extension_expires_at);
  IF TG_OP='UPDATE' THEN
    NEW.retention_revision:=OLD.retention_revision+CASE WHEN NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN 1 ELSE 0 END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER s06_deadline BEFORE INSERT OR UPDATE ON gcms_s04.lead FOR EACH ROW EXECUTE FUNCTION gcms_s06.guard_deadline();
-- A restored row with a known deletion identity is denied even before reconciliation.
CREATE FUNCTION gcms_s06.not_deleted(p_tenant text,p_lead text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT NOT EXISTS(SELECT 1 FROM gcms_s06.deletion_decision WHERE tenant_id=p_tenant AND lead_id=p_lead)
$$;
ALTER POLICY lead_tenant ON gcms_s04.lead USING(gcms_s04.has_lead_access(tenant_id) AND expires_at>clock_timestamp() AND gcms_s06.not_deleted(tenant_id,id));

-- Extend history's allowed kind without changing existing event bytes.
ALTER TABLE gcms_s05.lead_event DROP CONSTRAINT lead_event_kind_check;
ALTER TABLE gcms_s05.lead_event ADD CONSTRAINT lead_event_kind_s06 CHECK(kind IN ('assign','note','contact','close','reopen','retention_extended'));
CREATE FUNCTION gcms_s06.extend_lead(p_tenant text,p_lead text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l gcms_s04.lead%ROWTYPE; r gcms_s06.extension_receipt%ROWTYPE; stamp timestamptz; expiry timestamptz; v integer; actor_label text;
BEGIN
  PERFORM gcms_s05.authorize(p_tenant,true);
  SELECT * INTO l FROM gcms_s04.lead WHERE tenant_id=p_tenant AND id=p_lead FOR UPDATE;
  stamp:=clock_timestamp();
  IF l.id IS NULL OR l.expires_at<=stamp OR NOT gcms_s06.not_deleted(p_tenant,p_lead) THEN RETURN '{"code":"LEAD_UNAVAILABLE"}'; END IF;
  IF NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}'; END IF;
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT(c ?& ARRAY['operationId','expectedVersion','reason','expiresAt']) OR
    (c-ARRAY['operationId','expectedVersion','reason','expiresAt'])<>'{}'::jsonb OR
    jsonb_typeof(c->'operationId') IS DISTINCT FROM 'string' OR c->>'operationId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR
    jsonb_typeof(c->'expectedVersion') IS DISTINCT FROM 'number' OR c->>'expectedVersion' !~ '^[1-9][0-9]{0,8}$' OR
    jsonb_typeof(c->'reason') IS DISTINCT FROM 'string' OR NOT gcms_s05.valid_text(c->>'reason') OR
    jsonb_typeof(c->'expiresAt') IS DISTINCT FROM 'string' OR c->>'expiresAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$' THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
  BEGIN expiry:=(c->>'expiresAt')::timestamptz;
    IF NOT isfinite(expiry) OR to_char(expiry AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>c->>'expiresAt' THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN '{"code":"INVALID_INPUT"}'; END;
  IF EXISTS(SELECT 1 FROM gcms_s05.operation_receipt WHERE tenant_id=p_tenant AND operation_id=c->>'operationId') THEN RETURN '{"code":"OPERATION_CONFLICT"}'; END IF;
  SELECT * INTO r FROM gcms_s06.extension_receipt WHERE tenant_id=p_tenant AND operation_id=c->>'operationId';
  IF r.operation_id IS NOT NULL THEN
    IF r.lead_id<>p_lead OR r.actor_id<>gcms_s02.current_actor() OR r.command<>c THEN RETURN '{"code":"OPERATION_CONFLICT"}'; END IF;
    RETURN jsonb_build_object('operationId',r.operation_id,'appliedVersion',r.applied_version,'replayed',true);
  END IF;
  IF l.version<>(c->>'expectedVersion')::integer THEN RETURN '{"code":"VERSION_CONFLICT"}'; END IF;
  IF expiry<=stamp OR expiry<=l.expires_at THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
  v:=l.version+1;
  UPDATE gcms_s04.lead SET extension_expires_at=expiry,version=v WHERE tenant_id=p_tenant AND id=p_lead;
  SELECT name INTO actor_label FROM gcms_s02_auth."user" WHERE id=gcms_s02.current_actor();
  INSERT INTO gcms_s05.lead_event VALUES(p_tenant,p_lead,gen_random_uuid()::text,v,gcms_s02.current_actor(),actor_label,'retention_extended',
    jsonb_build_object('reason',c->>'reason','before',l.expires_at,'expiresAt',expiry),stamp);
  INSERT INTO gcms_s06.extension_receipt VALUES(p_tenant,c->>'operationId',p_lead,gcms_s02.current_actor(),c,v,stamp);
  INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id,created_at) VALUES(gen_random_uuid()::text,p_tenant,gcms_s02.current_actor(),'lead.retention_extended',p_lead,stamp);
  RETURN jsonb_build_object('operationId',c->>'operationId','appliedVersion',v,'replayed',false);
END $$;

CREATE FUNCTION gcms_s06.notice_state(p_tenant text,p_lead text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object('revision',l.retention_revision,'dueAt',l.expires_at-interval '7 days',
    'status',CASE WHEN l.expires_at-interval '7 days'>clock_timestamp() THEN 'not_due' ELSE coalesce(n.status,'pending') END,
    'blockedReason',n.blocked_reason,'recipients',(SELECT count(*) FROM gcms_s06.job j WHERE j.tenant_id=l.tenant_id AND j.lead_id=l.id AND j.revision=l.retention_revision AND j.kind='notice' AND gcms_s05.eligible(j.tenant_id,j.recipient_id)),
    'captured',(SELECT count(*) FROM gcms_s06.job j WHERE j.tenant_id=l.tenant_id AND j.lead_id=l.id AND j.revision=l.retention_revision AND j.kind='notice' AND j.status='captured' AND gcms_s05.eligible(j.tenant_id,j.recipient_id)))
  FROM gcms_s04.lead l LEFT JOIN gcms_s06.notice n ON n.tenant_id=l.tenant_id AND n.lead_id=l.id AND n.revision=l.retention_revision
  WHERE l.tenant_id=p_tenant AND l.id=p_lead AND l.expires_at>clock_timestamp() AND gcms_s04.has_lead_access(p_tenant) AND gcms_s06.not_deleted(p_tenant,p_lead)
$$;

CREATE FUNCTION gcms_s06.require_scope(p_tenant text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM gcms_s06.worker_scope WHERE tenant_id=p_tenant AND enabled) THEN RAISE EXCEPTION 'Retention scope denied' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION gcms_s06.refresh_notice(p_tenant text,p_lead text,p_revision integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE recipients integer; captured integer; failed integer; processing integer;
BEGIN
  SELECT count(*),count(*) FILTER(WHERE j.status='captured'),count(*) FILTER(WHERE j.status='failed'),count(*) FILTER(WHERE j.status='processing')
    INTO recipients,captured,failed,processing FROM gcms_s06.job j WHERE j.tenant_id=p_tenant AND j.lead_id=p_lead AND j.revision=p_revision AND j.kind='notice' AND gcms_s05.eligible(p_tenant,j.recipient_id);
  UPDATE gcms_s06.notice SET status=CASE WHEN recipients=0 THEN 'blocked' WHEN captured=recipients THEN 'captured' WHEN failed>0 AND failed+captured=recipients THEN 'failed' WHEN processing>0 THEN 'processing' ELSE 'pending' END,
    blocked_reason=CASE WHEN recipients=0 THEN 'recipient_unavailable' WHEN failed>0 AND failed+captured=recipients THEN 'attempts_exhausted' END
    WHERE tenant_id=p_tenant AND lead_id=p_lead AND revision=p_revision;
END $$;
CREATE FUNCTION gcms_s06.worker_claim(p_tenant text,p_worker text,p_limit integer DEFAULT 10) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l record; j record; target text; stamp timestamptz; result jsonb:='[]';
BEGIN
  PERFORM gcms_s06.require_scope(p_tenant);
  IF p_worker IS NULL OR p_worker !~ '^[a-f0-9-]{36}$' OR p_limit IS NULL OR p_limit<1 OR p_limit>10 THEN RAISE EXCEPTION 'Invalid retention claim' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202)); stamp:=clock_timestamp();
  FOR l IN SELECT x.* FROM gcms_s04.lead x JOIN gcms_s06.lead_scope s ON s.tenant_id=x.tenant_id AND s.lead_id=x.id
    WHERE x.tenant_id=p_tenant AND x.expires_at<=stamp+interval '7 days' AND (x.expires_at<=stamp OR
      NOT EXISTS(SELECT 1 FROM gcms_s06.notice n WHERE n.tenant_id=x.tenant_id AND n.lead_id=x.id AND n.revision=x.retention_revision) OR
      EXISTS(SELECT 1 FROM gcms_s02.membership m WHERE m.tenant_id=x.tenant_id AND gcms_s05.eligible(x.tenant_id,m.user_id) AND NOT EXISTS(
        SELECT 1 FROM gcms_s06.job z WHERE z.tenant_id=x.tenant_id AND z.lead_id=x.id AND z.revision=x.retention_revision AND z.kind='notice' AND z.recipient_id=m.user_id)))
    ORDER BY x.expires_at,x.id LIMIT 100 FOR UPDATE OF x LOOP
    UPDATE gcms_s06.job SET status='cancelled',failure_reason='stale_revision',lease_until=NULL
      WHERE tenant_id=p_tenant AND lead_id=l.id AND revision<>l.retention_revision AND status IN ('pending','processing','blocked');
    IF l.expires_at<=stamp THEN
      UPDATE gcms_s06.job SET status='cancelled',failure_reason='lead_expired',lease_until=NULL WHERE tenant_id=p_tenant AND lead_id=l.id AND kind='notice' AND status IN ('pending','processing','blocked');
      INSERT INTO gcms_s06.job(tenant_id,lead_id,revision,kind,recipient_id) VALUES(p_tenant,l.id,l.retention_revision,'delete','system') ON CONFLICT DO NOTHING;
    ELSIF EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=p_tenant AND status IN ('active','suspended')) THEN
      INSERT INTO gcms_s06.notice(tenant_id,lead_id,revision,expires_at) VALUES(p_tenant,l.id,l.retention_revision,l.expires_at) ON CONFLICT DO NOTHING;
      FOR target IN SELECT m.user_id FROM gcms_s02.membership m WHERE m.tenant_id=p_tenant AND gcms_s05.eligible(p_tenant,m.user_id) LOOP
        INSERT INTO gcms_s06.job(tenant_id,lead_id,revision,kind,recipient_id) VALUES(p_tenant,l.id,l.retention_revision,'notice',target) ON CONFLICT DO NOTHING;
      END LOOP;
      PERFORM gcms_s06.refresh_notice(p_tenant,l.id,l.retention_revision);
    END IF;
  END LOOP;
  FOR j IN SELECT x.* FROM gcms_s06.job x JOIN gcms_s06.lead_scope s ON s.tenant_id=x.tenant_id AND s.lead_id=x.lead_id
    WHERE x.tenant_id=p_tenant AND x.available_at<=stamp AND (x.status IN ('pending','blocked') OR (x.status='processing' AND x.lease_until<=stamp))
    ORDER BY CASE x.kind WHEN 'delete' THEN 0 ELSE 1 END,x.available_at,x.id LIMIT 100 FOR UPDATE OF x SKIP LOCKED LOOP
    EXIT WHEN jsonb_array_length(result)>=p_limit;
    IF NOT pg_try_advisory_xact_lock(hashtextextended(j.id,7606)) THEN CONTINUE; END IF;
    IF j.attempts>=5 THEN
      UPDATE gcms_s06.job SET status='failed',failure_reason='attempts_exhausted',lease_until=NULL WHERE id=j.id;
      IF j.kind='notice' THEN PERFORM gcms_s06.refresh_notice(p_tenant,j.lead_id,j.revision); END IF;
      CONTINUE;
    END IF;
    UPDATE gcms_s06.job SET status='processing',attempts=attempts+1,worker_id=p_worker,fence=fence+1,lease_until=stamp+interval '30 seconds',started_at=NULL WHERE id=j.id RETURNING fence INTO j.fence;
    result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'tenantId',p_tenant,'leadId',j.lead_id,'revision',j.revision,'kind',j.kind,'fence',j.fence));
  END LOOP;
  RETURN result;
END $$;

CREATE FUNCTION gcms_s06.worker_notice_start(p_tenant text,p_job text,p_worker text,p_fence integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j gcms_s06.job%ROWTYPE; l gcms_s04.lead%ROWTYPE; recipient_email text; stamp timestamptz;
BEGIN
  PERFORM gcms_s06.require_scope(p_tenant); PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
  SELECT lead_id INTO j.lead_id FROM gcms_s06.job WHERE tenant_id=p_tenant AND id=p_job;
  SELECT * INTO l FROM gcms_s04.lead WHERE tenant_id=p_tenant AND id=j.lead_id FOR UPDATE;
  SELECT * INTO j FROM gcms_s06.job WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE; stamp:=clock_timestamp();
  IF j.id IS NULL OR j.kind<>'notice' OR j.status<>'processing' OR j.worker_id IS DISTINCT FROM p_worker OR j.fence IS DISTINCT FROM p_fence OR j.lease_until<=stamp OR j.attempts>5 OR
    NOT EXISTS(SELECT 1 FROM gcms_s06.lead_scope WHERE tenant_id=p_tenant AND lead_id=j.lead_id) THEN RETURN NULL; END IF;
  IF l.id IS NULL OR l.expires_at<=stamp OR l.expires_at>stamp+interval '7 days' OR l.retention_revision<>j.revision OR NOT gcms_s06.not_deleted(p_tenant,l.id) THEN
    UPDATE gcms_s06.job SET status='cancelled',failure_reason='stale_deadline',lease_until=NULL WHERE id=j.id; RETURN NULL; END IF;
  PERFORM 1 FROM gcms_s02.tenant WHERE id=p_tenant AND status IN ('active','suspended') FOR SHARE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT email INTO recipient_email FROM gcms_s02_auth."user" WHERE id=j.recipient_id FOR SHARE;
  PERFORM 1 FROM gcms_s02.membership WHERE tenant_id=p_tenant AND user_id=j.recipient_id FOR SHARE;
  IF NOT gcms_s05.eligible(p_tenant,j.recipient_id) THEN
    UPDATE gcms_s06.job SET status='blocked',failure_reason='recipient_unavailable',lease_until=NULL,available_at=stamp+interval '1 minute' WHERE id=j.id;
    PERFORM gcms_s06.refresh_notice(p_tenant,j.lead_id,j.revision); RETURN NULL; END IF;
  UPDATE gcms_s06.job SET started_at=stamp,available_at=stamp+interval '1 minute',lease_until=stamp+interval '30 seconds' WHERE id=j.id;
  RETURN jsonb_build_object('deliveryId',j.id,'recipientEmail',recipient_email,'transport','local_capture','signInUrl','http://127.0.0.1:5891/login');
END $$;

CREATE FUNCTION gcms_s06.worker_notice_finish(p_tenant text,p_job text,p_worker text,p_fence integer,p_outcome text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j gcms_s06.job%ROWTYPE; l gcms_s04.lead%ROWTYPE; stamp timestamptz;
BEGIN
  PERFORM gcms_s06.require_scope(p_tenant); PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
  SELECT lead_id INTO j.lead_id FROM gcms_s06.job WHERE tenant_id=p_tenant AND id=p_job;
  SELECT * INTO l FROM gcms_s04.lead WHERE tenant_id=p_tenant AND id=j.lead_id FOR UPDATE;
  SELECT * INTO j FROM gcms_s06.job WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE; stamp:=clock_timestamp();
  IF p_outcome IS NULL OR p_outcome NOT IN ('captured','transient','permanent') OR j.id IS NULL OR j.status<>'processing' OR j.worker_id IS DISTINCT FROM p_worker OR j.fence IS DISTINCT FROM p_fence OR j.started_at IS NULL THEN RETURN false; END IF;
  IF l.id IS NULL OR l.expires_at<=stamp OR l.retention_revision<>j.revision OR NOT gcms_s05.eligible(p_tenant,j.recipient_id) THEN
    UPDATE gcms_s06.job SET status='cancelled',failure_reason='stale_deadline',lease_until=NULL WHERE id=j.id; RETURN false; END IF;
  UPDATE gcms_s06.job SET status=CASE WHEN p_outcome='captured' THEN 'captured' WHEN p_outcome='permanent' OR attempts>=5 THEN 'failed' ELSE 'pending' END,
    failure_reason=CASE WHEN p_outcome='captured' THEN NULL ELSE p_outcome END,completed_at=CASE WHEN p_outcome='captured' THEN stamp END,
    available_at=stamp+CASE WHEN attempts=1 THEN interval '1 minute' WHEN attempts=2 THEN interval '5 minutes' ELSE interval '30 minutes' END,lease_until=NULL WHERE id=j.id;
  PERFORM gcms_s06.refresh_notice(p_tenant,j.lead_id,j.revision); RETURN true;
END $$;

CREATE FUNCTION gcms_s06.worker_delete(p_tenant text,p_job text,p_worker text,p_fence integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j gcms_s06.job%ROWTYPE; l gcms_s04.lead%ROWTYPE; stamp timestamptz;
BEGIN
  PERFORM gcms_s06.require_scope(p_tenant); PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
  SELECT lead_id INTO j.lead_id FROM gcms_s06.job WHERE tenant_id=p_tenant AND id=p_job;
  SELECT * INTO l FROM gcms_s04.lead WHERE tenant_id=p_tenant AND id=j.lead_id FOR UPDATE;
  SELECT * INTO j FROM gcms_s06.job WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE; stamp:=clock_timestamp();
  IF j.id IS NULL OR j.kind<>'delete' OR j.status<>'processing' OR j.worker_id IS DISTINCT FROM p_worker OR j.fence IS DISTINCT FROM p_fence OR j.lease_until<=stamp OR
    NOT EXISTS(SELECT 1 FROM gcms_s06.lead_scope WHERE tenant_id=p_tenant AND lead_id=j.lead_id) THEN RETURN false; END IF;
  IF l.id IS NULL THEN RETURN false; END IF;
  IF l.expires_at>stamp OR l.retention_revision<>j.revision THEN UPDATE gcms_s06.job SET status='cancelled',failure_reason='stale_deadline',lease_until=NULL WHERE id=j.id; RETURN false; END IF;
  INSERT INTO gcms_s06.deletion_decision VALUES(p_tenant,l.id,l.retention_revision,l.expires_at,stamp) ON CONFLICT DO NOTHING;
  -- All FK children which do not already cascade. Cascade also removes S05 event,
  -- command receipts, recipient deliveries and S06 reason/extension commands/jobs.
  DELETE FROM gcms_s04.accepted_request WHERE tenant_id=p_tenant AND lead_id=l.id;
  DELETE FROM gcms_s04.intake_activity WHERE tenant_id=p_tenant AND lead_id=l.id;
  DELETE FROM gcms_s04.notification_intent WHERE tenant_id=p_tenant AND lead_id=l.id;
  DELETE FROM gcms_s04.lead WHERE tenant_id=p_tenant AND id=l.id;
  INSERT INTO gcms_s06.audit_event(tenant_id,event,target_id,created_at) VALUES(p_tenant,'lead.deleted',l.id,stamp);
  RETURN true;
END $$;

-- Scope is a selected M2 fixture tenant. No global sweep is authorized by startup.
CREATE FUNCTION gcms_s06.worker_expire_audit(p_tenant text,p_limit integer DEFAULT 100) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a integer; b integer; c integer; stamp timestamptz;
BEGIN
  PERFORM gcms_s06.require_scope(p_tenant);
  IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'Invalid audit batch' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202)); stamp:=clock_timestamp();
  WITH due AS (SELECT a.id FROM gcms_s02.audit_event a WHERE (a.tenant_id=p_tenant OR (a.tenant_id IS NULL AND EXISTS(SELECT 1 FROM gcms_s06.audit_scope s WHERE s.tenant_id=p_tenant AND s.source='s02' AND s.record_id=a.id))) AND a.created_at<=stamp-interval '365 days' ORDER BY a.created_at,a.id LIMIT p_limit FOR UPDATE SKIP LOCKED)
    DELETE FROM gcms_s02.audit_event WHERE id IN(SELECT id FROM due); GET DIAGNOSTICS a=ROW_COUNT;
  WITH due AS (SELECT id FROM gcms_s04.audit_event WHERE tenant_id=p_tenant AND created_at<=stamp-interval '365 days' ORDER BY created_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED)
    DELETE FROM gcms_s04.audit_event WHERE id IN(SELECT id FROM due); GET DIAGNOSTICS b=ROW_COUNT;
  WITH due AS (SELECT id FROM gcms_s06.audit_event WHERE tenant_id=p_tenant AND created_at<=stamp-interval '365 days' ORDER BY created_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED)
    DELETE FROM gcms_s06.audit_event WHERE id IN(SELECT id FROM due); GET DIAGNOSTICS c=ROW_COUNT;
  RETURN jsonb_build_object('authenticated',a,'anonymous',b,'system',c);
END $$;

DO $$ DECLARE n text; BEGIN
  FOREACH n IN ARRAY ARRAY['deletion_decision','extension_receipt','worker_scope','lead_scope','audit_scope','notice','job','audit_event'] LOOP
    EXECUTE format('ALTER TABLE gcms_s06.%I ENABLE ROW LEVEL SECURITY',n);
    EXECUTE format('ALTER TABLE gcms_s06.%I FORCE ROW LEVEL SECURITY',n);
    EXECUTE format('CREATE POLICY owner_only ON gcms_s06.%I TO gcms_s02_owner USING(true) WITH CHECK(true)',n);
  END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA gcms_s06 FROM PUBLIC,gcms_s02_tenant,gcms_s02_platform,gcms_s02_auth,gcms_s04_intake,gcms_s05_worker,gcms_s06_worker;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gcms_s06 FROM PUBLIC;
GRANT USAGE ON SCHEMA gcms_s06 TO gcms_s02_tenant,gcms_s06_worker;
GRANT EXECUTE ON FUNCTION gcms_s06.extend_lead(text,text,jsonb),gcms_s06.notice_state(text,text),gcms_s06.not_deleted(text,text) TO gcms_s02_tenant;
GRANT EXECUTE ON FUNCTION gcms_s06.worker_claim(text,text,integer),gcms_s06.worker_notice_start(text,text,text,integer),
  gcms_s06.worker_notice_finish(text,text,text,integer,text),gcms_s06.worker_delete(text,text,text,integer),gcms_s06.worker_expire_audit(text,integer) TO gcms_s06_worker;

-- Preserve the S05 command contract and definition, but check time after the lead lock
-- and share operation identity with extensions. Deadline trigger preserves explicit extensions.
CREATE OR REPLACE FUNCTION gcms_s05.lead_command(p_tenant text,p_lead text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l gcms_s04.lead%ROWTYPE; receipt gcms_s05.operation_receipt%ROWTYPE; kind text:=c->>'kind';
  stamp timestamptz; actor_key text:=gcms_s02.current_actor(); actor_label text; payload jsonb; assigned text; v integer;
BEGIN
  PERFORM gcms_s05.authorize(p_tenant,true);
  SELECT * INTO l FROM gcms_s04.lead WHERE tenant_id=p_tenant AND id=p_lead FOR UPDATE;
  stamp:=clock_timestamp();
  IF l.id IS NULL OR l.expires_at<=stamp OR NOT gcms_s06.not_deleted(p_tenant,p_lead) THEN RETURN '{"code":"LEAD_UNAVAILABLE"}'; END IF;
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR jsonb_typeof(c->'operationId') IS DISTINCT FROM 'string' OR
    c->>'operationId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR
    jsonb_typeof(c->'expectedVersion') IS DISTINCT FROM 'number' OR c->>'expectedVersion' !~ '^[1-9][0-9]{0,8}$' OR
    jsonb_typeof(c->'kind') IS DISTINCT FROM 'string' OR kind NOT IN ('assign','note','contact','close','reopen') OR
    NOT(c ?& ARRAY['operationId','expectedVersion','kind']) THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
  IF (kind='assign' AND (NOT(c ? 'assigneeUserId') OR (c-ARRAY['operationId','expectedVersion','kind','assigneeUserId'])<>'{}'::jsonb OR
      (c->'assigneeUserId'<>'null'::jsonb AND (jsonb_typeof(c->'assigneeUserId') IS DISTINCT FROM 'string' OR c->>'assigneeUserId' !~ '^[A-Za-z0-9_-]{1,128}$')))) OR
    (kind='note' AND ((c-ARRAY['operationId','expectedVersion','kind','text'])<>'{}'::jsonb OR jsonb_typeof(c->'text') IS DISTINCT FROM 'string' OR NOT gcms_s05.valid_text(c->>'text'))) OR
    (kind='contact' AND ((c-ARRAY['operationId','expectedVersion','kind','channel','outcome','summary'])<>'{}'::jsonb OR
      jsonb_typeof(c->'summary') IS DISTINCT FROM 'string' OR NOT gcms_s05.valid_text(c->>'summary') OR
      jsonb_typeof(c->'channel') IS DISTINCT FROM 'string' OR jsonb_typeof(c->'outcome') IS DISTINCT FROM 'string' OR
      c->>'channel' NOT IN ('phone','email') OR c->>'outcome' NOT IN ('two_way','unanswered','email_sent') OR
      NOT(c ?& ARRAY['channel','outcome','summary']) OR (c->>'outcome'='unanswered' AND c->>'channel'<>'phone') OR (c->>'outcome'='email_sent' AND c->>'channel'<>'email'))) OR
    (kind='close' AND ((c-ARRAY['operationId','expectedVersion','kind','reason'])<>'{}'::jsonb OR jsonb_typeof(c->'reason') IS DISTINCT FROM 'string' OR c->>'reason' NOT IN ('completed','unreachable','spam','duplicate'))) OR
    (kind='reopen' AND ((c-ARRAY['operationId','expectedVersion','kind','reason'])<>'{}'::jsonb OR jsonb_typeof(c->'reason') IS DISTINCT FROM 'string' OR NOT gcms_s05.valid_text(c->>'reason')))
    THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
  IF EXISTS(SELECT 1 FROM gcms_s06.extension_receipt WHERE tenant_id=p_tenant AND operation_id=c->>'operationId') THEN RETURN '{"code":"OPERATION_CONFLICT"}'; END IF;
  SELECT * INTO receipt FROM gcms_s05.operation_receipt WHERE tenant_id=p_tenant AND operation_id=c->>'operationId';
  IF receipt.operation_id IS NOT NULL THEN
    IF receipt.lead_id<>p_lead OR receipt.actor_id<>actor_key OR receipt.command<>c THEN RETURN '{"code":"OPERATION_CONFLICT"}'; END IF;
    RETURN jsonb_build_object('operationId',receipt.operation_id,'appliedVersion',receipt.applied_version,'replayed',true);
  END IF;
  IF l.version<>(c->>'expectedVersion')::integer THEN RETURN '{"code":"VERSION_CONFLICT"}'; END IF;
  IF (kind IN ('assign','contact','close') AND l.status='closed') OR (kind='reopen' AND l.status<>'closed') OR
    (kind='close' AND c->>'reason'='completed' AND NOT l.has_two_way_contact) OR
    (kind='close' AND c->>'reason'='unreachable' AND NOT l.has_contact_attempt) THEN RETURN '{"code":"INVALID_TRANSITION"}'; END IF;
  IF kind='assign' THEN
    assigned:=c->>'assigneeUserId';
    IF assigned IS NOT NULL THEN
      PERFORM 1 FROM gcms_s02_auth."user" WHERE id=assigned FOR SHARE;
      PERFORM 1 FROM gcms_s02.membership WHERE tenant_id=p_tenant AND user_id=assigned FOR SHARE;
      IF NOT gcms_s05.eligible(p_tenant,assigned) THEN RETURN '{"code":"ASSIGNEE_UNAVAILABLE"}'; END IF;
    END IF;
    payload:=jsonb_build_object('before',gcms_s05.assignee(p_tenant,l.assignee_user_id),'after',gcms_s05.assignee(p_tenant,assigned));
    l.assignee_user_id:=assigned;
    IF l.status IN ('new','assigned') THEN l.status:=CASE WHEN assigned IS NULL THEN 'new' ELSE 'assigned' END; END IF;
    payload:=payload||jsonb_build_object('status',l.status);
  ELSIF kind='note' THEN payload:=jsonb_build_object('text',c->>'text');
  ELSIF kind='contact' THEN
    l.last_activity_at:=stamp; l.expires_at:=stamp+interval '180 days'; l.has_contact_attempt:=true;
    IF c->>'outcome'='two_way' THEN l.has_two_way_contact:=true; l.status:='contacted'; END IF;
    payload:=jsonb_build_object('channel',c->>'channel','outcome',c->>'outcome','summary',c->>'summary','status',l.status);
  ELSIF kind='close' THEN
    l.status:='closed'; l.closed_at:=stamp; l.closure_reason:=c->>'reason';
    l.expires_at:=least(l.expires_at,stamp+interval '90 days',l.last_activity_at+interval '180 days');
    IF l.closure_reason='spam' THEN l.expires_at:=least(l.expires_at,stamp+interval '30 days'); END IF;
    payload:=jsonb_build_object('reason',l.closure_reason,'status','closed');
    -- An intent already started may be in flight. S05 worker start/completion owns that boundary.
    UPDATE gcms_s04.notification_intent SET status='cancelled' WHERE tenant_id=p_tenant AND lead_id=p_lead AND status IN ('pending','blocked');
  ELSE
    l.status:=CASE WHEN l.has_two_way_contact THEN 'contacted' WHEN gcms_s05.eligible(p_tenant,l.assignee_user_id) THEN 'assigned' ELSE 'new' END;
    l.closed_at:=NULL; l.closure_reason:=NULL;
    payload:=jsonb_build_object('reason',c->>'reason','status',l.status);
  END IF;
  v:=l.version+1;
  UPDATE gcms_s04.lead SET version=v,status=l.status,assignee_user_id=l.assignee_user_id,has_contact_attempt=l.has_contact_attempt,
    has_two_way_contact=l.has_two_way_contact,closed_at=l.closed_at,closure_reason=l.closure_reason,last_activity_at=l.last_activity_at,expires_at=l.expires_at
    WHERE tenant_id=p_tenant AND id=p_lead;
  SELECT name INTO actor_label FROM gcms_s02_auth."user" WHERE id=actor_key;
  INSERT INTO gcms_s05.lead_event VALUES(p_tenant,p_lead,gen_random_uuid()::text,v,actor_key,actor_label,kind,payload,stamp);
  INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id,created_at) VALUES(gen_random_uuid()::text,p_tenant,actor_key,'lead.'||kind,p_lead,stamp);
  INSERT INTO gcms_s05.operation_receipt VALUES(p_tenant,c->>'operationId',p_lead,actor_key,c,v,stamp);
  RETURN jsonb_build_object('operationId',c->>'operationId','appliedVersion',v,'replayed',false);
END $$;
