-- M3 final integrity pass: unchanged pinned versions remain valid until a current revocation.
CREATE TABLE gcms_m3.service_publication_generation(tenant_id text NOT NULL,service_id text NOT NULL,publication_id text NOT NULL,generation integer NOT NULL,PRIMARY KEY(tenant_id,service_id,publication_id),FOREIGN KEY(tenant_id,service_id,publication_id) REFERENCES gcms_s02.publication_snapshot(tenant_id,service_id,id));
ALTER TABLE gcms_m3.service_publication_generation ENABLE ROW LEVEL SECURITY;ALTER TABLE gcms_m3.service_publication_generation FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_all ON gcms_m3.service_publication_generation TO gcms_s02_owner USING(true) WITH CHECK(true);
-- Pre-M3 publications carry baseline generation zero. An already-active M3 publication retains its current generation.
INSERT INTO gcms_m3.service_publication_generation(tenant_id,service_id,publication_id,generation) SELECT p.tenant_id,p.service_id,p.id,CASE WHEN ptr.snapshot_id=p.id THEN coalesce(g.generation,0) ELSE 0 END FROM gcms_s02.publication_snapshot p LEFT JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=p.tenant_id AND ptr.service_id=p.service_id LEFT JOIN gcms_m3.service_generation g ON g.tenant_id=p.tenant_id AND g.service_id=p.service_id;
CREATE TRIGGER service_publication_generation_immutable BEFORE UPDATE OR DELETE ON gcms_m3.service_publication_generation FOR EACH ROW EXECUTE FUNCTION gcms_s02.immutable_publication();
CREATE FUNCTION gcms_m3.capture_service_generation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN
 INSERT INTO gcms_m3.service_publication_generation(tenant_id,service_id,publication_id,generation) VALUES(NEW.tenant_id,NEW.service_id,NEW.id,coalesce((SELECT generation FROM gcms_m3.service_generation WHERE tenant_id=NEW.tenant_id AND service_id=NEW.service_id),0));RETURN NEW;
END $$;
CREATE TRIGGER m3_capture_service_generation AFTER INSERT ON gcms_s02.publication_snapshot FOR EACH ROW EXECUTE FUNCTION gcms_m3.capture_service_generation();
CREATE OR REPLACE FUNCTION gcms_m3.pin_refs(t text,self text,refs jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE ref jsonb;generation_value integer;out jsonb:='[]';BEGIN
 IF gcms_m3.references_shape(refs) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid reference shape' USING ERRCODE='23514';END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(refs) LOOP
  IF ref->>'id'=self THEN RAISE EXCEPTION 'Self reference' USING ERRCODE='23514';END IF;generation_value:=NULL;
  IF ref->>'kind'='service' THEN
   SELECT g.generation INTO generation_value FROM gcms_s02.publication_pointer ptr JOIN gcms_s02.publication_snapshot p ON p.tenant_id=ptr.tenant_id AND p.service_id=ptr.service_id JOIN gcms_m3.service_publication_generation g ON g.tenant_id=p.tenant_id AND g.service_id=p.service_id AND g.publication_id=p.id LEFT JOIN gcms_m3.service_generation current_generation ON current_generation.tenant_id=p.tenant_id AND current_generation.service_id=p.service_id WHERE ptr.tenant_id=t AND ptr.service_id=ref->>'id' AND p.id=ref->>'publicationId' AND g.generation=coalesce(current_generation.generation,0);
  ELSE SELECT p.generation INTO generation_value FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id WHERE r.tenant_id=t AND r.id=ref->>'id' AND r.kind=ref->>'kind' AND r.active_publication_id IS NOT NULL AND p.id=ref->>'publicationId' AND p.generation=r.generation AND gcms_m3.text_allowed(t,r.id,p.draft_version,r.kind);
  END IF;
  IF generation_value IS NULL THEN RAISE EXCEPTION 'Reference unavailable or revoked' USING ERRCODE='23514';END IF;out:=out||jsonb_build_array(ref||jsonb_build_object('generation',generation_value));
 END LOOP;RETURN out;
END $$;
CREATE OR REPLACE FUNCTION gcms_m3.reference_eligible(t text,ref jsonb) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN ref->>'kind'='service' THEN EXISTS(SELECT 1 FROM gcms_s02.publication_pointer ptr JOIN gcms_m3.service_publication_generation g ON g.tenant_id=ptr.tenant_id AND g.service_id=ptr.service_id LEFT JOIN gcms_m3.service_generation current_generation ON current_generation.tenant_id=ptr.tenant_id AND current_generation.service_id=ptr.service_id WHERE ptr.tenant_id=t AND ptr.service_id=ref->>'id' AND g.publication_id=ref->>'publicationId' AND g.generation=coalesce(current_generation.generation,0) AND g.generation=(ref->>'generation')::integer)
 ELSE EXISTS(SELECT 1 FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id WHERE r.tenant_id=t AND r.id=ref->>'id' AND r.kind=ref->>'kind' AND r.active_publication_id IS NOT NULL AND p.id=ref->>'publicationId' AND p.generation=r.generation AND p.generation=(ref->>'generation')::integer AND gcms_m3.text_allowed(t,r.id,p.draft_version,r.kind)) END
$$;
-- A withdrawn asset scope remains denied in all historical revisions of that resource.
CREATE OR REPLACE FUNCTION gcms_m3.asset_allowed(t text,r text,v integer,a text,rev integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT gcms_s07.content_asset_ready(t,a,rev) AND NOT EXISTS(SELECT 1 FROM gcms_m3.permission p WHERE p.tenant_id=t AND p.resource_id=r AND p.scope_key='asset:'||a||':'||rev AND p.withdrawn_at IS NOT NULL) AND (EXISTS(SELECT 1 FROM gcms_s07.asset x JOIN gcms_m3.resource resource ON resource.tenant_id=x.tenant_id AND resource.id=r WHERE x.tenant_id=t AND x.id=a AND x.material_kind='ordinary' AND resource.kind IN ('doctor','article')) OR EXISTS(SELECT 1 FROM gcms_m3.permission p WHERE p.tenant_id=t AND p.resource_id=r AND p.revision=v AND p.scope_key='asset:'||a||':'||rev AND p.withdrawn_at IS NULL))
$$;
-- Admission bounds match M3_LIMITS and the public consumer. No over-budget publication commits.
CREATE FUNCTION gcms_m3.graph_nodes(refs jsonb) RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$DECLARE ref jsonb;total integer:=0;BEGIN
 FOR ref IN SELECT value FROM jsonb_array_elements(coalesce(refs,'[]')) LOOP total:=total+1+gcms_m3.graph_nodes(ref->'references');IF total>250 THEN RETURN total;END IF;END LOOP;RETURN total;
END $$;
CREATE FUNCTION gcms_m3.assert_public_bounds(doc jsonb) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$BEGIN
 IF doc IS NULL OR gcms_m3.graph_nodes(doc->'references')>250 OR octet_length(doc::text)>1048576 THEN RAISE EXCEPTION 'Public content graph or payload exceeds admission limit' USING ERRCODE='23514';END IF;
END $$;
ALTER FUNCTION gcms_m3.command(text,text,jsonb) RENAME TO command_before_integrity;
REVOKE ALL ON FUNCTION gcms_m3.command_before_integrity(text,text,jsonb) FROM gcms_s02_tenant;
CREATE FUNCTION gcms_m3.command(t text,r text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE p gcms_m3.permission%ROWTYPE;out jsonb;keys text[];BEGIN
 PERFORM gcms_s05.authorize(t,true);
 keys:=CASE c->>'type' WHEN 'create' THEN ARRAY['type','operationId','content'] WHEN 'save' THEN ARRAY['type','operationId','expectedVersion','content'] WHEN 'publish' THEN ARRAY['type','operationId','expectedVersion','expectedPublicationVersion','expectedPublicationRevision','expectedSiteVersion'] WHEN 'unpublish' THEN ARRAY['type','operationId','expectedVersion','expectedPublicationRevision'] WHEN 'restore' THEN ARRAY['type','operationId','expectedVersion','sourceRevisionId'] WHEN 'grant' THEN ARRAY['type','operationId','expectedVersion','revision','scope','evidenceReference'] WHEN 'withdraw' THEN ARRAY['type','operationId','expectedVersion','permissionId','reason'] WHEN 'purge_retry' THEN ARRAY['type','operationId','expectedVersion','permissionId'] END;
 IF keys IS NULL OR jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT(c ?& keys) OR (c-keys)<>'{}' THEN RAISE EXCEPTION 'Invalid command shape' USING ERRCODE='23514';END IF;
 IF (c->>'type'='grant' AND jsonb_typeof(c->'evidenceReference') IS DISTINCT FROM 'string') OR (c->>'type'='withdraw' AND jsonb_typeof(c->'reason') IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'Invalid permission text' USING ERRCODE='23514';END IF;
 IF c->>'type'='withdraw' THEN SELECT * INTO p FROM gcms_m3.permission WHERE tenant_id=t AND resource_id=r AND id=c->>'permissionId';END IF;
 out:=gcms_m3.command_before_integrity(t,r,c);
 IF c->>'type'='publish' AND out->'replayed'='false'::jsonb THEN PERFORM gcms_m3.assert_public_bounds(gcms_m3.public_projection(t,r,(SELECT active_publication_id FROM gcms_m3.resource WHERE tenant_id=t AND id=r)));END IF;
 IF c->>'type'='withdraw' AND out->'replayed'='false'::jsonb THEN
  IF p.scope_key='text' THEN UPDATE gcms_m3.resource SET active_publication_id=NULL,generation=generation+1,publication_revision=publication_revision+1 WHERE tenant_id=t AND id=r;
  ELSE
   UPDATE gcms_m3.permission SET withdrawn_at=clock_timestamp(),withdrawal_reason=c->>'reason' WHERE tenant_id=t AND resource_id=r AND scope_key=p.scope_key AND withdrawn_at IS NULL;
   INSERT INTO gcms_m3.purge_job(tenant_id,permission_id) SELECT tenant_id,id FROM gcms_m3.permission WHERE tenant_id=t AND resource_id=r AND scope_key=p.scope_key AND withdrawn_at IS NOT NULL ON CONFLICT DO NOTHING;
  END IF;
 END IF;RETURN out;
END $$;
-- Restore mode is reserved for an actual same-resource editorial history source.
CREATE OR REPLACE FUNCTION gcms_m3.stage_service_links(t text,r text,refs jsonb,restoring boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE ref jsonb;BEGIN
 PERFORM gcms_s05.authorize(t,true);
 IF gcms_m3.references_shape(refs) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid service references' USING ERRCODE='23514';END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(refs) LOOP IF ref->>'kind'<>ALL(ARRAY['specialty','service_group','location','service','faq']) OR ref->>'id'=r THEN RAISE EXCEPTION 'Invalid service reference' USING ERRCODE='23514';END IF;END LOOP;
 IF restoring THEN
  IF NOT EXISTS(SELECT 1 FROM gcms_s08.editorial_revision h WHERE h.tenant_id=t AND h.resource='service' AND h.resource_id=r AND h.id=nullif(current_setting('gcms.restore_from',true),'') AND coalesce(h.content->'contentLinks'->'references','[]'::jsonb)=refs) THEN RAISE EXCEPTION 'Invalid restoration source' USING ERRCODE='23514';END IF;
 ELSE PERFORM gcms_m3.pin_refs(t,r,refs);END IF;
 INSERT INTO gcms_m3.service_links_draft(tenant_id,service_id,refs) VALUES(t,r,refs) ON CONFLICT(tenant_id,service_id) DO UPDATE SET refs=excluded.refs;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gcms_m3 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_m3.command(text,text,jsonb) TO gcms_s02_tenant;
GRANT USAGE ON SCHEMA gcms_m3 TO gcms_s07_worker;
GRANT EXECUTE ON FUNCTION gcms_m3.purge_claim(text,text),gcms_m3.purge_finish(text,text,text,integer,text) TO gcms_s07_worker;

CREATE FUNCTION gcms_m3.guard_service_link_bounds() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE closure jsonb;BEGIN
 SELECT p.closure INTO closure FROM gcms_s02.publication_snapshot p WHERE p.tenant_id=NEW.tenant_id AND p.service_id=NEW.service_id AND p.id=NEW.publication_id;
 PERFORM gcms_m3.assert_public_bounds(closure||jsonb_build_object('references',gcms_m3.resolve_refs(NEW.tenant_id,NEW.reference_pins)));RETURN NEW;
END $$;
CREATE TRIGGER m3_service_link_bounds AFTER INSERT ON gcms_m3.service_publication_links FOR EACH ROW EXECUTE FUNCTION gcms_m3.guard_service_link_bounds();
REVOKE ALL ON FUNCTION gcms_m3.graph_nodes(jsonb),gcms_m3.assert_public_bounds(jsonb),gcms_m3.guard_service_link_bounds() FROM PUBLIC;
-- Reject SQL NULL instead of accepting UNKNOWN through a boolean expression or CHECK.
CREATE OR REPLACE FUNCTION gcms_m3.valid_content(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE k text:=v->>'kind';extra text[];item jsonb;image jsonb;pair jsonb;day jsonb;part jsonb;seen text[]:='{}';previous text;name text;allowed text[];BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR jsonb_typeof(v->'kind') IS DISTINCT FROM 'string' OR gcms_m3.kind(k) IS NOT TRUE OR jsonb_typeof(v->'slug') IS DISTINCT FROM 'string' OR NOT(v ?& ARRAY['kind','slug','title','summary','body','seo','references']) OR
 NOT gcms_s02.valid_slug(v->>'slug') OR jsonb_typeof(v->'title') IS DISTINCT FROM 'string' OR length(btrim(v->>'title')) NOT BETWEEN 1 AND 160 OR
 jsonb_typeof(v->'summary') IS DISTINCT FROM 'string' OR length(v->>'summary')>320 OR NOT gcms_s02.valid_document(v->'body',20000) OR
 jsonb_typeof(v->'seo') IS DISTINCT FROM 'object' OR NOT(v->'seo' ?& ARRAY['title','description']) OR ((v->'seo')-ARRAY['title','description'])<>'{}' OR
 jsonb_typeof(v->'seo'->'title') IS DISTINCT FROM 'string' OR length(v->'seo'->>'title')>160 OR
 jsonb_typeof(v->'seo'->'description') IS DISTINCT FROM 'string' OR length(v->'seo'->>'description')>320 OR NOT gcms_m3.references_shape(v->'references') THEN RETURN false;END IF;
 extra:=CASE k WHEN 'location' THEN ARRAY['address','phone','email','openingHours','mapUrl'] WHEN 'doctor' THEN ARRAY['professionalTitle','credentials','languages','image'] WHEN 'price' THEN ARRAY['price','inclusions','notes'] WHEN 'case' THEN ARRAY['image'] WHEN 'gallery' THEN ARRAY['pairs'] WHEN 'testimonial' THEN ARRAY['quote','displayName','attribution','image'] WHEN 'article' THEN ARRAY['attribution','image'] ELSE ARRAY[]::text[] END;
 IF NOT(v ?& extra) OR (v-(ARRAY['kind','slug','title','summary','body','seo','references']||extra))<>'{}' THEN RETURN false;END IF;
 allowed:=CASE k WHEN 'doctor' THEN ARRAY['specialty','service','location'] WHEN 'price' THEN ARRAY['service','location'] WHEN 'case' THEN ARRAY['service','doctor','gallery'] WHEN 'gallery' THEN ARRAY['service','doctor'] WHEN 'testimonial' THEN ARRAY['service','doctor'] WHEN 'article' THEN ARRAY['category','doctor','service','faq'] WHEN 'faq' THEN ARRAY['specialty','service'] ELSE ARRAY[]::text[] END;
 FOR item IN SELECT value FROM jsonb_array_elements(v->'references') LOOP IF NOT(item->>'kind'=ANY(allowed)) THEN RETURN false;END IF;END LOOP;
 IF k='price' THEN
  IF NOT gcms_m3.price_shape(v->'price') OR (SELECT count(*) FROM jsonb_array_elements(v->'references') r WHERE r->>'kind'='service')<>1 OR
    jsonb_typeof(v->'inclusions') IS DISTINCT FROM 'string' OR length(v->>'inclusions')>2000 OR jsonb_typeof(v->'notes') IS DISTINCT FROM 'string' OR length(v->>'notes')>2000 THEN RETURN false;END IF;
 END IF;
 IF k=ANY(ARRAY['doctor','case','testimonial','article']) AND v->'image'<>'null'::jsonb AND gcms_s08.valid_cover(v->'image') IS NOT TRUE THEN RETURN false;END IF;
 IF k='doctor' THEN
  IF jsonb_typeof(v->'professionalTitle') IS DISTINCT FROM 'string' OR length(v->>'professionalTitle')>160 THEN RETURN false;END IF;
  FOREACH name IN ARRAY ARRAY['credentials','languages'] LOOP
   IF jsonb_typeof(v->name) IS DISTINCT FROM 'array' OR jsonb_array_length(v->name)>(CASE name WHEN 'credentials' THEN 30 ELSE 20 END) THEN RETURN false;END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(v->name) LOOP IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR length(btrim(item#>>'{}')) NOT BETWEEN 1 AND (CASE name WHEN 'credentials' THEN 300 ELSE 80 END) THEN RETURN false;END IF;END LOOP;
  END LOOP;
 END IF;
 IF k IN ('article','testimonial') AND (jsonb_typeof(v->'attribution') IS DISTINCT FROM 'string' OR length(v->>'attribution')>500) THEN RETURN false;END IF;
 IF k='testimonial' AND (jsonb_typeof(v->'quote') IS DISTINCT FROM 'string' OR length(btrim(v->>'quote')) NOT BETWEEN 1 AND 5000 OR jsonb_typeof(v->'displayName') IS DISTINCT FROM 'string' OR length(btrim(v->>'displayName')) NOT BETWEEN 1 AND 160) THEN RETURN false;END IF;
 IF k='gallery' THEN
  IF jsonb_typeof(v->'pairs') IS DISTINCT FROM 'array' OR jsonb_array_length(v->'pairs') NOT BETWEEN 1 AND 20 THEN RETURN false;END IF;
  FOR pair IN SELECT value FROM jsonb_array_elements(v->'pairs') LOOP
   IF jsonb_typeof(pair) IS DISTINCT FROM 'object' OR NOT(pair ?& ARRAY['before','after']) OR (pair-ARRAY['before','after'])<>'{}' THEN RETURN false;END IF;
   FOREACH name IN ARRAY ARRAY['before','after'] LOOP image:=pair->name;
    IF NOT gcms_s08.valid_cover(image-'caption') OR jsonb_typeof(image->'caption') IS DISTINCT FROM 'string' OR length(image->>'caption')>1000 OR image->>'assetId'=ANY(seen) THEN RETURN false;END IF;
    seen:=array_append(seen,image->>'assetId');
   END LOOP;
  END LOOP;
 END IF;
 IF k='location' THEN
  IF jsonb_typeof(v->'address') IS DISTINCT FROM 'string' OR length(btrim(v->>'address')) NOT BETWEEN 1 AND 1000 OR jsonb_typeof(v->'phone') IS DISTINCT FROM 'string' OR length(v->>'phone')>80 OR (v->>'phone'<>'' AND v->>'phone' !~ '^\+?[0-9 ().-]+$') OR jsonb_typeof(v->'email') IS DISTINCT FROM 'string' OR length(v->>'email')>254 OR (v->>'email'<>'' AND v->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') OR jsonb_typeof(v->'mapUrl') IS DISTINCT FROM 'string' OR length(v->>'mapUrl')>2048 THEN RETURN false;END IF;
  IF v->>'mapUrl'<>'' AND (v->>'mapUrl' !~* '^https?://[^/@[:space:]\\]+([/?#]|$)' OR v->>'mapUrl' ~ '[[:cntrl:][:space:]\\]' OR v->>'mapUrl' ~* '%(0[0-9a-f]|1[0-9a-f]|7f)') THEN RETURN false;END IF;
  IF jsonb_typeof(v->'openingHours') IS DISTINCT FROM 'array' OR jsonb_array_length(v->'openingHours')>7 THEN RETURN false;END IF;
  FOR day IN SELECT value FROM jsonb_array_elements(v->'openingHours') LOOP
   IF jsonb_typeof(day) IS DISTINCT FROM 'object' OR NOT(day ?& ARRAY['day','closed','intervals']) OR (day-ARRAY['day','closed','intervals'])<>'{}' OR jsonb_typeof(day->'day') IS DISTINCT FROM 'number' OR day->>'day' !~ '^[0-6]$' OR day->>'day'=ANY(seen) OR jsonb_typeof(day->'closed') IS DISTINCT FROM 'boolean' OR jsonb_typeof(day->'intervals') IS DISTINCT FROM 'array' OR jsonb_array_length(day->'intervals')>4 THEN RETURN false;END IF;
   seen:=array_append(seen,day->>'day');previous:='';
   IF ((day->>'closed')::boolean AND jsonb_array_length(day->'intervals')<>0) OR (NOT(day->>'closed')::boolean AND jsonb_array_length(day->'intervals')=0) THEN RETURN false;END IF;
   FOR part IN SELECT value FROM jsonb_array_elements(day->'intervals') LOOP
    IF jsonb_typeof(part) IS DISTINCT FROM 'object' OR NOT(part ?& ARRAY['opens','closes']) OR (part-ARRAY['opens','closes'])<>'{}' OR jsonb_typeof(part->'opens') IS DISTINCT FROM 'string' OR jsonb_typeof(part->'closes') IS DISTINCT FROM 'string' OR part->>'opens' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR part->>'closes' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR part->>'opens'>=part->>'closes' OR part->>'opens'<previous THEN RETURN false;END IF;previous:=part->>'closes';
   END LOOP;
  END LOOP;
 END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;END $$;
ALTER TABLE gcms_m3.resource ADD CONSTRAINT content_identity_strict CHECK((content->>'kind'=kind AND content->>'slug'=slug) IS TRUE),ADD CONSTRAINT content_shape_strict CHECK(gcms_m3.valid_content(content) IS TRUE);
CREATE OR REPLACE FUNCTION gcms_m3.purge_claim(t text,w text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE j gcms_m3.purge_job%ROWTYPE;BEGIN
 IF NOT gcms_m3.uuid(w) OR NOT EXISTS(SELECT 1 FROM gcms_m3.worker_scope WHERE tenant_id=t AND enabled) THEN RAISE EXCEPTION 'Invalid M3 worker scope' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));
 UPDATE gcms_m3.purge_job SET status='failed',failure_code='attempts_exhausted',lease_until=NULL WHERE tenant_id=t AND attempts>=5 AND status='processing' AND lease_until<=clock_timestamp();
 SELECT * INTO j FROM gcms_m3.purge_job WHERE tenant_id=t AND (status='pending' OR (status='processing' AND lease_until<clock_timestamp())) AND attempts<5 ORDER BY created_at,permission_id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF j.permission_id IS NULL THEN RETURN NULL;END IF;
 UPDATE gcms_m3.purge_job SET status='processing',attempts=attempts+1,fence=fence+1,worker_id=w,lease_until=clock_timestamp()+interval '30 seconds' WHERE tenant_id=t AND permission_id=j.permission_id RETURNING * INTO j;
 RETURN jsonb_build_object('tenantId',t,'permissionId',j.permission_id,'workerId',w,'fence',j.fence);
END $$;
REVOKE ALL ON FUNCTION gcms_m3.valid_content(jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION gcms_m3.references_shape(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$ DECLARE r jsonb;seen text[]:='{}';k text; BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v)>50 THEN RETURN false; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(v) LOOP
  IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR NOT(r ?& ARRAY['kind','id','publicationId']) OR (r-ARRAY['kind','id','publicationId'])<>'{}' OR
    (gcms_m3.kind(r->>'kind') IS NOT TRUE AND r->>'kind' IS DISTINCT FROM 'service') OR NOT gcms_m3.uuid(r->>'id') OR NOT gcms_m3.uuid(r->>'publicationId') THEN RETURN false; END IF;
  k:=(r->>'kind')||':'||(r->>'id');IF k=ANY(seen) THEN RETURN false;END IF;seen:=array_append(seen,k);
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false; END $$;

-- Preserve operator precedence at the JSON shape boundary.
CREATE OR REPLACE FUNCTION gcms_m3.command_before_integrity(t text,r text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_m3.resource%ROWTYPE;old gcms_m3.receipt%ROWTYPE;s gcms_s02.site_draft%ROWTYPE;source gcms_m3.revision%ROWTYPE;perm gcms_m3.permission%ROWTYPE;doc jsonb;pins jsonb;asset jsonb;out jsonb;pid text;scope_key text;action text:=c->>'type';BEGIN
 PERFORM gcms_s05.authorize(t,true);
 IF NOT gcms_m3.uuid(r) OR NOT gcms_m3.uuid(c->>'operationId') OR action IS NULL OR action NOT IN ('create','save','publish','unpublish','restore','grant','withdraw','purge_retry') THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='23514';END IF;
 IF action IN ('publish','unpublish','grant','withdraw') AND NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}';END IF;
 SELECT * INTO old FROM gcms_m3.receipt WHERE tenant_id=t AND operation_id=c->>'operationId';
 IF old.operation_id IS NOT NULL THEN IF old.resource_id<>r OR old.actor_id<>gcms_s02.current_actor() OR old.command<>c THEN RAISE EXCEPTION 'Operation conflict' USING ERRCODE='23514';END IF;RETURN old.result||'{"replayed":true}';END IF;
 SELECT * INTO d FROM gcms_m3.resource WHERE tenant_id=t AND id=r FOR UPDATE;
 IF action='create' THEN
  IF d.id IS NOT NULL OR gcms_m3.valid_content(c->'content') IS NOT TRUE THEN RAISE EXCEPTION 'Invalid content' USING ERRCODE='23514';END IF;
  doc:=c->'content';PERFORM gcms_m3.pin_refs(t,r,doc->'references');
  INSERT INTO gcms_m3.resource(tenant_id,id,kind,slug,version,content,updated_by) VALUES(t,r,doc->>'kind',doc->>'slug',1,doc,gcms_s02.current_actor());PERFORM gcms_m3.capture_revision(t,r,'created');
 ELSE
  IF d.id IS NULL THEN RETURN '{"code":"NOT_FOUND"}';END IF;
  IF NOT gcms_m3.version(c->'expectedVersion') OR d.version<>(c->>'expectedVersion')::integer THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='23514';END IF;
  IF action IN ('save','restore') THEN
   IF action='restore' THEN SELECT * INTO source FROM gcms_m3.revision WHERE tenant_id=t AND resource_id=r AND id=c->>'sourceRevisionId';IF source.id IS NULL THEN RAISE EXCEPTION 'Revision unavailable' USING ERRCODE='23514';END IF;doc:=source.content;ELSE doc:=c->'content';END IF;
   IF gcms_m3.valid_content(doc) IS NOT TRUE OR doc->>'kind'<>d.kind OR (d.slug_locked AND doc->>'slug'<>d.slug) THEN RAISE EXCEPTION 'Invalid content or locked slug' USING ERRCODE='23514';END IF;
   -- Restore may retain unavailable pins for editing, but never changes publication or grants.
   IF action='save' THEN PERFORM gcms_m3.pin_refs(t,r,doc->'references');END IF;
   UPDATE gcms_m3.resource SET content=doc,slug=doc->>'slug',version=version+1,updated_by=gcms_s02.current_actor(),updated_at=clock_timestamp() WHERE tenant_id=t AND id=r;
   PERFORM gcms_m3.capture_revision(t,r,CASE action WHEN 'restore' THEN 'restored' ELSE 'saved' END,CASE action WHEN 'restore' THEN source.id END);
  ELSIF action='publish' THEN
   SELECT * INTO s FROM gcms_s02.site_draft WHERE tenant_id=t FOR UPDATE;
   IF s.tenant_id IS NULL OR NOT s.public_enabled OR NOT gcms_m3.version(c->'expectedPublicationVersion',true) OR NOT gcms_m3.version(c->'expectedPublicationRevision',true) OR NOT gcms_m3.version(c->'expectedSiteVersion') OR d.publication_version<>(c->>'expectedPublicationVersion')::integer OR d.publication_revision<>(c->>'expectedPublicationRevision')::integer OR s.version<>(c->>'expectedSiteVersion')::integer THEN RAISE EXCEPTION 'Publication conflict' USING ERRCODE='23514';END IF;
   pins:=gcms_m3.pin_refs(t,r,d.content->'references');
   IF NOT gcms_m3.text_allowed(t,r,d.version,d.kind) THEN RAISE EXCEPTION 'Text permission required' USING ERRCODE='23514';END IF;
   FOR asset IN SELECT * FROM gcms_m3.asset_refs(d.content) LOOP IF NOT gcms_m3.asset_allowed(t,r,d.version,asset->>'assetId',(asset->>'revision')::integer) THEN RAISE EXCEPTION 'Resource media permission required' USING ERRCODE='23514';END IF;END LOOP;
   pid:=gen_random_uuid()::text;
   INSERT INTO gcms_m3.publication(tenant_id,resource_id,id,publication_version,draft_version,generation,site_version,content,site,reference_pins,published_by) VALUES(t,r,pid,d.publication_version+1,d.version,d.generation,s.version,d.content,jsonb_build_object('name',s.name,'footer',jsonb_build_object('intro',s.footer_intro,'body',s.footer_body)),pins,gcms_s02.current_actor());
   INSERT INTO gcms_m3.intent(tenant_id,resource_id,publication_id) VALUES(t,r,pid);
   UPDATE gcms_m3.resource SET active_publication_id=pid,publication_version=publication_version+1,publication_revision=publication_revision+1,slug_locked=true WHERE tenant_id=t AND id=r;
   UPDATE gcms_s02.site_draft SET slug_locked=true WHERE tenant_id=t AND NOT slug_locked;
  ELSIF action='unpublish' THEN
   IF NOT gcms_m3.version(c->'expectedPublicationRevision',true) OR d.publication_revision<>(c->>'expectedPublicationRevision')::integer OR d.active_publication_id IS NULL THEN RAISE EXCEPTION 'Publication conflict' USING ERRCODE='23514';END IF;
   UPDATE gcms_m3.resource SET active_publication_id=NULL,generation=generation+1,publication_revision=publication_revision+1 WHERE tenant_id=t AND id=r;
  ELSIF action='grant' THEN
   IF NOT gcms_m3.version(c->'revision') OR d.version<>(c->>'revision')::integer OR coalesce(length(btrim(c->>'evidenceReference')),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Permission scope conflict' USING ERRCODE='23514';END IF;
   IF c->'scope'='{"type":"text"}' THEN IF d.kind NOT IN ('case','gallery','testimonial') THEN RAISE EXCEPTION 'Text scope not required' USING ERRCODE='23514';END IF;scope_key:='text';
   ELSIF c->'scope'->>'type'='asset' AND ((c->'scope')-ARRAY['type','assetId','assetRevision'])='{}' AND gcms_m3.uuid(c->'scope'->>'assetId') AND gcms_m3.version(c->'scope'->'assetRevision') THEN
    IF NOT EXISTS(SELECT 1 FROM gcms_m3.asset_refs(d.content) a WHERE a->>'assetId'=c->'scope'->>'assetId' AND a->'revision'=c->'scope'->'assetRevision') OR NOT gcms_s07.content_asset_ready(t,c->'scope'->>'assetId',(c->'scope'->>'assetRevision')::integer) THEN RAISE EXCEPTION 'Media scope conflict' USING ERRCODE='23514';END IF;
    scope_key:='asset:'||(c->'scope'->>'assetId')||':'||(c->'scope'->>'assetRevision');
   ELSE RAISE EXCEPTION 'Invalid scope' USING ERRCODE='23514';END IF;
   INSERT INTO gcms_m3.permission(tenant_id,resource_id,revision,scope,scope_key,evidence_reference,granted_by) VALUES(t,r,d.version,c->'scope',scope_key,c->>'evidenceReference',gcms_s02.current_actor());
  ELSIF action='withdraw' THEN
   IF coalesce(length(btrim(c->>'reason')),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Reason required' USING ERRCODE='23514';END IF;
   UPDATE gcms_m3.permission SET withdrawn_at=clock_timestamp(),withdrawal_reason=c->>'reason' WHERE tenant_id=t AND resource_id=r AND id=c->>'permissionId' AND withdrawn_at IS NULL RETURNING * INTO perm;
   IF perm.id IS NULL THEN RAISE EXCEPTION 'Permission unavailable' USING ERRCODE='23514';END IF;
   INSERT INTO gcms_m3.purge_job(tenant_id,permission_id) VALUES(t,perm.id);
  ELSIF action='purge_retry' THEN
   UPDATE gcms_m3.purge_job j SET status='pending',attempts=0,failure_code=NULL,lease_until=NULL WHERE j.tenant_id=t AND j.permission_id=c->>'permissionId' AND j.status='failed' AND EXISTS(SELECT 1 FROM gcms_m3.permission p WHERE p.tenant_id=t AND p.id=j.permission_id AND p.resource_id=r AND p.withdrawn_at IS NOT NULL);
   IF NOT FOUND THEN RAISE EXCEPTION 'No retryable purge' USING ERRCODE='23514';END IF;
  END IF;
 END IF;
 -- Reject same-tenant unknown/future media too, even in private drafts.
 FOR asset IN SELECT * FROM gcms_m3.asset_refs((SELECT content FROM gcms_m3.resource WHERE tenant_id=t AND id=r)) LOOP
  IF NOT EXISTS(SELECT 1 FROM gcms_s07.asset a WHERE a.tenant_id=t AND a.id=asset->>'assetId' AND a.revision>=(asset->>'revision')::integer) THEN RAISE EXCEPTION 'Media unavailable' USING ERRCODE='23514';END IF;
 END LOOP;
 out:=jsonb_build_object('operationId',c->>'operationId','replayed',false);
 INSERT INTO gcms_m3.receipt(tenant_id,operation_id,resource_id,actor_id,command,result) VALUES(t,c->>'operationId',r,gcms_s02.current_actor(),c,out);
 INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id) VALUES(gen_random_uuid()::text,t,gcms_s02.current_actor(),'content.'||action,r);
 RETURN out;
END $$;
