-- Bound traversal before constructing the expanded public DTO. Applied0025-0029 stay immutable.
-- This conservative closure budget includes per-node/path and media-label overhead;
-- the exact post-projection 250-node/1MiB check remains the final admission rule.
CREATE FUNCTION gcms_m3.walk_budget(t text,refs jsonb,nodes integer,bytes bigint,depth integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE ref jsonb;doc jsonb;nested jsonb;result jsonb;asset_count integer;BEGIN
 IF nodes>250 OR bytes>1048576 OR depth>3 THEN RAISE EXCEPTION 'M3 public graph limit' USING ERRCODE='23514';END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(refs) LOOP
  IF NOT gcms_m3.reference_eligible(t,ref) THEN CONTINUE;END IF;
  nodes:=nodes+1;IF nodes>250 THEN RAISE EXCEPTION 'M3 public graph limit' USING ERRCODE='23514';END IF;
  IF ref->>'kind'='service' THEN
   SELECT jsonb_build_object('kind','service','title',p.closure->'service'->'title','slug',p.closure->'service'->'slug','summary',p.closure->'service'->'summary') INTO doc FROM gcms_s02.publication_snapshot p WHERE p.tenant_id=t AND p.service_id=ref->>'id' AND p.id=ref->>'publicationId';nested:='[]';asset_count:=0;
  ELSE
   SELECT p.content,p.reference_pins INTO doc,nested FROM gcms_m3.publication p WHERE p.tenant_id=t AND p.resource_id=ref->>'id' AND p.id=ref->>'publicationId';
   SELECT count(*)::integer INTO asset_count FROM gcms_m3.asset_refs(doc);
  END IF;
  bytes:=bytes+octet_length(doc::text)+2048+asset_count*8192;
  IF bytes>1048576 THEN RAISE EXCEPTION 'M3 public graph limit' USING ERRCODE='23514';END IF;
  IF jsonb_array_length(nested)>0 THEN result:=gcms_m3.walk_budget(t,nested,nodes,bytes,depth+1);nodes:=(result->>'nodes')::integer;bytes:=(result->>'bytes')::bigint;END IF;
 END LOOP;RETURN jsonb_build_object('nodes',nodes,'bytes',bytes);
END $$;
CREATE FUNCTION gcms_m3.admit_references(t text,refs jsonb,own_content jsonb) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE own_bytes bigint;asset_count integer;BEGIN
 SELECT count(*)::integer INTO asset_count FROM gcms_m3.asset_refs(coalesce(own_content->'content','{}'));
 own_bytes:=octet_length(own_content::text)+4096+asset_count*8192;
 PERFORM gcms_m3.walk_budget(t,refs,0,own_bytes,0);
END $$;
ALTER FUNCTION gcms_m3.command(text,text,jsonb) RENAME TO command_before_budget;
REVOKE ALL ON FUNCTION gcms_m3.command_before_budget(text,text,jsonb) FROM gcms_s02_tenant;
CREATE FUNCTION gcms_m3.command(t text,r text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE doc jsonb;pins jsonb;site jsonb;BEGIN
 PERFORM gcms_s05.authorize(t,true);
 -- Replays retain their original result and never recreate an active pointer.
 IF c->>'type'='publish' AND NOT EXISTS(SELECT 1 FROM gcms_m3.receipt WHERE tenant_id=t AND operation_id=c->>'operationId') THEN
  SELECT content INTO doc FROM gcms_m3.resource WHERE tenant_id=t AND id=r;
  IF doc IS NOT NULL THEN
   SELECT jsonb_build_object('name',s.name,'footer',jsonb_build_object('intro',s.footer_intro,'body',s.footer_body)) INTO site FROM gcms_s02.site_draft s WHERE s.tenant_id=t;
   pins:=gcms_m3.pin_refs(t,r,doc->'references');PERFORM gcms_m3.admit_references(t,pins,jsonb_build_object('content',doc,'site',site));
  END IF;
 END IF;
 RETURN gcms_m3.command_before_budget(t,r,c);
END $$;
CREATE FUNCTION gcms_m3.guard_service_link_preflight() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE closure jsonb;BEGIN
 SELECT p.closure INTO closure FROM gcms_s02.publication_snapshot p WHERE p.tenant_id=NEW.tenant_id AND p.service_id=NEW.service_id AND p.id=NEW.publication_id;
 PERFORM gcms_m3.admit_references(NEW.tenant_id,NEW.reference_pins,closure);RETURN NEW;
END $$;
CREATE TRIGGER m3_service_link_preflight BEFORE INSERT ON gcms_m3.service_publication_links FOR EACH ROW EXECUTE FUNCTION gcms_m3.guard_service_link_preflight();
CREATE OR REPLACE FUNCTION gcms_m3.preview_issues(t text,r text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE d gcms_m3.resource%ROWTYPE;a jsonb;pins jsonb;issues jsonb:='[]';BEGIN
 IF t IS DISTINCT FROM nullif(current_setting('gcms.tenant_id',true),'') OR NOT gcms_s02.has_current_membership(t) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM gcms_m3.resource WHERE tenant_id=t AND id=r;IF d.id IS NULL THEN RETURN '["NOT_FOUND"]';END IF;
 BEGIN
  pins:=gcms_m3.pin_refs(t,r,d.content->'references');
  BEGIN PERFORM gcms_m3.admit_references(t,pins,jsonb_build_object('content',d.content));EXCEPTION WHEN check_violation THEN issues:=issues||'"PUBLIC_GRAPH_LIMIT"'::jsonb;END;
 EXCEPTION WHEN check_violation THEN issues:=issues||'"REFERENCE_UNAVAILABLE"'::jsonb;END;
 IF NOT gcms_m3.text_allowed(t,r,d.version,d.kind) THEN issues:=issues||'"TEXT_PERMISSION_REQUIRED"'::jsonb;END IF;
 FOR a IN SELECT * FROM gcms_m3.asset_refs(d.content) LOOP IF NOT gcms_m3.asset_allowed(t,r,d.version,a->>'assetId',(a->>'revision')::integer) THEN issues:=issues||'"ASSET_PERMISSION_REQUIRED"'::jsonb;END IF;END LOOP;
 RETURN issues;
END $$;
REVOKE ALL ON FUNCTION gcms_m3.walk_budget(text,jsonb,integer,bigint,integer),gcms_m3.admit_references(text,jsonb,jsonb),gcms_m3.command(text,text,jsonb),gcms_m3.guard_service_link_preflight() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_m3.command(text,text,jsonb) TO gcms_s02_tenant;

-- Reverse membership is selected before expanding an unrelated content graph.
CREATE OR REPLACE FUNCTION gcms_m3.public_list(tenant_slug text,k text,q text,after_id text,lim integer,filter_kind text,filter_id text,filter_pub text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s gcms_s02.site_draft%ROWTYPE;row record;page jsonb;card jsonb;published_site jsonb;items jsonb:='[]';BEGIN
 IF lim NOT BETWEEN 1 AND 51 OR length(q)>160 OR NOT(gcms_m3.kind(k) OR k='service') THEN RETURN NULL;END IF;
 SELECT site.* INTO s FROM gcms_s02.site_draft site JOIN gcms_s02.tenant t ON t.id=site.tenant_id WHERE site.slug=tenant_slug AND site.public_enabled AND site.slug_locked AND t.status='active';IF s.tenant_id IS NULL THEN RETURN NULL;END IF;
 IF k='service' THEN
  FOR row IN SELECT d.id,p.id AS publication_id,p.publication_version,p.closure FROM gcms_s02.service_draft d JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=d.tenant_id AND ptr.service_id=d.id JOIN gcms_s02.publication_snapshot p ON p.tenant_id=ptr.tenant_id AND p.service_id=ptr.service_id AND p.id=ptr.snapshot_id WHERE d.tenant_id=s.tenant_id AND (after_id IS NULL OR d.id>after_id) AND (q='' OR position(q IN lower(p.closure->'service'->>'title'))>0 OR position(q IN lower(d.slug))>0) ORDER BY d.id LOOP
   -- Service relation filtering is supplied by the S09 snapshot link seam.
   IF filter_id IS NOT NULL AND NOT gcms_m3.service_has_reference(s.tenant_id,row.id,row.publication_id,filter_kind,filter_id,filter_pub) THEN CONTINUE;END IF;
   items:=items||jsonb_build_array(jsonb_build_object('id',row.id,'kind','service','title',row.closure->'service'->'title','slug',row.closure->'service'->'slug','summary',row.closure->'service'->'summary','path','/'||s.slug||'/dich-vu/'||(row.closure->'service'->>'slug'),'publicationId',row.publication_id,'publicationVersion',row.publication_version));IF jsonb_array_length(items)>=lim THEN EXIT;END IF;
  END LOOP;
 ELSE
  FOR row IN SELECT r.id,r.active_publication_id FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id WHERE r.tenant_id=s.tenant_id AND r.kind=k AND r.active_publication_id IS NOT NULL AND (filter_id IS NULL OR (p.reference_pins @> jsonb_build_array(jsonb_build_object('kind',filter_kind,'id',filter_id)||CASE WHEN filter_pub IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('publicationId',filter_pub) END) AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.reference_pins) selected WHERE selected->>'kind'=filter_kind AND selected->>'id'=filter_id AND (filter_pub IS NULL OR selected->>'publicationId'=filter_pub) AND gcms_m3.reference_eligible(s.tenant_id,selected)))) AND (after_id IS NULL OR r.id>after_id) AND (q='' OR position(q IN lower(p.content->>'title'))>0 OR position(q IN lower(r.slug))>0) ORDER BY r.id LOOP
   page:=gcms_m3.public_projection(s.tenant_id,row.id,row.active_publication_id);
   IF page IS NULL THEN CONTINUE;END IF;
   IF filter_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'references') x WHERE x->>'kind'=filter_kind AND x->>'id'=filter_id AND (filter_pub IS NULL OR x->>'publicationId'=filter_pub)) THEN CONTINUE;END IF;
   card:=jsonb_build_object('id',row.id,'kind',k,'title',page->'content'->'title','slug',page->'content'->'slug','summary',page->'content'->'summary','path','/'||s.slug||'/'||gcms_m3.path(k)||'/'||(page->'content'->>'slug'),'publicationId',page->'publicationId','publicationVersion',page->'publicationVersion');
   IF k='price' THEN card:=card||jsonb_build_object('price',page->'content'->'price','inclusions',page->'content'->'inclusions','notes',page->'content'->'notes','locations',coalesce((SELECT jsonb_agg(jsonb_build_object('title',x->'title','path',x->'path')) FROM jsonb_array_elements(page->'references') x WHERE x->>'kind'='location'),'[]'::jsonb));END IF;
   IF k='faq' THEN card:=card||jsonb_build_object('answer',page->'content'->'body');END IF;
   items:=items||jsonb_build_array(card);IF jsonb_array_length(items)>=lim THEN EXIT;END IF;
  END LOOP;
 END IF;
 SELECT x.site INTO published_site FROM (SELECT p.site,p.published_at FROM gcms_m3.publication p JOIN gcms_m3.resource r ON r.tenant_id=p.tenant_id AND r.id=p.resource_id AND r.active_publication_id=p.id WHERE p.tenant_id=s.tenant_id AND gcms_m3.text_allowed(p.tenant_id,p.resource_id,p.draft_version,r.kind) UNION ALL SELECT p.closure->'site',p.published_at FROM gcms_s02.publication_snapshot p JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=p.tenant_id AND ptr.service_id=p.service_id AND ptr.snapshot_id=p.id WHERE p.tenant_id=s.tenant_id) x ORDER BY x.published_at DESC LIMIT 1;
 IF published_site IS NULL THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('schemaVersion',3,'locale','vi','kind',k,'canonicalUrl',s.canonical_origin||'/'||s.slug||'/'||gcms_m3.path(k),'site',published_site,'items',items);
END $$;

-- Narrow eligibility for private reference options; it does not expand nested graphs.
CREATE FUNCTION gcms_m3.resource_eligible(t text,r text,pub text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM gcms_m3.resource d JOIN gcms_m3.publication p ON p.tenant_id=d.tenant_id AND p.resource_id=d.id JOIN gcms_s02.site_draft s ON s.tenant_id=d.tenant_id JOIN gcms_s02.tenant tenant ON tenant.id=d.tenant_id
 WHERE d.tenant_id=t AND d.id=r AND p.id=pub AND d.active_publication_id IS NOT NULL AND p.generation=d.generation AND s.public_enabled AND s.slug_locked AND d.slug_locked AND tenant.status='active' AND gcms_m3.text_allowed(t,r,p.draft_version,d.kind) AND
 (d.kind<>'price' OR (EXISTS(SELECT 1 FROM jsonb_array_elements(p.reference_pins) x WHERE x->>'kind'='service' AND gcms_m3.reference_eligible(t,x)) AND
 (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.reference_pins) x WHERE x->>'kind'='location') OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.reference_pins) x WHERE x->>'kind'='location' AND gcms_m3.reference_eligible(t,x))))))
$$;
REVOKE ALL ON FUNCTION gcms_m3.resource_eligible(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_m3.resource_eligible(text,text,text) TO gcms_s02_tenant;
