-- Reuse eligible presentation within one statement, with no cross-request cache.
-- Callers supply a page produced by project() in the same statement. Self alternates
-- reuse that already-checked page; other-locale projection and every output budget remain.
-- The helper is owner-only: public callers cannot supply their own page/configuration.
CREATE FUNCTION gcms_m4.decorate_with_config(t text,l text,page jsonb,config jsonb,en_config jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE sections jsonb:='[]';s jsonb;other jsonb;alternates jsonb:='[]';k text:=page->>'kind';r text:=page->>'id';BEGIN
 IF page IS NULL THEN RETURN NULL;END IF;
 IF l='en' AND config IS NULL THEN RETURN NULL;END IF;
 IF config IS NOT NULL THEN page:=page||jsonb_build_object('config',config,'configPublicationId',config->'publicationId','site',jsonb_build_object('name',config->'content'->'name','footer',config->'content'->'footer'));END IF;
 IF page->'form'<>'null'::jsonb THEN page:=jsonb_set(page,'{form,sourceConfigPublicationId}',coalesce(config->'publicationId','null'));END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(page->'sections') LOOP IF s->'form'<>'null'::jsonb THEN s:=jsonb_set(s,'{form,sourceConfigPublicationId}',coalesce(config->'publicationId','null'));END IF;sections:=sections||jsonb_build_array(s);END LOOP;page:=jsonb_set(page,'{sections}',sections);
 FOR s IN SELECT to_jsonb(x) FROM unnest(ARRAY['vi','en']) x LOOP IF s#>>'{}'=l THEN other:=page;ELSE other:=gcms_m4.project(t,k,r,s#>>'{}');END IF;IF other IS NOT NULL AND ((s#>>'{}')='vi' OR en_config IS NOT NULL) THEN alternates:=alternates||jsonb_build_array(jsonb_build_object('locale',s,'url',other->'canonicalUrl','publicationId',other->'publicationId'));END IF;END LOOP;
 page:=jsonb_set(page,'{alternates}',alternates);IF octet_length(page::text)>1048576 OR gcms_m3.graph_nodes(page->'references')>250 THEN RETURN NULL;END IF;RETURN page;
END $$;

CREATE OR REPLACE FUNCTION gcms_m4.decorate(t text,l text,page jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE current_config jsonb;en_config jsonb;
BEGIN
 IF page IS NULL THEN RETURN NULL;END IF;
 current_config:=gcms_m4.config(t,l);
 IF l='en' THEN en_config:=current_config;ELSE en_config:=gcms_m4.config(t,'en');END IF;
 RETURN gcms_m4.decorate_with_config(t,l,page,current_config,en_config);
END $$;

CREATE OR REPLACE FUNCTION gcms_m4.public_list(tenant_slug text,l text,k text,q text,after_id text,lim integer,fk text,fi text,fp text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE t text;row record;page jsonb;items jsonb:='[]';candidate jsonb;header jsonb;budget_limited boolean:=false;en_config jsonb;config_loaded boolean:=false;BEGIN
 IF lim IS NULL OR lim NOT BETWEEN 1 AND 51 OR q IS NULL OR length(q)>160 OR NOT gcms_m4.locale(l) OR NOT gcms_m4.kind(k) OR k='config' OR ((fk IS NULL) IS DISTINCT FROM (fi IS NULL)) OR (fi IS NOT NULL AND (NOT gcms_m4.kind(fk) OR NOT gcms_m3.uuid(fi))) OR (fp IS NOT NULL AND (fi IS NULL OR NOT gcms_m3.uuid(fp))) THEN RETURN NULL;END IF;
 SELECT s.tenant_id INTO t FROM gcms_s02.site_draft s JOIN gcms_s02.tenant ten ON ten.id=s.tenant_id WHERE s.slug=tenant_slug AND s.public_enabled AND s.slug_locked AND ten.status='active';IF t IS NULL THEN RETURN NULL;END IF;
 header:=jsonb_build_object('schemaVersion',4,'locale',l,'kind',k,'config',gcms_m4.config(t,l),'canonicalUrl','http://localhost:5892/'||tenant_slug||CASE WHEN l='en' THEN '/en' ELSE '' END||CASE WHEN k IN ('home','page') THEN '' WHEN k='landing' THEN '/landing' WHEN k='promotion' THEN '/khuyen-mai' ELSE '/'||gcms_m3.path(k) END);
 IF octet_length((header||jsonb_build_object('items',items,'nextCursor',repeat('x',600)))::text)>1048576 THEN RAISE EXCEPTION 'Public list metadata budget' USING ERRCODE='23514';END IF;
 FOR row IN SELECT * FROM gcms_m4.public_candidates(t,k) c WHERE (after_id IS NULL OR c.id>after_id) AND gcms_m4.matches_filter(t,k,c.id,l,fk,fi,fp) ORDER BY c.id LOOP
  -- Both configurations are current reads in this SQL statement, never cached across requests.
  IF NOT config_loaded THEN
   IF l='en' THEN en_config:=header->'config';ELSE en_config:=gcms_m4.config(t,'en');END IF;
   -- JSON null is SQL NULL at the helper boundary, matching config()'s result.
   IF en_config='null'::jsonb THEN en_config:=NULL;END IF;
   config_loaded:=true;
  END IF;
  page:=gcms_m4.decorate_with_config(t,l,gcms_m4.project(t,k,row.id,l),nullif(header->'config','null'::jsonb),en_config);IF page IS NULL OR (q<>'' AND position(q IN lower(page->'content'->>'title'))=0 AND position(q IN row.slug)=0) THEN CONTINUE;END IF;
  IF fi IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'references') x WHERE x->>'kind'=fk AND x->>'id'=fi AND (fp IS NULL OR x->>'publicationId'=fp)) THEN CONTINUE;END IF;
  candidate:=jsonb_build_object('id',row.id,'kind',k,'locale',l,'publicationId',page->'publicationId','publicationVersion',page->'publicationVersion','title',page->'content'->'title','slug',row.slug,'content',page->'content','media',page->'media','references',page->'references','legacy',page->'legacy','path',gcms_m4.path(tenant_slug,l,k,row.slug),'promotionState',page->'promotionState');
  IF octet_length((header||jsonb_build_object('items',items||jsonb_build_array(candidate),'nextCursor',repeat('x',600)))::text)>1048576 THEN IF jsonb_array_length(items)=0 THEN RAISE EXCEPTION 'Public list card budget' USING ERRCODE='23514';END IF;budget_limited:=true;EXIT;END IF;
  items:=items||jsonb_build_array(candidate);IF jsonb_array_length(items)>=lim THEN EXIT;END IF;
 END LOOP;RETURN header||jsonb_build_object('items',items,'hasMore',budget_limited,'budgetLimited',budget_limited);
END $$;

REVOKE ALL ON FUNCTION gcms_m4.decorate_with_config(text,text,jsonb,jsonb,jsonb) FROM PUBLIC, gcms_s02_tenant;
