-- SEO returns publication identities, not rendered content. Expanding a page,
-- its configuration menu and both alternates for every row multiplies graph
-- projection work. Keep the same delivery admission and required-pin rules,
-- but do not build content, media, menus, forms or fallback pages for SEO.
CREATE FUNCTION gcms_m4.seo_legacy_identity(t text,k text,r text,pub text,depth integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;pins jsonb;ref jsonb;location_ok boolean:=false;BEGIN
 -- Legacy service pins are terminal snapshots constructed directly by both
 -- projectors; unlike a nested M3 page they do not recurse at the last depth.
 IF depth<0 OR depth>4 OR (k<>'service' AND depth>3) OR gcms_m4.legacy_eligible(t,k,r) IS NOT TRUE THEN RETURN NULL;END IF;
 IF k='service' THEN
  SELECT jsonb_build_object('publicationId',snapshot.id,'slug',snapshot.closure->'service'->>'slug') INTO result
  FROM gcms_s02.publication_pointer pointer
  JOIN gcms_s02.service_draft source_service ON source_service.tenant_id=pointer.tenant_id AND source_service.id=pointer.service_id
  JOIN gcms_s02.publication_snapshot snapshot ON snapshot.tenant_id=pointer.tenant_id AND snapshot.service_id=pointer.service_id AND snapshot.id=coalesce(pub,pointer.snapshot_id)
  WHERE pointer.tenant_id=t AND pointer.service_id=r AND source_service.slug_locked;
  RETURN result;
 END IF;
 IF gcms_m3.kind(k) IS NOT TRUE THEN RETURN NULL;END IF;
 SELECT jsonb_build_object('publicationId',publication.id,'slug',publication.content->>'slug'),publication.reference_pins INTO result,pins
 FROM gcms_m3.resource resource JOIN gcms_m3.publication publication ON publication.tenant_id=resource.tenant_id AND publication.resource_id=resource.id AND publication.id=coalesce(pub,resource.active_publication_id)
 WHERE resource.tenant_id=t AND resource.id=r AND resource.kind=k AND gcms_m3.resource_eligible(t,r,publication.id);
 IF result IS NULL THEN RETURN NULL;END IF;
 -- Legacy price delivery requires a surviving service and, when authored, a
 -- surviving location. At depth three the legacy projector prunes locations.
 IF k='price' AND EXISTS(SELECT 1 FROM jsonb_array_elements(pins) pin WHERE pin->>'kind'='location') THEN
  IF depth>=3 THEN RETURN NULL;END IF;
  FOR ref IN SELECT value FROM jsonb_array_elements(pins) WHERE value->>'kind'='location' LOOP
   IF gcms_m3.reference_eligible(t,ref) AND gcms_m4.seo_legacy_identity(t,'location',ref->>'id',ref->>'publicationId',depth+1) IS NOT NULL THEN location_ok:=true;EXIT;END IF;
  END LOOP;
  IF NOT location_ok THEN RETURN NULL;END IF;
 END IF;
 RETURN result;
END $$;

CREATE FUNCTION gcms_m4.seo_page_identity(t text,k text,r text,l text,pub text DEFAULT NULL,depth integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE variant_row gcms_m4.variant%ROWTYPE;publication_row gcms_m4.publication%ROWTYPE;ref jsonb;child jsonb;BEGIN
 IF depth<0 OR depth>3 OR gcms_m4.locale(l) IS NOT TRUE OR gcms_m4.kind(k) IS NOT TRUE OR k='config' THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM gcms_s02.site_draft site JOIN gcms_s02.tenant tenant ON tenant.id=site.tenant_id WHERE site.tenant_id=t AND site.public_enabled AND site.slug_locked AND tenant.status='active') THEN RETURN NULL;END IF;
 SELECT * INTO variant_row FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;
 IF variant_row.resource_id IS NULL OR variant_row.publication_version=0 THEN
  IF l='vi' THEN RETURN gcms_m4.seo_legacy_identity(t,k,r,pub,depth);END IF;RETURN NULL;
 END IF;
 IF variant_row.active_publication_id IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO publication_row FROM gcms_m4.publication WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l AND id=coalesce(pub,variant_row.active_publication_id) AND generation=variant_row.generation;
 IF publication_row.id IS NULL OR gcms_m4.text_allowed(t,k,r,l,publication_row.draft_version) IS NOT TRUE THEN RETURN NULL;END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(publication_row.reference_pins) WHERE value->'required'='true'::jsonb LOOP
  IF gcms_m4.reference_eligible(t,ref) IS NOT TRUE THEN RETURN NULL;END IF;
  IF ref->'legacy'='true'::jsonb THEN child:=gcms_m4.seo_legacy_identity(t,ref->>'kind',ref->>'id',ref->>'publicationId',depth+1);
  ELSE child:=gcms_m4.seo_page_identity(t,ref->>'kind',ref->>'id',l,ref->>'publicationId',depth+1);END IF;
  IF child IS NULL THEN RETURN NULL;END IF;
 END LOOP;
 -- Optional references and revoked media prune from delivery and cannot make
 -- this identity disappear. No media bytes, alt text or content enter SEO.
 RETURN jsonb_build_object('publicationId',publication_row.id,'slug',publication_row.content->>'slug');
END $$;

CREATE OR REPLACE FUNCTION gcms_m4.seo(tenant_slug text,after_key text,lim integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE site_row gcms_s02.site_draft%ROWTYPE;candidate record;config_ids jsonb;pair jsonb;identity_value jsonb;alternate_value jsonb;alternates jsonb;lang text;other_lang text;entry_key text;path_value text;out jsonb:='[]';BEGIN
 IF lim IS NULL OR lim NOT BETWEEN 1 AND 51 THEN RETURN NULL;END IF;
 SELECT site.* INTO site_row FROM gcms_s02.site_draft site JOIN gcms_s02.tenant tenant ON tenant.id=site.tenant_id WHERE site.slug=tenant_slug AND site.public_enabled AND site.slug_locked AND tenant.status='active';
 IF site_row.tenant_id IS NULL THEN RETURN NULL;END IF;
 SELECT coalesce(jsonb_object_agg(variant.locale,publication.id),'{}') INTO config_ids
 FROM gcms_m4.variant variant JOIN gcms_m4.publication publication ON publication.tenant_id=variant.tenant_id AND publication.id=variant.active_publication_id AND publication.kind=variant.kind AND publication.resource_id=variant.resource_id AND publication.locale=variant.locale AND publication.generation=variant.generation
 WHERE variant.tenant_id=site_row.tenant_id AND variant.kind='config' AND variant.resource_id=site_row.tenant_id;
 FOR candidate IN
  SELECT source.kind,source.id FROM (
   SELECT 'service'::text AS kind,id FROM gcms_s02.service_draft WHERE tenant_id=site_row.tenant_id
   UNION ALL SELECT kind,id FROM gcms_m3.resource WHERE tenant_id=site_row.tenant_id
   UNION ALL SELECT kind,id FROM gcms_m4.identity WHERE tenant_id=site_row.tenant_id
  ) source WHERE after_key IS NULL OR source.kind||':'||source.id||':vi'>after_key ORDER BY source.kind,source.id
 LOOP
  pair:='{}';
  FOREACH lang IN ARRAY ARRAY['en','vi'] LOOP
   IF lang='en' AND NOT(config_ids ? 'en') THEN CONTINUE;END IF;
   -- Preserve conservative node/byte/depth admission. A budget or backend
   -- failure aborts the request; it never produces a partial successful list.
   PERFORM gcms_m4.admit_public(site_row.tenant_id,candidate.kind,candidate.id,lang);
   identity_value:=gcms_m4.seo_page_identity(site_row.tenant_id,candidate.kind,candidate.id,lang);
   IF identity_value IS NOT NULL THEN pair:=pair||jsonb_build_object(lang,identity_value);END IF;
  END LOOP;
  alternates:='[]';
  FOREACH other_lang IN ARRAY ARRAY['vi','en'] LOOP
   alternate_value:=pair->other_lang;IF alternate_value IS NULL THEN CONTINUE;END IF;
   alternates:=alternates||jsonb_build_array(jsonb_build_object('locale',other_lang,'url',site_row.canonical_origin||gcms_m4.path(site_row.slug,other_lang,candidate.kind,alternate_value->>'slug'),'publicationId',alternate_value->'publicationId'));
  END LOOP;
  FOREACH lang IN ARRAY ARRAY['en','vi'] LOOP
   entry_key:=candidate.kind||':'||candidate.id||':'||lang;
   identity_value:=pair->lang;IF identity_value IS NULL OR (after_key IS NOT NULL AND entry_key<=after_key) THEN CONTINUE;END IF;
   path_value:=gcms_m4.path(site_row.slug,lang,candidate.kind,identity_value->>'slug');
   out:=out||jsonb_build_array(jsonb_build_object('id',candidate.id,'kind',candidate.kind,'locale',lang,'path',path_value,'canonicalUrl',site_row.canonical_origin||path_value,'publicationId',identity_value->'publicationId','configPublicationId',config_ids->lang,'alternates',alternates));
   IF jsonb_array_length(out)>=lim THEN RETURN out;END IF;
  END LOOP;
 END LOOP;
 RETURN out;
END $$;

REVOKE ALL ON FUNCTION gcms_m4.seo_legacy_identity(text,text,text,text,integer),gcms_m4.seo_page_identity(text,text,text,text,text,integer) FROM PUBLIC;
