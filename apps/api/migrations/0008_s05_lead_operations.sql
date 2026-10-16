-- S05 forward-only lead operations. Retained intake/auth/publication contracts are unchanged.
DO $$ BEGIN
  IF current_user<>'gcms_s02_owner' OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='gcms_s05' AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
    THEN RAISE EXCEPTION 'S05 bootstrap ownership required'; END IF;
END $$;
REVOKE ALL ON SCHEMA gcms_s05 FROM PUBLIC;

-- Replace only the S04 New-only and initial-activity combined constraints.
-- Keep consent's independent invariant after substantive activity becomes possible.
DO $$ DECLARE c record; n integer:=0; BEGIN
  FOR c IN SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='gcms_s04.lead'::regclass AND contype='c' LOOP
    IF c.definition LIKE '%last_activity_at = created_at%' OR c.definition LIKE '%status = %new%' THEN
      EXECUTE format('ALTER TABLE gcms_s04.lead DROP CONSTRAINT %I',c.conname); n:=n+1;
    END IF;
  END LOOP;
  IF n<>2 THEN RAISE EXCEPTION 'Unexpected retained S04 constraints'; END IF;
END $$;
ALTER TABLE gcms_s04.lead ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0),
  ADD COLUMN code_number bigint, ADD COLUMN assignee_user_id text,
  ADD COLUMN has_contact_attempt boolean NOT NULL DEFAULT false,
  ADD COLUMN has_two_way_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN closed_at timestamptz, ADD COLUMN closure_reason text,
  ADD CONSTRAINT lead_status_s05 CHECK(status IN ('new','assigned','contacted','closed')),
  ADD CONSTRAINT lead_consent_time CHECK(consent_at=created_at),
  ADD CONSTRAINT lead_activity_order CHECK(last_activity_at>=created_at),
  ADD CONSTRAINT lead_closure CHECK((status='closed' AND closed_at IS NOT NULL AND closure_reason IN ('completed','unreachable','spam','duplicate')) OR
    (status<>'closed' AND closed_at IS NULL AND closure_reason IS NULL)),
  ADD CONSTRAINT lead_contact_facts CHECK(NOT has_two_way_contact OR has_contact_attempt);
CREATE TABLE gcms_s05.lead_sequence (tenant_id text PRIMARY KEY REFERENCES gcms_s02.tenant(id), last_number bigint NOT NULL CHECK(last_number>0));
WITH numbered AS (SELECT tenant_id,id,row_number() OVER(PARTITION BY tenant_id ORDER BY created_at,id) AS n FROM gcms_s04.lead)
UPDATE gcms_s04.lead l SET code_number=n.n FROM numbered n WHERE n.tenant_id=l.tenant_id AND n.id=l.id;
INSERT INTO gcms_s05.lead_sequence SELECT tenant_id,max(code_number) FROM gcms_s04.lead GROUP BY tenant_id;
ALTER TABLE gcms_s04.lead ALTER COLUMN code_number SET NOT NULL;
ALTER TABLE gcms_s04.lead ADD CONSTRAINT lead_code_positive CHECK(code_number>0), ADD CONSTRAINT lead_tenant_code UNIQUE(tenant_id,code_number);
CREATE FUNCTION gcms_s05.allocate_lead_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  INSERT INTO gcms_s05.lead_sequence(tenant_id,last_number) VALUES(NEW.tenant_id,1)
    ON CONFLICT(tenant_id) DO UPDATE SET last_number=gcms_s05.lead_sequence.last_number+1 RETURNING last_number INTO NEW.code_number;
  RETURN NEW;
END $$;
CREATE TRIGGER s05_lead_code BEFORE INSERT ON gcms_s04.lead FOR EACH ROW EXECUTE FUNCTION gcms_s05.allocate_lead_code();
CREATE INDEX lead_status_keyset ON gcms_s04.lead(tenant_id,status,created_at DESC,id DESC);
CREATE INDEX lead_assignee_keyset ON gcms_s04.lead(tenant_id,assignee_user_id,created_at DESC,id DESC);

CREATE TABLE gcms_s05.lead_event (
  tenant_id text NOT NULL, lead_id text NOT NULL, id text NOT NULL, version integer NOT NULL,
  actor_id text NOT NULL, actor_name text NOT NULL, kind text NOT NULL CHECK(kind IN ('assign','note','contact','close','reopen')),
  payload jsonb NOT NULL, created_at timestamptz NOT NULL,
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,lead_id,version),
  FOREIGN KEY(tenant_id,lead_id) REFERENCES gcms_s04.lead(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX lead_event_keyset ON gcms_s05.lead_event(tenant_id,lead_id,created_at DESC,id DESC);
CREATE TABLE gcms_s05.operation_receipt (
  tenant_id text NOT NULL, operation_id text NOT NULL, lead_id text NOT NULL, actor_id text NOT NULL,
  command jsonb NOT NULL, applied_version integer NOT NULL, created_at timestamptz NOT NULL,
  PRIMARY KEY(tenant_id,operation_id), FOREIGN KEY(tenant_id,lead_id) REFERENCES gcms_s04.lead(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE gcms_s05.recipient_settings (
  tenant_id text PRIMARY KEY REFERENCES gcms_s02.tenant(id), version integer NOT NULL DEFAULT 1 CHECK(version>0),
  mode text NOT NULL DEFAULT 'default' CHECK(mode IN ('default','selected')),
  initial_user_id text, initial_assigned_at timestamptz,
  recipient_user_ids text[] NOT NULL DEFAULT '{}',
  CHECK((mode='default' AND cardinality(recipient_user_ids)=0) OR (mode='selected' AND cardinality(recipient_user_ids) BETWEEN 1 AND 50))
);
-- Include revoked memberships. A tied earliest timestamp cannot prove the first administrator.
INSERT INTO gcms_s05.recipient_settings(tenant_id,initial_user_id,initial_assigned_at)
SELECT t.id,CASE WHEN count(m.user_id)=1 THEN min(m.user_id) END,min(m.created_at) FROM gcms_s02.tenant t
LEFT JOIN gcms_s02.membership m ON m.tenant_id=t.id AND m.created_at=(SELECT min(x.created_at) FROM gcms_s02.membership x WHERE x.tenant_id=t.id)
GROUP BY t.id;
CREATE FUNCTION gcms_s05.track_initial_recipient() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  INSERT INTO gcms_s05.recipient_settings(tenant_id,initial_user_id,initial_assigned_at) VALUES(NEW.tenant_id,NEW.user_id,NEW.created_at)
  ON CONFLICT(tenant_id) DO UPDATE SET
    initial_user_id=CASE WHEN gcms_s05.recipient_settings.initial_assigned_at IS NULL THEN NEW.user_id
      WHEN NEW.created_at=gcms_s05.recipient_settings.initial_assigned_at THEN NULL ELSE gcms_s05.recipient_settings.initial_user_id END,
    initial_assigned_at=coalesce(gcms_s05.recipient_settings.initial_assigned_at,NEW.created_at);
  RETURN NEW;
END $$;
CREATE TRIGGER s05_initial_recipient AFTER INSERT ON gcms_s02.membership FOR EACH ROW EXECUTE FUNCTION gcms_s05.track_initial_recipient();
CREATE TABLE gcms_s05.settings_receipt (
  tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id), operation_id text NOT NULL, actor_id text NOT NULL,
  command jsonb NOT NULL, applied_version integer NOT NULL, created_at timestamptz NOT NULL,
  PRIMARY KEY(tenant_id,operation_id)
);

CREATE FUNCTION gcms_s05.eligible(p_tenant text,p_user text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM gcms_s02.membership m JOIN gcms_s02_auth."user" u ON u.id=m.user_id
    WHERE m.tenant_id=p_tenant AND m.user_id=p_user AND m.status='active' AND u.active AND u.email_verified AND u.two_factor_enabled)
$$;
CREATE FUNCTION gcms_s05.assignee(p_tenant text,p_user text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT CASE WHEN p_user IS NULL OR NOT gcms_s04.has_lead_access(p_tenant) THEN NULL ELSE jsonb_build_object('userId',p_user,'name',coalesce((SELECT u.name FROM gcms_s02_auth."user" u
    JOIN gcms_s02.membership m ON m.user_id=u.id WHERE u.id=p_user AND m.tenant_id=p_tenant),'Unavailable administrator'),
    'eligible',gcms_s05.eligible(p_tenant,p_user)) END
$$;
CREATE FUNCTION gcms_s05.valid_text(v text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT v IS NOT NULL AND length(v) BETWEEN 1 AND 2000 AND v=btrim(v) AND normalize(v,NFC)=v AND v !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'
$$;
CREATE FUNCTION gcms_s05.authorize(p_tenant text,p_write boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor jsonb; tenant_status text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
  actor:=gcms_s02.lock_actor(gcms_s02.current_actor(),nullif(current_setting('gcms.session_id',true),''));
  SELECT status INTO tenant_status FROM gcms_s02.tenant WHERE id=p_tenant FOR SHARE;
  PERFORM 1 FROM gcms_s02.membership WHERE tenant_id=p_tenant AND user_id=gcms_s02.current_actor() FOR SHARE;
  IF p_tenant IS DISTINCT FROM nullif(current_setting('gcms.tenant_id',true),'') OR NOT gcms_s02.has_membership(p_tenant,true) OR
    tenant_status IS NULL OR tenant_status NOT IN ('active','suspended') OR (p_write AND tenant_status<>'active') THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
END $$;

-- Narrow commands, including the DB path, enforce authorization and expiry before receipt replay.
CREATE FUNCTION gcms_s05.lead_command(p_tenant text,p_lead text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l gcms_s04.lead%ROWTYPE; receipt gcms_s05.operation_receipt%ROWTYPE; kind text:=c->>'kind';
  stamp timestamptz; actor_key text:=gcms_s02.current_actor(); actor_label text; payload jsonb; assigned text; v integer;
BEGIN
  PERFORM gcms_s05.authorize(p_tenant,true); stamp:=clock_timestamp();
  SELECT * INTO l FROM gcms_s04.lead WHERE tenant_id=p_tenant AND id=p_lead FOR UPDATE;
  IF l.id IS NULL OR l.expires_at<=stamp THEN RETURN '{"code":"LEAD_UNAVAILABLE"}'; END IF;
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR jsonb_typeof(c->'operationId') IS DISTINCT FROM 'string' OR
    c->>'operationId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR
    jsonb_typeof(c->'expectedVersion') IS DISTINCT FROM 'number' OR c->>'expectedVersion' !~ '^[1-9][0-9]{0,8}$' OR
    jsonb_typeof(c->'kind') IS DISTINCT FROM 'string' OR kind NOT IN ('assign','note','contact','close','reopen') OR
    NOT(c ?& ARRAY['operationId','expectedVersion','kind']) THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
  IF (kind='assign' AND (NOT(c ? 'assigneeUserId') OR (c-ARRAY['operationId','expectedVersion','kind','assigneeUserId'])<>'{}'::jsonb OR
      (c->'assigneeUserId'<>'null'::jsonb AND (jsonb_typeof(c->'assigneeUserId') IS DISTINCT FROM 'string' OR c->>'assigneeUserId' !~ '^[a-f0-9-]{36}$')))) OR
    (kind='note' AND ((c-ARRAY['operationId','expectedVersion','kind','text'])<>'{}'::jsonb OR jsonb_typeof(c->'text') IS DISTINCT FROM 'string' OR NOT gcms_s05.valid_text(c->>'text'))) OR
    (kind='contact' AND ((c-ARRAY['operationId','expectedVersion','kind','channel','outcome','summary'])<>'{}'::jsonb OR
      jsonb_typeof(c->'summary') IS DISTINCT FROM 'string' OR NOT gcms_s05.valid_text(c->>'summary') OR
      jsonb_typeof(c->'channel') IS DISTINCT FROM 'string' OR jsonb_typeof(c->'outcome') IS DISTINCT FROM 'string' OR
      c->>'channel' NOT IN ('phone','email') OR c->>'outcome' NOT IN ('two_way','unanswered','email_sent') OR
      NOT(c ?& ARRAY['channel','outcome','summary']) OR (c->>'outcome'='unanswered' AND c->>'channel'<>'phone') OR (c->>'outcome'='email_sent' AND c->>'channel'<>'email'))) OR
    (kind='close' AND ((c-ARRAY['operationId','expectedVersion','kind','reason'])<>'{}'::jsonb OR jsonb_typeof(c->'reason') IS DISTINCT FROM 'string' OR c->>'reason' NOT IN ('completed','unreachable','spam','duplicate'))) OR
    (kind='reopen' AND ((c-ARRAY['operationId','expectedVersion','kind','reason'])<>'{}'::jsonb OR jsonb_typeof(c->'reason') IS DISTINCT FROM 'string' OR NOT gcms_s05.valid_text(c->>'reason')))
    THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
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

-- Expand durable intent states before commands can close an unstarted notification.
ALTER TABLE gcms_s04.notification_intent DROP CONSTRAINT notification_intent_status_check;
ALTER TABLE gcms_s04.notification_intent ADD CONSTRAINT notification_intent_status_s05 CHECK(status IN ('pending','processing','blocked','captured','failed','cancelled')),
  ADD COLUMN blocked_reason text;
CREATE FUNCTION gcms_s05.lead_notification(p_tenant text,p_lead text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object('transport','local_capture','status',i.status,'blockedReason',i.blocked_reason)
  FROM gcms_s04.notification_intent i JOIN gcms_s04.lead l ON l.tenant_id=i.tenant_id AND l.id=i.lead_id
  WHERE i.tenant_id=p_tenant AND i.lead_id=p_lead AND gcms_s04.has_lead_access(p_tenant) AND l.expires_at>clock_timestamp()
$$;

CREATE FUNCTION gcms_s05.read_settings(p_tenant text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s gcms_s05.recipient_settings%ROWTYPE; recipients jsonb; good boolean; tenant_status text;
BEGIN
  PERFORM gcms_s05.authorize(p_tenant,false);
  SELECT * INTO s FROM gcms_s05.recipient_settings WHERE tenant_id=p_tenant;
  SELECT status INTO tenant_status FROM gcms_s02.tenant WHERE id=p_tenant;
  SELECT coalesce(jsonb_agg(gcms_s05.assignee(p_tenant,id) ORDER BY id),'[]'::jsonb),coalesce(bool_or(gcms_s05.eligible(p_tenant,id)),false)
    INTO recipients,good FROM unnest(CASE WHEN s.mode='default' THEN ARRAY[s.initial_user_id] ELSE s.recipient_user_ids END) id WHERE id IS NOT NULL;
  RETURN jsonb_build_object('version',coalesce(s.version,1),'mode',coalesce(s.mode,'default'),'recipientUserIds',coalesce(to_jsonb(s.recipient_user_ids),'[]'),
    'defaultRecipient',gcms_s05.assignee(p_tenant,s.initial_user_id),'needsConfiguration',NOT good,'recipients',recipients,
    'capabilities',jsonb_build_object('canWrite',tenant_status='active','reason',CASE WHEN tenant_status='suspended' THEN 'tenant_suspended' END));
END $$;
CREATE FUNCTION gcms_s05.settings_command(p_tenant text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s gcms_s05.recipient_settings%ROWTYPE; r gcms_s05.settings_receipt%ROWTYPE; ids text[]; target text; stamp timestamptz; v integer;
BEGIN
  PERFORM gcms_s05.authorize(p_tenant,true); stamp:=clock_timestamp();
  IF NOT EXISTS(SELECT 1 FROM gcms_s02_auth.session x WHERE x.id=nullif(current_setting('gcms.session_id',true),'') AND x.user_id=gcms_s02.current_actor()
    AND ((x.created_at>stamp-interval '5 minutes' AND x.created_at<=stamp) OR EXISTS(SELECT 1 FROM gcms_s02_auth.reauth_grant g WHERE g.session_id=x.id AND g.expires_at>stamp AND g.mfa)))
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

DO $$ DECLARE n text; BEGIN
  FOREACH n IN ARRAY ARRAY['lead_sequence','lead_event','operation_receipt','recipient_settings','settings_receipt'] LOOP
    EXECUTE format('ALTER TABLE gcms_s05.%I ENABLE ROW LEVEL SECURITY',n);
    EXECUTE format('ALTER TABLE gcms_s05.%I FORCE ROW LEVEL SECURITY',n);
    EXECUTE format('CREATE POLICY owner_only ON gcms_s05.%I TO gcms_s02_owner USING(true) WITH CHECK(true)',n);
  END LOOP;
END $$;
CREATE POLICY history_tenant ON gcms_s05.lead_event FOR SELECT TO gcms_s02_tenant USING(gcms_s04.has_lead_access(tenant_id) AND
  EXISTS(SELECT 1 FROM gcms_s04.lead l WHERE l.tenant_id=lead_event.tenant_id AND l.id=lead_event.lead_id AND l.expires_at>clock_timestamp()));
REVOKE ALL ON ALL TABLES IN SCHEMA gcms_s05 FROM PUBLIC,gcms_s02_tenant,gcms_s02_auth,gcms_s02_platform,gcms_s04_intake,gcms_s05_worker;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gcms_s05 FROM PUBLIC;
GRANT USAGE ON SCHEMA gcms_s05 TO gcms_s02_tenant;
GRANT SELECT ON gcms_s05.lead_event TO gcms_s02_tenant;
GRANT EXECUTE ON FUNCTION gcms_s05.assignee(text,text),gcms_s05.lead_notification(text,text),gcms_s05.lead_command(text,text,jsonb),gcms_s05.read_settings(text),gcms_s05.settings_command(text,jsonb) TO gcms_s02_tenant;
