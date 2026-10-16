-- Exact reference union, bounded non-recursive navigation projection and promotion applicability.
CREATE OR REPLACE FUNCTION gcms_m4.pin_refs(t text,k text,r text,l text,c jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE ref jsonb;v gcms_m4.variant%ROWTYPE;p gcms_m4.publication%ROWTYPE;pins jsonb:='[]';legacy jsonb;BEGIN
 FOR ref IN SELECT * FROM gcms_m4.refs(k,c) LOOP
  IF ref->>'id'=r THEN RAISE EXCEPTION 'Self reference' USING ERRCODE='23514';END IF;
  SELECT * INTO v FROM gcms_m4.variant WHERE tenant_id=t AND kind=ref->>'kind' AND resource_id=ref->>'id' AND locale=l;
  IF v.publication_version>0 THEN
   SELECT * INTO p FROM gcms_m4.publication WHERE tenant_id=t AND id=ref->>'publicationId' AND resource_id=ref->>'id' AND kind=ref->>'kind' AND locale=l AND generation=v.generation;
   IF p.id IS NULL OR v.active_publication_id IS NULL OR NOT gcms_m4.text_allowed(t,p.kind,p.resource_id,l,p.draft_version) THEN RAISE EXCEPTION 'Locale reference unavailable' USING ERRCODE='23514';END IF;
   pins:=pins||jsonb_build_array(ref||jsonb_build_object('locale',l,'generation',v.generation,'legacy',false));
  ELSE
   IF l<>'vi' OR ref->>'kind'='promotion' THEN RAISE EXCEPTION 'Same-language published reference required' USING ERRCODE='23514';END IF;
   legacy:=gcms_m3.pin_refs(t,r,jsonb_build_array(ref-ARRAY['required']));pins:=pins||jsonb_build_array((legacy->0)||jsonb_build_object('required',(ref->>'required')::boolean,'locale','vi','legacy',true));
  END IF;
 END LOOP;IF jsonb_array_length(pins)>250 THEN RAISE EXCEPTION 'Reference graph limit' USING ERRCODE='23514';END IF;RETURN (SELECT coalesce(jsonb_agg(base||jsonb_build_object('required',needed) ORDER BY position),'[]') FROM (SELECT value-'required' AS base,min(ord) AS position,bool_or(coalesce((value->>'required')::boolean,false)) AS needed FROM jsonb_array_elements(pins) WITH ORDINALITY e(value,ord) GROUP BY value-'required') u);
END $$;

CREATE FUNCTION gcms_m4.flatten_refs(refs jsonb) RETURNS SETOF jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$DECLARE x jsonb;y jsonb;BEGIN FOR x IN SELECT value FROM jsonb_array_elements(coalesce(refs,'[]')) LOOP RETURN NEXT x;FOR y IN SELECT * FROM gcms_m4.flatten_refs(x->'references') LOOP RETURN NEXT y;END LOOP;END LOOP;END $$;

CREATE FUNCTION gcms_m4.project_core(t text,k text,r text,l text,pub text,depth integer,resolve_actions boolean) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
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
    IF ref->>'kind'='service' THEN SELECT jsonb_build_object('id',snap.service_id,'kind','service','locale','vi','publicationId',snap.id,'publicationVersion',snap.publication_version,'title',snap.closure->'service'->'title','slug',snap.closure->'service'->'slug','path',gcms_m4.path(s.slug,'vi','service',snap.closure->'service'->>'slug'),'content',(gcms_s08.eligible_closure(t,snap.closure)->'service')-ARRAY['coverImage','contentLinks'],'references','[]'::jsonb,'media','[]'::jsonb) INTO child FROM gcms_s02.publication_snapshot snap WHERE snap.tenant_id=t AND snap.service_id=ref->>'id' AND snap.id=ref->>'publicationId';
    ELSE child:=gcms_m3.public_projection(t,ref->>'id',ref->>'publicationId',depth+1);IF child IS NOT NULL THEN child:=jsonb_build_object('id',child->'id','kind',child->'kind','locale','vi','publicationId',child->'publicationId','publicationVersion',child->'publicationVersion','title',child->'content'->'title','slug',child->'content'->'slug','path',gcms_m4.path(s.slug,'vi',child->>'kind',child->'content'->>'slug'),'content',child->'content','references',gcms_m4.legacy_refs(t,child->'references'),'media',child->'media');END IF;END IF;
   ELSE child:=gcms_m4.project_core(t,ref->>'kind',ref->>'id',l,ref->>'publicationId',depth+1,resolve_actions);IF child IS NOT NULL THEN child:=jsonb_build_object('id',child->'id','kind',child->'kind','locale',l,'publicationId',child->'publicationId','publicationVersion',child->'publicationVersion','title',child->'content'->'title','slug',child->'content'->'slug','path',gcms_m4.path(s.slug,l,child->>'kind',child->'content'->>'slug'),'content',child->'content','references',child->'references','media',child->'media');END IF;END IF;
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



CREATE OR REPLACE FUNCTION gcms_m4.project(t text,k text,r text,l text,pub text DEFAULT NULL,depth integer DEFAULT 0) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT gcms_m4.project_core(t,k,r,l,pub,depth,true) $$;

CREATE OR REPLACE FUNCTION gcms_m4.target_path(t text,target jsonb,allow_fallback boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE slug text;lang text:=target->>'locale';s text;page jsonb;BEGIN
 IF NOT gcms_m4.target(target) THEN RETURN NULL;END IF;SELECT sd.slug INTO s FROM gcms_s02.site_draft sd WHERE tenant_id=t;slug:=gcms_m4.identity_slug(t,target->>'kind',target->>'id');IF slug IS NULL THEN RETURN NULL;END IF;
 page:=gcms_m4.project_core(t,target->>'kind',target->>'id',lang,NULL,0,false);IF page IS NULL AND lang='en' AND allow_fallback THEN lang:='vi';page:=gcms_m4.project_core(t,target->>'kind',target->>'id','vi',NULL,0,false);END IF;IF page IS NULL THEN RETURN NULL;END IF;RETURN jsonb_build_object('path',gcms_m4.path(s,lang,target->>'kind',slug),'actualLocale',lang,'fallback',lang IS DISTINCT FROM target->>'locale');
END $$;

CREATE OR REPLACE FUNCTION gcms_m4.media_target(t text,k text,r text,l text,pub text,a text,v integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE page jsonb;config jsonb;BEGIN
 IF k='config' THEN IF r IS DISTINCT FROM t THEN RETURN NULL;END IF;config:=gcms_m4.config(t,l);IF config->>'publicationId' IS DISTINCT FROM pub OR config->'logoMedia'->>'assetId' IS DISTINCT FROM a OR config->'logoMedia'->>'revision' IS DISTINCT FROM v::text THEN RETURN NULL;END IF;
 ELSE page:=gcms_m4.project(t,k,r,l,pub);IF page IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'media') x WHERE x->'media'->>'assetId'=a AND x->'media'->>'revision'=v::text) THEN RETURN NULL;END IF;END IF;
 RETURN (SELECT jsonb_build_object('key',object_key,'bytes',bytes) FROM gcms_s07.derivative WHERE tenant_id=t AND asset_id=a AND revision=v AND ready AND deleted_at IS NULL ORDER BY fence DESC LIMIT 1);
END $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_m4 FROM PUBLIC;
