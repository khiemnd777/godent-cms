-- M4 uses a real source union. The retained legacy slug constraint must accept
-- its inactive NULL column; lead_source_union still requires all legacy facts.
DO $$DECLARE c record;n integer:=0;BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='gcms_s04.lead'::regclass AND contype='c' AND pg_get_constraintdef(oid)='CHECK (gcms_s02.valid_slug(source_service_slug))' LOOP EXECUTE format('ALTER TABLE gcms_s04.lead DROP CONSTRAINT %I',c.conname);n:=n+1;END LOOP;
 IF n<>1 THEN RAISE EXCEPTION 'Unexpected legacy service slug constraint';END IF;
END $$;
ALTER TABLE gcms_s04.lead ADD CONSTRAINT source_service_slug_when_present CHECK(source_service_slug IS NULL OR gcms_s02.valid_slug(source_service_slug));
CREATE INDEX m4_permission_history ON gcms_m4.permission(tenant_id,kind,resource_id,locale,granted_at DESC,id DESC);
DO $$DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('gcms_m4.command(text,text,text,text,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'FUNCTION gcms_m4.command(','FUNCTION gcms_m4.command_before_permission_retry(');EXECUTE definition;
END $$;
CREATE OR REPLACE FUNCTION gcms_m4.command(t text,k text,r text,l text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE old gcms_m4.receipt%ROWTYPE;d gcms_m4.variant%ROWTYPE;out jsonb;BEGIN
 IF c->>'type' IS DISTINCT FROM 'purge_retry' THEN RETURN gcms_m4.command_before_permission_retry(t,k,r,l,c);END IF;
 PERFORM gcms_s05.authorize(t,true);
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT(c ?& ARRAY['type','operationId','expectedVersion','permissionId']) OR (c-ARRAY['type','operationId','expectedVersion','permissionId'])<>'{}' OR gcms_m3.uuid(r) IS NOT TRUE OR gcms_m4.kind(k) IS NOT TRUE OR gcms_m4.locale(l) IS NOT TRUE OR gcms_m3.uuid(c->>'operationId') IS NOT TRUE OR jsonb_typeof(c->'operationId') IS DISTINCT FROM 'string' OR gcms_m3.uuid(c->>'permissionId') IS NOT TRUE OR jsonb_typeof(c->'permissionId') IS DISTINCT FROM 'string' OR gcms_m3.version(c->'expectedVersion') IS NOT TRUE THEN RAISE EXCEPTION 'Invalid permission retry' USING ERRCODE='23514';END IF;
 IF NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}';END IF;
 SELECT * INTO old FROM gcms_m4.receipt WHERE tenant_id=t AND operation_id=c->>'operationId';IF old.tenant_id IS NOT NULL THEN
  IF old.kind<>k OR old.resource_id<>r OR old.locale<>l OR old.actor_id<>gcms_s02.current_actor() OR old.command<>c THEN RAISE EXCEPTION 'Operation conflict' USING ERRCODE='23514';END IF;RETURN old.result||'{"replayed":true}';
 END IF;
 SELECT * INTO d FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l FOR UPDATE;IF d.resource_id IS NULL THEN RETURN '{"code":"NOT_FOUND"}';END IF;IF d.version<>(c->>'expectedVersion')::integer THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='23514';END IF;
 UPDATE gcms_m4.purge_job j SET status='pending',attempts=0,failure_code=NULL,lease_until=NULL,worker_id=NULL,completed_at=NULL WHERE j.tenant_id=t AND j.permission_id=c->>'permissionId' AND j.status='failed' AND EXISTS(SELECT 1 FROM gcms_m4.permission p WHERE p.tenant_id=t AND p.id=j.permission_id AND p.kind=k AND p.resource_id=r AND p.locale=l AND p.withdrawn_at IS NOT NULL);
 IF NOT FOUND THEN RAISE EXCEPTION 'No retryable purge' USING ERRCODE='23514';END IF;
 out:=jsonb_build_object('operationId',c->>'operationId','replayed',false);INSERT INTO gcms_m4.receipt(tenant_id,operation_id,kind,resource_id,locale,actor_id,command,result) VALUES(t,c->>'operationId',k,r,l,gcms_s02.current_actor(),c,out);INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id) VALUES(gen_random_uuid()::text,t,gcms_s02.current_actor(),'m4.purge_retry',r);RETURN out;
END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_m4 FROM PUBLIC;
REVOKE ALL ON FUNCTION gcms_m4.command_before_permission_retry(text,text,text,text,jsonb) FROM gcms_s02_tenant,gcms_s04_intake,gcms_s07_worker;
