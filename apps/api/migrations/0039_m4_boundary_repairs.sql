-- Independent review R2/R3/R4/R5/R7: forward-only strict boundaries and current delivery eligibility.
CREATE FUNCTION gcms_m4.adopted(t text,k text,r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT EXISTS(SELECT 1 FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale='vi' AND publication_version>0) $$;
CREATE FUNCTION gcms_m4.valid_content_before_strict(k text,c jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE s jsonb;i jsonb;ref jsonb;seen text[]:='{}';allowed text[];extra text[];forms integer:=0;BEGIN
 IF gcms_m4.kind(k) IS NOT TRUE OR jsonb_typeof(c) IS DISTINCT FROM 'object' OR octet_length(c::text)>524288 THEN RETURN false;END IF;
 IF gcms_m3.kind(k) THEN RETURN gcms_m3.valid_content(c) IS TRUE AND c->>'kind'=k;END IF;
 IF k='config' THEN
  IF NOT(c ?& ARRAY['name','logo','theme','themeVersion','palette','font','layout','footer','menu']) OR (c-ARRAY['name','logo','theme','themeVersion','palette','font','layout','footer','menu'])<>'{}' OR NOT gcms_m4.text(c->'name',160,true) OR NOT gcms_m4.image(c->'logo') OR coalesce(c->>'theme','') NOT IN ('clarity','showcase') OR c->'themeVersion' IS DISTINCT FROM '1'::jsonb OR coalesce(c->>'palette','') NOT IN ('teal','blue','plum') OR coalesce(c->>'font','') NOT IN ('system','serif') OR coalesce(c->>'layout','') NOT IN ('comfortable','compact') OR jsonb_typeof(c->'footer') IS DISTINCT FROM 'object' OR NOT(c->'footer' ?& ARRAY['intro','body']) OR ((c->'footer')-ARRAY['intro','body'])<>'{}' OR NOT gcms_m4.text(c->'footer'->'intro',500) OR gcms_s02.valid_document(c->'footer'->'body',2000) IS NOT TRUE OR jsonb_typeof(c->'menu') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'menu')>20 THEN RETURN false;END IF;
  FOR i IN SELECT value FROM jsonb_array_elements(c->'menu') LOOP IF jsonb_typeof(i) IS DISTINCT FROM 'object' OR NOT(i ?& ARRAY['id','label','target','allowViFallback']) OR (i-ARRAY['id','label','target','allowViFallback'])<>'{}' OR i->>'id' !~ '^[-a-zA-Z0-9_]{1,64}$' OR i->>'id'=ANY(seen) OR NOT gcms_m4.text(i->'label',80,true) OR NOT gcms_m4.target(i->'target') OR jsonb_typeof(i->'allowViFallback') IS DISTINCT FROM 'boolean' THEN RETURN false;END IF;seen:=array_append(seen,i->>'id');END LOOP;RETURN true;
 END IF;
 IF NOT(c ?& ARRAY['slug','title','summary','seo']) OR gcms_s02.valid_slug(c->>'slug') IS NOT TRUE OR NOT gcms_m4.text(c->'title',160,true) OR NOT gcms_m4.text(c->'summary',320) OR jsonb_typeof(c->'seo') IS DISTINCT FROM 'object' OR NOT(c->'seo' ?& ARRAY['title','description']) OR ((c->'seo')-ARRAY['title','description'])<>'{}' OR NOT gcms_m4.text(c->'seo'->'title',160) OR NOT gcms_m4.text(c->'seo'->'description',320) THEN RETURN false;END IF;
 IF k='service' THEN
  IF NOT(c ? 'body') OR (c-ARRAY['slug','title','summary','seo','body','coverImage','contentLinks'])<>'{}' OR gcms_s02.valid_document(c->'body',20000) IS NOT TRUE OR (c ? 'coverImage' AND NOT gcms_m4.image(c->'coverImage')) THEN RETURN false;END IF;
  IF c ? 'contentLinks' THEN IF jsonb_typeof(c->'contentLinks') IS DISTINCT FROM 'object' OR NOT(c->'contentLinks' ? 'references') OR ((c->'contentLinks')-'references')<>'{}' OR NOT gcms_m3.references_shape(c->'contentLinks'->'references') THEN RETURN false;END IF;FOR ref IN SELECT value FROM jsonb_array_elements(c->'contentLinks'->'references') LOOP IF ref->>'kind'<>ALL(ARRAY['specialty','service_group','location','service','faq']) THEN RETURN false;END IF;END LOOP;END IF;RETURN true;
 END IF;
 IF c->>'kind' IS DISTINCT FROM k THEN RETURN false;END IF;
 IF k='promotion' THEN
  IF NOT(c ?& ARRAY['kind','body','startAt','endAt','authoredTimezone','conditions','references']) OR (c-ARRAY['kind','slug','title','summary','seo','body','startAt','endAt','authoredTimezone','conditions','references'])<>'{}' OR gcms_s02.valid_document(c->'body',20000) IS NOT TRUE OR NOT gcms_m4.text(c->'conditions',5000,true) OR NOT gcms_m4.text(c->'authoredTimezone',80,true) OR c->>'startAt' !~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$' OR c->>'endAt' !~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$' OR (c->>'startAt')::timestamptz>=(c->>'endAt')::timestamptz OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=c->>'authoredTimezone') OR NOT gcms_m3.references_shape(c->'references') THEN RETURN false;END IF;
  FOR ref IN SELECT value FROM jsonb_array_elements(c->'references') LOOP IF ref->>'kind'<>ALL(ARRAY['service','location','price']) THEN RETURN false;END IF;END LOOP;RETURN true;
 END IF;
 IF NOT(c ?& ARRAY['kind','sections']) OR (c-ARRAY['kind','slug','title','summary','seo','sections'])<>'{}' OR jsonb_typeof(c->'sections') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'sections')>30 OR (k='home' AND c->>'slug'<>'home') OR (k='page' AND NOT gcms_m4.page_slug(c->>'slug')) THEN RETURN false;END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(c->'sections') LOOP
  IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR NOT(s ?& ARRAY['id','type','hidden']) OR s->>'id' !~ '^[-a-zA-Z0-9_]{1,64}$' OR s->>'id'=ANY(seen) OR jsonb_typeof(s->'hidden') IS DISTINCT FROM 'boolean' THEN RETURN false;END IF;seen:=array_append(seen,s->>'id');
  extra:=CASE s->>'type' WHEN 'hero' THEN ARRAY['title','text','image','action'] WHEN 'rich_text' THEN ARRAY['body'] WHEN 'promotion' THEN ARRAY['title','reference','required'] WHEN 'consultation' THEN ARRAY['title','promotion','serviceOptions','locationOptions'] ELSE ARRAY['title','references','required'] END;
  IF NOT(s ?& extra) OR (s-(ARRAY['id','type','hidden']||extra))<>'{}' THEN RETURN false;END IF;
  IF s->>'type'='hero' THEN
   IF NOT gcms_m4.text(s->'title',160,true) OR NOT gcms_m4.text(s->'text',1000) OR NOT gcms_m4.image(s->'image') THEN RETURN false;END IF;
   i:=s->'action';IF i<>'null'::jsonb AND (jsonb_typeof(i) IS DISTINCT FROM 'object' OR NOT(i ?& ARRAY['label','target','allowViFallback']) OR (i-ARRAY['label','target','allowViFallback'])<>'{}' OR NOT gcms_m4.text(i->'label',80,true) OR NOT gcms_m4.target(i->'target') OR jsonb_typeof(i->'allowViFallback') IS DISTINCT FROM 'boolean') THEN RETURN false;END IF;
  ELSIF s->>'type'='rich_text' THEN IF gcms_s02.valid_document(s->'body',20000) IS NOT TRUE THEN RETURN false;END IF;
  ELSIF s->>'type'='promotion' THEN IF NOT gcms_m4.text(s->'title',160) OR NOT gcms_m4.promotion_ref(s->'reference') OR jsonb_typeof(s->'required') IS DISTINCT FROM 'boolean' THEN RETURN false;END IF;
  ELSIF s->>'type'='consultation' THEN
   forms:=forms+1;IF forms>1 OR k<>'landing' OR NOT gcms_m4.text(s->'title',160) OR (s->'promotion'<>'null'::jsonb AND NOT gcms_m4.promotion_ref(s->'promotion')) OR NOT gcms_m3.references_shape(s->'serviceOptions') OR NOT gcms_m3.references_shape(s->'locationOptions') THEN RETURN false;END IF;
   FOR ref IN SELECT value FROM jsonb_array_elements(s->'serviceOptions') LOOP IF ref->>'kind'<>'service' THEN RETURN false;END IF;END LOOP;FOR ref IN SELECT value FROM jsonb_array_elements(s->'locationOptions') LOOP IF ref->>'kind'<>'location' THEN RETURN false;END IF;END LOOP;
  ELSE
   allowed:=CASE s->>'type' WHEN 'services' THEN ARRAY['service','specialty','service_group'] WHEN 'doctors' THEN ARRAY['doctor'] WHEN 'locations' THEN ARRAY['location'] WHEN 'prices' THEN ARRAY['price'] WHEN 'cases' THEN ARRAY['case'] WHEN 'gallery' THEN ARRAY['gallery'] WHEN 'testimonials' THEN ARRAY['testimonial'] WHEN 'articles' THEN ARRAY['article'] WHEN 'faq' THEN ARRAY['faq'] END;
   IF allowed IS NULL OR NOT gcms_m4.text(s->'title',160) OR NOT gcms_m3.references_shape(s->'references') OR jsonb_array_length(s->'references')>30 OR jsonb_typeof(s->'required') IS DISTINCT FROM 'boolean' THEN RETURN false;END IF;FOR ref IN SELECT value FROM jsonb_array_elements(s->'references') LOOP IF NOT(ref->>'kind'=ANY(allowed)) THEN RETURN false;END IF;END LOOP;
  END IF;
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;END $$;

CREATE OR REPLACE FUNCTION gcms_m4.valid_content(k text,c jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$DECLARE x jsonb;name text;BEGIN
 IF gcms_m4.kind(k) IS NOT TRUE OR jsonb_typeof(c) IS DISTINCT FROM 'object' THEN RETURN false;END IF;
 IF k='config' THEN
  FOREACH name IN ARRAY ARRAY['name','theme','palette','font','layout'] LOOP IF jsonb_typeof(c->name) IS DISTINCT FROM 'string' THEN RETURN false;END IF;END LOOP;
  IF jsonb_typeof(c->'themeVersion') IS DISTINCT FROM 'number' OR jsonb_typeof(c->'menu') IS DISTINCT FROM 'array' THEN RETURN false;END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(c->'menu') LOOP IF jsonb_typeof(x) IS DISTINCT FROM 'object' OR jsonb_typeof(x->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(x->'label') IS DISTINCT FROM 'string' OR gcms_m4.target(x->'target') IS NOT TRUE OR jsonb_typeof(x->'allowViFallback') IS DISTINCT FROM 'boolean' THEN RETURN false;END IF;END LOOP;
 ELSE
  FOREACH name IN ARRAY ARRAY['slug','title','summary'] LOOP IF jsonb_typeof(c->name) IS DISTINCT FROM 'string' THEN RETURN false;END IF;END LOOP;
  IF k<>'service' AND c->>'kind' IS DISTINCT FROM k THEN RETURN false;END IF;
  IF k IN ('home','page','landing') THEN IF jsonb_typeof(c->'sections') IS DISTINCT FROM 'array' THEN RETURN false;END IF;
   FOR x IN SELECT value FROM jsonb_array_elements(c->'sections') LOOP IF jsonb_typeof(x) IS DISTINCT FROM 'object' OR jsonb_typeof(x->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(x->'type') IS DISTINCT FROM 'string' OR jsonb_typeof(x->'hidden') IS DISTINCT FROM 'boolean' THEN RETURN false;END IF;END LOOP;
  ELSIF k='promotion' THEN FOREACH name IN ARRAY ARRAY['startAt','endAt','authoredTimezone','conditions'] LOOP IF jsonb_typeof(c->name) IS DISTINCT FROM 'string' THEN RETURN false;END IF;END LOOP;END IF;
 END IF;
 RETURN gcms_m4.valid_content_before_strict(k,c) IS TRUE;
EXCEPTION WHEN OTHERS THEN RETURN false;END $$;
CREATE FUNCTION gcms_m4.legacy_reference_base(t text,ref jsonb) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN ref->>'kind'='service' THEN EXISTS(SELECT 1 FROM gcms_s02.publication_pointer ptr JOIN gcms_m3.service_publication_generation g ON g.tenant_id=ptr.tenant_id AND g.service_id=ptr.service_id LEFT JOIN gcms_m3.service_generation current_generation ON current_generation.tenant_id=ptr.tenant_id AND current_generation.service_id=ptr.service_id WHERE ptr.tenant_id=t AND ptr.service_id=ref->>'id' AND g.publication_id=ref->>'publicationId' AND g.generation=coalesce(current_generation.generation,0) AND g.generation=(ref->>'generation')::integer)
 ELSE EXISTS(SELECT 1 FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id WHERE r.tenant_id=t AND r.id=ref->>'id' AND r.kind=ref->>'kind' AND r.active_publication_id IS NOT NULL AND p.id=ref->>'publicationId' AND p.generation=r.generation AND p.generation=(ref->>'generation')::integer AND gcms_m3.text_allowed(t,r.id,p.draft_version,r.kind)) END
$$;

CREATE FUNCTION gcms_m4.current_eligible(t text,k text,r text,l text,visited text[] DEFAULT '{}',depth integer DEFAULT 0) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE d gcms_m4.variant%ROWTYPE;p gcms_m4.publication%ROWTYPE;ref jsonb;key text:=k||':'||r||':'||l;ok boolean;BEGIN
 IF depth>3 OR key=ANY(visited) THEN RETURN false;END IF;SELECT * INTO d FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;
 IF d.resource_id IS NULL OR d.publication_version=0 THEN RETURN true;END IF;IF d.active_publication_id IS NULL THEN RETURN false;END IF;
 SELECT * INTO p FROM gcms_m4.publication WHERE tenant_id=t AND id=d.active_publication_id AND kind=k AND resource_id=r AND locale=l AND generation=d.generation;IF p.id IS NULL OR gcms_m4.text_allowed(t,k,r,l,p.draft_version) IS NOT TRUE THEN RETURN false;END IF;visited:=array_append(visited,key);
 FOR ref IN SELECT value FROM jsonb_array_elements(p.reference_pins) WHERE value->'required'='true'::jsonb LOOP
  IF ref->'legacy'='true'::jsonb THEN ok:=gcms_m4.legacy_reference_base(t,ref);
  ELSE SELECT EXISTS(SELECT 1 FROM gcms_m4.variant v JOIN gcms_m4.publication child ON child.tenant_id=v.tenant_id AND child.kind=v.kind AND child.resource_id=v.resource_id AND child.locale=v.locale WHERE v.tenant_id=t AND v.kind=ref->>'kind' AND v.resource_id=ref->>'id' AND v.locale=ref->>'locale' AND v.active_publication_id IS NOT NULL AND child.id=ref->>'publicationId' AND child.generation=v.generation AND v.generation=(ref->>'generation')::integer AND gcms_m4.text_allowed(t,child.kind,child.resource_id,child.locale,child.draft_version)) INTO ok;END IF;
  IF ok IS NOT TRUE OR gcms_m4.current_eligible(t,ref->>'kind',ref->>'id',ref->>'locale',visited,depth+1) IS NOT TRUE THEN RETURN false;END IF;
 END LOOP;RETURN true;
END $$;
CREATE FUNCTION gcms_m4.legacy_eligible(t text,k text,r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT gcms_m4.current_eligible(t,k,r,'vi') $$;
CREATE FUNCTION gcms_m4.legacy_asset_eligible(t text,k text,r text,a text,rev integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT gcms_m4.legacy_eligible(t,k,r) AND NOT EXISTS(SELECT 1 FROM gcms_m4.permission p WHERE p.tenant_id=t AND p.kind=k AND p.resource_id=r AND p.scope->>'type'='asset' AND p.scope->>'assetId'=a AND p.scope->>'assetRevision'=rev::text AND p.withdrawn_at IS NOT NULL) $$;

CREATE OR REPLACE FUNCTION gcms_s02.read_public_service(tenant_slug text,service_slug text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT gcms_s08.eligible_closure(s.tenant_id,snap.closure)||jsonb_build_object('publicationId',snap.id,'publicationVersion',snap.publication_version,
 'publishedAt',snap.published_at,'canonicalUrl',s.canonical_origin||'/'||s.slug||'/dich-vu/'||d.slug)
 FROM gcms_s02.site_draft s JOIN gcms_s02.tenant t ON t.id=s.tenant_id JOIN gcms_s02.service_draft d ON d.tenant_id=s.tenant_id
 JOIN gcms_s02.publication_pointer p ON p.tenant_id=d.tenant_id AND p.service_id=d.id
 JOIN gcms_s02.publication_snapshot snap ON snap.tenant_id=p.tenant_id AND snap.service_id=p.service_id AND snap.id=p.snapshot_id
 WHERE gcms_s02.valid_slug(tenant_slug) AND gcms_s02.valid_slug(service_slug) AND s.slug=tenant_slug AND d.slug=service_slug
 AND gcms_m4.legacy_eligible(d.tenant_id,'service',d.id) AND t.status='active' AND s.public_enabled AND s.slug_locked AND d.slug_locked
$$;

CREATE OR REPLACE FUNCTION gcms_s07.public_reference_exists(p_tenant text,p_asset text,p_revision integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM gcms_s02.publication_pointer p
 JOIN gcms_s02.publication_snapshot s ON s.tenant_id=p.tenant_id AND s.service_id=p.service_id AND s.id=p.snapshot_id
 JOIN gcms_s02.service_draft d ON d.tenant_id=p.tenant_id AND d.id=p.service_id
 JOIN gcms_s02.site_draft site ON site.tenant_id=p.tenant_id JOIN gcms_s02.tenant t ON t.id=p.tenant_id
 WHERE p.tenant_id=p_tenant AND t.status='active' AND site.public_enabled AND site.slug_locked AND d.slug_locked
 AND gcms_m4.legacy_eligible(d.tenant_id,'service',d.id) AND gcms_m4.legacy_asset_eligible(p.tenant_id,'service',p.service_id,p_asset,p_revision) AND s.closure->'service'->'coverImage'->>'assetId'=p_asset AND s.closure->'service'->'coverImage'->>'revision'=p_revision::text)
$$;
CREATE OR REPLACE FUNCTION gcms_s08.read_public_service_cover(p_tenant_slug text,p_service_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT gcms_s07.public_derivative(p.tenant_id,s.closure->'service'->'coverImage'->>'assetId',
   (s.closure->'service'->'coverImage'->>'revision')::integer)||jsonb_build_object('alt',s.closure->'service'->'coverImage'->>'alt')
 FROM gcms_s02.publication_pointer p
 JOIN gcms_s02.publication_snapshot s ON s.tenant_id=p.tenant_id AND s.service_id=p.service_id AND s.id=p.snapshot_id
 JOIN gcms_s02.service_draft d ON d.tenant_id=p.tenant_id AND d.id=p.service_id
 JOIN gcms_s02.site_draft site ON site.tenant_id=p.tenant_id
 JOIN gcms_s02.tenant t ON t.id=p.tenant_id
 WHERE site.slug=p_tenant_slug AND d.slug=p_service_slug AND t.status='active' AND site.public_enabled AND site.slug_locked AND d.slug_locked
 AND gcms_m4.legacy_eligible(d.tenant_id,'service',d.id) AND gcms_m4.legacy_asset_eligible(p.tenant_id,'service',p.service_id,s.closure->'service'->'coverImage'->>'assetId',(s.closure->'service'->'coverImage'->>'revision')::integer) AND s.closure->'service'->'coverImage' IS NOT NULL
$$;
CREATE OR REPLACE FUNCTION gcms_m3.public_projection(t text,r text,pub text,depth integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_m3.resource%ROWTYPE;p gcms_m3.publication%ROWTYPE;site gcms_s02.site_draft%ROWTYPE;doc jsonb;refs jsonb:='[]';pins jsonb:='[]';ref jsonb;child jsonb;media jsonb:='[]';image jsonb;pair jsonb;pairs jsonb:='[]';before_media jsonb;after_media jsonb;idx integer:=0;BEGIN
 IF depth>3 THEN RETURN NULL;END IF;
 SELECT * INTO d FROM gcms_m3.resource WHERE tenant_id=t AND id=r;
 SELECT * INTO p FROM gcms_m3.publication WHERE tenant_id=t AND resource_id=r AND id=pub;
 SELECT * INTO site FROM gcms_s02.site_draft WHERE tenant_id=t;
 IF NOT gcms_m4.legacy_eligible(t,d.kind,r) OR d.id IS NULL OR p.id IS NULL OR d.active_publication_id IS NULL OR p.generation<>d.generation OR NOT site.public_enabled OR NOT site.slug_locked OR NOT d.slug_locked OR NOT EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=t AND status='active') OR NOT gcms_m3.text_allowed(t,r,p.draft_version,d.kind) THEN RETURN NULL;END IF;
 doc:=p.content;
 FOR ref IN SELECT value FROM jsonb_array_elements(p.reference_pins) LOOP
  IF NOT gcms_m3.reference_eligible(t,ref) THEN CONTINUE;END IF;child:=NULL;
  IF ref->>'kind'='service' THEN
   SELECT jsonb_build_object('kind','service','id',s.service_id,'publicationId',s.id,'title',s.closure->'service'->>'title','slug',s.closure->'service'->>'slug','publicationVersion',s.publication_version,'path','/'||site.slug||'/dich-vu/'||(s.closure->'service'->>'slug'),'content',jsonb_build_object('kind','service','title',s.closure->'service'->>'title','slug',s.closure->'service'->>'slug','summary',s.closure->'service'->>'summary'),'references','[]'::jsonb,'media','[]'::jsonb) INTO child FROM gcms_s02.publication_snapshot s WHERE s.tenant_id=t AND s.service_id=ref->>'id' AND s.id=ref->>'publicationId';
  ELSIF depth<3 THEN
   child:=gcms_m3.public_projection(t,ref->>'id',ref->>'publicationId',depth+1);
   IF child IS NOT NULL THEN child:=jsonb_build_object('kind',child->'kind','id',child->'id','publicationId',child->'publicationId','publicationVersion',child->'publicationVersion','title',child->'content'->'title','slug',child->'content'->'slug','path','/'||site.slug||'/'||gcms_m3.path(child->>'kind')||'/'||(child->'content'->>'slug'),'content',child->'content','references',child->'references','media',child->'media');END IF;
  END IF;
  IF child IS NOT NULL THEN refs:=refs||jsonb_build_array(child);pins:=pins||jsonb_build_array(ref-'generation');END IF;
 END LOOP;
 IF d.kind='price' THEN
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(refs) x WHERE x->>'kind'='service') OR (EXISTS(SELECT 1 FROM jsonb_array_elements(p.reference_pins) x WHERE x->>'kind'='location') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(refs) x WHERE x->>'kind'='location')) THEN RETURN NULL;END IF;
 END IF;
 doc:=jsonb_set(doc,'{references}',pins);
 IF doc ? 'image' AND doc->'image'<>'null'::jsonb THEN
  image:=doc->'image';before_media:=gcms_m3.public_media(t,r,p.id,image,p.draft_version);
  IF before_media IS NULL THEN doc:=jsonb_set(doc,'{image}','null');ELSE media:=jsonb_build_array(jsonb_build_object('slot','image','media',before_media));END IF;
 END IF;
 IF d.kind='gallery' THEN
  FOR pair IN SELECT value FROM jsonb_array_elements(doc->'pairs') LOOP
   before_media:=gcms_m3.public_media(t,r,p.id,pair->'before',p.draft_version);after_media:=gcms_m3.public_media(t,r,p.id,pair->'after',p.draft_version);
   IF before_media IS NOT NULL AND after_media IS NOT NULL THEN
    pairs:=pairs||jsonb_build_array(pair);media:=media||jsonb_build_array(jsonb_build_object('slot','before','pairIndex',idx,'caption',pair->'before'->>'caption','media',before_media),jsonb_build_object('slot','after','pairIndex',idx,'caption',pair->'after'->>'caption','media',after_media));idx:=idx+1;
   END IF;
  END LOOP;doc:=jsonb_set(doc,'{pairs}',pairs);
 END IF;
 RETURN jsonb_build_object('schemaVersion',3,'locale','vi','id',r,'kind',d.kind,'publicationId',p.id,'publicationVersion',p.publication_version,'publishedAt',p.published_at,'canonicalUrl',site.canonical_origin||'/'||site.slug||'/'||gcms_m3.path(d.kind)||'/'||d.slug,'site',p.site,'content',doc,'references',refs,'media',media);
END $$;
CREATE OR REPLACE FUNCTION gcms_m3.reference_eligible(t text,ref jsonb) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT gcms_m4.legacy_eligible(t,ref->>'kind',ref->>'id') AND CASE WHEN ref->>'kind'='service' THEN EXISTS(SELECT 1 FROM gcms_s02.publication_pointer ptr JOIN gcms_m3.service_publication_generation g ON g.tenant_id=ptr.tenant_id AND g.service_id=ptr.service_id LEFT JOIN gcms_m3.service_generation current_generation ON current_generation.tenant_id=ptr.tenant_id AND current_generation.service_id=ptr.service_id WHERE ptr.tenant_id=t AND ptr.service_id=ref->>'id' AND g.publication_id=ref->>'publicationId' AND g.generation=coalesce(current_generation.generation,0) AND g.generation=(ref->>'generation')::integer)
 ELSE EXISTS(SELECT 1 FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id WHERE r.tenant_id=t AND r.id=ref->>'id' AND r.kind=ref->>'kind' AND r.active_publication_id IS NOT NULL AND p.id=ref->>'publicationId' AND p.generation=r.generation AND p.generation=(ref->>'generation')::integer AND gcms_m3.text_allowed(t,r.id,p.draft_version,r.kind)) END
$$;
CREATE OR REPLACE FUNCTION gcms_m3.pin_refs(t text,self text,refs jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE ref jsonb;generation_value integer;out jsonb:='[]';BEGIN
 IF gcms_m3.references_shape(refs) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid reference shape' USING ERRCODE='23514';END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(refs) LOOP IF NOT gcms_m4.legacy_eligible(t,ref->>'kind',ref->>'id') THEN RAISE EXCEPTION 'Legacy reference adopted; select current M4 publication' USING ERRCODE='23514';END IF;
  IF ref->>'id'=self THEN RAISE EXCEPTION 'Self reference' USING ERRCODE='23514';END IF;generation_value:=NULL;
  IF ref->>'kind'='service' THEN
   SELECT g.generation INTO generation_value FROM gcms_s02.publication_pointer ptr JOIN gcms_s02.publication_snapshot p ON p.tenant_id=ptr.tenant_id AND p.service_id=ptr.service_id JOIN gcms_m3.service_publication_generation g ON g.tenant_id=p.tenant_id AND g.service_id=p.service_id AND g.publication_id=p.id LEFT JOIN gcms_m3.service_generation current_generation ON current_generation.tenant_id=p.tenant_id AND current_generation.service_id=p.service_id WHERE ptr.tenant_id=t AND ptr.service_id=ref->>'id' AND p.id=ref->>'publicationId' AND g.generation=coalesce(current_generation.generation,0);
  ELSE SELECT p.generation INTO generation_value FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id WHERE r.tenant_id=t AND r.id=ref->>'id' AND r.kind=ref->>'kind' AND r.active_publication_id IS NOT NULL AND p.id=ref->>'publicationId' AND p.generation=r.generation AND gcms_m3.text_allowed(t,r.id,p.draft_version,r.kind);
  END IF;
  IF generation_value IS NULL THEN RAISE EXCEPTION 'Reference unavailable or revoked' USING ERRCODE='23514';END IF;out:=out||jsonb_build_array(ref||jsonb_build_object('generation',generation_value));
 END LOOP;RETURN out;
END $$;
CREATE OR REPLACE FUNCTION gcms_m3.resource_eligible(t text,r text,pub text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM gcms_m3.resource d JOIN gcms_m3.publication p ON p.tenant_id=d.tenant_id AND p.resource_id=d.id JOIN gcms_s02.site_draft s ON s.tenant_id=d.tenant_id JOIN gcms_s02.tenant tenant ON tenant.id=d.tenant_id
 WHERE gcms_m4.legacy_eligible(t,d.kind,r) AND d.tenant_id=t AND d.id=r AND p.id=pub AND d.active_publication_id IS NOT NULL AND p.generation=d.generation AND s.public_enabled AND s.slug_locked AND d.slug_locked AND tenant.status='active' AND gcms_m3.text_allowed(t,r,p.draft_version,d.kind) AND
 (d.kind<>'price' OR (EXISTS(SELECT 1 FROM jsonb_array_elements(p.reference_pins) x WHERE x->>'kind'='service' AND gcms_m3.reference_eligible(t,x)) AND
 (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.reference_pins) x WHERE x->>'kind'='location') OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.reference_pins) x WHERE x->>'kind'='location' AND gcms_m3.reference_eligible(t,x))))))
$$;
CREATE OR REPLACE FUNCTION gcms_m3.public_service_links(tenant_slug text,service_slug text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE t text;r text;pub text;pins jsonb;BEGIN
 SELECT d.tenant_id,d.id,ptr.snapshot_id INTO t,r,pub FROM gcms_s02.site_draft site JOIN gcms_s02.tenant tenant ON tenant.id=site.tenant_id JOIN gcms_s02.service_draft d ON d.tenant_id=site.tenant_id JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=d.tenant_id AND ptr.service_id=d.id WHERE gcms_m4.legacy_eligible(d.tenant_id,'service',d.id) AND site.slug=tenant_slug AND d.slug=service_slug AND site.public_enabled AND site.slug_locked AND d.slug_locked AND tenant.status='active';IF t IS NULL THEN RETURN NULL;END IF;
 SELECT l.reference_pins INTO pins FROM gcms_m3.service_publication_links l WHERE l.tenant_id=t AND l.service_id=r AND l.publication_id=pub;
 RETURN gcms_m3.service_links_projection(t,r,pub,pins);
END $$;
CREATE OR REPLACE FUNCTION gcms_m3.public_list(tenant_slug text,k text,q text,after_id text,lim integer,filter_kind text,filter_id text,filter_pub text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s gcms_s02.site_draft%ROWTYPE;row record;page jsonb;card jsonb;published_site jsonb;header jsonb;items jsonb:='[]';budget_limited boolean:=false;BEGIN
 IF lim NOT BETWEEN 1 AND 51 OR length(q)>160 OR NOT(gcms_m3.kind(k) OR k='service') THEN RETURN NULL;END IF;
 SELECT site.* INTO s FROM gcms_s02.site_draft site JOIN gcms_s02.tenant t ON t.id=site.tenant_id WHERE site.slug=tenant_slug AND site.public_enabled AND site.slug_locked AND t.status='active';IF s.tenant_id IS NULL THEN RETURN NULL;END IF;
 SELECT x.site INTO published_site FROM (SELECT p.site,p.published_at FROM gcms_m3.publication p JOIN gcms_m3.resource r ON r.tenant_id=p.tenant_id AND r.id=p.resource_id AND r.active_publication_id=p.id WHERE gcms_m4.legacy_eligible(r.tenant_id,r.kind,r.id) AND p.tenant_id=s.tenant_id AND gcms_m3.text_allowed(p.tenant_id,p.resource_id,p.draft_version,r.kind) UNION ALL SELECT p.closure->'site',p.published_at FROM gcms_s02.publication_snapshot p JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=p.tenant_id AND ptr.service_id=p.service_id AND ptr.snapshot_id=p.id WHERE gcms_m4.legacy_eligible(p.tenant_id,'service',p.service_id) AND p.tenant_id=s.tenant_id) x ORDER BY x.published_at DESC LIMIT 1;
 IF published_site IS NULL THEN RETURN NULL;END IF;
 header:=jsonb_build_object('schemaVersion',3,'locale','vi','kind',k,'canonicalUrl',s.canonical_origin||'/'||s.slug||'/'||gcms_m3.path(k),'site',published_site);
 -- 600 is the existing decodePageCursor wire bound. PostgreSQL JSONB text adds
 -- whitespace, so this reservation also conservatively bounds the actual JSON DTO.
 IF octet_length((header||jsonb_build_object('items',items,'nextCursor',repeat('x',600)))::text)>1048576 THEN RAISE EXCEPTION 'Public list metadata exceeds payload limit' USING ERRCODE='23514';END IF;
 IF k='service' THEN
  FOR row IN SELECT d.id,p.id AS publication_id,p.publication_version,p.closure FROM gcms_s02.service_draft d JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=d.tenant_id AND ptr.service_id=d.id JOIN gcms_s02.publication_snapshot p ON p.tenant_id=ptr.tenant_id AND p.service_id=ptr.service_id AND p.id=ptr.snapshot_id WHERE gcms_m4.legacy_eligible(d.tenant_id,'service',d.id) AND d.tenant_id=s.tenant_id AND (after_id IS NULL OR d.id>after_id) AND (q='' OR position(q IN lower(p.closure->'service'->>'title'))>0 OR position(q IN lower(d.slug))>0) ORDER BY d.id LOOP
   IF filter_id IS NOT NULL AND NOT gcms_m3.service_has_reference(s.tenant_id,row.id,row.publication_id,filter_kind,filter_id,filter_pub) THEN CONTINUE;END IF;
   card:=jsonb_build_object('id',row.id,'kind','service','title',row.closure->'service'->'title','slug',row.closure->'service'->'slug','summary',row.closure->'service'->'summary','path','/'||s.slug||'/dich-vu/'||(row.closure->'service'->>'slug'),'publicationId',row.publication_id,'publicationVersion',row.publication_version);
   IF octet_length((header||jsonb_build_object('items',items||jsonb_build_array(card),'nextCursor',repeat('x',600)))::text)>1048576 THEN
    IF jsonb_array_length(items)=0 THEN RAISE EXCEPTION 'Public list card exceeds payload limit' USING ERRCODE='23514';END IF;budget_limited:=true;EXIT;
   END IF;
   items:=items||jsonb_build_array(card);IF jsonb_array_length(items)>=lim THEN EXIT;END IF;
  END LOOP;
 ELSE
  FOR row IN SELECT r.id,r.active_publication_id FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id WHERE gcms_m4.legacy_eligible(r.tenant_id,r.kind,r.id) AND r.tenant_id=s.tenant_id AND r.kind=k AND r.active_publication_id IS NOT NULL AND (filter_id IS NULL OR (p.reference_pins @> jsonb_build_array(jsonb_build_object('kind',filter_kind,'id',filter_id)||CASE WHEN filter_pub IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('publicationId',filter_pub) END) AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.reference_pins) selected WHERE selected->>'kind'=filter_kind AND selected->>'id'=filter_id AND (filter_pub IS NULL OR selected->>'publicationId'=filter_pub) AND gcms_m3.reference_eligible(s.tenant_id,selected)))) AND (after_id IS NULL OR r.id>after_id) AND (q='' OR position(q IN lower(p.content->>'title'))>0 OR position(q IN lower(r.slug))>0) ORDER BY r.id LOOP
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

CREATE OR REPLACE FUNCTION gcms_m3.asset_allowed(t text,r text,v integer,a text,rev integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT gcms_m4.legacy_asset_eligible(t,(SELECT kind FROM gcms_m3.resource WHERE tenant_id=t AND id=r),r,a,rev) AND gcms_s07.content_asset_ready(t,a,rev) AND NOT EXISTS(SELECT 1 FROM gcms_m3.permission p WHERE p.tenant_id=t AND p.resource_id=r AND p.scope_key='asset:'||a||':'||rev AND p.withdrawn_at IS NOT NULL) AND (EXISTS(SELECT 1 FROM gcms_s07.asset x JOIN gcms_m3.resource resource ON resource.tenant_id=x.tenant_id AND resource.id=r WHERE x.tenant_id=t AND x.id=a AND x.material_kind='ordinary' AND resource.kind IN ('doctor','article')) OR EXISTS(SELECT 1 FROM gcms_m3.permission p WHERE p.tenant_id=t AND p.resource_id=r AND p.revision=v AND p.scope_key='asset:'||a||':'||rev AND p.withdrawn_at IS NULL))
$$;

CREATE FUNCTION gcms_m4.walk_budget(t text,refs jsonb,nodes integer,bytes bigint,depth integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE ref jsonb;doc jsonb;nested jsonb;result jsonb;assets integer;BEGIN
 IF nodes>250 OR bytes>1048576 OR depth>3 THEN RAISE EXCEPTION 'M4 public graph limit' USING ERRCODE='23514';END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(refs) LOOP
  IF gcms_m4.reference_eligible(t,ref) IS NOT TRUE THEN CONTINUE;END IF;nodes:=nodes+1;IF nodes>250 THEN RAISE EXCEPTION 'M4 public graph limit' USING ERRCODE='23514';END IF;
  IF ref->'legacy'='true'::jsonb THEN
   IF ref->>'kind'='service' THEN SELECT p.closure->'service' INTO doc FROM gcms_s02.publication_snapshot p WHERE p.tenant_id=t AND p.service_id=ref->>'id' AND p.id=ref->>'publicationId';nested:='[]';assets:=0;
   ELSE SELECT p.content,coalesce((SELECT jsonb_agg(x||'{"locale":"vi","legacy":true,"required":false}'::jsonb) FROM jsonb_array_elements(p.reference_pins) x),'[]') INTO doc,nested FROM gcms_m3.publication p WHERE p.tenant_id=t AND p.resource_id=ref->>'id' AND p.id=ref->>'publicationId';SELECT count(*)::integer INTO assets FROM gcms_m3.asset_refs(doc);END IF;
  ELSE SELECT p.content,p.reference_pins INTO doc,nested FROM gcms_m4.publication p WHERE p.tenant_id=t AND p.kind=ref->>'kind' AND p.resource_id=ref->>'id' AND p.locale=ref->>'locale' AND p.id=ref->>'publicationId';SELECT count(*)::integer INTO assets FROM gcms_m4.assets(ref->>'kind',doc);END IF;
  bytes:=bytes+coalesce(octet_length(doc::text),0)+4096+coalesce(assets,0)*8192;IF bytes>1048576 THEN RAISE EXCEPTION 'M4 public graph limit' USING ERRCODE='23514';END IF;
  IF jsonb_array_length(coalesce(nested,'[]'))>0 THEN result:=gcms_m4.walk_budget(t,nested,nodes,bytes,depth+1);nodes:=(result->>'nodes')::integer;bytes:=(result->>'bytes')::bigint;END IF;
 END LOOP;RETURN jsonb_build_object('nodes',nodes,'bytes',bytes);
END $$;
CREATE FUNCTION gcms_m4.admit_refs(t text,k text,l text,doc jsonb,pins jsonb) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE refs jsonb:=pins;raw jsonb;pin jsonb;bytes bigint;assets integer;config jsonb;BEGIN
 SELECT content INTO config FROM gcms_m4.publication WHERE tenant_id=t AND id=(SELECT active_publication_id FROM gcms_m4.variant WHERE tenant_id=t AND kind='config' AND resource_id=t AND locale=l);
 SELECT count(*)::integer INTO assets FROM gcms_m4.assets(k,doc);bytes:=coalesce(octet_length(doc::text),0)*CASE WHEN k IN ('home','page','landing') THEN 2 ELSE 1 END+16384+coalesce(assets,0)*8192+coalesce(octet_length(config::text),0);
 -- Expanded section references and promotion blocks repeat selected closures. Count those uses before expansion.
 IF k IN ('home','page','landing') THEN FOR raw IN SELECT * FROM gcms_m4.refs(k,doc) LOOP SELECT value INTO pin FROM jsonb_array_elements(pins) WHERE value->>'kind'=raw->>'kind' AND value->>'id'=raw->>'id' AND value->>'publicationId'=raw->>'publicationId' LIMIT 1;IF pin IS NOT NULL THEN refs:=refs||jsonb_build_array(pin);END IF;END LOOP;END IF;
 PERFORM gcms_m4.walk_budget(t,refs,0,bytes,0);
END $$;
CREATE FUNCTION gcms_m4.admit_public(t text,k text,r text,l text,pub text DEFAULT NULL) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE d gcms_m4.variant%ROWTYPE;doc jsonb;pins jsonb;BEGIN
 SELECT * INTO d FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;
 IF d.publication_version>0 THEN SELECT content,reference_pins INTO doc,pins FROM gcms_m4.publication WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l AND id=coalesce(pub,d.active_publication_id);
 ELSIF l='vi' AND k='service' THEN SELECT p.closure->'service',coalesce((SELECT jsonb_agg(x||'{"locale":"vi","legacy":true,"required":false}'::jsonb) FROM gcms_m3.service_publication_links links CROSS JOIN LATERAL jsonb_array_elements(links.reference_pins) x WHERE links.tenant_id=p.tenant_id AND links.service_id=p.service_id AND links.publication_id=p.id),'[]') INTO doc,pins FROM gcms_s02.publication_snapshot p JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=p.tenant_id AND ptr.service_id=p.service_id AND ptr.snapshot_id=p.id WHERE p.tenant_id=t AND p.service_id=r;
 ELSIF l='vi' AND gcms_m3.kind(k) THEN SELECT p.content,coalesce((SELECT jsonb_agg(x||'{"locale":"vi","legacy":true,"required":false}'::jsonb) FROM jsonb_array_elements(p.reference_pins) x),'[]') INTO doc,pins FROM gcms_m3.publication p JOIN gcms_m3.resource d ON d.tenant_id=p.tenant_id AND d.id=p.resource_id AND d.active_publication_id=p.id WHERE p.tenant_id=t AND p.resource_id=r AND d.kind=k;END IF;
 IF doc IS NOT NULL THEN PERFORM gcms_m4.admit_refs(t,k,l,doc,coalesce(pins,'[]'));END IF;
END $$;
CREATE OR REPLACE FUNCTION gcms_m4.project(t text,k text,r text,l text,pub text DEFAULT NULL,depth integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN PERFORM gcms_m4.admit_public(t,k,r,l,pub);RETURN gcms_m4.project_core(t,k,r,l,pub,depth,true);END $$;
CREATE OR REPLACE FUNCTION gcms_m4.command(t text,k text,r text,l text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE out jsonb;d gcms_m4.variant%ROWTYPE;ref jsonb;item jsonb;s jsonb;doc jsonb;BEGIN
 PERFORM gcms_s05.authorize(t,true);
 IF c->>'type' IN ('create','save') THEN
  doc:=c->'content';IF gcms_m4.valid_content(k,doc) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid content' USING ERRCODE='23514';END IF;FOR ref IN SELECT * FROM gcms_m4.refs(k,doc) LOOP IF gcms_m4.identity_slug(t,ref->>'kind',ref->>'id') IS NULL THEN RAISE EXCEPTION 'Reference outside tenant or unknown' USING ERRCODE='23514';END IF;END LOOP;
  IF k='config' THEN FOR item IN SELECT value FROM jsonb_array_elements(doc->'menu') LOOP IF gcms_m4.identity_slug(t,item->'target'->>'kind',item->'target'->>'id') IS NULL THEN RAISE EXCEPTION 'Menu target outside tenant' USING ERRCODE='23514';END IF;END LOOP;
  ELSIF k IN ('home','page','landing') THEN FOR item IN SELECT value FROM jsonb_array_elements(doc->'sections') LOOP IF item->>'type'='hero' AND item->'action'<>'null'::jsonb AND gcms_m4.identity_slug(t,item->'action'->'target'->>'kind',item->'action'->'target'->>'id') IS NULL THEN RAISE EXCEPTION 'CTA target outside tenant' USING ERRCODE='23514';END IF;END LOOP;END IF;
 END IF;
 IF c->>'type'='publish' THEN
  IF NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}';END IF;
  IF NOT EXISTS(SELECT 1 FROM gcms_m4.receipt WHERE tenant_id=t AND operation_id=c->>'operationId') THEN SELECT content INTO doc FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;IF doc IS NOT NULL THEN PERFORM gcms_m4.admit_refs(t,k,l,doc,gcms_m4.pin_refs(t,k,r,l,doc));END IF;END IF;
  -- Source guards in the underlying command bind old version, head, generation and revision.
  IF k='service' THEN UPDATE gcms_s02.service_draft SET slug_locked=true WHERE tenant_id=t AND id=r AND NOT slug_locked;ELSIF gcms_m3.kind(k) THEN UPDATE gcms_m3.resource SET slug_locked=true WHERE tenant_id=t AND id=r AND NOT slug_locked;END IF;
 END IF;
 out:=gcms_m4.command_before_scope_integrity(t,k,r,l,c);
 IF c->>'type' IN ('create','save') AND out->'replayed'='false'::jsonb THEN SELECT * INTO d FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;PERFORM gcms_m4.pin_refs(t,k,r,l,d.content);END IF;
 RETURN out;
END $$;
CREATE OR REPLACE FUNCTION gcms_m4.target_path(t text,target jsonb,allow_fallback boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE slug text;lang text:=target->>'locale';s text;page jsonb;BEGIN
 IF NOT gcms_m4.target(target) THEN RETURN NULL;END IF;SELECT sd.slug INTO s FROM gcms_s02.site_draft sd WHERE tenant_id=t;slug:=gcms_m4.identity_slug(t,target->>'kind',target->>'id');IF slug IS NULL THEN RETURN NULL;END IF;
 BEGIN PERFORM gcms_m4.admit_public(t,target->>'kind',target->>'id',lang);EXCEPTION WHEN check_violation THEN RETURN NULL;END;page:=gcms_m4.project_core(t,target->>'kind',target->>'id',lang,NULL,0,false);IF page IS NULL AND lang='en' AND allow_fallback THEN lang:='vi';page:=gcms_m4.project_core(t,target->>'kind',target->>'id','vi',NULL,0,false);END IF;IF page IS NULL THEN RETURN NULL;END IF;RETURN jsonb_build_object('path',gcms_m4.path(s,lang,target->>'kind',slug),'actualLocale',lang,'fallback',lang IS DISTINCT FROM target->>'locale');
END $$;

CREATE OR REPLACE FUNCTION gcms_m4.media_target(t text,k text,r text,l text,pub text,a text,v integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE page jsonb;config jsonb;BEGIN
 IF k='config' THEN IF r IS DISTINCT FROM t THEN RETURN NULL;END IF;config:=gcms_m4.config(t,l);IF config->>'publicationId' IS DISTINCT FROM pub OR config->'logoMedia'->>'assetId' IS DISTINCT FROM a OR config->'logoMedia'->>'revision' IS DISTINCT FROM v::text THEN RETURN NULL;END IF;
 ELSE page:=gcms_m4.project(t,k,r,l,pub);IF page IS NULL OR NOT (EXISTS(SELECT 1 FROM jsonb_array_elements(page->'media') x WHERE x->'media'->>'assetId'=a AND x->'media'->>'revision'=v::text) OR EXISTS(SELECT 1 FROM jsonb_array_elements(page->'sections') x WHERE x->'media'->>'assetId'=a AND x->'media'->>'revision'=v::text)) THEN RETURN NULL;END IF;END IF;
 RETURN (SELECT jsonb_build_object('key',object_key,'bytes',bytes) FROM gcms_s07.derivative WHERE tenant_id=t AND asset_id=a AND revision=v AND ready AND deleted_at IS NULL ORDER BY fence DESC LIMIT 1);
END $$;

CREATE OR REPLACE FUNCTION gcms_m4.project_core(t text,k text,r text,l text,pub text,depth integer,resolve_actions boolean) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_m4.variant%ROWTYPE;p gcms_m4.publication%ROWTYPE;s gcms_s02.site_draft%ROWTYPE;doc jsonb;ref jsonb;child jsonb;refs jsonb:='[]';a jsonb;block jsonb;media_list jsonb:='[]';sections jsonb:='[]';section jsonb;section_refs jsonb;promotion jsonb;form jsonb;action jsonb;resolved_target jsonb;pairs jsonb:='[]';pair jsonb;before_media jsonb;after_media jsonb;idx integer:=0;BEGIN
 IF depth<0 OR depth>3 OR NOT gcms_m4.locale(l) OR k='config' THEN RETURN NULL;END IF;
 SELECT site.* INTO s FROM gcms_s02.site_draft site JOIN gcms_s02.tenant ten ON ten.id=site.tenant_id WHERE site.tenant_id=t AND site.public_enabled AND site.slug_locked AND ten.status='active';IF s.tenant_id IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO d FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;
 IF d.resource_id IS NULL OR d.publication_version=0 THEN IF l='vi' THEN RETURN gcms_m4.legacy_page(t,k,r);ELSE RETURN NULL;END IF;END IF;
 IF d.active_publication_id IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO p FROM gcms_m4.publication WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l AND id=coalesce(pub,d.active_publication_id) AND generation=d.generation;IF p.id IS NULL OR NOT gcms_m4.text_allowed(t,k,r,l,p.draft_version) THEN RETURN NULL;END IF;doc:=p.content;
 FOR ref IN SELECT value FROM jsonb_array_elements(p.reference_pins) LOOP child:=NULL;
  IF gcms_m4.reference_eligible(t,ref) THEN
   IF ref->'legacy'='true'::jsonb THEN
    IF ref->>'kind'='service' THEN SELECT jsonb_build_object('id',snap.service_id,'kind','service','legacy',true,'locale','vi','publicationId',snap.id,'publicationVersion',snap.publication_version,'title',snap.closure->'service'->'title','slug',snap.closure->'service'->'slug','path',gcms_m4.path(s.slug,'vi','service',snap.closure->'service'->>'slug'),'content',(gcms_s08.eligible_closure(t,snap.closure)->'service')-ARRAY['coverImage','contentLinks'],'references','[]'::jsonb,'media','[]'::jsonb) INTO child FROM gcms_s02.publication_snapshot snap WHERE snap.tenant_id=t AND snap.service_id=ref->>'id' AND snap.id=ref->>'publicationId';
    ELSE child:=gcms_m3.public_projection(t,ref->>'id',ref->>'publicationId',depth+1);IF child IS NOT NULL THEN child:=jsonb_build_object('id',child->'id','kind',child->'kind','legacy',true,'locale','vi','publicationId',child->'publicationId','publicationVersion',child->'publicationVersion','title',child->'content'->'title','slug',child->'content'->'slug','path',gcms_m4.path(s.slug,'vi',child->>'kind',child->'content'->>'slug'),'content',child->'content','references',gcms_m4.legacy_refs(t,child->'references'),'media',child->'media');END IF;END IF;
   ELSE child:=gcms_m4.project_core(t,ref->>'kind',ref->>'id',l,ref->>'publicationId',depth+1,resolve_actions);IF child IS NOT NULL THEN child:=jsonb_build_object('id',child->'id','kind',child->'kind','legacy',false,'locale',l,'publicationId',child->'publicationId','publicationVersion',child->'publicationVersion','title',child->'content'->'title','slug',child->'content'->'slug','path',gcms_m4.path(s.slug,l,child->>'kind',child->'content'->>'slug'),'content',child->'content','references',child->'references','media',child->'media');END IF;END IF;
  END IF;
  IF child IS NULL AND ref->'required'='true'::jsonb THEN RETURN NULL;END IF;IF child IS NOT NULL THEN refs:=refs||jsonb_build_array(child);END IF;
 END LOOP;
 IF k NOT IN ('home','page','landing','gallery') THEN FOR a IN SELECT * FROM gcms_m4.assets(k,doc) LOOP block:=gcms_m4.media(t,k,r,l,p.id,p.draft_version,a);IF block IS NOT NULL THEN media_list:=media_list||jsonb_build_array(jsonb_build_object('slot','image','media',block));END IF;END LOOP;END IF;
 IF k='service' AND doc ? 'contentLinks' THEN doc:=jsonb_set(doc,'{contentLinks,references}',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',x->'kind','id',x->'id','publicationId',x->'publicationId')) FROM jsonb_array_elements(refs) x),'[]'));END IF;IF k='service' AND doc ? 'coverImage' THEN IF NOT gcms_m4.asset_allowed(t,k,r,l,p.draft_version,(doc->'coverImage')||'{"usage":"page"}') THEN doc:=jsonb_set(doc,'{coverImage}','null');END IF;END IF;
 IF gcms_m3.kind(k) THEN
  IF doc ? 'image' AND doc->'image'<>'null'::jsonb AND NOT gcms_m4.asset_allowed(t,k,r,l,p.draft_version,(doc->'image')||'{"usage":"page"}') THEN doc:=jsonb_set(doc,'{image}','null');END IF;
  IF k='gallery' THEN FOR pair IN SELECT value FROM jsonb_array_elements(doc->'pairs') LOOP IF gcms_m4.asset_allowed(t,k,r,l,p.draft_version,(pair->'before')||'{"usage":"page"}') AND gcms_m4.asset_allowed(t,k,r,l,p.draft_version,(pair->'after')||'{"usage":"page"}') THEN before_media:=gcms_m4.media(t,k,r,l,p.id,p.draft_version,(pair->'before')||'{"usage":"page"}');after_media:=gcms_m4.media(t,k,r,l,p.id,p.draft_version,(pair->'after')||'{"usage":"page"}');IF before_media IS NOT NULL AND after_media IS NOT NULL THEN pairs:=pairs||jsonb_build_array(pair);media_list:=media_list||jsonb_build_array(jsonb_build_object('slot','before','pairIndex',idx,'caption',pair->'before'->>'caption','media',before_media),jsonb_build_object('slot','after','pairIndex',idx,'caption',pair->'after'->>'caption','media',after_media));idx:=idx+1;END IF;END IF;END LOOP;doc:=jsonb_set(doc,'{pairs}',pairs);END IF;
  doc:=jsonb_set(doc,'{references}',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',x->'kind','id',x->'id','publicationId',x->'publicationId')) FROM jsonb_array_elements(refs) x),'[]'));
 END IF;
 IF k IN ('home','page','landing') THEN FOR section IN SELECT value FROM jsonb_array_elements(doc->'sections') LOOP
  IF section->'hidden'='true'::jsonb THEN CONTINUE;END IF;section_refs:='[]';promotion:=NULL;form:=NULL;action:=NULL;block:=NULL;
  IF section ? 'references' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO section_refs FROM jsonb_array_elements(refs) x WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(section->'references') y WHERE y->>'id'=x->>'id' AND y->>'publicationId'=x->>'publicationId');END IF;
  IF section->>'type'='hero' THEN
   IF section->'image'<>'null'::jsonb THEN block:=gcms_m4.media(t,k,r,l,p.id,p.draft_version,(section->'image')||'{"usage":"hero"}');IF block IS NULL THEN section:=jsonb_set(section,'{image}','null');END IF;END IF;
   IF resolve_actions AND depth<3 AND section->'action'<>'null'::jsonb THEN resolved_target:=gcms_m4.target_path(t,section->'action'->'target',(section->'action'->>'allowViFallback')::boolean);IF resolved_target IS NOT NULL THEN action:=resolved_target||jsonb_build_object('label',section->'action'->>'label');END IF;END IF;
  END IF;
  IF section->>'type'='promotion' THEN promotion:=gcms_m4.project_core(t,'promotion',section->'reference'->>'id',l,section->'reference'->>'publicationId',depth+1,resolve_actions);END IF;
  IF section->>'type'='consultation' THEN
   IF section->'promotion'<>'null'::jsonb THEN promotion:=gcms_m4.project_core(t,'promotion',section->'promotion'->>'id',l,section->'promotion'->>'publicationId',depth+1,resolve_actions);END IF;
   IF section->'promotion'='null'::jsonb OR promotion->>'promotionState'='active' THEN form:=jsonb_build_object('sourceType','landing','sourceId',r,'sourcePublicationId',p.id,'sourceConfigPublicationId',NULL,'formLocale',l,'consent',gcms_m4.consent(l),'promotionId',promotion->'id','promotionPublicationId',promotion->'publicationId','serviceOptions',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(refs) x WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(section->'serviceOptions') y WHERE y->>'id'=x->>'id' AND y->>'publicationId'=x->>'publicationId')),'[]'),'locationOptions',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(refs) x WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(section->'locationOptions') y WHERE y->>'id'=x->>'id' AND y->>'publicationId'=x->>'publicationId')),'[]'));END IF;
  END IF;
  IF form IS NOT NULL AND promotion IS NOT NULL THEN form:=jsonb_set(form,'{serviceOptions}',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(form->'serviceOptions') x WHERE EXISTS(SELECT 1 FROM gcms_m4.flatten_refs(promotion->'references') y WHERE y->>'kind'='service' AND y->>'id'=x->>'id' AND y->>'publicationId'=x->>'publicationId')),'[]'));form:=jsonb_set(form,'{locationOptions}',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(form->'locationOptions') x WHERE EXISTS(SELECT 1 FROM gcms_m4.flatten_refs(promotion->'references') y WHERE y->>'kind'='location' AND y->>'id'=x->>'id' AND y->>'publicationId'=x->>'publicationId')),'[]'));END IF;IF promotion IS NOT NULL THEN promotion:=promotion-ARRAY['schemaVersion','requestedLocale','actualLocale','configPublicationId','config','site','sections','form','alternates','legacy'];END IF;sections:=sections||jsonb_build_array(jsonb_build_object('section',section,'action',action,'references',section_refs,'media',block,'promotion',promotion,'form',form));
 END LOOP;doc:=jsonb_set(doc,'{sections}',coalesce((SELECT jsonb_agg(x->'section') FROM jsonb_array_elements(sections) x),'[]'));END IF;
 IF k='service' THEN form:=jsonb_build_object('sourceType','service','sourceId',r,'sourcePublicationId',p.id,'sourceConfigPublicationId',NULL,'formLocale',l,'consent',gcms_m4.consent(l),'promotionId',NULL,'promotionPublicationId',NULL,'serviceOptions','[]'::jsonb,'locationOptions',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(refs) x WHERE x->>'kind'='location'),'[]'));ELSIF k='landing' THEN SELECT x->'form' INTO form FROM jsonb_array_elements(sections) x WHERE x->'form'<>'null'::jsonb LIMIT 1;ELSE form:=NULL;END IF;
 RETURN jsonb_build_object('schemaVersion',4,'id',r,'kind',k,'locale',l,'requestedLocale',l,'actualLocale',l,'publicationId',p.id,'publicationVersion',p.publication_version,'publishedAt',p.published_at,'canonicalUrl',s.canonical_origin||gcms_m4.path(s.slug,l,k,doc->>'slug'),'configPublicationId',NULL,'config',NULL,'site',p.site,'content',doc,'references',refs,'media',media_list,'sections',sections,'form',form,'promotionState',CASE WHEN k<>'promotion' THEN NULL WHEN statement_timestamp()<(doc->>'startAt')::timestamptz THEN 'upcoming' WHEN statement_timestamp()>=(doc->>'endAt')::timestamptz THEN 'expired' ELSE 'active' END,'alternates','[]'::jsonb,'legacy',false);
END $$;



CREATE OR REPLACE FUNCTION gcms_m4.legacy_refs(t text,refs jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE r jsonb;doc jsonb;out jsonb:='[]';BEGIN
 FOR r IN SELECT value FROM jsonb_array_elements(coalesce(refs,'[]')) LOOP
  IF r->>'kind'='service' THEN SELECT gcms_s08.eligible_closure(t,p.closure)->'service' INTO doc FROM gcms_s02.publication_snapshot p WHERE p.tenant_id=t AND p.service_id=r->>'id' AND p.id=r->>'publicationId';IF doc IS NULL THEN CONTINUE;END IF;r:=r||jsonb_build_object('content',doc-ARRAY['coverImage','contentLinks'],'media','[]'::jsonb);END IF;
  out:=out||jsonb_build_array(r||jsonb_build_object('locale','vi','legacy',true,'references',gcms_m4.legacy_refs(t,r->'references')));
 END LOOP;RETURN out;
END $$;
CREATE FUNCTION gcms_m4.matches_filter(t text,k text,r text,l text,fk text,fi text,fp text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE d gcms_m4.variant%ROWTYPE;pins jsonb;ref jsonb;BEGIN
 IF fi IS NULL THEN RETURN true;END IF;SELECT * INTO d FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;
 IF d.publication_version>0 THEN SELECT reference_pins INTO pins FROM gcms_m4.publication WHERE tenant_id=t AND id=d.active_publication_id;
 ELSIF l='vi' AND k='service' THEN SELECT coalesce((SELECT jsonb_agg(x||'{"locale":"vi","legacy":true,"required":false}'::jsonb) FROM jsonb_array_elements(links.reference_pins) x),'[]') INTO pins FROM gcms_m3.service_publication_links links JOIN gcms_s02.publication_pointer p ON p.tenant_id=links.tenant_id AND p.service_id=links.service_id AND p.snapshot_id=links.publication_id WHERE links.tenant_id=t AND links.service_id=r;
 ELSIF l='vi' AND gcms_m3.kind(k) THEN SELECT coalesce((SELECT jsonb_agg(x||'{"locale":"vi","legacy":true,"required":false}'::jsonb) FROM jsonb_array_elements(p.reference_pins) x),'[]') INTO pins FROM gcms_m3.publication p JOIN gcms_m3.resource d ON d.tenant_id=p.tenant_id AND d.id=p.resource_id AND d.active_publication_id=p.id WHERE p.tenant_id=t AND p.resource_id=r AND d.kind=k;END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(coalesce(pins,'[]')) WHERE value->>'kind'=fk AND value->>'id'=fi AND (fp IS NULL OR value->>'publicationId'=fp) LOOP IF gcms_m4.reference_eligible(t,ref) THEN RETURN true;END IF;END LOOP;RETURN false;
END $$;
CREATE FUNCTION gcms_m4.public_list(tenant_slug text,l text,k text,q text,after_id text,lim integer,fk text,fi text,fp text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE t text;row record;page jsonb;items jsonb:='[]';candidate jsonb;header jsonb;budget_limited boolean:=false;BEGIN
 IF lim IS NULL OR lim NOT BETWEEN 1 AND 51 OR q IS NULL OR length(q)>160 OR NOT gcms_m4.locale(l) OR NOT gcms_m4.kind(k) OR k='config' OR ((fk IS NULL) IS DISTINCT FROM (fi IS NULL)) OR (fi IS NOT NULL AND (NOT gcms_m4.kind(fk) OR NOT gcms_m3.uuid(fi))) OR (fp IS NOT NULL AND (fi IS NULL OR NOT gcms_m3.uuid(fp))) THEN RETURN NULL;END IF;
 SELECT s.tenant_id INTO t FROM gcms_s02.site_draft s JOIN gcms_s02.tenant ten ON ten.id=s.tenant_id WHERE s.slug=tenant_slug AND s.public_enabled AND s.slug_locked AND ten.status='active';IF t IS NULL THEN RETURN NULL;END IF;
 header:=jsonb_build_object('schemaVersion',4,'locale',l,'kind',k,'config',gcms_m4.config(t,l),'canonicalUrl','http://localhost:5892/'||tenant_slug||CASE WHEN l='en' THEN '/en' ELSE '' END||CASE WHEN k IN ('home','page') THEN '' WHEN k='landing' THEN '/landing' WHEN k='promotion' THEN '/khuyen-mai' ELSE '/'||gcms_m3.path(k) END);
 IF octet_length((header||jsonb_build_object('items',items,'nextCursor',repeat('x',600)))::text)>1048576 THEN RAISE EXCEPTION 'Public list metadata budget' USING ERRCODE='23514';END IF;
 FOR row IN SELECT * FROM gcms_m4.public_candidates(t,k) c WHERE (after_id IS NULL OR c.id>after_id) AND gcms_m4.matches_filter(t,k,c.id,l,fk,fi,fp) ORDER BY c.id LOOP
  page:=gcms_m4.decorate(t,l,gcms_m4.project(t,k,row.id,l));IF page IS NULL OR (q<>'' AND position(q IN lower(page->'content'->>'title'))=0 AND position(q IN row.slug)=0) THEN CONTINUE;END IF;
  IF fi IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'references') x WHERE x->>'kind'=fk AND x->>'id'=fi AND (fp IS NULL OR x->>'publicationId'=fp)) THEN CONTINUE;END IF;
  candidate:=jsonb_build_object('id',row.id,'kind',k,'locale',l,'publicationId',page->'publicationId','publicationVersion',page->'publicationVersion','title',page->'content'->'title','slug',row.slug,'content',page->'content','media',page->'media','references',page->'references','legacy',page->'legacy','path',gcms_m4.path(tenant_slug,l,k,row.slug),'promotionState',page->'promotionState');
  IF octet_length((header||jsonb_build_object('items',items||jsonb_build_array(candidate),'nextCursor',repeat('x',600)))::text)>1048576 THEN IF jsonb_array_length(items)=0 THEN RAISE EXCEPTION 'Public list card budget' USING ERRCODE='23514';END IF;budget_limited:=true;EXIT;END IF;
  items:=items||jsonb_build_array(candidate);IF jsonb_array_length(items)>=lim THEN EXIT;END IF;
 END LOOP;RETURN header||jsonb_build_object('items',items,'hasMore',budget_limited,'budgetLimited',budget_limited);
END $$;
CREATE OR REPLACE FUNCTION gcms_m4.public_list(tenant_slug text,l text,k text,q text,after_id text,lim integer) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT gcms_m4.public_list(tenant_slug,l,k,q,after_id,lim,NULL,NULL,NULL) $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_m4 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_m4.public_list(text,text,text,text,text,integer,text,text,text),gcms_m4.legacy_eligible(text,text,text) TO gcms_s02_tenant;
