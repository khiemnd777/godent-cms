-- M4 command validation, locale-aware legacy projection and explicit local invalidation worker scope.
CREATE FUNCTION gcms_m4.legacy_refs(t text,refs jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE r jsonb;doc jsonb;out jsonb:='[]';BEGIN
 FOR r IN SELECT value FROM jsonb_array_elements(coalesce(refs,'[]')) LOOP
  IF r->>'kind'='service' THEN SELECT gcms_s08.eligible_closure(t,p.closure)->'service' INTO doc FROM gcms_s02.publication_snapshot p WHERE p.tenant_id=t AND p.service_id=r->>'id' AND p.id=r->>'publicationId';IF doc IS NULL THEN CONTINUE;END IF;r:=r||jsonb_build_object('content',doc-ARRAY['coverImage','contentLinks'],'media','[]'::jsonb);END IF;
  out:=out||jsonb_build_array(r||jsonb_build_object('locale','vi','references',gcms_m4.legacy_refs(t,r->'references')));
 END LOOP;RETURN out;
END $$;
CREATE TABLE gcms_m4.worker_scope(tenant_id text PRIMARY KEY REFERENCES gcms_s02.tenant(id),enabled boolean NOT NULL DEFAULT false);
CREATE TABLE gcms_m4.purge_job(tenant_id text NOT NULL,permission_id text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),fence integer NOT NULL DEFAULT 0,worker_id text,lease_until timestamptz,failure_code text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),completed_at timestamptz,PRIMARY KEY(tenant_id,permission_id),FOREIGN KEY(tenant_id,permission_id) REFERENCES gcms_m4.permission(tenant_id,id));
ALTER TABLE gcms_m4.worker_scope ENABLE ROW LEVEL SECURITY;ALTER TABLE gcms_m4.worker_scope FORCE ROW LEVEL SECURITY;CREATE POLICY owner_all ON gcms_m4.worker_scope TO gcms_s02_owner USING(true) WITH CHECK(true);
ALTER TABLE gcms_m4.purge_job ENABLE ROW LEVEL SECURITY;ALTER TABLE gcms_m4.purge_job FORCE ROW LEVEL SECURITY;CREATE POLICY owner_all ON gcms_m4.purge_job TO gcms_s02_owner USING(true) WITH CHECK(true);CREATE POLICY tenant_read ON gcms_m4.purge_job FOR SELECT TO gcms_s02_tenant USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_current_membership(tenant_id));GRANT SELECT ON gcms_m4.purge_job TO gcms_s02_tenant;
CREATE FUNCTION gcms_m4.queue_withdrawal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN INSERT INTO gcms_m4.purge_job(tenant_id,permission_id) VALUES(NEW.tenant_id,NEW.id) ON CONFLICT DO NOTHING;RETURN NEW;END $$;
CREATE TRIGGER queue_permission_withdrawal AFTER UPDATE OF withdrawn_at ON gcms_m4.permission FOR EACH ROW WHEN(OLD.withdrawn_at IS NULL AND NEW.withdrawn_at IS NOT NULL) EXECUTE FUNCTION gcms_m4.queue_withdrawal();
CREATE FUNCTION gcms_m4.purge_claim(t text,w text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE j gcms_m4.purge_job%ROWTYPE;BEGIN
 IF NOT gcms_m3.uuid(w) OR NOT EXISTS(SELECT 1 FROM gcms_m4.worker_scope WHERE tenant_id=t AND enabled) THEN RAISE EXCEPTION 'Invalid M4 worker scope' USING ERRCODE='42501';END IF;PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));
 UPDATE gcms_m4.purge_job SET status='failed',failure_code='delivery_invalidation_failed',lease_until=NULL WHERE tenant_id=t AND status='processing' AND lease_until<clock_timestamp() AND attempts>=5;SELECT * INTO j FROM gcms_m4.purge_job WHERE tenant_id=t AND (status='pending' OR (status='processing' AND lease_until<clock_timestamp())) AND attempts<5 ORDER BY created_at,permission_id FOR UPDATE SKIP LOCKED LIMIT 1;IF j.permission_id IS NULL THEN RETURN NULL;END IF;
 UPDATE gcms_m4.purge_job SET status='processing',attempts=attempts+1,fence=fence+1,worker_id=w,lease_until=clock_timestamp()+interval '30 seconds' WHERE tenant_id=t AND permission_id=j.permission_id RETURNING * INTO j;RETURN jsonb_build_object('tenantId',t,'permissionId',j.permission_id,'workerId',w,'fence',j.fence);
END $$;
CREATE FUNCTION gcms_m4.purge_finish(t text,p text,w text,f integer,outcome text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM gcms_m4.worker_scope WHERE tenant_id=t AND enabled) THEN RAISE EXCEPTION 'Invalid M4 worker scope' USING ERRCODE='42501';END IF;PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));
 UPDATE gcms_m4.purge_job j SET status=CASE WHEN outcome='success' THEN 'completed' WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,completed_at=CASE WHEN outcome='success' THEN clock_timestamp() END,lease_until=NULL,failure_code=CASE WHEN outcome='success' THEN NULL ELSE 'delivery_invalidation_failed' END WHERE tenant_id=t AND permission_id=p AND worker_id=w AND fence=f AND status='processing' AND lease_until>clock_timestamp() AND outcome IN ('success','retry') AND EXISTS(SELECT 1 FROM gcms_m4.permission WHERE tenant_id=t AND id=p AND withdrawn_at IS NOT NULL);RETURN FOUND;
END $$;
ALTER FUNCTION gcms_m4.command(text,text,text,text,jsonb) RENAME TO command_before_scope_integrity;
REVOKE ALL ON FUNCTION gcms_m4.command_before_scope_integrity(text,text,text,text,jsonb) FROM gcms_s02_tenant;
CREATE FUNCTION gcms_m4.command(t text,k text,r text,l text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE out jsonb;d gcms_m4.variant%ROWTYPE;ref jsonb;item jsonb;s jsonb;doc jsonb;BEGIN
 PERFORM gcms_s05.authorize(t,true);
 IF c->>'type' IN ('create','save') THEN
  doc:=c->'content';IF gcms_m4.valid_content(k,doc) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid content' USING ERRCODE='23514';END IF;FOR ref IN SELECT * FROM gcms_m4.refs(k,doc) LOOP IF gcms_m4.identity_slug(t,ref->>'kind',ref->>'id') IS NULL THEN RAISE EXCEPTION 'Reference outside tenant or unknown' USING ERRCODE='23514';END IF;END LOOP;
  IF k='config' THEN FOR item IN SELECT value FROM jsonb_array_elements(doc->'menu') LOOP IF gcms_m4.identity_slug(t,item->'target'->>'kind',item->'target'->>'id') IS NULL THEN RAISE EXCEPTION 'Menu target outside tenant' USING ERRCODE='23514';END IF;END LOOP;
  ELSIF k IN ('home','page','landing') THEN FOR item IN SELECT value FROM jsonb_array_elements(doc->'sections') LOOP IF item->>'type'='hero' AND item->'action'<>'null'::jsonb AND gcms_m4.identity_slug(t,item->'action'->'target'->>'kind',item->'action'->'target'->>'id') IS NULL THEN RAISE EXCEPTION 'CTA target outside tenant' USING ERRCODE='23514';END IF;END LOOP;END IF;
 END IF;
 IF c->>'type'='publish' THEN
  IF NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}';END IF;
  -- Source guards in the underlying command bind old version, head, generation and revision.
  IF k='service' THEN UPDATE gcms_s02.service_draft SET slug_locked=true WHERE tenant_id=t AND id=r AND NOT slug_locked;ELSIF gcms_m3.kind(k) THEN UPDATE gcms_m3.resource SET slug_locked=true WHERE tenant_id=t AND id=r AND NOT slug_locked;END IF;
 END IF;
 out:=gcms_m4.command_before_scope_integrity(t,k,r,l,c);
 IF c->>'type' IN ('create','save') AND out->'replayed'='false'::jsonb THEN SELECT * INTO d FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;PERFORM gcms_m4.pin_refs(t,k,r,l,d.content);END IF;
 RETURN out;
END $$;
CREATE FUNCTION gcms_m4.private_live(t text,k text,r text,l text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN PERFORM gcms_s05.authorize(t,true);RETURN gcms_m4.project(t,k,r,l) IS NOT NULL;END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_m4 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_m4.command(text,text,text,text,jsonb),gcms_m4.private_live(text,text,text,text) TO gcms_s02_tenant;
GRANT USAGE ON SCHEMA gcms_m4 TO gcms_s07_worker;
GRANT EXECUTE ON FUNCTION gcms_m4.purge_claim(text,text),gcms_m4.purge_finish(text,text,text,integer,text) TO gcms_s07_worker;

CREATE OR REPLACE FUNCTION gcms_m4.legacy_page(t text,k text,r text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE s gcms_s02.site_draft%ROWTYPE;page jsonb;cover jsonb;links jsonb;slug_value text;BEGIN
 SELECT * INTO s FROM gcms_s02.site_draft WHERE tenant_id=t;slug_value:=gcms_m4.identity_slug(t,k,r);IF slug_value IS NULL THEN RETURN NULL;END IF;
 IF k='service' THEN page:=gcms_s02.read_public_service(s.slug,slug_value);IF page IS NULL THEN RETURN NULL;END IF;cover:=gcms_s08.read_public_service_cover(s.slug,slug_value);links:=gcms_m3.public_service_links(s.slug,slug_value);
  page:=page||jsonb_build_object('id',r,'kind',k,'content',page->'service','references',gcms_m4.legacy_refs(t,links->'references'),'media',CASE WHEN cover IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('slot','image','media',cover)) END);
 ELSIF gcms_m3.kind(k) THEN page:=gcms_m3.public_projection(t,r,(SELECT active_publication_id FROM gcms_m3.resource WHERE tenant_id=t AND id=r AND kind=k));IF page IS NULL THEN RETURN NULL;END IF;page:=page||jsonb_build_object('references',gcms_m4.legacy_refs(t,page->'references'));
 ELSE RETURN NULL;END IF;
 RETURN (page-'service')||jsonb_build_object('schemaVersion',4,'locale','vi','requestedLocale','vi','actualLocale','vi','configPublicationId',NULL,'config',NULL,'sections','[]'::jsonb,'form',NULL,'promotionState',NULL,'alternates','[]'::jsonb,'legacy',true);
END $$;

CREATE OR REPLACE FUNCTION gcms_m4.project(t text,k text,r text,l text,pub text DEFAULT NULL,depth integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_m4.variant%ROWTYPE;p gcms_m4.publication%ROWTYPE;s gcms_s02.site_draft%ROWTYPE;doc jsonb;ref jsonb;child jsonb;refs jsonb:='[]';a jsonb;block jsonb;media_list jsonb:='[]';sections jsonb:='[]';section jsonb;section_refs jsonb;promotion jsonb;form jsonb;action jsonb;resolved_target jsonb;pairs jsonb:='[]';pair jsonb;before_media jsonb;after_media jsonb;idx integer:=0;BEGIN
 IF depth>3 OR NOT gcms_m4.locale(l) OR k='config' THEN RETURN NULL;END IF;
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
   ELSE child:=gcms_m4.project(t,ref->>'kind',ref->>'id',l,ref->>'publicationId',depth+1);IF child IS NOT NULL THEN child:=jsonb_build_object('id',child->'id','kind',child->'kind','locale',l,'publicationId',child->'publicationId','publicationVersion',child->'publicationVersion','title',child->'content'->'title','slug',child->'content'->'slug','path',gcms_m4.path(s.slug,l,child->>'kind',child->'content'->>'slug'),'content',child->'content','references',child->'references','media',child->'media');END IF;END IF;
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
   IF depth<3 AND section->'action'<>'null'::jsonb THEN resolved_target:=gcms_m4.target_path(t,section->'action'->'target',(section->'action'->>'allowViFallback')::boolean);IF resolved_target IS NOT NULL THEN action:=resolved_target||jsonb_build_object('label',section->'action'->>'label');END IF;END IF;
  END IF;
  IF section->>'type'='promotion' THEN promotion:=gcms_m4.project(t,'promotion',section->'reference'->>'id',l,section->'reference'->>'publicationId',depth+1);END IF;
  IF section->>'type'='consultation' THEN
   IF section->'promotion'<>'null'::jsonb THEN promotion:=gcms_m4.project(t,'promotion',section->'promotion'->>'id',l,section->'promotion'->>'publicationId',depth+1);END IF;
   IF section->'promotion'='null'::jsonb OR promotion->>'promotionState'='active' THEN form:=jsonb_build_object('sourceType','landing','sourceId',r,'sourcePublicationId',p.id,'sourceConfigPublicationId',NULL,'formLocale',l,'consent',gcms_m4.consent(l),'promotionId',promotion->'id','promotionPublicationId',promotion->'publicationId','serviceOptions',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(refs) x WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(section->'serviceOptions') y WHERE y->>'id'=x->>'id' AND y->>'publicationId'=x->>'publicationId')),'[]'),'locationOptions',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(refs) x WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(section->'locationOptions') y WHERE y->>'id'=x->>'id' AND y->>'publicationId'=x->>'publicationId')),'[]'));END IF;
  END IF;
  IF promotion IS NOT NULL THEN promotion:=promotion-ARRAY['schemaVersion','requestedLocale','actualLocale','configPublicationId','config','site','sections','form','alternates','legacy'];END IF;sections:=sections||jsonb_build_array(jsonb_build_object('section',section,'action',action,'references',section_refs,'media',block,'promotion',promotion,'form',form));
 END LOOP;doc:=jsonb_set(doc,'{sections}',coalesce((SELECT jsonb_agg(x->'section') FROM jsonb_array_elements(sections) x),'[]'));END IF;
 IF k='service' THEN form:=jsonb_build_object('sourceType','service','sourceId',r,'sourcePublicationId',p.id,'sourceConfigPublicationId',NULL,'formLocale',l,'consent',gcms_m4.consent(l),'promotionId',NULL,'promotionPublicationId',NULL,'serviceOptions','[]'::jsonb,'locationOptions',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(refs) x WHERE x->>'kind'='location'),'[]'));ELSIF k='landing' THEN SELECT x->'form' INTO form FROM jsonb_array_elements(sections) x WHERE x->'form'<>'null'::jsonb LIMIT 1;ELSE form:=NULL;END IF;
 RETURN jsonb_build_object('schemaVersion',4,'id',r,'kind',k,'locale',l,'requestedLocale',l,'actualLocale',l,'publicationId',p.id,'publicationVersion',p.publication_version,'publishedAt',p.published_at,'canonicalUrl',s.canonical_origin||gcms_m4.path(s.slug,l,k,doc->>'slug'),'configPublicationId',NULL,'config',NULL,'site',p.site,'content',doc,'references',refs,'media',media_list,'sections',sections,'form',form,'promotionState',CASE WHEN k<>'promotion' THEN NULL WHEN statement_timestamp()<(doc->>'startAt')::timestamptz THEN 'upcoming' WHEN statement_timestamp()>=(doc->>'endAt')::timestamptz THEN 'expired' ELSE 'active' END,'alternates','[]'::jsonb,'legacy',false);
END $$;


REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_m4 FROM PUBLIC;
