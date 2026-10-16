-- Forward repair for current claim clocks, explicit JSON binding and durable decoder settlement failure.
DO $$ BEGIN IF current_user<>'gcms_s02_owner' THEN RAISE EXCEPTION 'S07 owner required'; END IF; END $$;
ALTER TABLE gcms_s07.worker_scope ADD COLUMN native_blocked boolean NOT NULL DEFAULT false;
-- Only the owner can clear this safety latch after confirming exact labelled container cleanup.
CREATE FUNCTION gcms_s07.guard_native_retry() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.kind='process' AND NEW.status IN ('pending','processing') AND OLD.status='failed' AND
  EXISTS(SELECT 1 FROM gcms_s07.worker_scope WHERE tenant_id=NEW.tenant_id AND native_blocked)
 THEN RAISE EXCEPTION 'Native processing blocked pending settlement' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER media_native_retry_guard BEFORE UPDATE ON gcms_s07.job FOR EACH ROW EXECUTE FUNCTION gcms_s07.guard_native_retry();
REVOKE EXECUTE ON FUNCTION gcms_s07.guard_native_retry() FROM PUBLIC;

CREATE OR REPLACE FUNCTION gcms_s07.worker_claim(p_tenant text,p_worker text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE j gcms_s07.job%ROWTYPE; stamp timestamptz; blocked boolean; BEGIN
 IF p_worker IS NULL OR p_worker !~ '^[a-f0-9-]{36}$' OR NOT EXISTS(SELECT 1 FROM gcms_s07.worker_scope WHERE tenant_id=p_tenant AND enabled) THEN RAISE EXCEPTION 'Invalid worker scope' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
 SELECT native_blocked INTO blocked FROM gcms_s07.worker_scope WHERE tenant_id=p_tenant AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid worker scope' USING ERRCODE='42501'; END IF;
 stamp:=clock_timestamp();
 -- Reconcile only enrolled uploads after a bounded crash window. A missing original retries visibly;
 -- the same upload operation can still put its checksum-bound original and resume the job.
 INSERT INTO gcms_s07.job(tenant_id,asset_id,kind,revision)
 SELECT tenant_id,id,'process',revision FROM gcms_s07.asset WHERE tenant_id=p_tenant AND state='uploading' AND withdrawn_at IS NULL AND created_at<=stamp-interval '30 seconds'
 ON CONFLICT(tenant_id,asset_id,kind,revision) DO NOTHING;
 -- Scheduling uses defaults at a later clock instant; include jobs created by this call.
 stamp:=clock_timestamp();
 FOR j IN SELECT * FROM gcms_s07.job WHERE tenant_id=p_tenant AND (kind='purge' OR NOT blocked) AND available_at<=stamp AND (status='pending' OR (status='processing' AND lease_until<=stamp)) ORDER BY CASE kind WHEN 'purge' THEN 0 ELSE 1 END,available_at,id FOR UPDATE SKIP LOCKED LOOP
  IF NOT pg_try_advisory_xact_lock(hashtextextended(j.tenant_id||'/'||j.asset_id,7517)) THEN CONTINUE; END IF;
  IF j.attempts>=5 THEN UPDATE gcms_s07.job SET status='failed',failure_code='attempts_exhausted',lease_until=NULL WHERE id=j.id; CONTINUE; END IF;
  UPDATE gcms_s07.job SET status='processing',worker_id=p_worker,fence=fence+1,lease_until=stamp+interval '30 seconds',failure_code=NULL WHERE id=j.id RETURNING * INTO j;
  RETURN jsonb_build_object('id',j.id,'tenantId',j.tenant_id,'assetId',j.asset_id,'kind',j.kind,'revision',j.revision,'fence',j.fence);
 END LOOP;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION gcms_s07.worker_start(p_tenant text,p_job text,p_worker text,p_fence integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE j gcms_s07.job%ROWTYPE; a gcms_s07.asset%ROWTYPE; target text; targets jsonb; stamp timestamptz; BEGIN
 IF NOT EXISTS(SELECT 1 FROM gcms_s07.worker_scope WHERE tenant_id=p_tenant AND enabled) THEN RAISE EXCEPTION 'Invalid worker scope' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
 SELECT * INTO j FROM gcms_s07.job WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE;
 stamp:=clock_timestamp();
 IF j.id IS NULL OR j.status<>'processing' OR j.worker_id IS DISTINCT FROM p_worker OR j.fence IS DISTINCT FROM p_fence OR j.lease_until<=stamp THEN RETURN NULL; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended(j.tenant_id||'/'||j.asset_id,7517)) THEN RETURN NULL; END IF;
 SELECT * INTO a FROM gcms_s07.asset WHERE tenant_id=p_tenant AND id=j.asset_id FOR UPDATE;
 stamp:=clock_timestamp();
 IF j.lease_until<=stamp THEN RETURN NULL; END IF;
 IF j.kind='process' AND EXISTS(SELECT 1 FROM gcms_s07.worker_scope WHERE tenant_id=p_tenant AND native_blocked) THEN
  UPDATE gcms_s07.job SET status='failed',failure_code='decoder_settlement_unknown',lease_until=NULL WHERE id=j.id; RETURN NULL;
 END IF;
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

CREATE OR REPLACE FUNCTION gcms_s07.worker_finish(p_tenant text,p_job text,p_worker text,p_fence integer,p_result jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j gcms_s07.job%ROWTYPE; a gcms_s07.asset%ROWTYPE; stamp timestamptz; outcome text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM gcms_s07.worker_scope WHERE tenant_id=p_tenant AND enabled) THEN RAISE EXCEPTION 'Invalid worker scope' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_result) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid worker result shape' USING ERRCODE='23514'; END IF;
 outcome:=p_result->>'outcome';
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
 SELECT * INTO j FROM gcms_s07.job WHERE tenant_id=p_tenant AND id=p_job FOR UPDATE;
 IF j.id IS NULL OR j.worker_id IS DISTINCT FROM p_worker OR j.fence IS DISTINCT FROM p_fence THEN RETURN false; END IF;
 SELECT * INTO a FROM gcms_s07.asset WHERE tenant_id=p_tenant AND id=j.asset_id FOR UPDATE;
 stamp:=clock_timestamp();
 -- Native code has no storage credentials; halt fresh native work before releasing the asset I/O lock.
 IF outcome='settlement_unknown' AND j.kind='process' THEN
  UPDATE gcms_s07.worker_scope SET native_blocked=true WHERE tenant_id=p_tenant;
  UPDATE gcms_s07.job SET status='failed',failure_code='decoder_settlement_unknown',lease_until=NULL WHERE id=j.id;
  RETURN false;
 END IF;
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
