-- Navigation needs reachability, not a complete content/media JSON projection.
-- Keep this predicate equivalent to project_core(...,false) IS NOT NULL.
-- Full page/media reads still use project()/project_core(); no cached state is kept.
CREATE FUNCTION gcms_m4.navigation_available(t text,k text,r text,l text,pub text,depth integer) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_m4.variant%ROWTYPE;p gcms_m4.publication%ROWTYPE;ref jsonb;
BEGIN
 IF depth<0 OR depth>3 OR NOT gcms_m4.locale(l) OR k='config' THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM gcms_s02.site_draft s JOIN gcms_s02.tenant ten ON ten.id=s.tenant_id
   WHERE s.tenant_id=t AND s.public_enabled AND s.slug_locked AND ten.status='active') THEN RETURN false;END IF;
 SELECT * INTO d FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;
 IF d.resource_id IS NULL OR d.publication_version=0 THEN
  IF l='vi' THEN RETURN gcms_m4.legacy_page(t,k,r) IS NOT NULL;ELSE RETURN false;END IF;
 END IF;
 IF d.active_publication_id IS NULL THEN RETURN false;END IF;
 SELECT * INTO p FROM gcms_m4.publication WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l
   AND id=coalesce(pub,d.active_publication_id) AND generation=d.generation;
 IF p.id IS NULL OR NOT gcms_m4.text_allowed(t,k,r,l,p.draft_version) THEN RETURN false;END IF;

 -- Only required references can make the containing page unavailable. Optional
 -- references and withdrawn images are omitted by the unchanged full projection.
 FOR ref IN SELECT value FROM jsonb_array_elements(p.reference_pins) WHERE value->'required'='true'::jsonb LOOP
  IF gcms_m4.reference_eligible(t,ref) IS NOT TRUE THEN RETURN false;END IF;
  -- Retain the exact legacy closure rules, including legacy service behavior.
  IF ref->'legacy'='true'::jsonb THEN RETURN gcms_m4.project_core(t,k,r,l,pub,depth,false) IS NOT NULL;END IF;
  IF NOT gcms_m4.navigation_available(t,ref->>'kind',ref->>'id',l,ref->>'publicationId',depth+1) THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION gcms_m4.target_path(t text,target jsonb,allow_fallback boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE slug text;lang text:=target->>'locale';s text;available boolean;
BEGIN
 IF NOT gcms_m4.target(target) THEN RETURN NULL;END IF;
 SELECT sd.slug INTO s FROM gcms_s02.site_draft sd WHERE tenant_id=t;
 slug:=gcms_m4.identity_slug(t,target->>'kind',target->>'id');IF slug IS NULL THEN RETURN NULL;END IF;
 -- Preserve admission and its failure contract before any navigation result.
 BEGIN PERFORM gcms_m4.admit_public(t,target->>'kind',target->>'id',lang);EXCEPTION WHEN check_violation THEN RETURN NULL;END;
 available:=gcms_m4.navigation_available(t,target->>'kind',target->>'id',lang,NULL,0);
 IF NOT available AND lang='en' AND allow_fallback THEN
  lang:='vi';available:=gcms_m4.navigation_available(t,target->>'kind',target->>'id','vi',NULL,0);
 END IF;
 IF NOT available THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('path',gcms_m4.path(s,lang,target->>'kind',slug),'actualLocale',lang,'fallback',lang IS DISTINCT FROM target->>'locale');
END $$;

CREATE OR REPLACE FUNCTION gcms_m4.signature_navigation(t text,l text,nodes jsonb,depth integer DEFAULT 1) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n jsonb;out jsonb:='[]';children jsonb;target jsonb;site_slug text;
BEGIN
 IF depth>3 THEN RETURN '[]';END IF;SELECT slug INTO site_slug FROM gcms_s02.site_draft WHERE tenant_id=t;
 FOR n IN SELECT value FROM jsonb_array_elements(nodes) LOOP
  children:=gcms_m4.signature_navigation(t,l,n->'children',depth+1);target:=NULL;
  IF n->>'type'='resource' THEN target:=gcms_m4.target_path(t,n->'target',(n->>'allowViFallback')::boolean);
  ELSIF n->>'type'='listing' THEN
   IF EXISTS(SELECT 1 FROM gcms_m4.public_candidates(t,n->>'kind') c WHERE gcms_m4.navigation_available(t,n->>'kind',c.id,n->>'locale',NULL,0)) THEN
    target:=jsonb_build_object('path','/'||site_slug||CASE WHEN n->>'locale'='en' THEN '/en' ELSE '' END||'/'||CASE WHEN n->>'kind'='promotion' THEN 'khuyen-mai' ELSE gcms_m3.path(n->>'kind') END,'actualLocale',n->>'locale','fallback',false);
   END IF;
  END IF;
  IF target IS NULL AND jsonb_array_length(children)=0 THEN CONTINUE;END IF;
  out:=out||jsonb_build_array(jsonb_build_object('id',n->'id','label',n->'label','type',n->'type','path',target->'path','actualLocale',coalesce(target->'actualLocale',to_jsonb(l)),'fallback',coalesce(target->'fallback','false'::jsonb),'children',children));
 END LOOP;RETURN out;
END $$;

REVOKE ALL ON FUNCTION gcms_m4.navigation_available(text,text,text,text,text,integer) FROM PUBLIC, gcms_s02_tenant;
