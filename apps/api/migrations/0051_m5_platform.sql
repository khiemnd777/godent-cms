-- M5 approved local platform/lifecycle. No retained business rows are rewritten.
DO $$ BEGIN
 IF current_user<>'gcms_s02_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='gcms_m5_worker' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb)
 THEN RAISE EXCEPTION 'M5 owner and narrow worker bootstrap required';END IF;
END $$;

-- Bootstrap owns namespace creation; the migration role has no database CREATE privilege.
DO $$ DECLARE ns oid;BEGIN
 SELECT oid INTO ns FROM pg_namespace WHERE nspname='gcms_m5' AND nspowner=(SELECT oid FROM pg_roles WHERE rolname='gcms_s02_owner');
 IF ns IS NULL OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace=ns) OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace=ns) OR EXISTS(SELECT 1 FROM pg_type WHERE typnamespace=ns) THEN RAISE EXCEPTION 'M5 requires its owned empty namespace';END IF;
END $$;
REVOKE ALL ON SCHEMA gcms_m5 FROM PUBLIC;
CREATE TABLE gcms_m5.tenant_state(
 tenant_id text PRIMARY KEY REFERENCES gcms_s02.tenant(id),version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 mode text NOT NULL DEFAULT 'unset' CHECK(mode IN ('unset','monitor','enforced')),content_limit bigint CHECK(content_limit BETWEEN 0 AND 9007199254740991),media_limit bigint CHECK(media_limit BETWEEN 0 AND 9007199254740991),
 phase text NOT NULL DEFAULT 'none' CHECK(phase IN ('none','requested','confirmed','executing','failed','completed','cancelled')),
 request_id text,execute_after timestamptz,requested_by text,confirmed_by text,confirmed_membership_at timestamptz,
 reason text,started_at timestamptz,completed_at timestamptz,worker_id text,fence integer NOT NULL DEFAULT 0,lease_until timestamptz,failure_code text,
 CHECK(mode<>'enforced' OR content_limit IS NOT NULL OR media_limit IS NOT NULL),CHECK(mode<>'unset' OR (content_limit IS NULL AND media_limit IS NULL)),CHECK(execute_after IS NULL OR isfinite(execute_after))
);
CREATE TABLE gcms_m5.command_receipt(tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id),operation_id text NOT NULL,actor_id text NOT NULL,action text NOT NULL,command jsonb NOT NULL,applied_version integer NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(tenant_id,operation_id));
CREATE TABLE gcms_m5.content_identity(tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id),kind text NOT NULL,resource_id text NOT NULL,PRIMARY KEY(tenant_id,kind,resource_id));
CREATE TABLE gcms_m5.media_object(tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id),asset_id text NOT NULL,object_key text NOT NULL,stored_bytes bigint NOT NULL DEFAULT 0 CHECK(stored_bytes>=0),reserved_bytes bigint NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),deleted_at timestamptz,PRIMARY KEY(tenant_id,object_key),CHECK(deleted_at IS NULL OR (stored_bytes=0 AND reserved_bytes=0)));
CREATE TABLE gcms_m5.worker_scope(tenant_id text PRIMARY KEY REFERENCES gcms_s02.tenant(id),allow_deletion boolean NOT NULL DEFAULT false);
CREATE TABLE gcms_m5.tombstone(tenant_id text PRIMARY KEY,request_id text NOT NULL,version integer NOT NULL,deleted_at timestamptz NOT NULL);
CREATE TABLE gcms_m5.deletion_object(tenant_id text NOT NULL,request_id text NOT NULL,asset_id text NOT NULL,object_key text NOT NULL,deleted_at timestamptz,PRIMARY KEY(tenant_id,request_id,object_key));
DO $$ DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['tenant_state','command_receipt','content_identity','media_object','worker_scope','tombstone','deletion_object'] LOOP
 EXECUTE format('ALTER TABLE gcms_m5.%I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('ALTER TABLE gcms_m5.%I FORCE ROW LEVEL SECURITY',n);EXECUTE format('CREATE POLICY owner_all ON gcms_m5.%I TO gcms_s02_owner USING(true) WITH CHECK(true)',n);
 END LOOP;END $$;

CREATE FUNCTION gcms_m5.is_live(t text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=t AND status='active') AND NOT EXISTS(SELECT 1 FROM gcms_m5.tenant_state WHERE tenant_id=t AND started_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM gcms_m5.tombstone WHERE tenant_id=t)
$$;
CREATE FUNCTION gcms_m5.is_readable(t text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=t AND status IN ('active','suspended')) AND NOT EXISTS(SELECT 1 FROM gcms_m5.tenant_state WHERE tenant_id=t AND started_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM gcms_m5.tombstone WHERE tenant_id=t)
$$;
CREATE FUNCTION gcms_m5.require_read(t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));PERFORM gcms_s02.lock_actor(gcms_s02.current_actor(),nullif(current_setting('gcms.session_id',true),''));
 PERFORM 1 FROM gcms_s02.membership WHERE tenant_id=t AND user_id=gcms_s02.current_actor() FOR SHARE;
 IF t IS DISTINCT FROM nullif(current_setting('gcms.tenant_id',true),'') OR NOT gcms_s02.has_current_membership(t) OR NOT gcms_m5.is_readable(t) THEN RAISE EXCEPTION 'Read denied' USING ERRCODE='42501';END IF;
END $$;
CREATE FUNCTION gcms_m5.require_safety(t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM gcms_m5.require_read(t);IF NOT gcms_s02.has_recent_auth() THEN RAISE EXCEPTION 'REAUTH_REQUIRED' USING ERRCODE='42501';END IF;
END $$;
CREATE FUNCTION gcms_m5.require_platform(t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE actor jsonb;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));actor:=gcms_s02.lock_actor(gcms_s02.current_actor(),nullif(current_setting('gcms.session_id',true),''));
 IF actor->'platformAdmin' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Platform denied' USING ERRCODE='42501';END IF;
END $$;
CREATE FUNCTION gcms_m5.cleanup_authorized(t text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT session_user='gcms_m5_worker' AND t=nullif(current_setting('gcms.m5_cleanup',true),'') AND EXISTS(SELECT 1 FROM gcms_m5.tenant_state s JOIN gcms_m5.worker_scope w USING(tenant_id) WHERE s.tenant_id=t AND s.started_at IS NOT NULL AND s.phase='executing' AND w.allow_deletion AND s.worker_id=nullif(current_setting('gcms.m5_worker',true),'') AND s.fence::text=current_setting('gcms.m5_fence',true) AND s.lease_until>clock_timestamp())
$$;
-- Metadata-only baseline adoption: unchanged legacy/M3/M4 resource identities count once.
INSERT INTO gcms_m5.content_identity SELECT tenant_id,'service',id FROM gcms_s02.service_draft UNION SELECT tenant_id,kind,id FROM gcms_m3.resource UNION SELECT tenant_id,kind,id FROM gcms_m4.identity UNION SELECT tenant_id,kind,resource_id FROM gcms_m4.variant WHERE kind<>'config' ON CONFLICT DO NOTHING;
INSERT INTO gcms_m5.media_object(tenant_id,asset_id,object_key,stored_bytes,reserved_bytes)
 SELECT tenant_id,id,'original/'||tenant_id||'/'||id,CASE WHEN state='uploading' THEN 0 ELSE bytes END,CASE WHEN state='uploading' THEN bytes ELSE 0 END FROM gcms_s07.asset;
INSERT INTO gcms_m5.media_object(tenant_id,asset_id,object_key,stored_bytes,reserved_bytes,deleted_at)
 SELECT tenant_id,asset_id,object_key,CASE WHEN deleted_at IS NULL AND ready THEN bytes ELSE 0 END,CASE WHEN deleted_at IS NULL AND NOT ready THEN 5242880 ELSE 0 END,deleted_at FROM gcms_s07.derivative;
INSERT INTO gcms_m5.media_object(tenant_id,asset_id,object_key,reserved_bytes)
 SELECT tenant_id,id,'budget/'||id,5242880 FROM gcms_s07.asset a WHERE a.state IN ('uploading','processing') AND NOT EXISTS(SELECT 1 FROM gcms_s07.derivative d WHERE d.tenant_id=a.tenant_id AND d.asset_id=a.id AND d.deleted_at IS NULL);

CREATE FUNCTION gcms_m5.admit(t text,dimension text,growth bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE p gcms_m5.tenant_state%ROWTYPE;usage_value bigint;limit_value bigint;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));IF NOT gcms_m5.is_live(t) THEN RAISE EXCEPTION 'Tenant growth denied' USING ERRCODE='42501';END IF;
 IF growth<=0 THEN RETURN;END IF;SELECT * INTO p FROM gcms_m5.tenant_state WHERE tenant_id=t;
 IF dimension='content_items' THEN SELECT count(*) INTO usage_value FROM gcms_m5.content_identity WHERE tenant_id=t;limit_value:=p.content_limit;
 ELSIF dimension='media_bytes' THEN SELECT coalesce(sum(stored_bytes+reserved_bytes),0) INTO usage_value FROM gcms_m5.media_object WHERE tenant_id=t;limit_value:=p.media_limit;
 ELSE RAISE EXCEPTION 'Unknown quota dimension';END IF;
 IF p.mode='enforced' AND limit_value IS NOT NULL AND usage_value+growth>limit_value THEN RAISE EXCEPTION 'QUOTA_EXCEEDED' USING ERRCODE='P5501',DETAIL=jsonb_build_object('code','QUOTA_EXCEEDED','dimension',dimension,'usage',usage_value,'limit',limit_value)::text;END IF;
END $$;
CREATE FUNCTION gcms_m5.content_admission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE k text;r text;BEGIN
 k:=CASE WHEN TG_TABLE_NAME='service_draft' THEN 'service' ELSE to_jsonb(NEW)->>'kind' END;r:=CASE WHEN TG_TABLE_NAME='variant' THEN to_jsonb(NEW)->>'resource_id' ELSE to_jsonb(NEW)->>'id' END;
 IF k='config' THEN RETURN NEW;END IF;PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id,7202));
 IF NOT EXISTS(SELECT 1 FROM gcms_m5.content_identity WHERE tenant_id=NEW.tenant_id AND kind=k AND resource_id=r) THEN
  PERFORM gcms_m5.admit(NEW.tenant_id,'content_items',1);INSERT INTO gcms_m5.content_identity VALUES(NEW.tenant_id,k,r) ON CONFLICT DO NOTHING;
 END IF;RETURN NEW;
END $$;
CREATE FUNCTION gcms_m5.status_view(t text,p boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s gcms_m5.tenant_state%ROWTYPE;tenant_status text;effective text;items bigint;stored bigint;reserved bigint;readable boolean;BEGIN
 IF p THEN PERFORM gcms_m5.require_platform(t);ELSE PERFORM gcms_m5.require_read(t);END IF;
 SELECT status INTO tenant_status FROM gcms_s02.tenant WHERE id=t;IF tenant_status IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO s FROM gcms_m5.tenant_state WHERE tenant_id=t;
 effective:=CASE WHEN s.phase='completed' THEN 'deleted' WHEN s.started_at IS NOT NULL THEN 'deleting' ELSE tenant_status END;readable:=effective IN ('active','suspended') AND gcms_s02.has_current_membership(t);
 SELECT count(*) INTO items FROM gcms_m5.content_identity WHERE tenant_id=t;SELECT coalesce(sum(stored_bytes),0),coalesce(sum(reserved_bytes),0) INTO stored,reserved FROM gcms_m5.media_object WHERE tenant_id=t;
 RETURN jsonb_build_object('tenantId',t,'status',effective,'version',coalesce(s.version,0),
 'policy',jsonb_build_object('mode',coalesce(s.mode,'unset'),'contentItemsLimit',s.content_limit,'mediaBytesLimit',s.media_limit),
 'usage',jsonb_build_object('contentItems',items,'storedMediaBytes',stored,'reservedMediaBytes',reserved,'mediaAccounting','confirmed-and-reserved'),
 'capabilities',jsonb_build_object('read',readable,'export',readable,'businessWrite',readable AND effective='active','safetyWrite',readable),
 'deletion',jsonb_build_object('requestId',s.request_id,'phase',coalesce(s.phase,'none'),'executeAfter',to_char(s.execute_after AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'scope',CASE WHEN s.request_id IS NOT NULL THEN 'all-active-tenant-data' END,'confirmed',s.confirmed_by IS NOT NULL,'failureCode',s.failure_code,'completedAt',to_char(s.completed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
 'readinessWarnings',CASE WHEN effective='active' THEN jsonb_build_array('Public delivery still requires current binding/TLS, publication and media eligibility.','Reactivation does not restore revoked rights or dispatch backlog.') ELSE '[]'::jsonb END);
END $$;
CREATE FUNCTION gcms_m5.valid_command(c jsonb,keys text[]) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_typeof(c)='object' AND c ?& keys AND (c-keys)='{}' AND jsonb_typeof(c->'operationId')='string' AND gcms_m3.uuid(c->>'operationId') AND jsonb_typeof(c->'expectedVersion')='number' AND CASE WHEN c->>'expectedVersion'~'^(0|[1-9][0-9]{0,9})$' THEN (c->>'expectedVersion')::numeric<=2147483646 ELSE false END AND jsonb_typeof(c->'reason')='string' AND length(btrim(c->>'reason')) BETWEEN 1 AND 500,false)
$$;
CREATE FUNCTION gcms_m5.invalidate_confirmation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE t text;u text;BEGIN
 IF TG_TABLE_SCHEMA='gcms_s02_auth' THEN
  IF (NEW.active OR NOT OLD.active) AND (NEW.email_verified OR NOT OLD.email_verified) THEN RETURN NEW;END IF;u:=OLD.id;
  FOR t IN SELECT tenant_id FROM gcms_m5.tenant_state WHERE confirmed_by=u AND phase='confirmed' AND started_at IS NULL ORDER BY tenant_id LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));UPDATE gcms_m5.tenant_state SET phase='requested',confirmed_by=NULL,confirmed_membership_at=NULL,version=version+1 WHERE tenant_id=t AND confirmed_by=u AND phase='confirmed' AND started_at IS NULL;
  END LOOP;RETURN NEW;
 END IF;
 t:=OLD.tenant_id;u:=OLD.user_id;
 IF TG_OP='DELETE' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));UPDATE gcms_m5.tenant_state SET phase='requested',confirmed_by=NULL,confirmed_membership_at=NULL,version=version+1 WHERE tenant_id=t AND confirmed_by=u AND phase='confirmed' AND started_at IS NULL;
 END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER m5_confirmation_membership AFTER UPDATE OR DELETE ON gcms_s02.membership FOR EACH ROW EXECUTE FUNCTION gcms_m5.invalidate_confirmation();
CREATE TRIGGER m5_confirmation_identity AFTER UPDATE OF active,email_verified ON gcms_s02_auth."user" FOR EACH ROW EXECUTE FUNCTION gcms_m5.invalidate_confirmation();
CREATE FUNCTION gcms_m5.command(t text,action text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s gcms_m5.tenant_state%ROWTYPE;prior gcms_m5.command_receipt%ROWTYPE;keys text[];p jsonb;expiry timestamptz;member_stamp timestamptz;is_platform boolean;out jsonb;BEGIN
 is_platform:=action IN ('quota','lifecycle','execute');
 IF is_platform THEN PERFORM gcms_m5.require_platform(t);ELSE PERFORM gcms_m5.require_read(t);END IF;
 IF NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}';END IF;
 IF NOT EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=t) THEN RETURN '{"code":"NOT_FOUND"}';END IF;
 keys:=ARRAY['operationId','expectedVersion','reason']||CASE action WHEN 'quota' THEN ARRAY['policy'] WHEN 'lifecycle' THEN ARRAY['action'] WHEN 'request' THEN ARRAY['tenantId','scope','executeAfter'] WHEN 'confirm' THEN ARRAY['tenantId','scope','executeAfter','requestId'] WHEN 'execute' THEN ARRAY['requestId'] WHEN 'cancel' THEN '{}'::text[] ELSE NULL END;
 IF keys IS NULL OR NOT gcms_m5.valid_command(c,keys) THEN RETURN '{"code":"INVALID_INPUT"}';END IF;
 SELECT * INTO prior FROM gcms_m5.command_receipt WHERE tenant_id=t AND operation_id=c->>'operationId';
 IF prior.operation_id IS NOT NULL THEN
  IF prior.actor_id<>gcms_s02.current_actor() OR prior.action<>action OR prior.command<>c THEN RETURN '{"code":"OPERATION_CONFLICT"}';END IF;
  RETURN jsonb_build_object('operationId',prior.operation_id,'replayed',true,'status',gcms_m5.status_view(t,is_platform));
 END IF;
 INSERT INTO gcms_m5.tenant_state(tenant_id) VALUES(t) ON CONFLICT DO NOTHING;SELECT * INTO s FROM gcms_m5.tenant_state WHERE tenant_id=t FOR UPDATE;
 IF s.version<>(c->>'expectedVersion')::integer THEN RETURN '{"code":"VERSION_CONFLICT"}';END IF;
 IF s.started_at IS NOT NULL THEN RETURN '{"code":"IRREVERSIBLE"}';END IF;
 IF action='quota' THEN
  p:=c->'policy';IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR NOT(p ?& ARRAY['mode','contentItemsLimit','mediaBytesLimit']) OR (p-ARRAY['mode','contentItemsLimit','mediaBytesLimit'])<>'{}' OR coalesce(p->>'mode','') NOT IN ('unset','monitor','enforced') THEN RETURN '{"code":"INVALID_INPUT"}';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(p-ARRAY['mode']) e WHERE e.value<>'null'::jsonb AND (jsonb_typeof(e.value)<>'number' OR (e.value#>>'{}')!~'^(0|[1-9][0-9]{0,15})$')) THEN RETURN '{"code":"INVALID_INPUT"}';END IF;
  IF coalesce((p->>'contentItemsLimit')::numeric,0)>9007199254740991 OR coalesce((p->>'mediaBytesLimit')::numeric,0)>9007199254740991 OR (p->>'mode'='enforced' AND p->'contentItemsLimit'='null' AND p->'mediaBytesLimit'='null') OR (p->>'mode'='unset' AND (p->'contentItemsLimit'<>'null' OR p->'mediaBytesLimit'<>'null')) THEN RETURN '{"code":"INVALID_INPUT"}';END IF;
  UPDATE gcms_m5.tenant_state SET mode=p->>'mode',content_limit=(p->>'contentItemsLimit')::bigint,media_limit=(p->>'mediaBytesLimit')::bigint WHERE tenant_id=t;
 ELSIF action='lifecycle' THEN
  IF coalesce(c->>'action','') NOT IN ('suspend','reactivate') THEN RETURN '{"code":"INVALID_INPUT"}';END IF;
  UPDATE gcms_s02.tenant SET status=CASE c->>'action' WHEN 'suspend' THEN 'suspended' ELSE 'active' END,updated_at=clock_timestamp() WHERE id=t;
 ELSIF action IN ('request','confirm') THEN
  IF c->>'tenantId' IS DISTINCT FROM t OR c->>'scope' IS DISTINCT FROM 'all-active-tenant-data' OR jsonb_typeof(c->'executeAfter') IS DISTINCT FROM 'string' OR c->>'executeAfter'!~'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$' THEN RETURN '{"code":"INVALID_INPUT"}';END IF;
  BEGIN expiry:=(c->>'executeAfter')::timestamptz;EXCEPTION WHEN OTHERS THEN RETURN '{"code":"INVALID_INPUT"}';END;
  IF NOT isfinite(expiry) THEN RETURN '{"code":"INVALID_INPUT"}';END IF;
  IF action='request' THEN
   IF s.phase NOT IN ('none','cancelled') OR expiry<clock_timestamp() THEN RETURN '{"code":"DELETION_UNAVAILABLE"}';END IF;
   UPDATE gcms_m5.tenant_state SET phase='requested',request_id=gen_random_uuid()::text,execute_after=expiry,requested_by=gcms_s02.current_actor(),confirmed_by=NULL,confirmed_membership_at=NULL,reason=c->>'reason',failure_code=NULL WHERE tenant_id=t;
  ELSE
   IF s.phase<>'requested' OR c->>'requestId' IS DISTINCT FROM s.request_id OR expiry IS DISTINCT FROM s.execute_after THEN RETURN '{"code":"CONFIRMATION_REQUIRED"}';END IF;
   SELECT updated_at INTO member_stamp FROM gcms_s02.membership WHERE tenant_id=t AND user_id=gcms_s02.current_actor() AND status='active' FOR SHARE;
   UPDATE gcms_m5.tenant_state SET phase='confirmed',confirmed_by=gcms_s02.current_actor(),confirmed_membership_at=member_stamp WHERE tenant_id=t;
  END IF;
 ELSIF action='cancel' THEN
  IF s.phase NOT IN ('requested','confirmed') THEN RETURN '{"code":"DELETION_UNAVAILABLE"}';END IF;
  UPDATE gcms_m5.tenant_state SET phase='cancelled',confirmed_by=NULL,confirmed_membership_at=NULL WHERE tenant_id=t;
 ELSIF action='execute' THEN
  IF s.phase<>'confirmed' OR c->>'requestId' IS DISTINCT FROM s.request_id OR s.confirmed_by IS NULL OR NOT EXISTS(SELECT 1 FROM gcms_s02.membership m JOIN gcms_s02_auth."user" u ON u.id=m.user_id WHERE m.tenant_id=t AND m.user_id=s.confirmed_by AND m.status='active' AND m.updated_at=s.confirmed_membership_at AND u.active AND u.email_verified) THEN RETURN '{"code":"CONFIRMATION_REQUIRED"}';END IF;
  IF s.execute_after IS NULL OR s.execute_after>clock_timestamp() THEN RETURN '{"code":"EXECUTE_AFTER"}';END IF;
  IF NOT EXISTS(SELECT 1 FROM gcms_m5.worker_scope WHERE tenant_id=t AND allow_deletion) THEN RETURN '{"code":"DELETION_UNAVAILABLE"}';END IF;
  UPDATE gcms_m5.tenant_state SET phase='executing',started_at=clock_timestamp(),failure_code=NULL WHERE tenant_id=t;
  UPDATE gcms_s02.tenant SET status='suspended',updated_at=clock_timestamp() WHERE id=t;
  -- Every object identity is captured before effects. Unknown reservations remain targets.
  INSERT INTO gcms_m5.deletion_object(tenant_id,request_id,asset_id,object_key)
  SELECT t,s.request_id,asset_id,object_key FROM gcms_m5.media_object WHERE tenant_id=t AND object_key NOT LIKE 'budget/%'
  UNION SELECT t,s.request_id,id,'original/'||t||'/'||id FROM gcms_s07.asset WHERE tenant_id=t
  UNION SELECT t,s.request_id,asset_id,object_key FROM gcms_s07.derivative WHERE tenant_id=t ON CONFLICT DO NOTHING;
 END IF;
 UPDATE gcms_m5.tenant_state SET version=version+1 WHERE tenant_id=t RETURNING * INTO s;
 INSERT INTO gcms_m5.command_receipt VALUES(t,c->>'operationId',gcms_s02.current_actor(),action,c,s.version,clock_timestamp());
 INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id) VALUES(gen_random_uuid()::text,t,gcms_s02.current_actor(),'m5.'||action,t);
 out:=jsonb_build_object('operationId',c->>'operationId','replayed',false,'status',gcms_m5.status_view(t,is_platform));RETURN out;
END $$;
CREATE TRIGGER m5_content_admission BEFORE INSERT ON gcms_s02.service_draft FOR EACH ROW EXECUTE FUNCTION gcms_m5.content_admission();
CREATE FUNCTION gcms_m5.initialize_new_tenant(t text,p jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE result jsonb;BEGIN
 PERFORM gcms_m5.require_platform(t);IF NOT gcms_s02.has_recent_auth() THEN RAISE EXCEPTION 'REAUTH_REQUIRED' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=t AND xmin::text=pg_current_xact_id()::text) OR EXISTS(SELECT 1 FROM gcms_m5.tenant_state WHERE tenant_id=t) OR coalesce(p->>'mode','') NOT IN ('monitor','enforced') THEN RAISE EXCEPTION 'Explicit new tenant quota policy required' USING ERRCODE='23514';END IF;
 result:=gcms_m5.command(t,'quota',jsonb_build_object('operationId',gen_random_uuid()::text,'expectedVersion',0,'reason','Initial explicit quota policy','policy',p));IF result ? 'code' THEN RAISE EXCEPTION 'Invalid initial quota policy' USING ERRCODE='23514';END IF;
END $$;
CREATE TRIGGER m5_content_admission BEFORE INSERT ON gcms_m3.resource FOR EACH ROW EXECUTE FUNCTION gcms_m5.content_admission();
CREATE TRIGGER m5_content_admission BEFORE INSERT ON gcms_m4.identity FOR EACH ROW EXECUTE FUNCTION gcms_m5.content_admission();
CREATE TRIGGER m5_content_admission BEFORE INSERT ON gcms_m4.variant FOR EACH ROW EXECUTE FUNCTION gcms_m5.content_admission();
CREATE FUNCTION gcms_m5.asset_admission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM gcms_m5.admit(NEW.tenant_id,'media_bytes',NEW.bytes::bigint+5242880);
 INSERT INTO gcms_m5.media_object(tenant_id,asset_id,object_key,reserved_bytes) VALUES(NEW.tenant_id,NEW.id,'original/'||NEW.tenant_id||'/'||NEW.id,NEW.bytes),(NEW.tenant_id,NEW.id,'budget/'||NEW.id,5242880);RETURN NEW;
END $$;
CREATE TRIGGER m5_asset_admission BEFORE INSERT ON gcms_s07.asset FOR EACH ROW EXECUTE FUNCTION gcms_m5.asset_admission();
CREATE FUNCTION gcms_m5.derivative_accounting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE budget bigint;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id,7202));
 IF TG_OP='INSERT' THEN
  IF EXISTS(SELECT 1 FROM gcms_m5.media_object WHERE tenant_id=NEW.tenant_id AND object_key=NEW.object_key) THEN RETURN NEW;END IF;
  SELECT reserved_bytes INTO budget FROM gcms_m5.media_object WHERE tenant_id=NEW.tenant_id AND object_key='budget/'||NEW.asset_id FOR UPDATE;
  IF budget IS NULL OR budget=0 THEN PERFORM gcms_m5.admit(NEW.tenant_id,'media_bytes',5242880);ELSE DELETE FROM gcms_m5.media_object WHERE tenant_id=NEW.tenant_id AND object_key='budget/'||NEW.asset_id;END IF;
  INSERT INTO gcms_m5.media_object(tenant_id,asset_id,object_key,reserved_bytes) VALUES(NEW.tenant_id,NEW.asset_id,NEW.object_key,5242880);
 END IF;
 IF NEW.deleted_at IS NOT NULL THEN UPDATE gcms_m5.media_object SET stored_bytes=0,reserved_bytes=0,deleted_at=NEW.deleted_at WHERE tenant_id=NEW.tenant_id AND object_key=NEW.object_key;
 ELSIF NEW.ready THEN UPDATE gcms_m5.media_object SET stored_bytes=NEW.bytes,reserved_bytes=0 WHERE tenant_id=NEW.tenant_id AND object_key=NEW.object_key;END IF;RETURN NEW;
END $$;
CREATE TRIGGER m5_derivative_accounting BEFORE INSERT OR UPDATE ON gcms_s07.derivative FOR EACH ROW EXECUTE FUNCTION gcms_m5.derivative_accounting();
CREATE FUNCTION gcms_m5.media_original_stored(t text,a text,n integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM gcms_m5.require_read(t);IF NOT gcms_m5.is_live(t) OR NOT EXISTS(SELECT 1 FROM gcms_s07.asset WHERE tenant_id=t AND id=a AND bytes=n) THEN RAISE EXCEPTION 'Invalid original settlement' USING ERRCODE='42501';END IF;
 UPDATE gcms_m5.media_object SET stored_bytes=n,reserved_bytes=0 WHERE tenant_id=t AND object_key='original/'||t||'/'||a AND deleted_at IS NULL;
END $$;

-- Explicit module-owned export contracts. Dataset names map only to business tables.
CREATE FUNCTION gcms_s02.export_m5_batch(t text,d text,a text,n integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE source text;key_sql text;extra text:='';result jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);IF n IS NULL OR n<1 OR n>25 THEN RAISE EXCEPTION 'Invalid export batch';END IF;
 CASE d
 WHEN 'site' THEN source:='gcms_s02.site_draft';key_sql:='x.tenant_id';
 WHEN 'services' THEN source:='gcms_s02.service_draft';key_sql:='x.id';
 WHEN 'legacy_publications' THEN source:='gcms_s02.publication_snapshot';key_sql:='x.service_id||''/''||x.id';
 WHEN 'legacy_heads' THEN source:='gcms_s02.publication_pointer';key_sql:='x.service_id';
 ELSE RAISE EXCEPTION 'Unknown module export dataset';END CASE;
 EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''recordKey'',record_key,''version'',coalesce(data->''version'',data->''publication_version'',data->''revision'',''1''::jsonb),''exportedAt'',clock_timestamp(),''data'',data) ORDER BY record_key),''[]''::jsonb) FROM (SELECT '||key_sql||' AS record_key,to_jsonb(x) AS data FROM '||source||' x WHERE x.tenant_id=$1 AND ($2 IS NULL OR ('||key_sql||')>$2)'||extra||' ORDER BY '||key_sql||' LIMIT $3) batch' INTO result USING t,a,n;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION gcms_s02.export_m5_batch(text,text,text,integer) FROM PUBLIC;
CREATE FUNCTION gcms_s08.export_m5_batch(t text,d text,a text,n integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE source text;key_sql text;extra text:='';result jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);IF n IS NULL OR n<1 OR n>25 THEN RAISE EXCEPTION 'Invalid export batch';END IF;
 CASE d
 WHEN 'editorial_revisions' THEN source:='gcms_s08.editorial_revision';key_sql:='x.id';
 WHEN 'publication_heads' THEN source:='gcms_s08.publication_head';key_sql:='x.service_id';
 WHEN 'publication_history' THEN source:='gcms_s08.publication_event';key_sql:='x.id';
 ELSE RAISE EXCEPTION 'Unknown module export dataset';END CASE;
 EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''recordKey'',record_key,''version'',coalesce(data->''version'',data->''publication_version'',data->''revision'',''1''::jsonb),''exportedAt'',clock_timestamp(),''data'',data) ORDER BY record_key),''[]''::jsonb) FROM (SELECT '||key_sql||' AS record_key,to_jsonb(x) AS data FROM '||source||' x WHERE x.tenant_id=$1 AND ($2 IS NULL OR ('||key_sql||')>$2)'||extra||' ORDER BY '||key_sql||' LIMIT $3) batch' INTO result USING t,a,n;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION gcms_s08.export_m5_batch(text,text,text,integer) FROM PUBLIC;
CREATE FUNCTION gcms_m3.export_m5_batch(t text,d text,a text,n integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE source text;key_sql text;extra text:='';result jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);IF n IS NULL OR n<1 OR n>25 THEN RAISE EXCEPTION 'Invalid export batch';END IF;
 CASE d
 WHEN 'content' THEN source:='gcms_m3.resource';key_sql:='x.id';
 WHEN 'content_revisions' THEN source:='gcms_m3.revision';key_sql:='x.id';
 WHEN 'content_publications' THEN source:='gcms_m3.publication';key_sql:='x.resource_id||''/''||x.id';
 WHEN 'content_permissions' THEN source:='gcms_m3.permission';key_sql:='x.id';
 WHEN 'service_references' THEN source:='gcms_m3.service_links_draft';key_sql:='x.service_id';
 WHEN 'service_publication_references' THEN source:='gcms_m3.service_publication_links';key_sql:='x.service_id||''/''||x.publication_id';
 ELSE RAISE EXCEPTION 'Unknown module export dataset';END CASE;
 EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''recordKey'',record_key,''version'',coalesce(data->''version'',data->''publication_version'',data->''revision'',''1''::jsonb),''exportedAt'',clock_timestamp(),''data'',data) ORDER BY record_key),''[]''::jsonb) FROM (SELECT '||key_sql||' AS record_key,to_jsonb(x) AS data FROM '||source||' x WHERE x.tenant_id=$1 AND ($2 IS NULL OR ('||key_sql||')>$2)'||extra||' ORDER BY '||key_sql||' LIMIT $3) batch' INTO result USING t,a,n;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION gcms_m3.export_m5_batch(text,text,text,integer) FROM PUBLIC;
CREATE FUNCTION gcms_m4.export_m5_batch(t text,d text,a text,n integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE source text;key_sql text;extra text:='';result jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);IF n IS NULL OR n<1 OR n>25 THEN RAISE EXCEPTION 'Invalid export batch';END IF;
 CASE d
 WHEN 'builder_identities' THEN source:='gcms_m4.identity';key_sql:='x.kind||''/''||x.id';
 WHEN 'builder_variants' THEN source:='gcms_m4.variant';key_sql:='x.kind||''/''||x.resource_id||''/''||x.locale';
 WHEN 'builder_revisions' THEN source:='gcms_m4.revision';key_sql:='x.id';
 WHEN 'builder_publications' THEN source:='gcms_m4.publication';key_sql:='x.id';
 WHEN 'builder_permissions' THEN source:='gcms_m4.permission';key_sql:='x.id';
 ELSE RAISE EXCEPTION 'Unknown module export dataset';END CASE;
 EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''recordKey'',record_key,''version'',coalesce(data->''version'',data->''publication_version'',data->''revision'',''1''::jsonb),''exportedAt'',clock_timestamp(),''data'',data) ORDER BY record_key),''[]''::jsonb) FROM (SELECT '||key_sql||' AS record_key,to_jsonb(x) AS data FROM '||source||' x WHERE x.tenant_id=$1 AND ($2 IS NULL OR ('||key_sql||')>$2)'||extra||' ORDER BY '||key_sql||' LIMIT $3) batch' INTO result USING t,a,n;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION gcms_m4.export_m5_batch(text,text,text,integer) FROM PUBLIC;
CREATE FUNCTION gcms_s04.export_m5_batch(t text,d text,a text,n integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE source text;key_sql text;extra text:='';result jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);IF n IS NULL OR n<1 OR n>25 THEN RAISE EXCEPTION 'Invalid export batch';END IF;
 CASE d
 WHEN 'leads' THEN source:='gcms_s04.lead';key_sql:='x.id';extra:=' AND x.expires_at>clock_timestamp() AND gcms_s06.not_deleted(x.tenant_id,x.id)';
 ELSE RAISE EXCEPTION 'Unknown module export dataset';END CASE;
 EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''recordKey'',record_key,''version'',coalesce(data->''version'',data->''publication_version'',data->''revision'',''1''::jsonb),''exportedAt'',clock_timestamp(),''data'',data) ORDER BY record_key),''[]''::jsonb) FROM (SELECT '||key_sql||' AS record_key,to_jsonb(x) AS data FROM '||source||' x WHERE x.tenant_id=$1 AND ($2 IS NULL OR ('||key_sql||')>$2)'||extra||' ORDER BY '||key_sql||' LIMIT $3) batch' INTO result USING t,a,n;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION gcms_s04.export_m5_batch(text,text,text,integer) FROM PUBLIC;
CREATE FUNCTION gcms_s05.export_m5_batch(t text,d text,a text,n integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE source text;key_sql text;extra text:='';result jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);IF n IS NULL OR n<1 OR n>25 THEN RAISE EXCEPTION 'Invalid export batch';END IF;
 CASE d
 WHEN 'lead_history' THEN source:='gcms_s05.lead_event';key_sql:='x.id';extra:=' AND EXISTS(SELECT 1 FROM gcms_s04.lead l WHERE l.tenant_id=x.tenant_id AND l.id=x.lead_id AND l.expires_at>clock_timestamp() AND gcms_s06.not_deleted(l.tenant_id,l.id))';
 WHEN 'recipient_settings' THEN source:='gcms_s05.recipient_settings';key_sql:='x.tenant_id';
 ELSE RAISE EXCEPTION 'Unknown module export dataset';END CASE;
 EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''recordKey'',record_key,''version'',coalesce(data->''version'',data->''publication_version'',data->''revision'',''1''::jsonb),''exportedAt'',clock_timestamp(),''data'',data) ORDER BY record_key),''[]''::jsonb) FROM (SELECT '||key_sql||' AS record_key,to_jsonb(x) AS data FROM '||source||' x WHERE x.tenant_id=$1 AND ($2 IS NULL OR ('||key_sql||')>$2)'||extra||' ORDER BY '||key_sql||' LIMIT $3) batch' INTO result USING t,a,n;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION gcms_s05.export_m5_batch(text,text,text,integer) FROM PUBLIC;
CREATE FUNCTION gcms_s07.export_m5_batch(t text,d text,a text,n integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE source text;key_sql text;extra text:='';result jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);IF n IS NULL OR n<1 OR n>25 THEN RAISE EXCEPTION 'Invalid export batch';END IF;
 CASE d
 WHEN 'media_metadata' THEN source:='gcms_s07.asset';key_sql:='x.id';
 WHEN 'media_permissions' THEN source:='gcms_s07.permission';key_sql:='x.asset_id';
 WHEN 'media_derivatives' THEN source:='gcms_s07.derivative';key_sql:='x.asset_id||''/''||lpad(x.revision::text,10,''0'')||''/''||lpad(x.fence::text,10,''0'')';
 ELSE RAISE EXCEPTION 'Unknown module export dataset';END CASE;
 EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''recordKey'',record_key,''version'',coalesce(data->''version'',data->''publication_version'',data->''revision'',''1''::jsonb),''exportedAt'',clock_timestamp(),''data'',data) ORDER BY record_key),''[]''::jsonb) FROM (SELECT '||key_sql||' AS record_key,to_jsonb(x) AS data FROM '||source||' x WHERE x.tenant_id=$1 AND ($2 IS NULL OR ('||key_sql||')>$2)'||extra||' ORDER BY '||key_sql||' LIMIT $3) batch' INTO result USING t,a,n;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION gcms_s07.export_m5_batch(text,text,text,integer) FROM PUBLIC;
CREATE FUNCTION gcms_m5.export_batch(t text,d text,a text,n integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM gcms_m5.require_read(t);
 IF d=ANY(ARRAY['site','services','legacy_publications','legacy_heads']) THEN RETURN gcms_s02.export_m5_batch(t,d,a,n);END IF;
 IF d=ANY(ARRAY['editorial_revisions','publication_heads','publication_history']) THEN RETURN gcms_s08.export_m5_batch(t,d,a,n);END IF;
 IF d=ANY(ARRAY['content','content_revisions','content_publications','content_permissions','service_references','service_publication_references']) THEN RETURN gcms_m3.export_m5_batch(t,d,a,n);END IF;
 IF d=ANY(ARRAY['builder_identities','builder_variants','builder_revisions','builder_publications','builder_permissions']) THEN RETURN gcms_m4.export_m5_batch(t,d,a,n);END IF;
 IF d=ANY(ARRAY['leads']) THEN RETURN gcms_s04.export_m5_batch(t,d,a,n);END IF;
 IF d=ANY(ARRAY['lead_history','recipient_settings']) THEN RETURN gcms_s05.export_m5_batch(t,d,a,n);END IF;
 IF d=ANY(ARRAY['media_metadata','media_permissions','media_derivatives']) THEN RETURN gcms_s07.export_m5_batch(t,d,a,n);END IF;
 IF d='domains' THEN RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('recordKey',record_key,'version',coalesce(data->'version','1'::jsonb),'exportedAt',clock_timestamp(),'data',data) ORDER BY record_key),'[]') FROM gcms_m5.export_domain_rows(t,a,n));END IF;RAISE EXCEPTION 'Unknown export dataset';
END $$;

-- Direct restricted-role updates cannot grow resources or write suspended business data.
-- Safety exceptions are structural and reauthenticated; no caller-settable bypass flag.
CREATE FUNCTION gcms_m5.business_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE t text;before_row jsonb;after_row jsonb;allowed boolean:=false;BEGIN
 after_row:=to_jsonb(NEW);t:=after_row->>'tenant_id';PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));
 IF gcms_m5.is_live(t) THEN RETURN NEW;END IF;
 IF gcms_m5.cleanup_authorized(t) THEN RETURN NEW;END IF;
 IF NOT gcms_m5.is_readable(t) THEN RAISE EXCEPTION 'Tenant data fenced' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' THEN
  before_row:=to_jsonb(OLD);
  IF TG_TABLE_NAME IN ('resource','variant') THEN
   allowed:=(after_row-ARRAY['active_publication_id','generation','publication_revision'])=(before_row-ARRAY['active_publication_id','generation','publication_revision']) AND after_row->'active_publication_id'='null' AND (after_row->>'generation')::integer=(before_row->>'generation')::integer+1 AND (after_row->>'publication_revision')::integer=(before_row->>'publication_revision')::integer+1;
  ELSIF TG_TABLE_NAME='asset' THEN
   allowed:=(after_row-ARRAY['state','withdrawn_at','version','revision'])=(before_row-ARRAY['state','withdrawn_at','version','revision']) AND after_row->>'state'='withdrawn' AND after_row->>'withdrawn_at' IS NOT NULL AND (after_row->>'version')::integer=(before_row->>'version')::integer+1 AND (after_row->>'revision')::integer=(before_row->>'revision')::integer+1;
  ELSIF TG_TABLE_NAME='permission' THEN
   allowed:=(after_row-ARRAY['revoked_at','withdrawn_at','withdrawal_reason'])=(before_row-ARRAY['revoked_at','withdrawn_at','withdrawal_reason']) AND (after_row->>'revoked_at' IS NOT NULL OR after_row->>'withdrawn_at' IS NOT NULL);
  END IF;
 END IF;
 IF NOT allowed THEN RAISE EXCEPTION 'Suspended business write denied' USING ERRCODE='42501';END IF;PERFORM gcms_m5.require_safety(t);RETURN NEW;
END $$;
CREATE FUNCTION gcms_m5.irreversible_fence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE t text;BEGIN
 t:=to_jsonb(NEW)->>'tenant_id';PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));
 IF NOT gcms_m5.is_readable(t) AND NOT gcms_m5.cleanup_authorized(t) THEN RAISE EXCEPTION 'Tenant data fenced' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
DO $$ DECLARE tab text;BEGIN
 FOREACH tab IN ARRAY ARRAY['gcms_s02.service_draft','gcms_s02.site_draft','gcms_s02.membership','gcms_s02.invitation','gcms_s04.lead','gcms_s05.recipient_settings','gcms_s07.asset','gcms_s07.permission','gcms_m3.resource','gcms_m3.permission','gcms_m4.identity','gcms_m4.variant','gcms_m4.permission'] LOOP
  EXECUTE format('CREATE TRIGGER m5_business_guard BEFORE INSERT OR UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION gcms_m5.business_guard()',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['gcms_s02.service_draft','gcms_s02.site_draft','gcms_s02.publication_snapshot','gcms_s02.publication_pointer','gcms_s04.lead','gcms_s05.lead_event','gcms_s07.asset','gcms_s07.permission','gcms_s07.job','gcms_s08.editorial_revision','gcms_s08.publication_head','gcms_s08.publication_event','gcms_m3.resource','gcms_m3.revision','gcms_m3.publication','gcms_m3.permission','gcms_m3.service_links_draft','gcms_m3.service_publication_links','gcms_m4.identity','gcms_m4.variant','gcms_m4.revision','gcms_m4.publication','gcms_m4.permission'] LOOP
  EXECUTE format('CREATE POLICY m5_private_read_fence ON %s AS RESTRICTIVE FOR SELECT TO gcms_s02_tenant USING(gcms_m5.is_readable(tenant_id))',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['gcms_s02.publication_snapshot','gcms_s02.publication_pointer','gcms_s02.publication_intent','gcms_s04.notification_intent','gcms_s04.accepted_request','gcms_s04.request_event','gcms_s04.intake_activity','gcms_s04.challenge','gcms_s05.delivery','gcms_s05.lead_event','gcms_s05.operation_receipt','gcms_s05.settings_receipt','gcms_s07.job','gcms_s07.derivative','gcms_s07.receipt','gcms_s07.withdrawal_decision','gcms_s08.editorial_revision','gcms_s08.publication_head','gcms_s08.publication_event','gcms_s08.operation_receipt','gcms_m3.revision','gcms_m3.publication','gcms_m3.receipt','gcms_m3.intent','gcms_m3.purge_job','gcms_m3.service_links_draft','gcms_m3.service_publication_links','gcms_m3.service_link_receipt','gcms_m3.service_generation','gcms_m3.service_publication_generation','gcms_m4.revision','gcms_m4.publication','gcms_m4.receipt','gcms_m4.intent','gcms_m4.purge_job'] LOOP
  EXECUTE format('CREATE TRIGGER m5_irreversible_fence BEFORE INSERT OR UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION gcms_m5.irreversible_fence()',tab);
 END LOOP;
END $$;

CREATE FUNCTION gcms_m5.require_worker(t text,r text,w text,f integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));
 IF session_user<>'gcms_m5_worker' OR NOT EXISTS(SELECT 1 FROM gcms_m5.worker_scope WHERE tenant_id=t AND allow_deletion) OR NOT EXISTS(SELECT 1 FROM gcms_m5.tenant_state WHERE tenant_id=t AND request_id=r AND phase='executing' AND started_at IS NOT NULL AND worker_id=w AND fence=f AND lease_until>clock_timestamp()) THEN RAISE EXCEPTION 'Lifecycle worker scope/fence denied' USING ERRCODE='42501';END IF;
END $$;
CREATE FUNCTION gcms_m5.lifecycle_claim(t text,w text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE s gcms_m5.tenant_state%ROWTYPE;BEGIN
 IF session_user<>'gcms_m5_worker' OR gcms_m3.uuid(w) IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM gcms_m5.worker_scope WHERE tenant_id=t AND allow_deletion) THEN RAISE EXCEPTION 'Lifecycle worker scope denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));SELECT * INTO s FROM gcms_m5.tenant_state WHERE tenant_id=t FOR UPDATE;
 IF s.started_at IS NULL OR s.phase NOT IN ('executing','failed') OR (s.worker_id IS DISTINCT FROM w AND s.lease_until>clock_timestamp()) THEN RETURN NULL;END IF;
 UPDATE gcms_m5.tenant_state SET phase='executing',worker_id=w,fence=fence+1,lease_until=clock_timestamp()+interval '60 seconds',failure_code=NULL WHERE tenant_id=t RETURNING * INTO s;
 RETURN jsonb_build_object('tenantId',t,'requestId',s.request_id,'fence',s.fence);
END $$;
CREATE FUNCTION gcms_m5.lifecycle_object_batch(t text,r text,w text,f integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE out jsonb;BEGIN
 PERFORM gcms_m5.require_worker(t,r,w,f);UPDATE gcms_m5.tenant_state SET lease_until=clock_timestamp()+interval '60 seconds' WHERE tenant_id=t;
 SELECT coalesce(jsonb_agg(jsonb_build_object('assetId',asset_id,'key',object_key) ORDER BY object_key),'[]') INTO out FROM (SELECT asset_id,object_key FROM gcms_m5.deletion_object WHERE tenant_id=t AND request_id=r AND deleted_at IS NULL ORDER BY object_key LIMIT 25) batch;RETURN out;
END $$;
CREATE FUNCTION gcms_m5.lifecycle_object_deleted(t text,r text,w text,f integer,k text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM gcms_m5.require_worker(t,r,w,f);UPDATE gcms_m5.deletion_object SET deleted_at=clock_timestamp() WHERE tenant_id=t AND request_id=r AND object_key=k AND deleted_at IS NULL;
 UPDATE gcms_m5.media_object SET stored_bytes=0,reserved_bytes=0,deleted_at=clock_timestamp() WHERE tenant_id=t AND object_key=k;UPDATE gcms_m5.tenant_state SET lease_until=clock_timestamp()+interval '60 seconds' WHERE tenant_id=t;RETURN true;
END $$;
CREATE FUNCTION gcms_m5.lifecycle_fail(t text,r text,w text,f integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM gcms_m5.require_worker(t,r,w,f);UPDATE gcms_m5.tenant_state SET phase='failed',failure_code='storage-or-cleanup-incomplete',lease_until=NULL WHERE tenant_id=t;RETURN true;
END $$;
CREATE FUNCTION gcms_m5.export_media_batch(t text,a text,n integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE out jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);IF n IS NULL OR n<1 OR n>25 THEN RAISE EXCEPTION 'Invalid media export batch';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('assetId',id,'revision',revision,'state',state,'bytes',bytes,'checksum',checksum,'eligible',state='ready' AND withdrawn_at IS NULL) ORDER BY id),'[]') INTO out FROM (SELECT * FROM gcms_s07.asset WHERE tenant_id=t AND (a IS NULL OR id>a) ORDER BY id LIMIT n) batch;RETURN out;
END $$;
CREATE FUNCTION gcms_m5.export_media_target(t text,a text,v integer,variant text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE target jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);IF NOT EXISTS(SELECT 1 FROM gcms_s07.asset WHERE tenant_id=t AND id=a AND revision=v AND state='ready' AND withdrawn_at IS NULL) THEN RETURN NULL;END IF;
 IF variant='original' THEN SELECT jsonb_build_object('key','original/'||t||'/'||id,'bytes',bytes,'checksum',checksum) INTO target FROM gcms_s07.asset WHERE tenant_id=t AND id=a;
 ELSIF variant='cover' THEN SELECT jsonb_build_object('key',object_key,'bytes',bytes) INTO target FROM gcms_s07.derivative WHERE tenant_id=t AND asset_id=a AND revision=v AND ready AND deleted_at IS NULL ORDER BY fence DESC LIMIT 1;END IF;RETURN target;
END $$;


-- Immutable histories remain immutable for every ordinary actor. Only the
-- positively scoped irreversible worker can delete this tenant's active graph.
CREATE OR REPLACE FUNCTION gcms_s02.immutable_publication() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF TG_OP='DELETE' AND gcms_m5.cleanup_authorized(OLD.tenant_id) THEN RETURN OLD;END IF;RAISE EXCEPTION 'Immutable publication' USING ERRCODE='23514';
END $$;
CREATE OR REPLACE FUNCTION gcms_s02.retain_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE target text;BEGIN
 target:=OLD.tenant_id;PERFORM pg_advisory_xact_lock(hashtextextended(target,7202));
 IF TG_OP='DELETE' AND gcms_m5.cleanup_authorized(target) THEN RETURN OLD;END IF;
 IF OLD.status='active' AND (TG_OP='DELETE' OR NEW.status<>'active' OR NEW.user_id<>OLD.user_id OR NEW.tenant_id<>OLD.tenant_id) THEN
  IF NOT EXISTS(SELECT 1 FROM gcms_s02.membership m JOIN gcms_s02_auth."user" u ON u.id=m.user_id WHERE m.tenant_id=target AND m.user_id<>OLD.user_id AND m.status='active' AND u.active AND u.email_verified) THEN RAISE EXCEPTION 'Last active administrator' USING ERRCODE='23514';END IF;
 END IF;IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE FUNCTION gcms_s04.delete_m5_data(t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NOT gcms_m5.cleanup_authorized(t) THEN RAISE EXCEPTION 'Cleanup denied' USING ERRCODE='42501';END IF;
 DELETE FROM gcms_s04.accepted_request WHERE tenant_id=t;DELETE FROM gcms_s04.intake_activity WHERE tenant_id=t;DELETE FROM gcms_s04.notification_intent WHERE tenant_id=t;DELETE FROM gcms_s04.challenge WHERE tenant_id=t;DELETE FROM gcms_s04.request_event WHERE tenant_id=t;
 -- Existing FK contracts delete lead events/receipts/deliveries and retention children.
 DELETE FROM gcms_s04.lead WHERE tenant_id=t;
 DELETE FROM gcms_s05.delivery WHERE tenant_id=t;DELETE FROM gcms_s05.operation_receipt WHERE tenant_id=t;DELETE FROM gcms_s05.lead_event WHERE tenant_id=t;DELETE FROM gcms_s05.settings_receipt WHERE tenant_id=t;DELETE FROM gcms_s05.recipient_settings WHERE tenant_id=t;DELETE FROM gcms_s05.lead_sequence WHERE tenant_id=t;DELETE FROM gcms_s05.worker_scope WHERE tenant_id=t;
 DELETE FROM gcms_s06.extension_receipt WHERE tenant_id=t;DELETE FROM gcms_s06.notice WHERE tenant_id=t;DELETE FROM gcms_s06.job WHERE tenant_id=t;DELETE FROM gcms_s06.deletion_decision WHERE tenant_id=t;DELETE FROM gcms_s06.lead_scope WHERE tenant_id=t;DELETE FROM gcms_s06.audit_scope WHERE tenant_id=t;DELETE FROM gcms_s06.worker_scope WHERE tenant_id=t;
END $$;
CREATE FUNCTION gcms_m4.delete_m5_data(t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NOT gcms_m5.cleanup_authorized(t) THEN RAISE EXCEPTION 'Cleanup denied' USING ERRCODE='42501';END IF;
 UPDATE gcms_m4.variant SET active_publication_id=NULL WHERE tenant_id=t AND active_publication_id IS NOT NULL;
 DELETE FROM gcms_m4.purge_job WHERE tenant_id=t;DELETE FROM gcms_m4.permission WHERE tenant_id=t;DELETE FROM gcms_m4.intent WHERE tenant_id=t;DELETE FROM gcms_m4.receipt WHERE tenant_id=t;DELETE FROM gcms_m4.publication WHERE tenant_id=t;DELETE FROM gcms_m4.revision WHERE tenant_id=t;DELETE FROM gcms_m4.variant WHERE tenant_id=t;DELETE FROM gcms_m4.identity WHERE tenant_id=t;DELETE FROM gcms_m4.worker_scope WHERE tenant_id=t;
END $$;
CREATE FUNCTION gcms_m3.delete_m5_data(t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NOT gcms_m5.cleanup_authorized(t) THEN RAISE EXCEPTION 'Cleanup denied' USING ERRCODE='42501';END IF;
 UPDATE gcms_m3.resource SET active_publication_id=NULL WHERE tenant_id=t AND active_publication_id IS NOT NULL;
 DELETE FROM gcms_m3.purge_job WHERE tenant_id=t;DELETE FROM gcms_m3.permission WHERE tenant_id=t;DELETE FROM gcms_m3.intent WHERE tenant_id=t;DELETE FROM gcms_m3.receipt WHERE tenant_id=t;DELETE FROM gcms_m3.publication WHERE tenant_id=t;DELETE FROM gcms_m3.revision WHERE tenant_id=t;DELETE FROM gcms_m3.resource WHERE tenant_id=t;DELETE FROM gcms_m3.worker_scope WHERE tenant_id=t;
END $$;
CREATE FUNCTION gcms_s02.delete_m5_content(t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NOT gcms_m5.cleanup_authorized(t) THEN RAISE EXCEPTION 'Cleanup denied' USING ERRCODE='42501';END IF;
 DELETE FROM gcms_s02.publication_pointer WHERE tenant_id=t;
 DELETE FROM gcms_m3.service_link_receipt WHERE tenant_id=t;DELETE FROM gcms_m3.service_publication_links WHERE tenant_id=t;DELETE FROM gcms_m3.service_links_draft WHERE tenant_id=t;DELETE FROM gcms_m3.service_publication_generation WHERE tenant_id=t;DELETE FROM gcms_m3.service_generation WHERE tenant_id=t;
 DELETE FROM gcms_s08.operation_receipt WHERE tenant_id=t;DELETE FROM gcms_s08.publication_event WHERE tenant_id=t;DELETE FROM gcms_s08.publication_head WHERE tenant_id=t;DELETE FROM gcms_s08.editorial_revision WHERE tenant_id=t;
 DELETE FROM gcms_s02.publication_intent WHERE tenant_id=t;DELETE FROM gcms_s02.publication_snapshot WHERE tenant_id=t;DELETE FROM gcms_s02.service_draft WHERE tenant_id=t;DELETE FROM gcms_s02.site_draft WHERE tenant_id=t;
END $$;
CREATE FUNCTION gcms_s07.delete_m5_data(t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NOT gcms_m5.cleanup_authorized(t) OR EXISTS(SELECT 1 FROM gcms_m5.deletion_object WHERE tenant_id=t AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Storage cleanup incomplete' USING ERRCODE='42501';END IF;
 DELETE FROM gcms_s07.job WHERE tenant_id=t;DELETE FROM gcms_s07.derivative WHERE tenant_id=t;DELETE FROM gcms_s07.receipt WHERE tenant_id=t;DELETE FROM gcms_s07.permission WHERE tenant_id=t;DELETE FROM gcms_s07.withdrawal_decision WHERE tenant_id=t;DELETE FROM gcms_s07.asset WHERE tenant_id=t;DELETE FROM gcms_s07.worker_scope WHERE tenant_id=t;
END $$;
CREATE FUNCTION gcms_m5.lifecycle_cleanup(t text,r text,w text,f integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE s gcms_m5.tenant_state%ROWTYPE;BEGIN
 PERFORM gcms_m5.require_worker(t,r,w,f);SELECT * INTO s FROM gcms_m5.tenant_state WHERE tenant_id=t FOR UPDATE;
 IF EXISTS(SELECT 1 FROM gcms_m5.deletion_object WHERE tenant_id=t AND request_id=r AND deleted_at IS NULL) THEN RETURN false;END IF;
 PERFORM set_config('gcms.m5_cleanup',t,true),set_config('gcms.m5_worker',w,true),set_config('gcms.m5_fence',f::text,true),set_config('gcms.actor_id',s.confirmed_by,true);
 -- Dependencies are explicit: leads reference publications; content references
 -- media; memberships outlive all content writers. No catalog-driven cascade.
 PERFORM gcms_s04.delete_m5_data(t);PERFORM gcms_m5.delete_domain_data(t);PERFORM gcms_m4.delete_m5_data(t);PERFORM gcms_m3.delete_m5_data(t);PERFORM gcms_s02.delete_m5_content(t);PERFORM gcms_s07.delete_m5_data(t);
 DELETE FROM gcms_s02.invitation WHERE tenant_id=t;DELETE FROM gcms_s02.membership WHERE tenant_id=t;
 DELETE FROM gcms_m5.command_receipt WHERE tenant_id=t;DELETE FROM gcms_m5.content_identity WHERE tenant_id=t;DELETE FROM gcms_m5.media_object WHERE tenant_id=t;DELETE FROM gcms_m5.deletion_object WHERE tenant_id=t;
 INSERT INTO gcms_m5.tombstone VALUES(t,r,s.version+1,clock_timestamp()) ON CONFLICT DO NOTHING;
 -- The tenant row now contains technical tombstone display text only. Global
 -- identities, credentials and existing redacted audit timestamps are retained.
 UPDATE gcms_s02.tenant SET name='Deleted tenant',status='suspended',updated_at=clock_timestamp() WHERE id=t;
 UPDATE gcms_m5.tenant_state SET phase='completed',version=version+1,mode='unset',content_limit=NULL,media_limit=NULL,completed_at=clock_timestamp(),requested_by=NULL,confirmed_by=NULL,confirmed_membership_at=NULL,reason=NULL,worker_id=NULL,lease_until=NULL,failure_code=NULL WHERE tenant_id=t;
 DELETE FROM gcms_m5.worker_scope WHERE tenant_id=t;
 RETURN true;
END $$;

-- Functions are execute-only contracts; runtime roles acquire no table access.
REVOKE ALL ON ALL TABLES IN SCHEMA gcms_m5 FROM PUBLIC,gcms_s02_tenant,gcms_s02_platform,gcms_m5_worker;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_m5 FROM PUBLIC;
REVOKE ALL ON FUNCTION gcms_s04.delete_m5_data(text),gcms_m4.delete_m5_data(text),gcms_m3.delete_m5_data(text),gcms_s02.delete_m5_content(text),gcms_s07.delete_m5_data(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA gcms_m5 TO gcms_s02_tenant,gcms_s02_platform,gcms_s04_intake,gcms_s05_worker,gcms_s06_worker,gcms_s07_worker,gcms_m5_worker;
GRANT EXECUTE ON FUNCTION gcms_m5.is_live(text),gcms_m5.is_readable(text) TO gcms_s02_tenant,gcms_s02_platform,gcms_s04_intake,gcms_s05_worker,gcms_s06_worker,gcms_s07_worker;
GRANT EXECUTE ON FUNCTION gcms_m5.cleanup_authorized(text) TO gcms_s02_tenant,gcms_s02_platform,gcms_s04_intake,gcms_s05_worker,gcms_s06_worker,gcms_s07_worker,gcms_m5_worker;
GRANT EXECUTE ON FUNCTION gcms_m5.require_read(text),gcms_m5.require_safety(text),gcms_m5.status_view(text,boolean),gcms_m5.command(text,text,jsonb),gcms_m5.media_original_stored(text,text,integer),gcms_m5.export_batch(text,text,text,integer),gcms_m5.export_media_batch(text,text,integer),gcms_m5.export_media_target(text,text,integer,text) TO gcms_s02_tenant;
GRANT EXECUTE ON FUNCTION gcms_m5.status_view(text,boolean),gcms_m5.command(text,text,jsonb) TO gcms_s02_platform;
GRANT EXECUTE ON FUNCTION gcms_m5.initialize_new_tenant(text,jsonb) TO gcms_s02_platform;
GRANT EXECUTE ON FUNCTION gcms_m5.lifecycle_claim(text,text),gcms_m5.lifecycle_object_batch(text,text,text,integer),gcms_m5.lifecycle_object_deleted(text,text,text,integer,text),gcms_m5.lifecycle_cleanup(text,text,text,integer),gcms_m5.lifecycle_fail(text,text,text,integer) TO gcms_m5_worker;
