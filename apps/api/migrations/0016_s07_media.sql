DO $$ BEGIN
 IF current_user<>'gcms_s02_owner' OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='gcms_s07' AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
 THEN RAISE EXCEPTION 'S07 bootstrap ownership required'; END IF;
END $$;
REVOKE ALL ON SCHEMA gcms_s07 FROM PUBLIC;
CREATE TABLE gcms_s07.asset (
 tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id), id text NOT NULL, operation_id text NOT NULL,
 material_kind text NOT NULL CHECK(material_kind IN ('ordinary','patient_derived')),
 checksum text NOT NULL CHECK(checksum ~ '^[a-f0-9]{64}$'), bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 5242880),
 state text NOT NULL DEFAULT 'uploading' CHECK(state IN ('uploading','processing','ready','rejected','withdrawn')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 detected_type text CHECK(detected_type IN ('jpeg','png','webp')), width integer, height integer,
 created_by text NOT NULL REFERENCES gcms_s02_auth."user"(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 withdrawn_at timestamptz, rejection_code text,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,operation_id), CHECK(id ~ '^[a-f0-9-]{36}$'),
 CHECK((width IS NULL AND height IS NULL) OR (width IS NOT NULL AND height IS NOT NULL AND width BETWEEN 1 AND 8192 AND height BETWEEN 1 AND 8192 AND width::bigint*height<=16000000)),
 CHECK(state<>'ready' OR (detected_type IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL))
);
CREATE TABLE gcms_s07.permission (
 tenant_id text NOT NULL, asset_id text NOT NULL, scope text NOT NULL CHECK(scope='service_cover'),
 evidence_reference text NOT NULL CHECK(length(evidence_reference) BETWEEN 1 AND 500),
 granted_by text NOT NULL REFERENCES gcms_s02_auth."user"(id), granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_at timestamptz, PRIMARY KEY(tenant_id,asset_id), FOREIGN KEY(tenant_id,asset_id) REFERENCES gcms_s07.asset(tenant_id,id)
);
CREATE TABLE gcms_s07.job (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text, tenant_id text NOT NULL, asset_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('process','purge')), revision integer NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5), fence integer NOT NULL DEFAULT 0,
 worker_id text, lease_until timestamptz, available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 failure_code text, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,asset_id,kind,revision), FOREIGN KEY(tenant_id,asset_id) REFERENCES gcms_s07.asset(tenant_id,id)
);
CREATE INDEX media_job_due ON gcms_s07.job(tenant_id,status,available_at,id);
-- Targets are reserved before object writes. Withdrawal can purge even a crashed writer's output.
CREATE TABLE gcms_s07.derivative (
 tenant_id text NOT NULL, asset_id text NOT NULL, revision integer NOT NULL, fence integer NOT NULL,
 object_key text NOT NULL UNIQUE, width integer, height integer, bytes integer, ready boolean NOT NULL DEFAULT false,
 deleted_at timestamptz, PRIMARY KEY(tenant_id,asset_id,revision,fence),
 FOREIGN KEY(tenant_id,asset_id) REFERENCES gcms_s07.asset(tenant_id,id),
 CHECK((width IS NULL AND height IS NULL) OR (width IS NOT NULL AND height IS NOT NULL AND width BETWEEN 1 AND 1600 AND height BETWEEN 1 AND 1600)),
 CHECK(bytes IS NULL OR bytes BETWEEN 1 AND 5242880), CHECK(NOT ready OR (width IS NOT NULL AND height IS NOT NULL AND bytes IS NOT NULL AND deleted_at IS NULL))
);
CREATE TABLE gcms_s07.receipt (
 tenant_id text NOT NULL, operation_id text NOT NULL, asset_id text NOT NULL, command jsonb NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(tenant_id,operation_id),
 FOREIGN KEY(tenant_id,asset_id) REFERENCES gcms_s07.asset(tenant_id,id)
);
-- Retained separately from mutable asset metadata. Replaying an old asset cannot undo a withdrawal.
-- Decision retention before a live backup restore remains a D5 operational decision.
CREATE TABLE gcms_s07.withdrawal_decision (
 tenant_id text NOT NULL, asset_id text NOT NULL, revision integer NOT NULL, withdrawn_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,asset_id), FOREIGN KEY(tenant_id,asset_id) REFERENCES gcms_s07.asset(tenant_id,id)
);
-- Only explicitly enrolled new local fixture tenants can be processed. Never populated by migration/startup.
CREATE TABLE gcms_s07.worker_scope (tenant_id text PRIMARY KEY REFERENCES gcms_s02.tenant(id), enabled boolean NOT NULL DEFAULT false);
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['asset','permission','job','derivative','receipt','withdrawal_decision','worker_scope'] LOOP
  EXECUTE format('ALTER TABLE gcms_s07.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('ALTER TABLE gcms_s07.%I FORCE ROW LEVEL SECURITY',name);
  EXECUTE format('CREATE POLICY owner_all ON gcms_s07.%I TO gcms_s02_owner USING(true) WITH CHECK(true)',name);
 END LOOP;
END $$;
CREATE FUNCTION gcms_s07.preserve_withdrawal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_s07.withdrawal_decision%ROWTYPE; BEGIN
 SELECT * INTO d FROM gcms_s07.withdrawal_decision WHERE tenant_id=NEW.tenant_id AND asset_id=NEW.id;
 IF d.asset_id IS NOT NULL THEN
  NEW.state:='withdrawn'; NEW.withdrawn_at:=d.withdrawn_at; NEW.revision:=greatest(NEW.revision,d.revision);
  IF TG_OP='UPDATE' THEN NEW.version:=greatest(NEW.version,OLD.version); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER asset_withdrawal_preserved BEFORE INSERT OR UPDATE ON gcms_s07.asset FOR EACH ROW EXECUTE FUNCTION gcms_s07.preserve_withdrawal();
CREATE POLICY asset_member ON gcms_s07.asset FOR SELECT TO gcms_s02_tenant
 USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id));
CREATE POLICY permission_member ON gcms_s07.permission FOR SELECT TO gcms_s02_tenant
 USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id));
CREATE POLICY job_member ON gcms_s07.job FOR SELECT TO gcms_s02_tenant
 USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id));

CREATE FUNCTION gcms_s07.require_tenant(p_tenant text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
 IF p_tenant IS DISTINCT FROM nullif(current_setting('gcms.tenant_id',true),'') OR NOT gcms_s02.has_membership(p_tenant)
  OR NOT EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=p_tenant AND status='active')
 THEN RAISE EXCEPTION 'Media denied' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION gcms_s07.publishable(p_tenant text,p_asset text,p_revision integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM gcms_s07.asset a JOIN gcms_s02.tenant t ON t.id=a.tenant_id
 WHERE a.tenant_id=p_tenant AND a.id=p_asset AND a.revision=p_revision AND a.state='ready' AND a.withdrawn_at IS NULL AND t.status='active'
 AND NOT EXISTS(SELECT 1 FROM gcms_s07.withdrawal_decision w WHERE w.tenant_id=a.tenant_id AND w.asset_id=a.id)
 AND EXISTS(SELECT 1 FROM gcms_s07.derivative d WHERE d.tenant_id=a.tenant_id AND d.asset_id=a.id AND d.revision=a.revision AND d.ready AND d.deleted_at IS NULL)
 AND (a.material_kind='ordinary' OR EXISTS(SELECT 1 FROM gcms_s07.permission p WHERE p.tenant_id=a.tenant_id AND p.asset_id=a.id AND p.scope='service_cover' AND p.revoked_at IS NULL)))
$$;
-- S08 replaces this fail-closed placeholder with its immutable active-closure lookup.
CREATE FUNCTION gcms_s07.public_reference_exists(p_tenant text,p_asset text,p_revision integer) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT false $$;
CREATE FUNCTION gcms_s07.public_derivative(p_tenant text,p_asset text,p_revision integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('assetId',d.asset_id,'revision',d.revision,'width',d.width,'height',d.height,'profile','cover',
 'path','/api/public/media/'||d.tenant_id||'/'||d.asset_id||'/'||d.revision||'/cover') FROM gcms_s07.derivative d
 WHERE d.tenant_id=p_tenant AND d.asset_id=p_asset AND d.revision=p_revision AND d.ready AND d.deleted_at IS NULL
 AND gcms_s07.publishable(p_tenant,p_asset,p_revision) AND gcms_s07.public_reference_exists(p_tenant,p_asset,p_revision)
 ORDER BY d.fence DESC LIMIT 1
$$;
CREATE FUNCTION gcms_s07.public_target(p_tenant text,p_asset text,p_revision integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('key',d.object_key,'bytes',d.bytes) FROM gcms_s07.derivative d
 WHERE d.tenant_id=p_tenant AND d.asset_id=p_asset AND d.revision=p_revision AND d.ready AND d.deleted_at IS NULL
 AND gcms_s07.publishable(p_tenant,p_asset,p_revision) AND gcms_s07.public_reference_exists(p_tenant,p_asset,p_revision)
 ORDER BY d.fence DESC LIMIT 1
$$;
CREATE FUNCTION gcms_s07.reserve_upload(p_tenant text,p_operation text,p_checksum text,p_bytes integer,p_kind text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a gcms_s07.asset%ROWTYPE; BEGIN
 PERFORM gcms_s07.require_tenant(p_tenant);
 IF p_operation IS NULL OR p_operation !~ '^[a-f0-9-]{36}$' THEN RAISE EXCEPTION 'Invalid operation' USING ERRCODE='23514'; END IF;
 SELECT * INTO a FROM gcms_s07.asset WHERE tenant_id=p_tenant AND operation_id=p_operation FOR UPDATE;
 IF a.id IS NOT NULL THEN
  IF a.checksum<>p_checksum OR a.bytes<>p_bytes OR a.material_kind<>p_kind THEN RAISE EXCEPTION 'Operation conflict' USING ERRCODE='23514'; END IF;
  RETURN a.id;
 END IF;
 INSERT INTO gcms_s07.asset(tenant_id,id,operation_id,checksum,bytes,material_kind,created_by)
 VALUES(p_tenant,p_operation,p_operation,p_checksum,p_bytes,p_kind,gcms_s02.current_actor());
 INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id) VALUES(gen_random_uuid()::text,p_tenant,gcms_s02.current_actor(),'media.upload_reserved',p_operation);
 RETURN p_operation;
END $$;
CREATE FUNCTION gcms_s07.finish_upload(p_tenant text,p_asset text,p_checksum text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM gcms_s07.require_tenant(p_tenant);
 UPDATE gcms_s07.asset SET state='processing',version=version+1 WHERE tenant_id=p_tenant AND id=p_asset AND checksum=p_checksum AND state='uploading';
 IF FOUND THEN INSERT INTO gcms_s07.job(tenant_id,asset_id,kind,revision) VALUES(p_tenant,p_asset,'process',1)
  ON CONFLICT(tenant_id,asset_id,kind,revision) DO UPDATE SET status='pending',attempts=0,available_at=clock_timestamp(),failure_code=NULL WHERE gcms_s07.job.status='failed'; END IF;
END $$;
CREATE FUNCTION gcms_s07.command(p_tenant text,p_asset text,p_operation text,p_expected integer,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a gcms_s07.asset%ROWTYPE; prior gcms_s07.receipt%ROWTYPE; result jsonb; stamp timestamptz:=clock_timestamp();
BEGIN
 PERFORM gcms_s07.require_tenant(p_tenant);
 IF p_operation IS NULL OR p_operation !~ '^[a-f0-9-]{36}$' OR p_expected IS NULL OR p_expected<1 OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='23514'; END IF;
 SELECT * INTO a FROM gcms_s07.asset WHERE tenant_id=p_tenant AND id=p_asset FOR UPDATE;
 IF a.id IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO prior FROM gcms_s07.receipt WHERE tenant_id=p_tenant AND operation_id=p_operation;
 IF prior.operation_id IS NOT NULL THEN
  IF prior.asset_id<>p_asset OR prior.command<>p_command||jsonb_build_object('expectedVersion',p_expected) THEN RAISE EXCEPTION 'Operation conflict' USING ERRCODE='23514'; END IF;
  RETURN prior.result;
 END IF;
 IF a.version<>p_expected OR (a.withdrawn_at IS NOT NULL AND p_command->>'type'<>'retry') THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='23514'; END IF;
 IF p_command->>'type'='permission' THEN
  IF a.material_kind<>'patient_derived' OR a.state<>'ready' OR (p_command->>'scope') IS DISTINCT FROM 'service_cover' OR coalesce(length(p_command->>'evidenceReference'),0) NOT BETWEEN 1 AND 500
   OR EXISTS(SELECT 1 FROM gcms_s07.permission WHERE tenant_id=p_tenant AND asset_id=p_asset)
   THEN RAISE EXCEPTION 'Permission conflict' USING ERRCODE='23514'; END IF;
  INSERT INTO gcms_s07.permission(tenant_id,asset_id,scope,evidence_reference,granted_by)
   VALUES(p_tenant,p_asset,'service_cover',p_command->>'evidenceReference',gcms_s02.current_actor());
  UPDATE gcms_s07.asset SET version=version+1 WHERE tenant_id=p_tenant AND id=p_asset;
 ELSIF p_command->>'type'='withdrawal' THEN
  IF coalesce(length(p_command->>'reason'),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid reason' USING ERRCODE='23514'; END IF;
  UPDATE gcms_s07.asset SET state='withdrawn',withdrawn_at=stamp,version=version+1,revision=revision+1 WHERE tenant_id=p_tenant AND id=p_asset;
  INSERT INTO gcms_s07.withdrawal_decision(tenant_id,asset_id,revision,withdrawn_at) VALUES(p_tenant,p_asset,a.revision+1,stamp);
  UPDATE gcms_s07.permission SET revoked_at=stamp WHERE tenant_id=p_tenant AND asset_id=p_asset AND revoked_at IS NULL;
  UPDATE gcms_s07.job SET status='cancelled',failure_code='withdrawn' WHERE tenant_id=p_tenant AND asset_id=p_asset AND kind='process' AND status IN ('pending','processing','failed');
  INSERT INTO gcms_s07.job(tenant_id,asset_id,kind,revision) VALUES(p_tenant,p_asset,'purge',a.revision+1);
 ELSIF p_command->>'type'='retry' THEN
  UPDATE gcms_s07.job SET status='pending',attempts=0,available_at=stamp,lease_until=NULL,failure_code=NULL
   WHERE tenant_id=p_tenant AND asset_id=p_asset AND status='failed'
   AND ((kind='purge' AND a.withdrawn_at IS NOT NULL) OR (kind='process' AND a.withdrawn_at IS NULL AND a.state IN ('uploading','processing')));
  IF NOT FOUND THEN RAISE EXCEPTION 'No retryable failure' USING ERRCODE='23514'; END IF;
  UPDATE gcms_s07.asset SET version=version+1 WHERE tenant_id=p_tenant AND id=p_asset;
 ELSE RAISE EXCEPTION 'Invalid command' USING ERRCODE='23514'; END IF;
 SELECT jsonb_build_object('id',id,'version',version,'revision',revision,'withdrawnAt',withdrawn_at) INTO result FROM gcms_s07.asset WHERE tenant_id=p_tenant AND id=p_asset;
 INSERT INTO gcms_s07.receipt(tenant_id,operation_id,asset_id,command,result) VALUES(p_tenant,p_operation,p_asset,p_command||jsonb_build_object('expectedVersion',p_expected),result);
 INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id) VALUES(gen_random_uuid()::text,p_tenant,gcms_s02.current_actor(),'media.'||(p_command->>'type'),p_asset);
 RETURN result;
END $$;
CREATE FUNCTION gcms_s07.private_target(p_tenant text,p_asset text,p_revision integer,p_variant text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a gcms_s07.asset%ROWTYPE; target jsonb; BEGIN
 PERFORM gcms_s07.require_tenant(p_tenant);
 SELECT * INTO a FROM gcms_s07.asset WHERE tenant_id=p_tenant AND id=p_asset;
 IF a.id IS NULL OR a.withdrawn_at IS NOT NULL OR a.revision<>p_revision OR a.state<>'ready' THEN RETURN NULL; END IF;
 IF p_variant='original' THEN RETURN jsonb_build_object('key','original/'||p_tenant||'/'||p_asset,'bytes',a.bytes,'checksum',a.checksum); END IF;
 IF p_variant<>'cover' THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('key',object_key,'bytes',bytes) INTO target FROM gcms_s07.derivative
 WHERE tenant_id=p_tenant AND asset_id=p_asset AND revision=p_revision AND ready AND deleted_at IS NULL ORDER BY fence DESC LIMIT 1;
 RETURN target;
END $$;
CREATE FUNCTION gcms_s07.worker_claim(p_tenant text,p_worker text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE j gcms_s07.job%ROWTYPE; stamp timestamptz:=clock_timestamp(); BEGIN
 IF p_worker IS NULL OR p_worker !~ '^[a-f0-9-]{36}$' OR NOT EXISTS(SELECT 1 FROM gcms_s07.worker_scope WHERE tenant_id=p_tenant AND enabled) THEN RAISE EXCEPTION 'Invalid worker scope' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
 -- Reconcile only enrolled uploads after a bounded crash window. A missing original retries visibly;
 -- the same upload operation can still put its checksum-bound original and resume the job.
 INSERT INTO gcms_s07.job(tenant_id,asset_id,kind,revision)
 SELECT tenant_id,id,'process',revision FROM gcms_s07.asset WHERE tenant_id=p_tenant AND state='uploading' AND withdrawn_at IS NULL AND created_at<=stamp-interval '30 seconds'
 ON CONFLICT(tenant_id,asset_id,kind,revision) DO NOTHING;
 FOR j IN SELECT * FROM gcms_s07.job WHERE tenant_id=p_tenant AND available_at<=stamp AND (status='pending' OR (status='processing' AND lease_until<=stamp)) ORDER BY CASE kind WHEN 'purge' THEN 0 ELSE 1 END,available_at,id FOR UPDATE SKIP LOCKED LOOP
  IF NOT pg_try_advisory_xact_lock(hashtextextended(j.tenant_id||'/'||j.asset_id,7517)) THEN CONTINUE; END IF;
  IF j.attempts>=5 THEN UPDATE gcms_s07.job SET status='failed',failure_code='attempts_exhausted',lease_until=NULL WHERE id=j.id; CONTINUE; END IF;
  UPDATE gcms_s07.job SET status='processing',worker_id=p_worker,fence=fence+1,lease_until=stamp+interval '30 seconds',failure_code=NULL WHERE id=j.id RETURNING * INTO j;
  RETURN jsonb_build_object('id',j.id,'tenantId',j.tenant_id,'assetId',j.asset_id,'kind',j.kind,'revision',j.revision,'fence',j.fence);
 END LOOP;
 RETURN NULL;
END $$;
CREATE FUNCTION gcms_s07.worker_start(p_tenant text,p_job text,p_worker text,p_fence integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE j gcms_s07.job%ROWTYPE; a gcms_s07.asset%ROWTYPE; target text; targets jsonb; stamp timestamptz:=clock_timestamp(); BEGIN
 IF NOT EXISTS(SELECT 1 FROM gcms_s07.worker_scope WHERE tenant_id=p_tenant AND enabled) THEN RAISE EXCEPTION 'Invalid worker scope' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
 SELECT * INTO j FROM gcms_s07.job WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE;
 IF j.id IS NULL OR j.status<>'processing' OR j.worker_id IS DISTINCT FROM p_worker OR j.fence IS DISTINCT FROM p_fence OR j.lease_until<=stamp THEN RETURN NULL; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended(j.tenant_id||'/'||j.asset_id,7517)) THEN RETURN NULL; END IF;
 SELECT * INTO a FROM gcms_s07.asset WHERE tenant_id=p_tenant AND id=j.asset_id FOR UPDATE;
 IF j.kind='process' AND (a.withdrawn_at IS NOT NULL OR a.revision<>j.revision OR a.state NOT IN ('uploading','processing') OR NOT EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=p_tenant AND status='active')) THEN
  UPDATE gcms_s07.job SET status='cancelled',failure_code='ineligible',lease_until=NULL WHERE id=j.id; RETURN NULL;
 END IF;
 UPDATE gcms_s07.job SET attempts=attempts+1,lease_until=stamp+interval '30 seconds',available_at=stamp+interval '30 seconds' WHERE id=j.id;
 IF j.kind='process' THEN
  target:='derivative/'||p_tenant||'/'||a.id||'/r'||j.revision||'/f'||p_fence||'/cover.webp';
  INSERT INTO gcms_s07.derivative(tenant_id,asset_id,revision,fence,object_key) VALUES(p_tenant,a.id,j.revision,p_fence,target) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('kind','process','originalKey','original/'||p_tenant||'/'||a.id,'targetKey',target,'bytes',a.bytes,'checksum',a.checksum);
 END IF;
 SELECT coalesce(jsonb_agg(object_key ORDER BY object_key),'[]'::jsonb) INTO targets FROM gcms_s07.derivative WHERE tenant_id=p_tenant AND asset_id=a.id AND deleted_at IS NULL;
 RETURN jsonb_build_object('kind','purge','targets',targets);
END $$;
CREATE FUNCTION gcms_s07.worker_finish(p_tenant text,p_job text,p_worker text,p_fence integer,p_result jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j gcms_s07.job%ROWTYPE; a gcms_s07.asset%ROWTYPE; stamp timestamptz:=clock_timestamp(); outcome text:=p_result->>'outcome'; BEGIN
 IF NOT EXISTS(SELECT 1 FROM gcms_s07.worker_scope WHERE tenant_id=p_tenant AND enabled) THEN RAISE EXCEPTION 'Invalid worker scope' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
 SELECT * INTO j FROM gcms_s07.job WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE;
 IF j.id IS NULL OR j.worker_id IS DISTINCT FROM p_worker OR j.fence IS DISTINCT FROM p_fence THEN RETURN false; END IF;
 SELECT * INTO a FROM gcms_s07.asset WHERE tenant_id=p_tenant AND id=j.asset_id FOR UPDATE;
 IF j.kind='process' AND (j.status='cancelled' OR a.withdrawn_at IS NOT NULL OR a.revision<>j.revision) THEN RETURN false; END IF;
 IF j.status<>'processing' THEN RETURN false; END IF;
 IF outcome='success' AND j.kind='process' THEN
  IF NOT EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=p_tenant AND status='active') THEN
   UPDATE gcms_s07.job SET status='pending',lease_until=NULL,failure_code='tenant_ineligible' WHERE id=j.id; RETURN false;
  END IF;
  UPDATE gcms_s07.derivative SET ready=true,width=(p_result->>'width')::integer,height=(p_result->>'height')::integer,bytes=(p_result->>'bytes')::integer
    WHERE tenant_id=p_tenant AND asset_id=a.id AND revision=j.revision AND fence=p_fence AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing target' USING ERRCODE='23514'; END IF;
  UPDATE gcms_s07.asset SET state='ready',version=version+1,detected_type=p_result->>'detectedType',width=(p_result->>'sourceWidth')::integer,height=(p_result->>'sourceHeight')::integer WHERE tenant_id=p_tenant AND id=a.id;
 ELSIF outcome='success' AND j.kind='purge' THEN
  IF a.withdrawn_at IS NULL THEN RETURN false; END IF;
  UPDATE gcms_s07.derivative SET ready=false,deleted_at=stamp WHERE tenant_id=p_tenant AND asset_id=a.id AND deleted_at IS NULL;
 ELSIF outcome='rejected' AND j.kind='process' THEN
  UPDATE gcms_s07.asset SET state='rejected',version=version+1,rejection_code='invalid_image' WHERE tenant_id=p_tenant AND id=a.id;
 ELSIF outcome='retry' THEN
  UPDATE gcms_s07.job SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,
    failure_code=CASE WHEN p_result->>'failureCode' IN ('storage_failure','processor_failure','integrity_failure') THEN p_result->>'failureCode' ELSE 'worker_failure' END,
    available_at=stamp+CASE WHEN attempts<3 THEN interval '5 seconds' ELSE interval '30 seconds' END,lease_until=NULL WHERE id=j.id;
  RETURN false;
 ELSE RAISE EXCEPTION 'Invalid worker outcome' USING ERRCODE='23514'; END IF;
 UPDATE gcms_s07.job SET status='completed',completed_at=stamp,lease_until=NULL,failure_code=NULL WHERE id=j.id;
 RETURN true;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA gcms_s07 FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_s07 FROM PUBLIC;
GRANT USAGE ON SCHEMA gcms_s07 TO gcms_s02_tenant,gcms_s07_worker;
GRANT SELECT ON gcms_s07.asset,gcms_s07.permission,gcms_s07.job TO gcms_s02_tenant;
GRANT EXECUTE ON FUNCTION gcms_s07.publishable(text,text,integer),gcms_s07.public_derivative(text,text,integer),gcms_s07.public_target(text,text,integer),
 gcms_s07.reserve_upload(text,text,text,integer,text),gcms_s07.finish_upload(text,text,text),gcms_s07.command(text,text,text,integer,jsonb),gcms_s07.private_target(text,text,integer,text) TO gcms_s02_tenant;
GRANT EXECUTE ON FUNCTION gcms_s07.worker_claim(text,text),gcms_s07.worker_start(text,text,text,integer),gcms_s07.worker_finish(text,text,text,integer,jsonb) TO gcms_s07_worker;
