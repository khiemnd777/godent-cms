-- M3 additive local VI content. No retained rows are rewritten or auto-published.
DO $$ BEGIN IF current_user<>'gcms_s02_owner' THEN RAISE EXCEPTION 'M3 owner required'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='gcms_m3' AND nspowner=(SELECT oid FROM pg_roles WHERE rolname='gcms_s02_owner')) THEN RAISE EXCEPTION 'M3 pre-owned namespace required'; END IF; END $$;
REVOKE ALL ON SCHEMA gcms_m3 FROM PUBLIC;
CREATE FUNCTION gcms_m3.kind(v text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT v=ANY(ARRAY['specialty','service_group','location','doctor','price','case','gallery','testimonial','article','category','faq'])
$$;
CREATE FUNCTION gcms_m3.path(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT CASE v WHEN 'specialty' THEN 'chuyen-khoa' WHEN 'service_group' THEN 'nhom-dich-vu' WHEN 'service' THEN 'dich-vu' WHEN 'location' THEN 'co-so' WHEN 'doctor' THEN 'bac-si' WHEN 'price' THEN 'bang-gia' WHEN 'case' THEN 'ca-dieu-tri' WHEN 'gallery' THEN 'truoc-sau' WHEN 'testimonial' THEN 'danh-gia' WHEN 'article' THEN 'bai-viet' WHEN 'category' THEN 'chuyen-muc' WHEN 'faq' THEN 'hoi-dap' END
$$;
CREATE FUNCTION gcms_m3.uuid(v text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT coalesce(v ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',false) $$;
CREATE FUNCTION gcms_m3.version(v jsonb,zero_allowed boolean DEFAULT false) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_typeof(v)='number' AND v::text ~ '^[0-9]{1,10}$' AND v::text::numeric>=CASE WHEN zero_allowed THEN 0 ELSE 1 END AND v::text::numeric<2147483647,false)
$$;
CREATE FUNCTION gcms_m3.references_shape(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$ DECLARE r jsonb;seen text[]:='{}';k text; BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v)>50 THEN RETURN false; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(v) LOOP
  IF jsonb_typeof(r) IS DISTINCT FROM 'object' OR NOT(r ?& ARRAY['kind','id','publicationId']) OR (r-ARRAY['kind','id','publicationId'])<>'{}' OR
    NOT(gcms_m3.kind(r->>'kind') OR r->>'kind'='service') OR NOT gcms_m3.uuid(r->>'id') OR NOT gcms_m3.uuid(r->>'publicationId') THEN RETURN false; END IF;
  k:=(r->>'kind')||':'||(r->>'id');IF k=ANY(seen) THEN RETURN false;END IF;seen:=array_append(seen,k);
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false; END $$;
CREATE FUNCTION gcms_m3.price_shape(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$ DECLARE k text; BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR v->>'currency' !~ '^[A-Z]{3}$' OR jsonb_typeof(v->'currency') IS DISTINCT FROM 'string' OR jsonb_typeof(v->'unit') IS DISTINCT FROM 'string' OR length(btrim(v->>'unit')) NOT BETWEEN 1 AND 80 THEN RETURN false; END IF;
 IF v->>'type' IN ('exact','from') THEN
  IF NOT(v ?& ARRAY['type','amount','currency','unit']) OR (v-ARRAY['type','amount','currency','unit'])<>'{}' THEN RETURN false;END IF;
  IF jsonb_typeof(v->'amount') IS DISTINCT FROM 'string' OR v->>'amount' !~ '^(0|[1-9][0-9]{0,23})(\.[0-9]{1,6})?$' THEN RETURN false; END IF;
 ELSIF v->>'type'='range' THEN
  IF NOT(v ?& ARRAY['type','minimum','maximum','currency','unit']) OR (v-ARRAY['type','minimum','maximum','currency','unit'])<>'{}' THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['minimum','maximum'] LOOP IF jsonb_typeof(v->k) IS DISTINCT FROM 'string' OR v->>k !~ '^(0|[1-9][0-9]{0,23})(\.[0-9]{1,6})?$' THEN RETURN false;END IF;END LOOP;
  IF (v->>'minimum')::numeric>(v->>'maximum')::numeric THEN RETURN false; END IF;
 ELSE RETURN false; END IF;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false; END $$;
CREATE FUNCTION gcms_m3.valid_content(v jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE k text:=v->>'kind';extra text[];item jsonb;image jsonb;pair jsonb;day jsonb;part jsonb;seen text[]:='{}';previous text;name text;allowed text[];BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR NOT gcms_m3.kind(k) OR NOT(v ?& ARRAY['kind','slug','title','summary','body','seo','references']) OR
 NOT gcms_s02.valid_slug(v->>'slug') OR jsonb_typeof(v->'title') IS DISTINCT FROM 'string' OR length(btrim(v->>'title')) NOT BETWEEN 1 AND 160 OR
 jsonb_typeof(v->'summary') IS DISTINCT FROM 'string' OR length(v->>'summary')>320 OR NOT gcms_s02.valid_document(v->'body',20000) OR
 jsonb_typeof(v->'seo') IS DISTINCT FROM 'object' OR NOT(v->'seo' ?& ARRAY['title','description']) OR (v->'seo'-ARRAY['title','description'])<>'{}' OR
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
 IF k=ANY(ARRAY['doctor','case','testimonial','article']) AND v->'image'<>'null'::jsonb AND NOT gcms_s08.valid_cover(v->'image') THEN RETURN false;END IF;
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
    IF jsonb_typeof(part) IS DISTINCT FROM 'object' OR NOT(part ?& ARRAY['opens','closes']) OR (part-ARRAY['opens','closes'])<>'{}' OR part->>'opens' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR part->>'closes' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR part->>'opens'>=part->>'closes' OR part->>'opens'<previous THEN RETURN false;END IF;previous:=part->>'closes';
   END LOOP;
  END LOOP;
 END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;END $$;
CREATE TABLE gcms_m3.resource (
 tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id),id text NOT NULL CHECK(gcms_m3.uuid(id)),kind text NOT NULL CHECK(gcms_m3.kind(kind)),
 slug text NOT NULL CHECK(gcms_s02.valid_slug(slug)),version integer NOT NULL CHECK(version>0),content jsonb NOT NULL CHECK(gcms_m3.valid_content(content) IS TRUE),
 slug_locked boolean NOT NULL DEFAULT false,publication_version integer NOT NULL DEFAULT 0 CHECK(publication_version>=0),publication_revision integer NOT NULL DEFAULT 0 CHECK(publication_revision>=0),
 generation integer NOT NULL DEFAULT 0 CHECK(generation>=0),active_publication_id text,updated_by text NOT NULL,updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,kind,slug),FOREIGN KEY(tenant_id,updated_by) REFERENCES gcms_s02.membership(tenant_id,user_id),
 CHECK(content->>'kind'=kind AND content->>'slug'=slug)
);
CREATE INDEX content_list_keyset ON gcms_m3.resource(tenant_id,kind,id);
CREATE TABLE gcms_m3.revision (
 tenant_id text NOT NULL,resource_id text NOT NULL,id text NOT NULL DEFAULT gen_random_uuid()::text,version integer NOT NULL,content jsonb NOT NULL,
 kind text NOT NULL CHECK(kind IN ('created','saved','restored')),actor_id text NOT NULL,actor_name text NOT NULL,restored_from text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,resource_id,version),FOREIGN KEY(tenant_id,resource_id) REFERENCES gcms_m3.resource(tenant_id,id),FOREIGN KEY(tenant_id,restored_from) REFERENCES gcms_m3.revision(tenant_id,id)
);
CREATE INDEX content_revision_keyset ON gcms_m3.revision(tenant_id,resource_id,version DESC,id DESC);
CREATE TABLE gcms_m3.publication (
 tenant_id text NOT NULL,resource_id text NOT NULL,id text NOT NULL DEFAULT gen_random_uuid()::text,publication_version integer NOT NULL,draft_version integer NOT NULL,generation integer NOT NULL,
 site_version integer NOT NULL,content jsonb NOT NULL,site jsonb NOT NULL,reference_pins jsonb NOT NULL,published_by text NOT NULL,published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,resource_id,id),UNIQUE(tenant_id,resource_id,publication_version),FOREIGN KEY(tenant_id,resource_id) REFERENCES gcms_m3.resource(tenant_id,id),
 FOREIGN KEY(tenant_id,resource_id,draft_version) REFERENCES gcms_m3.revision(tenant_id,resource_id,version)
);
ALTER TABLE gcms_m3.resource ADD CONSTRAINT content_active_fk FOREIGN KEY(tenant_id,id,active_publication_id) REFERENCES gcms_m3.publication(tenant_id,resource_id,id);
CREATE TABLE gcms_m3.receipt (tenant_id text NOT NULL,operation_id text NOT NULL CHECK(gcms_m3.uuid(operation_id)),resource_id text NOT NULL,actor_id text NOT NULL,command jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(tenant_id,operation_id),FOREIGN KEY(tenant_id,resource_id) REFERENCES gcms_m3.resource(tenant_id,id));
CREATE TABLE gcms_m3.permission (
 tenant_id text NOT NULL,resource_id text NOT NULL,id text NOT NULL DEFAULT gen_random_uuid()::text,revision integer NOT NULL,scope jsonb NOT NULL,
 scope_key text NOT NULL,evidence_reference text NOT NULL CHECK(length(btrim(evidence_reference)) BETWEEN 1 AND 500),granted_by text NOT NULL,granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 withdrawn_at timestamptz,withdrawal_reason text,PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,resource_id,revision,scope_key),
 FOREIGN KEY(tenant_id,resource_id,revision) REFERENCES gcms_m3.revision(tenant_id,resource_id,version)
);
CREATE TABLE gcms_m3.purge_job (tenant_id text NOT NULL,permission_id text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),fence integer NOT NULL DEFAULT 0,worker_id text,lease_until timestamptz,failure_code text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),completed_at timestamptz,PRIMARY KEY(tenant_id,permission_id),FOREIGN KEY(tenant_id,permission_id) REFERENCES gcms_m3.permission(tenant_id,id));
CREATE TABLE gcms_m3.intent (tenant_id text NOT NULL,resource_id text NOT NULL,publication_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(tenant_id,resource_id,publication_id),FOREIGN KEY(tenant_id,resource_id,publication_id) REFERENCES gcms_m3.publication(tenant_id,resource_id,id));
CREATE TABLE gcms_m3.worker_scope (tenant_id text PRIMARY KEY REFERENCES gcms_s02.tenant(id),enabled boolean NOT NULL DEFAULT false);
DO $$ DECLARE n text; BEGIN FOREACH n IN ARRAY ARRAY['resource','revision','publication','receipt','permission','purge_job','intent','worker_scope'] LOOP
 EXECUTE format('ALTER TABLE gcms_m3.%I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('ALTER TABLE gcms_m3.%I FORCE ROW LEVEL SECURITY',n);
 EXECUTE format('CREATE POLICY owner_all ON gcms_m3.%I TO gcms_s02_owner USING(true) WITH CHECK(true)',n);
 IF n<>'worker_scope' THEN EXECUTE format('CREATE POLICY tenant_read ON gcms_m3.%I FOR SELECT TO gcms_s02_tenant USING(tenant_id=nullif(current_setting(''gcms.tenant_id'',true),'''') AND gcms_s02.has_current_membership(tenant_id))',n);END IF;
 END LOOP;END $$;
GRANT USAGE ON SCHEMA gcms_m3 TO gcms_s02_tenant;
GRANT SELECT ON gcms_m3.resource,gcms_m3.revision,gcms_m3.publication,gcms_m3.receipt,gcms_m3.permission,gcms_m3.purge_job,gcms_m3.intent TO gcms_s02_tenant;
CREATE TRIGGER content_revision_immutable BEFORE UPDATE OR DELETE ON gcms_m3.revision FOR EACH ROW EXECUTE FUNCTION gcms_s02.immutable_publication();
CREATE TRIGGER content_publication_immutable BEFORE UPDATE OR DELETE ON gcms_m3.publication FOR EACH ROW EXECUTE FUNCTION gcms_s02.immutable_publication();
CREATE TRIGGER content_receipt_immutable BEFORE UPDATE OR DELETE ON gcms_m3.receipt FOR EACH ROW EXECUTE FUNCTION gcms_s02.immutable_publication();
CREATE TRIGGER content_intent_immutable BEFORE UPDATE OR DELETE ON gcms_m3.intent FOR EACH ROW EXECUTE FUNCTION gcms_s02.immutable_publication();
-- Media exposes readiness; service_cover permission is deliberately irrelevant here.
CREATE FUNCTION gcms_s07.content_asset_ready(t text,a text,r integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM gcms_s07.asset x JOIN gcms_s02.tenant ten ON ten.id=x.tenant_id WHERE x.tenant_id=t AND x.id=a AND x.revision=r AND x.state='ready' AND x.withdrawn_at IS NULL AND ten.status='active' AND NOT EXISTS(SELECT 1 FROM gcms_s07.withdrawal_decision w WHERE w.tenant_id=t AND w.asset_id=a) AND EXISTS(SELECT 1 FROM gcms_s07.derivative d WHERE d.tenant_id=t AND d.asset_id=a AND d.revision=r AND d.ready AND d.deleted_at IS NULL))
$$;
CREATE FUNCTION gcms_m3.asset_refs(c jsonb) RETURNS SETOF jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$ DECLARE p jsonb;BEGIN
 IF c ? 'image' AND c->'image'<>'null'::jsonb THEN RETURN NEXT c->'image';END IF;
 IF c->>'kind'='gallery' THEN FOR p IN SELECT value FROM jsonb_array_elements(c->'pairs') LOOP RETURN NEXT p->'before';RETURN NEXT p->'after';END LOOP;END IF;
END $$;
CREATE FUNCTION gcms_m3.asset_allowed(t text,r text,v integer,a text,rev integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT gcms_s07.content_asset_ready(t,a,rev) AND NOT EXISTS(SELECT 1 FROM gcms_m3.permission p WHERE p.tenant_id=t AND p.resource_id=r AND p.revision=v AND p.scope_key='asset:'||a||':'||rev AND p.withdrawn_at IS NOT NULL) AND (EXISTS(SELECT 1 FROM gcms_s07.asset x WHERE x.tenant_id=t AND x.id=a AND x.material_kind='ordinary') OR EXISTS(SELECT 1 FROM gcms_m3.permission p WHERE p.tenant_id=t AND p.resource_id=r AND p.revision=v AND p.scope_key='asset:'||a||':'||rev AND p.withdrawn_at IS NULL))
$$;
CREATE FUNCTION gcms_m3.text_allowed(t text,r text,v integer,k text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT k<>ALL(ARRAY['case','gallery','testimonial']) OR EXISTS(SELECT 1 FROM gcms_m3.permission p WHERE p.tenant_id=t AND p.resource_id=r AND p.revision=v AND p.scope_key='text' AND p.withdrawn_at IS NULL)
$$;
-- Service generation is held separately and changes only on an explicit unpublish.
CREATE TABLE gcms_m3.service_generation(tenant_id text NOT NULL,service_id text NOT NULL,generation integer NOT NULL DEFAULT 0,PRIMARY KEY(tenant_id,service_id),FOREIGN KEY(tenant_id,service_id) REFERENCES gcms_s02.service_draft(tenant_id,id));
ALTER TABLE gcms_m3.service_generation ENABLE ROW LEVEL SECURITY;ALTER TABLE gcms_m3.service_generation FORCE ROW LEVEL SECURITY;
CREATE POLICY service_generation_owner ON gcms_m3.service_generation TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE FUNCTION gcms_m3.service_unpublished() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 INSERT INTO gcms_m3.service_generation(tenant_id,service_id,generation) VALUES(OLD.tenant_id,OLD.service_id,1) ON CONFLICT(tenant_id,service_id) DO UPDATE SET generation=service_generation.generation+1;RETURN OLD;
END $$;
CREATE TRIGGER m3_service_generation AFTER DELETE ON gcms_s02.publication_pointer FOR EACH ROW EXECUTE FUNCTION gcms_m3.service_unpublished();
CREATE FUNCTION gcms_m3.pin_refs(t text,self text,refs jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE ref jsonb;generation_value integer;out jsonb:='[]';BEGIN
 IF NOT gcms_m3.references_shape(refs) THEN RAISE EXCEPTION 'Invalid reference shape' USING ERRCODE='23514';END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(refs) LOOP
  IF ref->>'id'=self THEN RAISE EXCEPTION 'Self reference' USING ERRCODE='23514';END IF;generation_value:=NULL;
  IF ref->>'kind'='service' THEN
   SELECT coalesce(g.generation,0) INTO generation_value FROM gcms_s02.publication_pointer p JOIN gcms_s02.publication_snapshot s ON s.tenant_id=p.tenant_id AND s.service_id=p.service_id AND s.id=p.snapshot_id LEFT JOIN gcms_m3.service_generation g ON g.tenant_id=p.tenant_id AND g.service_id=p.service_id WHERE p.tenant_id=t AND p.service_id=ref->>'id' AND s.id=ref->>'publicationId';
  ELSE SELECT r.generation INTO generation_value FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id WHERE r.tenant_id=t AND r.id=ref->>'id' AND r.kind=ref->>'kind' AND p.id=ref->>'publicationId' AND gcms_m3.text_allowed(t,r.id,p.draft_version,r.kind);
  END IF;
  IF generation_value IS NULL THEN RAISE EXCEPTION 'Reference unavailable or changed' USING ERRCODE='23514';END IF;out:=out||jsonb_build_array(ref||jsonb_build_object('generation',generation_value));
 END LOOP;RETURN out;
END $$;
CREATE FUNCTION gcms_m3.reference_eligible(t text,ref jsonb) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN ref->>'kind'='service' THEN EXISTS(SELECT 1 FROM gcms_s02.publication_pointer ptr JOIN gcms_s02.publication_snapshot p ON p.tenant_id=ptr.tenant_id AND p.service_id=ptr.service_id LEFT JOIN gcms_m3.service_generation g ON g.tenant_id=ptr.tenant_id AND g.service_id=ptr.service_id WHERE ptr.tenant_id=t AND ptr.service_id=ref->>'id' AND p.id=ref->>'publicationId' AND coalesce(g.generation,0)=(ref->>'generation')::integer)
 ELSE EXISTS(SELECT 1 FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id WHERE r.tenant_id=t AND r.id=ref->>'id' AND r.kind=ref->>'kind' AND r.active_publication_id IS NOT NULL AND p.id=ref->>'publicationId' AND p.generation=r.generation AND p.generation=(ref->>'generation')::integer AND gcms_m3.text_allowed(t,r.id,p.draft_version,r.kind)) END
$$;
CREATE FUNCTION gcms_m3.capture_revision(t text,r text,k text,source text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 INSERT INTO gcms_m3.revision(tenant_id,resource_id,version,content,kind,actor_id,actor_name,restored_from) SELECT t,r,d.version,d.content,k,gcms_s02.current_actor(),u.name,source FROM gcms_m3.resource d JOIN gcms_s02_auth."user" u ON u.id=gcms_s02.current_actor() WHERE d.tenant_id=t AND d.id=r;
END $$;
CREATE FUNCTION gcms_m3.command(t text,r text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
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
   ELSIF c->'scope'->>'type'='asset' AND (c->'scope'-ARRAY['type','assetId','assetRevision'])='{}' AND gcms_m3.uuid(c->'scope'->>'assetId') AND gcms_m3.version(c->'scope'->'assetRevision') THEN
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
-- Public projection validates eligibility within one database statement snapshot.
CREATE FUNCTION gcms_m3.public_projection(t text,r text,pub text,depth integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_m3.resource%ROWTYPE;p gcms_m3.publication%ROWTYPE;site gcms_s02.site_draft%ROWTYPE;doc jsonb;refs jsonb:='[]';pins jsonb:='[]';ref jsonb;child jsonb;media jsonb:='[]';image jsonb;pair jsonb;pairs jsonb:='[]';before_media jsonb;after_media jsonb;idx integer:=0;BEGIN
 IF depth>3 THEN RETURN NULL;END IF;
 SELECT * INTO d FROM gcms_m3.resource WHERE tenant_id=t AND id=r;
 SELECT * INTO p FROM gcms_m3.publication WHERE tenant_id=t AND resource_id=r AND id=pub;
 SELECT * INTO site FROM gcms_s02.site_draft WHERE tenant_id=t;
 IF d.id IS NULL OR p.id IS NULL OR d.active_publication_id IS NULL OR p.generation<>d.generation OR NOT site.public_enabled OR NOT site.slug_locked OR NOT d.slug_locked OR NOT EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=t AND status='active') OR NOT gcms_m3.text_allowed(t,r,p.draft_version,d.kind) THEN RETURN NULL;END IF;
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
CREATE FUNCTION gcms_m3.public_media(t text,r text,pub text,image jsonb,v integer) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('assetId',d.asset_id,'revision',d.revision,'alt',image->>'alt','width',d.width,'height',d.height,'profile','cover','path','/api/public/content-media/'||t||'/'||r||'/'||pub||'/'||d.asset_id||'/'||d.revision||'/cover') FROM gcms_s07.derivative d WHERE d.tenant_id=t AND d.asset_id=image->>'assetId' AND d.revision=(image->>'revision')::integer AND d.ready AND d.deleted_at IS NULL AND gcms_m3.asset_allowed(t,r,v,d.asset_id,d.revision) ORDER BY d.fence DESC LIMIT 1
$$;
CREATE FUNCTION gcms_m3.read_public(tenant_slug text,k text,slug_value text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT gcms_m3.public_projection(r.tenant_id,r.id,r.active_publication_id) FROM gcms_m3.resource r JOIN gcms_s02.site_draft s ON s.tenant_id=r.tenant_id WHERE s.slug=tenant_slug AND r.kind=k AND r.slug=slug_value
$$;
CREATE FUNCTION gcms_m3.public_media_target(t text,r text,pub text,a text,v integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE page jsonb;BEGIN
 page:=gcms_m3.public_projection(t,r,pub);
 IF page IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(page->'media') x WHERE x->'media'->>'assetId'=a AND x->'media'->>'revision'=v::text) THEN RETURN NULL;END IF;
 RETURN (SELECT jsonb_build_object('key',d.object_key,'bytes',d.bytes) FROM gcms_s07.derivative d WHERE d.tenant_id=t AND d.asset_id=a AND d.revision=v AND d.ready AND d.deleted_at IS NULL ORDER BY d.fence DESC LIMIT 1);
END $$;
CREATE FUNCTION gcms_m3.public_list(tenant_slug text,k text,q text,after_id text,lim integer,filter_kind text,filter_id text,filter_pub text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
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
  FOR row IN SELECT r.id,r.active_publication_id FROM gcms_m3.resource r JOIN gcms_m3.publication p ON p.tenant_id=r.tenant_id AND p.resource_id=r.id AND p.id=r.active_publication_id WHERE r.tenant_id=s.tenant_id AND r.kind=k AND r.active_publication_id IS NOT NULL AND (after_id IS NULL OR r.id>after_id) AND (q='' OR position(q IN lower(p.content->>'title'))>0 OR position(q IN lower(r.slug))>0) ORDER BY r.id LOOP
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
-- Narrow scoped purge worker. There are no per-resource stored derivatives or HTML caches.
-- The worker records delivery invalidation; global asset deletion remains Media's explicit withdrawal.
CREATE FUNCTION gcms_m3.purge_claim(t text,w text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE j gcms_m3.purge_job%ROWTYPE;BEGIN
 IF NOT gcms_m3.uuid(w) OR NOT EXISTS(SELECT 1 FROM gcms_m3.worker_scope WHERE tenant_id=t AND enabled) THEN RAISE EXCEPTION 'Invalid M3 worker scope' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));
 SELECT * INTO j FROM gcms_m3.purge_job WHERE tenant_id=t AND (status='pending' OR (status='processing' AND lease_until<clock_timestamp())) AND attempts<5 ORDER BY created_at,permission_id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF j.permission_id IS NULL THEN RETURN NULL;END IF;
 UPDATE gcms_m3.purge_job SET status='processing',attempts=attempts+1,fence=fence+1,worker_id=w,lease_until=clock_timestamp()+interval '30 seconds' WHERE tenant_id=t AND permission_id=j.permission_id RETURNING * INTO j;
 RETURN jsonb_build_object('tenantId',t,'permissionId',j.permission_id,'workerId',w,'fence',j.fence);
END $$;
CREATE FUNCTION gcms_m3.purge_finish(t text,p text,w text,f integer,outcome text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM gcms_m3.worker_scope WHERE tenant_id=t AND enabled) THEN RAISE EXCEPTION 'Invalid M3 worker scope' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));
 UPDATE gcms_m3.purge_job j SET status=CASE WHEN outcome='success' THEN 'completed' WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,completed_at=CASE WHEN outcome='success' THEN clock_timestamp() END,lease_until=NULL,failure_code=CASE WHEN outcome='success' THEN NULL ELSE 'delivery_invalidation_failed' END WHERE tenant_id=t AND permission_id=p AND worker_id=w AND fence=f AND status='processing' AND lease_until>clock_timestamp() AND outcome IN ('success','retry') AND EXISTS(SELECT 1 FROM gcms_m3.permission x WHERE x.tenant_id=t AND x.id=p AND x.withdrawn_at IS NOT NULL);
 RETURN FOUND;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gcms_m3 FROM PUBLIC;
REVOKE ALL ON FUNCTION gcms_s07.content_asset_ready(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_m3.command(text,text,jsonb),gcms_m3.read_public(text,text,text),gcms_m3.public_list(text,text,text,text,integer,text,text,text),gcms_m3.public_media_target(text,text,text,text,integer),gcms_m3.public_projection(text,text,text,integer),gcms_m3.path(text),gcms_m3.pin_refs(text,text,jsonb),gcms_m3.reference_eligible(text,jsonb) TO gcms_s02_tenant;
CREATE FUNCTION gcms_m3.preview_issues(t text,r text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE d gcms_m3.resource%ROWTYPE;a jsonb;issues jsonb:='[]';BEGIN
 IF t IS DISTINCT FROM nullif(current_setting('gcms.tenant_id',true),'') OR NOT gcms_s02.has_current_membership(t) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM gcms_m3.resource WHERE tenant_id=t AND id=r;IF d.id IS NULL THEN RETURN '["NOT_FOUND"]';END IF;
 BEGIN PERFORM gcms_m3.pin_refs(t,r,d.content->'references');EXCEPTION WHEN check_violation THEN issues:=issues||'"REFERENCE_UNAVAILABLE"'::jsonb;END;
 IF NOT gcms_m3.text_allowed(t,r,d.version,d.kind) THEN issues:=issues||'"TEXT_PERMISSION_REQUIRED"'::jsonb;END IF;
 FOR a IN SELECT * FROM gcms_m3.asset_refs(d.content) LOOP IF NOT gcms_m3.asset_allowed(t,r,d.version,a->>'assetId',(a->>'revision')::integer) THEN issues:=issues||'"ASSET_PERMISSION_REQUIRED"'::jsonb;END IF;END LOOP;
 RETURN issues;
END $$;
-- Until the independently added service-link seam exists, filters fail closed.
CREATE FUNCTION gcms_m3.service_has_reference(t text,r text,p text,k text,id_value text,pub text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT false $$;
REVOKE ALL ON FUNCTION gcms_m3.preview_issues(text,text),gcms_m3.service_has_reference(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_m3.preview_issues(text,text) TO gcms_s02_tenant;
