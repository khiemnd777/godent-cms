-- Forward-only signature template. Existing publication bytes and themes stay valid.
CREATE FUNCTION gcms_m4.signature_nodes(nodes jsonb,depth integer DEFAULT 1) RETURNS SETOF jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$DECLARE n jsonb;child jsonb;extra text[];BEGIN
 IF depth>3 OR jsonb_typeof(nodes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid navigation depth' USING ERRCODE='23514';END IF;
 FOR n IN SELECT value FROM jsonb_array_elements(nodes) LOOP
  extra:=CASE n->>'type' WHEN 'resource' THEN ARRAY['target','allowViFallback'] WHEN 'listing' THEN ARRAY['kind','locale'] WHEN 'group' THEN '{}'::text[] ELSE NULL END;
  IF extra IS NULL OR jsonb_typeof(n) IS DISTINCT FROM 'object' OR NOT(n ?& (ARRAY['id','label','type','children']||extra)) OR (n-(ARRAY['id','label','type','children']||extra))<>'{}' OR jsonb_typeof(n->'id') IS DISTINCT FROM 'string' OR n->>'id' !~ '^[-a-zA-Z0-9_]{1,64}$' OR NOT gcms_m4.text(n->'label',80,true) OR jsonb_typeof(n->'children') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid navigation' USING ERRCODE='23514';END IF;
  IF n->>'type'='resource' AND (gcms_m4.target(n->'target') IS NOT TRUE OR jsonb_typeof(n->'allowViFallback') IS DISTINCT FROM 'boolean') THEN RAISE EXCEPTION 'Invalid navigation target' USING ERRCODE='23514';END IF;
  IF n->>'type'='listing' AND (jsonb_typeof(n->'kind') IS DISTINCT FROM 'string' OR n->>'kind' NOT IN ('service','specialty','service_group','location','doctor','price','case','gallery','testimonial','article','category','faq','promotion') OR gcms_m4.locale(n->>'locale') IS NOT TRUE) THEN RAISE EXCEPTION 'Invalid listing target' USING ERRCODE='23514';END IF;
  IF n->>'type'='group' AND jsonb_array_length(n->'children')=0 THEN RAISE EXCEPTION 'Empty navigation group' USING ERRCODE='23514';END IF;
  RETURN NEXT n;IF jsonb_array_length(n->'children')>0 THEN FOR child IN SELECT * FROM gcms_m4.signature_nodes(n->'children',depth+1) LOOP RETURN NEXT child;END LOOP;END IF;
 END LOOP;
END $$;
DO $copy$ DECLARE definition text;BEGIN SELECT pg_get_functiondef('gcms_m4.valid_content(text,jsonb)'::regprocedure) INTO definition;definition:=replace(definition,'FUNCTION gcms_m4.valid_content(','FUNCTION gcms_m4.valid_content_before_signature(');EXECUTE definition;END $copy$;
CREATE OR REPLACE FUNCTION gcms_m4.valid_content(k text,c jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$DECLARE normalized jsonb:=c;signature jsonb;n integer;unique_n integer;s jsonb;slide jsonb;sections jsonb:='[]';slides_seen text[];hero jsonb;BEGIN
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR octet_length(c::text)>524288 THEN RETURN false;END IF;
 IF k='config' THEN
  IF c->>'theme'='signature' THEN
   signature:=c->'signature';IF jsonb_typeof(signature) IS DISTINCT FROM 'object' OR NOT(signature ?& ARRAY['navigation','headerLocation','footerLocations']) OR (signature-ARRAY['navigation','headerLocation','footerLocations'])<>'{}' THEN RETURN false;END IF;
   SELECT count(*),count(DISTINCT node->>'id') INTO n,unique_n FROM gcms_m4.signature_nodes(signature->'navigation') node;IF n>60 OR n<>unique_n THEN RETURN false;END IF;
   IF signature->'headerLocation'<>'null'::jsonb AND (NOT gcms_m3.references_shape(jsonb_build_array(signature->'headerLocation')) OR signature->'headerLocation'->>'kind'<>'location') THEN RETURN false;END IF;
   IF NOT gcms_m3.references_shape(signature->'footerLocations') OR jsonb_array_length(signature->'footerLocations')>10 THEN RETURN false;END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(signature->'footerLocations') ref WHERE ref->>'kind'<>'location') OR (SELECT count(*)<>count(DISTINCT ref->>'id') FROM jsonb_array_elements(signature->'footerLocations') ref) THEN RETURN false;END IF;
   normalized:=jsonb_set(c-'signature','{theme}','"clarity"');
  ELSIF c ? 'signature' THEN RETURN false;END IF;
 ELSIF k IN ('home','page','landing') THEN
  IF jsonb_typeof(c->'sections') IS DISTINCT FROM 'array' THEN RETURN false;END IF;
  FOR s IN SELECT value FROM jsonb_array_elements(c->'sections') LOOP
   IF s->>'type'='hero_carousel' THEN
    IF NOT(s ?& ARRAY['id','type','hidden','slides','autoplay','intervalMs']) OR (s-ARRAY['id','type','hidden','slides','autoplay','intervalMs'])<>'{}' OR jsonb_typeof(s->'slides') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'slides') NOT BETWEEN 1 AND 5 OR jsonb_typeof(s->'autoplay') IS DISTINCT FROM 'boolean' OR s->'intervalMs' NOT IN ('5000'::jsonb,'7000'::jsonb,'10000'::jsonb) THEN RETURN false;END IF;
    slides_seen:='{}';FOR slide IN SELECT value FROM jsonb_array_elements(s->'slides') LOOP
     IF jsonb_typeof(slide) IS DISTINCT FROM 'object' OR NOT(slide ?& ARRAY['id','title','text','image','action']) OR (slide-ARRAY['id','title','text','image','action'])<>'{}' OR jsonb_typeof(slide->'id') IS DISTINCT FROM 'string' OR slide->>'id' !~ '^[-a-zA-Z0-9_]{1,64}$' OR slide->>'id'=ANY(slides_seen) THEN RETURN false;END IF;slides_seen:=array_append(slides_seen,slide->>'id');
     hero:=(slide-'id')||jsonb_build_object('id',s->'id','type','hero','hidden',s->'hidden');IF gcms_m4.valid_content_before_signature('landing',jsonb_build_object('kind','landing','slug','validation','title','Validation','summary','','seo',jsonb_build_object('title','','description',''),'sections',jsonb_build_array(hero))) IS NOT TRUE THEN RETURN false;END IF;
    END LOOP;
    s:=jsonb_build_object('id',s->'id','type','hero','hidden',s->'hidden','title','Carousel','text','','image',NULL,'action',NULL);
   END IF;sections:=sections||jsonb_build_array(s);
  END LOOP;
  normalized:=jsonb_set(c,'{sections}',sections);
  -- Validate original identity, then reuse the exact existing section validator for new form sources.
  IF k='home' AND c->>'slug'<>'home' THEN RETURN false;END IF;IF k='page' AND gcms_m4.page_slug(c->>'slug') IS NOT TRUE THEN RETURN false;END IF;
  IF c->>'kind' IS DISTINCT FROM k THEN RETURN false;END IF;normalized:=jsonb_set(normalized,'{kind}','"landing"');RETURN gcms_m4.valid_content_before_signature('landing',normalized) IS TRUE;
 END IF;
 RETURN gcms_m4.valid_content_before_signature(k,normalized) IS TRUE;
EXCEPTION WHEN OTHERS THEN RETURN false;END $$;
DO $copy$ DECLARE definition text;BEGIN SELECT pg_get_functiondef('gcms_m4.assets(text,jsonb)'::regprocedure) INTO definition;definition:=replace(definition,'FUNCTION gcms_m4.assets(','FUNCTION gcms_m4.assets_before_signature(');EXECUTE definition;END $copy$;
CREATE OR REPLACE FUNCTION gcms_m4.assets(k text,c jsonb) RETURNS SETOF jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$DECLARE s jsonb;slide jsonb;BEGIN
 RETURN QUERY SELECT * FROM gcms_m4.assets_before_signature(k,c);
 IF k IN ('home','page','landing') THEN FOR s IN SELECT value FROM jsonb_array_elements(c->'sections') WHERE value->>'type'='hero_carousel' LOOP FOR slide IN SELECT value FROM jsonb_array_elements(s->'slides') LOOP IF slide->'image'<>'null'::jsonb THEN RETURN NEXT (slide->'image')||'{"usage":"hero"}';END IF;END LOOP;END LOOP;END IF;
END $$;
DO $copy$ DECLARE definition text;BEGIN SELECT pg_get_functiondef('gcms_m4.refs(text,jsonb)'::regprocedure) INTO definition;definition:=replace(definition,'FUNCTION gcms_m4.refs(','FUNCTION gcms_m4.refs_before_signature(');EXECUTE definition;END $copy$;
CREATE OR REPLACE FUNCTION gcms_m4.refs(k text,c jsonb) RETURNS SETOF jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$DECLARE ref jsonb;BEGIN
 RETURN QUERY SELECT * FROM gcms_m4.refs_before_signature(k,c);
 IF k='config' AND c->>'theme'='signature' THEN
  IF c->'signature'->'headerLocation'<>'null'::jsonb THEN RETURN NEXT (c->'signature'->'headerLocation')||'{"required":false}';END IF;
  FOR ref IN SELECT value FROM jsonb_array_elements(c->'signature'->'footerLocations') LOOP RETURN NEXT ref||'{"required":false}';END LOOP;
 END IF;
END $$;
CREATE FUNCTION gcms_m4.signature_navigation(t text,l text,nodes jsonb,depth integer DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE n jsonb;out jsonb:='[]';children jsonb;target jsonb;site_slug text;BEGIN
 IF depth>3 THEN RETURN '[]';END IF;SELECT slug INTO site_slug FROM gcms_s02.site_draft WHERE tenant_id=t;
 FOR n IN SELECT value FROM jsonb_array_elements(nodes) LOOP
  children:=gcms_m4.signature_navigation(t,l,n->'children',depth+1);target:=NULL;
  IF n->>'type'='resource' THEN target:=gcms_m4.target_path(t,n->'target',(n->>'allowViFallback')::boolean);
  ELSIF n->>'type'='listing' THEN
   -- A listing is reachable only when at least one current eligible page exists in its explicit locale.
   IF EXISTS(SELECT 1 FROM gcms_m4.public_candidates(t,n->>'kind') c WHERE gcms_m4.project_core(t,n->>'kind',c.id,n->>'locale',NULL,0,false) IS NOT NULL) THEN target:=jsonb_build_object('path','/'||site_slug||CASE WHEN n->>'locale'='en' THEN '/en' ELSE '' END||'/'||CASE WHEN n->>'kind'='promotion' THEN 'khuyen-mai' ELSE gcms_m3.path(n->>'kind') END,'actualLocale',n->>'locale','fallback',false);END IF;
  END IF;
  IF target IS NULL AND jsonb_array_length(children)=0 THEN CONTINUE;END IF;
  out:=out||jsonb_build_array(jsonb_build_object('id',n->'id','label',n->'label','type',n->'type','path',target->'path','actualLocale',coalesce(target->'actualLocale',to_jsonb(l)),'fallback',coalesce(target->'fallback','false'::jsonb),'children',children));
 END LOOP;RETURN out;
END $$;
CREATE FUNCTION gcms_m4.signature_location(t text,l text,pins jsonb,ref jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE pin jsonb;page jsonb;site_slug text;BEGIN
 IF ref IS NULL OR ref='null'::jsonb THEN RETURN NULL;END IF;
 SELECT value INTO pin FROM jsonb_array_elements(pins) WHERE value->>'kind'='location' AND value->>'id'=ref->>'id' AND value->>'publicationId'=ref->>'publicationId' LIMIT 1;
 IF pin IS NULL OR gcms_m4.reference_eligible(t,pin) IS NOT TRUE THEN RETURN NULL;END IF;
 page:=gcms_m4.project_core(t,'location',ref->>'id',l,ref->>'publicationId',0,false);IF page IS NULL THEN RETURN NULL;END IF;SELECT slug INTO site_slug FROM gcms_s02.site_draft WHERE tenant_id=t;
 RETURN jsonb_build_object('id',page->'id','kind','location','publicationId',page->'publicationId','publicationVersion',page->'publicationVersion','locale',l,'title',page->'content'->'title','slug',page->'content'->'slug','path',gcms_m4.path(site_slug,l,'location',page->'content'->>'slug'),'content',page->'content','references',page->'references','media',page->'media','legacy',page->'legacy');
END $$;
CREATE FUNCTION gcms_m4.resolve_signature(t text,l text,doc jsonb,pins jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE ref jsonb;contact jsonb;contacts jsonb:='[]';BEGIN
 FOR ref IN SELECT value FROM jsonb_array_elements(doc->'signature'->'footerLocations') LOOP contact:=gcms_m4.signature_location(t,l,pins,ref);IF contact IS NOT NULL THEN contacts:=contacts||jsonb_build_array(contact);END IF;END LOOP;
 RETURN jsonb_build_object('navigation',gcms_m4.signature_navigation(t,l,doc->'signature'->'navigation'),'headerLocation',gcms_m4.signature_location(t,l,pins,doc->'signature'->'headerLocation'),'footerLocations',contacts);
END $$;
DO $copy$ DECLARE definition text;BEGIN SELECT pg_get_functiondef('gcms_m4.config(text,text)'::regprocedure) INTO definition;definition:=replace(definition,'FUNCTION gcms_m4.config(','FUNCTION gcms_m4.config_before_signature(');EXECUTE definition;END $copy$;
CREATE OR REPLACE FUNCTION gcms_m4.config(t text,l text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE out jsonb;doc jsonb;pins jsonb;BEGIN
 out:=gcms_m4.config_before_signature(t,l);IF out IS NULL OR out->'content'->>'theme'<>'signature' THEN RETURN out;END IF;
 SELECT content,reference_pins INTO doc,pins FROM gcms_m4.publication WHERE tenant_id=t AND kind='config' AND resource_id=t AND locale=l AND id=out->>'publicationId';
 out:=out||jsonb_build_object('signature',gcms_m4.resolve_signature(t,l,doc,pins));
 -- The public typed projection is authoritative. Do not leak unresolved raw reference identifiers.
 out:=jsonb_set(out,'{content,signature}','{"navigation":[],"headerLocation":null,"footerLocations":[]}');
 IF octet_length(out::text)>1048576 OR gcms_m3.graph_nodes(coalesce(out->'signature'->'footerLocations','[]')||CASE WHEN out->'signature'->'headerLocation'='null'::jsonb THEN '[]'::jsonb ELSE jsonb_build_array(out->'signature'->'headerLocation') END)>250 THEN RETURN NULL;END IF;RETURN out;
END $$;


-- Resolve each slide with the same resource/locale/revision permission as ordinary hero media.
CREATE OR REPLACE FUNCTION gcms_m4.project_core(t text,k text,r text,l text,pub text,depth integer,resolve_actions boolean) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_m4.variant%ROWTYPE;p gcms_m4.publication%ROWTYPE;s gcms_s02.site_draft%ROWTYPE;doc jsonb;ref jsonb;child jsonb;refs jsonb:='[]';a jsonb;block jsonb;media_list jsonb:='[]';sections jsonb:='[]';section jsonb;section_refs jsonb;promotion jsonb;form jsonb;action jsonb;resolved_target jsonb;pairs jsonb:='[]';pair jsonb;before_media jsonb;after_media jsonb;idx integer:=0;slide jsonb;slides jsonb;slide_media jsonb;slide_action jsonb;safe_slides jsonb;BEGIN
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
  IF section->>'type'='hero_carousel' THEN
   slides:='[]';safe_slides:='[]';FOR slide IN SELECT value FROM jsonb_array_elements(section->'slides') LOOP
    slide_media:=NULL;slide_action:=NULL;
    IF slide->'image'<>'null'::jsonb THEN slide_media:=gcms_m4.media(t,k,r,l,p.id,p.draft_version,(slide->'image')||'{"usage":"hero"}');END IF;
    IF resolve_actions AND depth<3 AND slide->'action'<>'null'::jsonb THEN resolved_target:=gcms_m4.target_path(t,slide->'action'->'target',(slide->'action'->>'allowViFallback')::boolean);IF resolved_target IS NOT NULL THEN slide_action:=resolved_target||jsonb_build_object('label',slide->'action'->>'label');END IF;END IF;
    slides:=slides||jsonb_build_array(jsonb_build_object('id',slide->'id','title',slide->'title','text',slide->'text','media',slide_media,'action',slide_action));
    safe_slides:=safe_slides||jsonb_build_array(slide||jsonb_build_object('image',NULL,'action',NULL));
   END LOOP;section:=jsonb_set(section,'{slides}',safe_slides);
  ELSE slides:=NULL;END IF;
  IF section->>'type'='promotion' THEN promotion:=gcms_m4.project_core(t,'promotion',section->'reference'->>'id',l,section->'reference'->>'publicationId',depth+1,resolve_actions);END IF;
  IF section->>'type'='consultation' THEN
   IF section->'promotion'<>'null'::jsonb THEN promotion:=gcms_m4.project_core(t,'promotion',section->'promotion'->>'id',l,section->'promotion'->>'publicationId',depth+1,resolve_actions);END IF;
   IF section->'promotion'='null'::jsonb OR promotion->>'promotionState'='active' THEN form:=jsonb_build_object('sourceType',k,'sourceId',r,'sourcePublicationId',p.id,'sourceConfigPublicationId',NULL,'formLocale',l,'consent',gcms_m4.consent(l),'promotionId',promotion->'id','promotionPublicationId',promotion->'publicationId','serviceOptions',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(refs) x WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(section->'serviceOptions') y WHERE y->>'id'=x->>'id' AND y->>'publicationId'=x->>'publicationId')),'[]'),'locationOptions',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(refs) x WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(section->'locationOptions') y WHERE y->>'id'=x->>'id' AND y->>'publicationId'=x->>'publicationId')),'[]'));END IF;
  END IF;
  IF form IS NOT NULL AND promotion IS NOT NULL THEN form:=jsonb_set(form,'{serviceOptions}',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(form->'serviceOptions') x WHERE EXISTS(SELECT 1 FROM gcms_m4.flatten_refs(promotion->'references') y WHERE y->>'kind'='service' AND y->>'id'=x->>'id' AND y->>'publicationId'=x->>'publicationId')),'[]'));form:=jsonb_set(form,'{locationOptions}',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(form->'locationOptions') x WHERE EXISTS(SELECT 1 FROM gcms_m4.flatten_refs(promotion->'references') y WHERE y->>'kind'='location' AND y->>'id'=x->>'id' AND y->>'publicationId'=x->>'publicationId')),'[]'));END IF;IF promotion IS NOT NULL THEN promotion:=promotion-ARRAY['schemaVersion','requestedLocale','actualLocale','configPublicationId','config','site','sections','form','alternates','legacy'];END IF;sections:=sections||jsonb_build_array(jsonb_build_object('section',section,'action',action,'references',section_refs,'media',block,'promotion',promotion,'form',form)||CASE WHEN slides IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('slides',slides) END);
 END LOOP;doc:=jsonb_set(doc,'{sections}',coalesce((SELECT jsonb_agg(x->'section') FROM jsonb_array_elements(sections) x),'[]'));END IF;
 IF k='service' THEN form:=jsonb_build_object('sourceType','service','sourceId',r,'sourcePublicationId',p.id,'sourceConfigPublicationId',NULL,'formLocale',l,'consent',gcms_m4.consent(l),'promotionId',NULL,'promotionPublicationId',NULL,'serviceOptions','[]'::jsonb,'locationOptions',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(refs) x WHERE x->>'kind'='location'),'[]'));ELSIF k IN ('home','page','landing') THEN SELECT x->'form' INTO form FROM jsonb_array_elements(sections) x WHERE x->'form'<>'null'::jsonb LIMIT 1;ELSE form:=NULL;END IF;
 RETURN jsonb_build_object('schemaVersion',4,'id',r,'kind',k,'locale',l,'requestedLocale',l,'actualLocale',l,'publicationId',p.id,'publicationVersion',p.publication_version,'publishedAt',p.published_at,'canonicalUrl',s.canonical_origin||gcms_m4.path(s.slug,l,k,doc->>'slug'),'configPublicationId',NULL,'config',NULL,'site',p.site,'content',doc,'references',refs,'media',media_list,'sections',sections,'form',form,'promotionState',CASE WHEN k<>'promotion' THEN NULL WHEN statement_timestamp()<(doc->>'startAt')::timestamptz THEN 'upcoming' WHEN statement_timestamp()>=(doc->>'endAt')::timestamptz THEN 'expired' ELSE 'active' END,'alternates','[]'::jsonb,'legacy',false);
END $$;

CREATE OR REPLACE FUNCTION gcms_m4.media_target(t text,k text,r text,l text,pub text,a text,v integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE page jsonb;config jsonb;BEGIN
 IF k='config' THEN IF r IS DISTINCT FROM t THEN RETURN NULL;END IF;config:=gcms_m4.config(t,l);IF config->>'publicationId' IS DISTINCT FROM pub OR config->'logoMedia'->>'assetId' IS DISTINCT FROM a OR config->'logoMedia'->>'revision' IS DISTINCT FROM v::text THEN RETURN NULL;END IF;
 ELSE page:=gcms_m4.project(t,k,r,l,pub);IF page IS NULL OR NOT (EXISTS(SELECT 1 FROM jsonb_array_elements(page->'media') x WHERE x->'media'->>'assetId'=a AND x->'media'->>'revision'=v::text) OR EXISTS(SELECT 1 FROM jsonb_array_elements(page->'sections') x WHERE x->'media'->>'assetId'=a AND x->'media'->>'revision'=v::text) OR EXISTS(SELECT 1 FROM jsonb_array_elements(page->'sections') x CROSS JOIN LATERAL jsonb_array_elements(coalesce(x->'slides','[]')) slide WHERE slide->'media'->>'assetId'=a AND slide->'media'->>'revision'=v::text)) THEN RETURN NULL;END IF;END IF;
 RETURN (SELECT jsonb_build_object('key',object_key,'bytes',bytes) FROM gcms_s07.derivative WHERE tenant_id=t AND asset_id=a AND revision=v AND ready AND deleted_at IS NULL ORDER BY fence DESC LIMIT 1);
END $$;

DO $copy$ DECLARE definition text;BEGIN SELECT pg_get_functiondef('gcms_m4.command(text,text,text,text,jsonb)'::regprocedure) INTO definition;definition:=replace(definition,'FUNCTION gcms_m4.command(','FUNCTION gcms_m4.command_before_signature(');EXECUTE definition;END $copy$;
CREATE OR REPLACE FUNCTION gcms_m4.command(t text,k text,r text,l text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE n jsonb;s jsonb;slide jsonb;BEGIN
 PERFORM gcms_m5.require_command(t,'m4',c);
 IF c->>'type' IN ('create','save') THEN
  IF gcms_m4.valid_content(k,c->'content') IS NOT TRUE THEN RAISE EXCEPTION 'Invalid signature content' USING ERRCODE='23514';END IF;
  IF k='config' AND c->'content'->>'theme'='signature' THEN FOR n IN SELECT * FROM gcms_m4.signature_nodes(c->'content'->'signature'->'navigation') LOOP IF n->>'type'='resource' AND gcms_m4.identity_slug(t,n->'target'->>'kind',n->'target'->>'id') IS NULL THEN RAISE EXCEPTION 'Navigation target outside tenant' USING ERRCODE='23514';END IF;END LOOP;END IF;
  IF k IN ('home','page','landing') THEN FOR s IN SELECT value FROM jsonb_array_elements(c->'content'->'sections') WHERE value->>'type'='hero_carousel' LOOP FOR slide IN SELECT value FROM jsonb_array_elements(s->'slides') LOOP IF slide->'action'<>'null'::jsonb AND gcms_m4.identity_slug(t,slide->'action'->'target'->>'kind',slide->'action'->'target'->>'id') IS NULL THEN RAISE EXCEPTION 'Carousel target outside tenant' USING ERRCODE='23514';END IF;END LOOP;END LOOP;END IF;
 END IF;
 RETURN gcms_m4.command_before_signature(t,k,r,l,c);
END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_m4 FROM PUBLIC;

-- A new locale starts blank for each carousel slide, as for an ordinary hero.
DO $copy$ DECLARE definition text;BEGIN SELECT pg_get_functiondef('gcms_m4.blank_content(text,jsonb,text)'::regprocedure) INTO definition;definition:=replace(definition,'FUNCTION gcms_m4.blank_content(','FUNCTION gcms_m4.blank_content_before_signature(');EXECUTE definition;END $copy$;
CREATE OR REPLACE FUNCTION gcms_m4.blank_content(k text,c jsonb,l text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$DECLARE out jsonb;s jsonb;slide jsonb;sections jsonb:='[]';slides jsonb;BEGIN
 out:=gcms_m4.blank_content_before_signature(k,c,l);
 IF k IN ('home','page','landing') THEN FOR s IN SELECT value FROM jsonb_array_elements(out->'sections') LOOP
  IF s->>'type'='hero_carousel' THEN slides:='[]';FOR slide IN SELECT value FROM jsonb_array_elements(s->'slides') LOOP slide:=slide||'{"title":"","text":""}';IF slide->'image'<>'null'::jsonb THEN slide:=jsonb_set(slide,'{image,alt}','""');END IF;IF slide->'action'<>'null'::jsonb THEN slide:=jsonb_set(slide,'{action,label}','""');slide:=jsonb_set(slide,'{action,target,locale}',to_jsonb(l));END IF;slides:=slides||jsonb_build_array(slide);END LOOP;s:=jsonb_set(s,'{slides}',slides);END IF;sections:=sections||jsonb_build_array(s);
 END LOOP;out:=jsonb_set(out,'{sections}',sections);END IF;RETURN out;
END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_m4 FROM PUBLIC;

-- Current authenticated previews retain read access while public exposure is suspended.
CREATE FUNCTION gcms_m4.private_signature_navigation(t text,l text,nodes jsonb,depth integer DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE n jsonb;out jsonb:='[]';children jsonb;target jsonb;site_slug text;BEGIN
 IF depth>3 THEN RETURN '[]';END IF;SELECT slug INTO site_slug FROM gcms_s02.site_draft WHERE tenant_id=t;
 FOR n IN SELECT value FROM jsonb_array_elements(nodes) LOOP
  children:=gcms_m4.private_signature_navigation(t,l,n->'children',depth+1);target:=NULL;
  IF n->>'type'='resource' THEN target:=gcms_m4.private_target_path(t,n->'target',(n->>'allowViFallback')::boolean);
  ELSIF n->>'type'='listing' AND EXISTS(SELECT 1 FROM gcms_m4.public_candidates(t,n->>'kind') c WHERE gcms_m5.private_current_reference(t,n->>'kind',c.id,n->>'locale') IS NOT NULL) THEN target:=jsonb_build_object('path','/'||site_slug||CASE WHEN n->>'locale'='en' THEN '/en' ELSE '' END||'/'||CASE WHEN n->>'kind'='promotion' THEN 'khuyen-mai' ELSE gcms_m3.path(n->>'kind') END,'actualLocale',n->>'locale','fallback',false);END IF;
  IF target IS NULL AND jsonb_array_length(children)=0 THEN CONTINUE;END IF;
  out:=out||jsonb_build_array(jsonb_build_object('id',n->'id','label',n->'label','type',n->'type','path',target->'path','actualLocale',coalesce(target->'actualLocale',to_jsonb(l)),'fallback',coalesce(target->'fallback','false'::jsonb),'children',children));
 END LOOP;RETURN out;
END $$;
CREATE FUNCTION gcms_m4.private_signature(t text,l text,doc jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE pins jsonb;refs jsonb;ref jsonb;header jsonb;footer jsonb:='[]';contact jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);IF doc->>'theme'<>'signature' THEN RETURN NULL;END IF;
 BEGIN pins:=gcms_m4.pin_refs(t,'config',t,l,doc);EXCEPTION WHEN check_violation THEN pins:='[]';END;
 refs:=gcms_m5.private_references(t,pins);
 SELECT value INTO header FROM jsonb_array_elements(refs) WHERE value->>'kind'='location' AND value->>'id'=doc->'signature'->'headerLocation'->>'id' AND value->>'publicationId'=doc->'signature'->'headerLocation'->>'publicationId' LIMIT 1;
 FOR ref IN SELECT value FROM jsonb_array_elements(doc->'signature'->'footerLocations') LOOP SELECT value INTO contact FROM jsonb_array_elements(refs) WHERE value->>'kind'='location' AND value->>'id'=ref->>'id' AND value->>'publicationId'=ref->>'publicationId' LIMIT 1;IF contact IS NOT NULL THEN footer:=footer||jsonb_build_array(contact);END IF;END LOOP;
 RETURN jsonb_build_object('navigation',gcms_m4.private_signature_navigation(t,l,doc->'signature'->'navigation'),'headerLocation',header,'footerLocations',footer);
END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_m4 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_m4.private_signature(text,text,jsonb) TO gcms_s02_tenant;
