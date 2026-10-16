-- Independent early review: reject SQL NULL versions before any unpublish effect.
-- Preserve applied0015–0017; no existing data or credentials are changed.
CREATE OR REPLACE FUNCTION gcms_s08.unpublish(p_tenant text,p_service text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old gcms_s08.operation_receipt%ROWTYPE;h gcms_s08.publication_head%ROWTYPE;d gcms_s02.service_draft%ROWTYPE;
BEGIN
 PERFORM gcms_s05.authorize(p_tenant,true);
 IF NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}'; END IF;
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT(c ?& ARRAY['operationId','expectedDraftVersion','expectedPublicationVersion','expectedPublicationRevision']) OR
   (c-ARRAY['operationId','expectedDraftVersion','expectedPublicationVersion','expectedPublicationRevision'])<>'{}'::jsonb OR
   jsonb_typeof(c->'operationId') IS DISTINCT FROM 'string' OR
   coalesce(c->>'operationId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
   THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
 IF jsonb_typeof(c->'expectedDraftVersion') IS DISTINCT FROM 'number' OR coalesce(c->>'expectedDraftVersion','') !~ '^[1-9][0-9]{0,8}$' OR
    jsonb_typeof(c->'expectedPublicationVersion') IS DISTINCT FROM 'number' OR coalesce(c->>'expectedPublicationVersion','') !~ '^[1-9][0-9]{0,8}$' OR
    jsonb_typeof(c->'expectedPublicationRevision') IS DISTINCT FROM 'number' OR coalesce(c->>'expectedPublicationRevision','') !~ '^[1-9][0-9]{0,8}$'
   THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
 SELECT * INTO old FROM gcms_s08.operation_receipt WHERE tenant_id=p_tenant AND operation_id=c->>'operationId';
 IF old.operation_id IS NOT NULL THEN
   IF old.actor_id<>gcms_s02.current_actor() OR old.resource<>'unpublish' OR old.resource_id<>p_service OR old.command<>c THEN RETURN '{"code":"OPERATION_CONFLICT"}'; END IF;
   RETURN jsonb_build_object('replayed',true,'operationId',old.operation_id);
 END IF;
 SELECT * INTO d FROM gcms_s02.service_draft WHERE tenant_id=p_tenant AND id=p_service FOR UPDATE;
 SELECT * INTO h FROM gcms_s08.publication_head WHERE tenant_id=p_tenant AND service_id=p_service FOR UPDATE;
 IF d.id IS NULL THEN RETURN '{"code":"NOT_FOUND"}'; END IF;
 IF h.active_snapshot_id IS NULL OR d.version<>(c->>'expectedDraftVersion')::integer OR h.publication_version<>(c->>'expectedPublicationVersion')::integer OR h.revision<>(c->>'expectedPublicationRevision')::integer
   THEN RETURN '{"code":"VERSION_CONFLICT"}'; END IF;
 DELETE FROM gcms_s02.publication_pointer WHERE tenant_id=p_tenant AND service_id=p_service;
 INSERT INTO gcms_s08.operation_receipt(tenant_id,operation_id,actor_id,resource,resource_id,command,applied_version)
 VALUES(p_tenant,c->>'operationId',gcms_s02.current_actor(),'unpublish',p_service,c,h.revision+1);
 INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id) VALUES(gen_random_uuid()::text,p_tenant,gcms_s02.current_actor(),'service.unpublished',p_service);
 RETURN jsonb_build_object('replayed',false,'operationId',c->>'operationId');
END $$;

CREATE OR REPLACE FUNCTION gcms_s07.require_tenant(p_tenant text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM gcms_s05.authorize(p_tenant,true);
END $$;
