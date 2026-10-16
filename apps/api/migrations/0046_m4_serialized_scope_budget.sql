-- Public legacy JSON must prune the same exact resource asset use as its saved
-- gateway. Slugs are immutable after publication and identify that old service.
CREATE OR REPLACE FUNCTION gcms_s08.eligible_closure(p_tenant text,closure jsonb) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT (CASE WHEN closure->'service'->'coverImage' IS NOT NULL AND closure->'service'->'coverImage'<>'null'::jsonb AND
  (gcms_s07.publishable(p_tenant,closure->'service'->'coverImage'->>'assetId',(closure->'service'->'coverImage'->>'revision')::integer) IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM gcms_s02.service_draft source_service WHERE source_service.tenant_id=p_tenant AND source_service.slug=closure->'service'->>'slug' AND gcms_m4.legacy_asset_eligible(p_tenant,'service',source_service.id,closure->'service'->'coverImage'->>'assetId',(closure->'service'->'coverImage'->>'revision')::integer)))
  THEN closure#-'{service,coverImage}' ELSE closure END)#-'{service,contentLinks}'
$$;
CREATE OR REPLACE FUNCTION gcms_m4.admit_refs(t text,k text,l text,doc jsonb,pins jsonb) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE refs jsonb:=pins;raw jsonb;pin jsonb;bytes bigint;assets integer;config jsonb;section jsonb;options jsonb;BEGIN
 SELECT content INTO config FROM gcms_m4.publication WHERE tenant_id=t AND id=(SELECT active_publication_id FROM gcms_m4.variant WHERE tenant_id=t AND kind='config' AND resource_id=t AND locale=l);
 SELECT count(*)::integer INTO assets FROM gcms_m4.assets(k,doc);bytes:=coalesce(octet_length(doc::text),0)*CASE WHEN k IN ('home','page','landing') THEN 2 ELSE 1 END+16384+coalesce(assets,0)*8192+coalesce(octet_length(config::text),0);
 PERFORM gcms_m4.walk_budget(t,pins,1,bytes,0);
 IF k IN ('home','page','landing') THEN
  FOR section IN SELECT value FROM jsonb_array_elements(doc->'sections') WHERE value->'hidden'='false'::jsonb LOOP
   IF section ? 'references' THEN FOR raw IN SELECT value FROM jsonb_array_elements(section->'references') LOOP SELECT value INTO pin FROM jsonb_array_elements(pins) WHERE value->>'kind'=raw->>'kind' AND value->>'id'=raw->>'id' AND value->>'publicationId'=raw->>'publicationId' LIMIT 1;IF pin IS NOT NULL THEN refs:=refs||jsonb_build_array(pin);END IF;END LOOP;END IF;
   IF section->>'type'='promotion' OR (section->>'type'='consultation' AND section->'promotion'<>'null'::jsonb) THEN raw:=CASE WHEN section->>'type'='promotion' THEN section->'reference' ELSE section->'promotion' END;SELECT value INTO pin FROM jsonb_array_elements(pins) WHERE value->>'kind'='promotion' AND value->>'id'=raw->>'id' AND value->>'publicationId'=raw->>'publicationId' LIMIT 1;IF pin IS NOT NULL THEN refs:=refs||jsonb_build_array(pin);END IF;END IF;
   IF section->>'type'='consultation' THEN
    options:=(section->'serviceOptions')||(section->'locationOptions');
    FOR raw IN SELECT value FROM jsonb_array_elements(options) LOOP
     SELECT value INTO pin FROM jsonb_array_elements(pins) WHERE value->>'kind'=raw->>'kind' AND value->>'id'=raw->>'id' AND value->>'publicationId'=raw->>'publicationId' LIMIT 1;IF pin IS NOT NULL THEN refs:=refs||jsonb_build_array(pin,pin);END IF;
    END LOOP;
   END IF;
  END LOOP;
 ELSIF k='service' THEN FOR pin IN SELECT value FROM jsonb_array_elements(pins) WHERE value->>'kind'='location' LOOP refs:=refs||jsonb_build_array(pin);END LOOP;END IF;
 -- The root page is one serialized node. Shared pins repeat in section forms
 -- and the top-level form. Reserve all authored options even if promotion scope
 -- currently narrows them, so no scope expansion can escape the hard bound.
 PERFORM gcms_m4.walk_budget(t,refs,1,bytes,0);
END $$;
