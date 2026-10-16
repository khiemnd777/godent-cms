-- S09/S10/S12 additive service relationship seam. Service version/history remain canonical.
CREATE TABLE gcms_m3.service_links_draft(tenant_id text NOT NULL,service_id text NOT NULL,refs jsonb NOT NULL CHECK(gcms_m3.references_shape(refs)),PRIMARY KEY(tenant_id,service_id),FOREIGN KEY(tenant_id,service_id) REFERENCES gcms_s02.service_draft(tenant_id,id));
CREATE TABLE gcms_m3.service_publication_links(tenant_id text NOT NULL,service_id text NOT NULL,publication_id text NOT NULL,reference_pins jsonb NOT NULL,PRIMARY KEY(tenant_id,service_id,publication_id),FOREIGN KEY(tenant_id,service_id,publication_id) REFERENCES gcms_s02.publication_snapshot(tenant_id,service_id,id));
CREATE TABLE gcms_m3.service_link_receipt(tenant_id text NOT NULL,operation_id text NOT NULL,service_id text NOT NULL,actor_id text NOT NULL,command jsonb NOT NULL,PRIMARY KEY(tenant_id,operation_id),FOREIGN KEY(tenant_id,service_id) REFERENCES gcms_s02.service_draft(tenant_id,id));
DO $$ DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['service_links_draft','service_publication_links','service_link_receipt'] LOOP
 EXECUTE format('ALTER TABLE gcms_m3.%I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('ALTER TABLE gcms_m3.%I FORCE ROW LEVEL SECURITY',n);
 EXECUTE format('CREATE POLICY owner_all ON gcms_m3.%I TO gcms_s02_owner USING(true) WITH CHECK(true)',n);
 EXECUTE format('CREATE POLICY tenant_read ON gcms_m3.%I FOR SELECT TO gcms_s02_tenant USING(tenant_id=nullif(current_setting(''gcms.tenant_id'',true),'''') AND gcms_s02.has_current_membership(tenant_id))',n);
 END LOOP;END $$;
GRANT SELECT ON gcms_m3.service_links_draft,gcms_m3.service_publication_links,gcms_m3.service_link_receipt TO gcms_s02_tenant;
CREATE TRIGGER service_link_publication_immutable BEFORE UPDATE OR DELETE ON gcms_m3.service_publication_links FOR EACH ROW EXECUTE FUNCTION gcms_s02.immutable_publication();
CREATE TRIGGER service_link_receipt_immutable BEFORE UPDATE OR DELETE ON gcms_m3.service_link_receipt FOR EACH ROW EXECUTE FUNCTION gcms_s02.immutable_publication();
CREATE FUNCTION gcms_m3.stage_service_links(t text,r text,refs jsonb,restoring boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE ref jsonb;BEGIN
 PERFORM gcms_s05.authorize(t,true);
 IF NOT gcms_m3.references_shape(refs) THEN RAISE EXCEPTION 'Invalid service references' USING ERRCODE='23514';END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(refs) LOOP IF ref->>'kind'<>ALL(ARRAY['specialty','service_group','location','service','faq']) OR ref->>'id'=r THEN RAISE EXCEPTION 'Invalid service reference' USING ERRCODE='23514';END IF;END LOOP;
 IF NOT restoring THEN PERFORM gcms_m3.pin_refs(t,r,refs);END IF;
 INSERT INTO gcms_m3.service_links_draft(tenant_id,service_id,refs) VALUES(t,r,refs) ON CONFLICT(tenant_id,service_id) DO UPDATE SET refs=excluded.refs;
END $$;
CREATE FUNCTION gcms_m3.save_service_links(t text,r text,c jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE d gcms_s02.service_draft%ROWTYPE;old gcms_m3.service_link_receipt%ROWTYPE;BEGIN
 PERFORM gcms_s05.authorize(t,true);
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT(c ?& ARRAY['operationId','expectedDraftVersion','references']) OR (c-ARRAY['operationId','expectedDraftVersion','references'])<>'{}' OR NOT gcms_m3.uuid(c->>'operationId') OR NOT gcms_m3.version(c->'expectedDraftVersion') THEN RAISE EXCEPTION 'Invalid link command' USING ERRCODE='23514';END IF;
 SELECT * INTO old FROM gcms_m3.service_link_receipt WHERE tenant_id=t AND operation_id=c->>'operationId';IF old.operation_id IS NOT NULL THEN IF old.service_id<>r OR old.actor_id<>gcms_s02.current_actor() OR old.command<>c THEN RAISE EXCEPTION 'Operation conflict' USING ERRCODE='23514';END IF;RETURN;END IF;
 SELECT * INTO d FROM gcms_s02.service_draft WHERE tenant_id=t AND id=r FOR UPDATE;IF d.id IS NULL OR d.version<>(c->>'expectedDraftVersion')::integer THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='23514';END IF;
 PERFORM gcms_m3.stage_service_links(t,r,c->'references');
 UPDATE gcms_s02.service_draft SET version=version+1,updated_by=gcms_s02.current_actor(),updated_at=clock_timestamp() WHERE tenant_id=t AND id=r;
 INSERT INTO gcms_m3.service_link_receipt(tenant_id,operation_id,service_id,actor_id,command) VALUES(t,c->>'operationId',r,gcms_s02.current_actor(),c);
 INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id) VALUES(gen_random_uuid()::text,t,gcms_s02.current_actor(),'service.references_saved',r);
END $$;
CREATE OR REPLACE FUNCTION gcms_s08.service_content(d gcms_s02.service_draft) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('slug',d.slug,'title',d.title,'summary',d.summary,'body',coalesce(d.body_document,gcms_s02.plain_document(d.body)),'seo',jsonb_build_object('title',d.seo_title,'description',d.seo_description))||CASE WHEN d.cover_image IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('coverImage',d.cover_image) END||CASE WHEN EXISTS(SELECT 1 FROM gcms_m3.service_links_draft l WHERE l.tenant_id=d.tenant_id AND l.service_id=d.id) THEN jsonb_build_object('contentLinks',jsonb_build_object('references',(SELECT refs FROM gcms_m3.service_links_draft l WHERE l.tenant_id=d.tenant_id AND l.service_id=d.id))) ELSE '{}'::jsonb END
$$;
CREATE FUNCTION gcms_m3.capture_service_publication_links() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE refs jsonb;BEGIN
 SELECT l.refs INTO refs FROM gcms_m3.service_links_draft l WHERE l.tenant_id=NEW.tenant_id AND l.service_id=NEW.service_id;
 IF refs IS NOT NULL THEN INSERT INTO gcms_m3.service_publication_links(tenant_id,service_id,publication_id,reference_pins) VALUES(NEW.tenant_id,NEW.service_id,NEW.id,gcms_m3.pin_refs(NEW.tenant_id,NEW.service_id,refs));END IF;RETURN NEW;
END $$;
CREATE TRIGGER m3_service_snapshot_links AFTER INSERT ON gcms_s02.publication_snapshot FOR EACH ROW EXECUTE FUNCTION gcms_m3.capture_service_publication_links();
-- Public service HTML obtains relationships through the separate eligible contract only.
CREATE OR REPLACE FUNCTION gcms_s08.eligible_closure(p_tenant text,closure jsonb) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT (CASE WHEN closure->'service'->'coverImage' IS NOT NULL AND NOT gcms_s07.publishable(p_tenant,closure->'service'->'coverImage'->>'assetId',(closure->'service'->'coverImage'->>'revision')::integer) THEN closure#-'{service,coverImage}' ELSE closure END)#-'{service,contentLinks}'
$$;
CREATE FUNCTION gcms_m3.resolve_refs(t text,refs jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE ref jsonb;child jsonb;site_slug text;out jsonb:='[]';BEGIN
 SELECT slug INTO site_slug FROM gcms_s02.site_draft WHERE tenant_id=t;
 FOR ref IN SELECT value FROM jsonb_array_elements(refs) LOOP
  IF NOT gcms_m3.reference_eligible(t,ref) THEN CONTINUE;END IF;child:=NULL;
  IF ref->>'kind'='service' THEN SELECT jsonb_build_object('kind','service','id',p.service_id,'publicationId',p.id,'publicationVersion',p.publication_version,'title',p.closure->'service'->'title','slug',p.closure->'service'->'slug','path','/'||site_slug||'/dich-vu/'||(p.closure->'service'->>'slug'),'content',jsonb_build_object('kind','service','title',p.closure->'service'->'title','slug',p.closure->'service'->'slug','summary',p.closure->'service'->'summary'),'references','[]'::jsonb,'media','[]'::jsonb) INTO child FROM gcms_s02.publication_snapshot p WHERE p.tenant_id=t AND p.service_id=ref->>'id' AND p.id=ref->>'publicationId';
  ELSE child:=gcms_m3.public_projection(t,ref->>'id',ref->>'publicationId');IF child IS NOT NULL THEN child:=jsonb_build_object('kind',child->'kind','id',child->'id','publicationId',child->'publicationId','publicationVersion',child->'publicationVersion','title',child->'content'->'title','slug',child->'content'->'slug','path','/'||site_slug||'/'||gcms_m3.path(child->>'kind')||'/'||(child->'content'->>'slug'),'content',child->'content','references',child->'references','media',child->'media');END IF;END IF;
  IF child IS NOT NULL THEN out:=out||jsonb_build_array(child);END IF;
 END LOOP;RETURN out;
END $$;
CREATE FUNCTION gcms_m3.service_links_view(t text,r text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE d gcms_s02.service_draft%ROWTYPE;refs jsonb;pins jsonb:='[]';ref jsonb;BEGIN
 IF t IS DISTINCT FROM nullif(current_setting('gcms.tenant_id',true),'') OR NOT gcms_s02.has_current_membership(t) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM gcms_s02.service_draft WHERE tenant_id=t AND id=r;IF d.id IS NULL THEN RETURN NULL;END IF;
 SELECT l.refs INTO refs FROM gcms_m3.service_links_draft l WHERE l.tenant_id=t AND l.service_id=r;refs:=coalesce(refs,'[]');
 FOR ref IN SELECT value FROM jsonb_array_elements(refs) LOOP BEGIN pins:=pins||gcms_m3.pin_refs(t,r,jsonb_build_array(ref));EXCEPTION WHEN check_violation THEN NULL;END;END LOOP;
 RETURN jsonb_build_object('serviceId',r,'draftVersion',d.version,'references',refs,'resolved',gcms_m3.resolve_refs(t,pins));
END $$;
CREATE FUNCTION gcms_m3.public_service_links(tenant_slug text,service_slug text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE t text;r text;pub text;refs jsonb;BEGIN
 SELECT d.tenant_id,d.id,ptr.snapshot_id INTO t,r,pub FROM gcms_s02.site_draft site JOIN gcms_s02.tenant tenant ON tenant.id=site.tenant_id JOIN gcms_s02.service_draft d ON d.tenant_id=site.tenant_id JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=d.tenant_id AND ptr.service_id=d.id WHERE site.slug=tenant_slug AND d.slug=service_slug AND site.public_enabled AND site.slug_locked AND d.slug_locked AND tenant.status='active';IF t IS NULL THEN RETURN NULL;END IF;
 SELECT gcms_m3.resolve_refs(t,l.reference_pins) INTO refs FROM gcms_m3.service_publication_links l WHERE l.tenant_id=t AND l.service_id=r AND l.publication_id=pub;refs:=coalesce(refs,'[]');
 RETURN jsonb_build_object('serviceId',r,'publicationId',pub,'references',refs,'locations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x->'id','publicationId',x->'publicationId','name',x->'title','address',x->'content'->'address')) FROM jsonb_array_elements(refs) x WHERE x->>'kind'='location'),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION gcms_m3.service_has_reference(t text,r text,p text,k text,id_value text,pub text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM gcms_m3.service_publication_links l CROSS JOIN LATERAL jsonb_array_elements(l.reference_pins) x WHERE l.tenant_id=t AND l.service_id=r AND l.publication_id=p AND x->>'kind'=k AND x->>'id'=id_value AND (pub IS NULL OR x->>'publicationId'=pub) AND gcms_m3.reference_eligible(t,x))
$$;
CREATE FUNCTION gcms_m3.preview_references(t text,r text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE refs jsonb;pins jsonb:='[]';ref jsonb;BEGIN
 IF t IS DISTINCT FROM nullif(current_setting('gcms.tenant_id',true),'') OR NOT gcms_s02.has_current_membership(t) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501';END IF;
 SELECT content->'references' INTO refs FROM gcms_m3.resource WHERE tenant_id=t AND id=r;
 FOR ref IN SELECT value FROM jsonb_array_elements(coalesce(refs,'[]')) LOOP
  -- Keep the selected immutable version even if a newer version is available.
  IF ref->>'kind'='service' THEN SELECT ref||jsonb_build_object('generation',coalesce(g.generation,0)) INTO ref FROM gcms_s02.publication_snapshot p LEFT JOIN gcms_m3.service_generation g ON g.tenant_id=p.tenant_id AND g.service_id=p.service_id WHERE p.tenant_id=t AND p.service_id=ref->>'id' AND p.id=ref->>'publicationId';
  ELSE SELECT ref||jsonb_build_object('generation',p.generation) INTO ref FROM gcms_m3.publication p WHERE p.tenant_id=t AND p.resource_id=ref->>'id' AND p.id=ref->>'publicationId';END IF;
  IF ref IS NOT NULL THEN pins:=pins||jsonb_build_array(ref);END IF;
 END LOOP;RETURN gcms_m3.resolve_refs(t,pins);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gcms_m3 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_m3.stage_service_links(text,text,jsonb,boolean),gcms_m3.save_service_links(text,text,jsonb),gcms_m3.service_links_view(text,text),gcms_m3.public_service_links(text,text),gcms_m3.preview_references(text,text) TO gcms_s02_tenant;
-- A FAQ may be drafted empty; public answers must contain visible text.
CREATE FUNCTION gcms_m3.guard_faq_answer() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$BEGIN
 IF NEW.content->>'kind'='faq' AND NOT EXISTS(SELECT 1 FROM jsonb_path_query(NEW.content->'body','$.blocks.**.text') value WHERE jsonb_typeof(value)='string' AND btrim(value#>>'{}')<>'') THEN RAISE EXCEPTION 'FAQ answer required' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER m3_faq_public_answer BEFORE INSERT ON gcms_m3.publication FOR EACH ROW EXECUTE FUNCTION gcms_m3.guard_faq_answer();
REVOKE ALL ON FUNCTION gcms_m3.guard_faq_answer() FROM PUBLIC;
