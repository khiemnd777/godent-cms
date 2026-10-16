-- Bound the complete list DTO, including site metadata and its continuation cursor.
-- A byte-limited page resumes after its last returned id; the first excluded eligible
-- card is reconsidered on the next request. Never limit raw candidates before eligibility.
CREATE OR REPLACE FUNCTION gcms_m3.public_list(tenant_slug text,k text,q text,after_id text,lim integer,filter_kind text,filter_id text,filter_pub text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s gcms_s02.site_draft%ROWTYPE;row record;page jsonb;card jsonb;published_site jsonb;header jsonb;items jsonb:='[]';budget_limited boolean:=false;BEGIN
 IF lim NOT BETWEEN 1 AND 51 OR length(q)>160 OR NOT(gcms_m3.kind(k) OR k='service') THEN RETURN NULL;END IF;
 SELECT site.* INTO s FROM gcms_s02.site_draft site JOIN gcms_s02.tenant t ON t.id=site.tenant_id WHERE site.slug=tenant_slug AND site.public_enabled AND site.slug_locked AND t.status='active';IF s.tenant_id IS NULL THEN RETURN NULL;END IF;
 SELECT x.site INTO published_site FROM (SELECT p.site,p.published_at FROM gcms_m3.publication p JOIN gcms_m3.resource r ON r.tenant_id=p.tenant_id AND r.id=p.resource_id AND r.active_publication_id=p.id WHERE p.tenant_id=s.tenant_id AND gcms_m3.text_allowed(p.tenant_id,p.resource_id,p.draft_version,r.kind) UNION ALL SELECT p.closure->'site',p.published_at FROM gcms_s02.publication_snapshot p JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=p.tenant_id AND ptr.service_id=p.service_id AND ptr.snapshot_id=p.id WHERE p.tenant_id=s.tenant_id) x ORDER BY x.published_at DESC LIMIT 1;
 IF published_site IS NULL THEN RETURN NULL;END IF;
 header:=jsonb_build_object('schemaVersion',3,'locale','vi','kind',k,'canonicalUrl',s.canonical_origin||'/'||s.slug||'/'||gcms_m3.path(k),'site',published_site);
 -- 600 is the existing decodePageCursor wire bound. PostgreSQL JSONB text adds
 -- whitespace, so this reservation also conservatively bounds the actual JSON DTO.
 IF octet_length((header||jsonb_build_object('items',items,'nextCursor',repeat('x',600)))::text)>1048576 THEN RAISE EXCEPTION 'Public list metadata exceeds payload limit' USING ERRCODE='23514';END IF;
 IF k='service' THEN
  FOR row IN SELECT d.id,p.id AS publication_id,p.publication_version,p.closure FROM gcms_s02.service_draft d JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=d.tenant_id AND ptr.service_id=d.id JOIN gcms_s02.publication_snapshot p ON p.tenant_id=ptr.tenant_id AND p.service_id=ptr.service_id AND p.id=ptr.snapshot_id WHERE d.tenant_id=s.tenant_id AND (after_id IS NULL OR d.id>after_id) AND (q='' OR position(q IN lower(p.closure->'service'->>'title'))>0 OR position(q IN lower(d.slug))>0) ORDER BY d.id LOOP
   IF filter_id IS NOT NULL AND NOT gcms_m3.service_has_reference(s.tenant_id,row.id,row.publication_id,filter_kind,filter_id,filter_pub) THEN CONTINUE;END IF;
   card:=jsonb_build_object('id',row.id,'kind','service','title',row.closure->'service'->'title','slug',row.closure->'service'->'slug','summary',row.closure->'service'->'summary','path','/'||s.slug||'/dich-vu/'||(row.closure->'service'->>'slug'),'publicationId',row.publication_id,'publicationVersion',row.publication_version);
   IF octet_length((header||jsonb_build_object('items',items||jsonb_build_array(card),'nextCursor',repeat('x',600)))::text)>1048576 THEN
    IF jsonb_array_length(items)=0 THEN RAISE EXCEPTION 'Public list card exceeds payload limit' USING ERRCODE='23514';END IF;budget_limited:=true;EXIT;
   END IF;
   items:=items||jsonb_build_array(card);IF jsonb_array_length(items)>=lim THEN EXIT;END IF;
  END LOOP;
 ELSE
  FOR row IN SELECT r.id,r.active_publication_id FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id WHERE r.tenant_id=s.tenant_id AND r.kind=k AND r.active_publication_id IS NOT NULL AND (filter_id IS NULL OR (p.reference_pins @> jsonb_build_array(jsonb_build_object('kind',filter_kind,'id',filter_id)||CASE WHEN filter_pub IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('publicationId',filter_pub) END) AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.reference_pins) selected WHERE selected->>'kind'=filter_kind AND selected->>'id'=filter_id AND (filter_pub IS NULL OR selected->>'publicationId'=filter_pub) AND gcms_m3.reference_eligible(s.tenant_id,selected)))) AND (after_id IS NULL OR r.id>after_id) AND (q='' OR position(q IN lower(p.content->>'title'))>0 OR position(q IN lower(r.slug))>0) ORDER BY r.id LOOP
   page:=gcms_m3.public_projection(s.tenant_id,row.id,row.active_publication_id);
   IF page IS NULL THEN CONTINUE;END IF;
   IF filter_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'references') x WHERE x->>'kind'=filter_kind AND x->>'id'=filter_id AND (filter_pub IS NULL OR x->>'publicationId'=filter_pub)) THEN CONTINUE;END IF;
   card:=jsonb_build_object('id',row.id,'kind',k,'title',page->'content'->'title','slug',page->'content'->'slug','summary',page->'content'->'summary','path','/'||s.slug||'/'||gcms_m3.path(k)||'/'||(page->'content'->>'slug'),'publicationId',page->'publicationId','publicationVersion',page->'publicationVersion');
   IF k='price' THEN card:=card||jsonb_build_object('price',page->'content'->'price','inclusions',page->'content'->'inclusions','notes',page->'content'->'notes','locations',coalesce((SELECT jsonb_agg(jsonb_build_object('title',x->'title','path',x->'path')) FROM jsonb_array_elements(page->'references') x WHERE x->>'kind'='location'),'[]'::jsonb));END IF;
   IF k='faq' THEN card:=card||jsonb_build_object('answer',page->'content'->'body');END IF;
   IF octet_length((header||jsonb_build_object('items',items||jsonb_build_array(card),'nextCursor',repeat('x',600)))::text)>1048576 THEN
    IF jsonb_array_length(items)=0 THEN RAISE EXCEPTION 'Public list card exceeds payload limit' USING ERRCODE='23514';END IF;budget_limited:=true;EXIT;
   END IF;
   items:=items||jsonb_build_array(card);IF jsonb_array_length(items)>=lim THEN EXIT;END IF;
  END LOOP;
 END IF;
 -- These two fields are internal SQL/API signals, removed before public serialization.
 RETURN header||jsonb_build_object('items',items,'budgetLimited',budget_limited,'hasMore',budget_limited);
END $$;

-- Service links repeat selected location identity/address outside the reference tree.
-- Check that exact DTO at admission and delivery, in addition to existing closure bounds.
CREATE FUNCTION gcms_m3.service_links_projection(t text,r text,pub text,pins jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE refs jsonb;result jsonb;BEGIN
 refs:=gcms_m3.resolve_refs(t,coalesce(pins,'[]'));
 result:=jsonb_build_object('serviceId',r,'publicationId',pub,'references',refs,'locations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x->'id','publicationId',x->'publicationId','name',x->'title','address',x->'content'->'address')) FROM jsonb_array_elements(refs) x WHERE x->>'kind'='location'),'[]'::jsonb));
 PERFORM gcms_m3.assert_public_bounds(result);RETURN result;
END $$;
CREATE OR REPLACE FUNCTION gcms_m3.public_service_links(tenant_slug text,service_slug text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE t text;r text;pub text;pins jsonb;BEGIN
 SELECT d.tenant_id,d.id,ptr.snapshot_id INTO t,r,pub FROM gcms_s02.site_draft site JOIN gcms_s02.tenant tenant ON tenant.id=site.tenant_id JOIN gcms_s02.service_draft d ON d.tenant_id=site.tenant_id JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=d.tenant_id AND ptr.service_id=d.id WHERE site.slug=tenant_slug AND d.slug=service_slug AND site.public_enabled AND site.slug_locked AND d.slug_locked AND tenant.status='active';IF t IS NULL THEN RETURN NULL;END IF;
 SELECT l.reference_pins INTO pins FROM gcms_m3.service_publication_links l WHERE l.tenant_id=t AND l.service_id=r AND l.publication_id=pub;
 RETURN gcms_m3.service_links_projection(t,r,pub,pins);
END $$;
CREATE FUNCTION gcms_m3.guard_service_link_dto_bounds() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN
 PERFORM gcms_m3.service_links_projection(NEW.tenant_id,NEW.service_id,NEW.publication_id,NEW.reference_pins);RETURN NEW;
END $$;
CREATE TRIGGER m3_service_link_dto_bounds AFTER INSERT ON gcms_m3.service_publication_links FOR EACH ROW EXECUTE FUNCTION gcms_m3.guard_service_link_dto_bounds();
REVOKE ALL ON FUNCTION gcms_m3.service_links_projection(text,text,text,jsonb),gcms_m3.guard_service_link_dto_bounds() FROM PUBLIC;
