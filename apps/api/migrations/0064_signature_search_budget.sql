-- R2: a query-independent window prevents withheld titles from changing continuation.
-- Only immutable CURRENT Published snapshots enter this private internal window.
-- No draft title/summary is read. A prior M4 adoption also prevents legacy revival.
CREATE FUNCTION gcms_m4.search_window(t text,l text,filter_kind text,after_key text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 WITH heads AS MATERIALIZED (
 SELECT * FROM (
  SELECT v.kind AS k,v.resource_id AS id,p.content->>'slug' AS slug,p.content AS doc
   FROM gcms_m4.variant v JOIN gcms_m4.publication p ON p.tenant_id=v.tenant_id AND p.kind=v.kind AND p.resource_id=v.resource_id AND p.locale=v.locale AND p.id=v.active_publication_id AND p.generation=v.generation
   WHERE v.tenant_id=t AND v.locale=l AND v.kind<>'config' AND v.publication_version>0 AND (filter_kind IS NULL OR v.kind=filter_kind) AND (after_key IS NULL OR (v.kind||':'||v.resource_id) COLLATE "C">after_key COLLATE "C")
  UNION ALL
  SELECT 'service',d.id,p.closure->'service'->>'slug',p.closure->'service'
   FROM gcms_s02.service_draft d JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=d.tenant_id AND ptr.service_id=d.id JOIN gcms_s02.publication_snapshot p ON p.tenant_id=ptr.tenant_id AND p.service_id=ptr.service_id AND p.id=ptr.snapshot_id
   WHERE l='vi' AND d.tenant_id=t AND d.slug_locked AND (filter_kind IS NULL OR filter_kind='service') AND (after_key IS NULL OR ('service:'||d.id) COLLATE "C">after_key COLLATE "C") AND NOT EXISTS(SELECT 1 FROM gcms_m4.variant v WHERE v.tenant_id=t AND v.kind='service' AND v.resource_id=d.id AND v.locale='vi' AND v.publication_version>0)
  UNION ALL
  SELECT d.kind,d.id,p.content->>'slug',p.content
   FROM gcms_m3.resource d JOIN gcms_m3.publication p ON p.tenant_id=d.tenant_id AND p.resource_id=d.id AND p.id=d.active_publication_id AND p.generation=d.generation
   WHERE l='vi' AND d.tenant_id=t AND (filter_kind IS NULL OR d.kind=filter_kind) AND (after_key IS NULL OR (d.kind||':'||d.id) COLLATE "C">after_key COLLATE "C") AND NOT EXISTS(SELECT 1 FROM gcms_m4.variant v WHERE v.tenant_id=t AND v.kind=d.kind AND v.resource_id=d.id AND v.locale='vi' AND v.publication_version>0)
 ) published ORDER BY (published.k||':'||published.id) COLLATE "C" LIMIT 61
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('kind',k,'id',id,'slug',slug,'title',coalesce(doc->>'title',''),'summary',coalesce(doc->>'summary','')) ORDER BY (k||':'||id) COLLATE "C"),'[]'::jsonb) FROM heads
$$;
CREATE OR REPLACE FUNCTION gcms_m4.public_search(tenant_slug text,l text,q text,filter_kind text,after_key text,lim integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE t text;candidate jsonb;page jsonb;items jsonb:='[]';config jsonb;raw_window jsonb;processed integer:=0;last_key text;resume_key text;BEGIN
 IF gcms_m4.locale(l) IS NOT TRUE OR q IS NULL OR length(q) NOT BETWEEN 2 AND 160 OR lim IS NULL OR lim NOT BETWEEN 1 AND 20 OR (filter_kind IS NOT NULL AND (gcms_m4.kind(filter_kind) IS NOT TRUE OR filter_kind='config')) OR (after_key IS NOT NULL AND (after_key !~ '^[a-z_]+:[a-f0-9-]{36}$' OR gcms_m4.kind(split_part(after_key,':',1)) IS NOT TRUE OR split_part(after_key,':',1)='config' OR gcms_m3.uuid(split_part(after_key,':',2)) IS NOT TRUE)) THEN RETURN NULL;END IF;
 SELECT s.tenant_id INTO t FROM gcms_s02.site_draft s JOIN gcms_s02.tenant ten ON ten.id=s.tenant_id WHERE s.slug=tenant_slug AND s.public_enabled AND s.slug_locked AND ten.status='active' AND gcms_m5.is_live(s.tenant_id);IF t IS NULL THEN RETURN NULL;END IF;
 config:=gcms_m4.config(t,l);IF l='en' AND config IS NULL THEN RETURN NULL;END IF;
 raw_window:=gcms_m4.search_window(t,l,filter_kind,after_key);
 FOR candidate IN SELECT value FROM jsonb_array_elements(raw_window) WITH ORDINALITY raw(value,n) WHERE n<=60 ORDER BY n LOOP
  processed:=processed+1;last_key:=(candidate->>'kind')||':'||(candidate->>'id');
  -- Cheap snapshot matching occurs inside the fixed raw window, before any graph projection.
  IF position(q IN lower((candidate->>'title')||' '||(candidate->>'summary')||' '||(candidate->>'slug')))=0 THEN CONTINUE;END IF;
  BEGIN page:=gcms_m4.project(t,candidate->>'kind',candidate->>'id',l);EXCEPTION WHEN check_violation THEN page:=NULL;END;
  IF page IS NULL THEN CONTINUE;END IF;
  items:=items||jsonb_build_array(jsonb_build_object('id',page->'id','kind',page->'kind','title',page->'content'->'title','summary',coalesce(page->'content'->>'summary',''),'path',gcms_m4.path(tenant_slug,l,page->>'kind',page->'content'->>'slug'),'locale',l,'publicationId',page->'publicationId'));
  IF jsonb_array_length(items)>=lim THEN EXIT;END IF;
 END LOOP;
 IF jsonb_array_length(raw_window)>processed THEN resume_key:=last_key;END IF;
 -- resumeAfter is private API-to-SQL state. The API seals it and returns only nextCursor.
 RETURN jsonb_build_object('schemaVersion',4,'locale',l,'query',q,'items',items,'config',config,'resumeAfter',resume_key);
END $$;
REVOKE ALL ON FUNCTION gcms_m4.search_window(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION gcms_m4.public_search(text,text,text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_m4.public_search(text,text,text,text,text,integer) TO gcms_s02_tenant;

-- A registered typed listing is reachable even when its Published collection is empty.
-- Do not scan a whole family to decide whether to show its navigation link.
-- EN links still require the current eligible Published EN configuration head.
DO $navigation$ DECLARE definition text;function_name text;old_probe text;new_probe text:='(n->>''locale''=''vi'' OR EXISTS(SELECT 1 FROM gcms_m4.variant cfg JOIN gcms_m4.publication cp ON cp.tenant_id=cfg.tenant_id AND cp.kind=cfg.kind AND cp.resource_id=cfg.resource_id AND cp.locale=cfg.locale AND cp.id=cfg.active_publication_id AND cp.generation=cfg.generation WHERE cfg.tenant_id=t AND cfg.kind=''config'' AND cfg.resource_id=t AND cfg.locale=''en'' AND cfg.publication_version>0 AND gcms_m4.text_allowed(t,''config'',t,''en'',cp.draft_version)))';BEGIN
 FOREACH function_name IN ARRAY ARRAY['signature_navigation','private_signature_navigation'] LOOP
  SELECT pg_get_functiondef(to_regprocedure('gcms_m4.'||function_name||'(text,text,jsonb,integer)')) INTO definition;
  old_probe:=CASE function_name WHEN 'signature_navigation' THEN 'EXISTS(SELECT 1 FROM gcms_m4.public_candidates(t,n->>''kind'') c WHERE gcms_m4.project_core(t,n->>''kind'',c.id,n->>''locale'',NULL,0,false) IS NOT NULL)' ELSE 'EXISTS(SELECT 1 FROM gcms_m4.public_candidates(t,n->>''kind'') c WHERE gcms_m5.private_current_reference(t,n->>''kind'',c.id,n->>''locale'') IS NOT NULL)' END;
  IF definition IS NULL OR (length(definition)-length(replace(definition,old_probe,'')))/length(old_probe)<>1 THEN RAISE EXCEPTION 'Unexpected signature listing probe';END IF;
  definition:=replace(definition,old_probe,new_probe);EXECUTE definition;
 END LOOP;
END $navigation$;
