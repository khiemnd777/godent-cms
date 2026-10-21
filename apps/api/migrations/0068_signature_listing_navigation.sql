-- Restore the 0064 contract: registered typed listings remain reachable when empty.
-- EN still needs the current eligible Published EN configuration head. Resource
-- and hero targets retain 0067's permission-aware availability predicate.
DO $repair$
DECLARE definition text;
 old_probe text:='EXISTS(SELECT 1 FROM gcms_m4.public_candidates(t,n->>''kind'') c WHERE gcms_m4.navigation_available(t,n->>''kind'',c.id,n->>''locale'',NULL,0))';
 new_probe text:='(n->>''locale''=''vi'' OR EXISTS(SELECT 1 FROM gcms_m4.variant cfg JOIN gcms_m4.publication cp ON cp.tenant_id=cfg.tenant_id AND cp.kind=cfg.kind AND cp.resource_id=cfg.resource_id AND cp.locale=cfg.locale AND cp.id=cfg.active_publication_id AND cp.generation=cfg.generation WHERE cfg.tenant_id=t AND cfg.kind=''config'' AND cfg.resource_id=t AND cfg.locale=''en'' AND cfg.publication_version>0 AND gcms_m4.text_allowed(t,''config'',t,''en'',cp.draft_version)))';
BEGIN
 SELECT pg_get_functiondef('gcms_m4.signature_navigation(text,text,jsonb,integer)'::regprocedure) INTO definition;
 IF definition IS NULL OR (length(definition)-length(replace(definition,old_probe,'')))/length(old_probe)<>1 THEN
  RAISE EXCEPTION 'Unexpected signature listing availability probe';
 END IF;
 definition:=replace(definition,old_probe,new_probe);EXECUTE definition;
END $repair$;
