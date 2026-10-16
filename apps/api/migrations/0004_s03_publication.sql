-- Additive S03 migration. Applied 0001-0003 and all retained IDs/versions stay unchanged.
ALTER TABLE gcms_s02.service_draft
  ADD COLUMN slug text,
  ADD COLUMN summary text NOT NULL DEFAULT '' CHECK(length(summary)<=320),
  ADD COLUMN body_document jsonb,
  ADD COLUMN seo_title text NOT NULL DEFAULT '' CHECK(length(seo_title)<=160),
  ADD COLUMN seo_description text NOT NULL DEFAULT '' CHECK(length(seo_description)<=320),
  ADD COLUMN slug_locked boolean NOT NULL DEFAULT false;

CREATE FUNCTION gcms_s02.valid_slug(v text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT v IS NOT NULL AND length(v) BETWEEN 1 AND 63 AND v ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND v <> ALL(ARRAY['api','admin','cms','platform','login','logout','preview','auth','assets','static','public','health','ready','diagnostics','dich-vu','en','vi','www'])
$$;
ALTER TABLE gcms_s02.service_draft ADD CONSTRAINT service_slug_valid CHECK(slug IS NULL OR gcms_s02.valid_slug(slug));
CREATE UNIQUE INDEX service_slug_unique ON gcms_s02.service_draft(tenant_id,slug) WHERE slug IS NOT NULL;

CREATE TABLE gcms_s02.site_draft (
  tenant_id text PRIMARY KEY REFERENCES gcms_s02.tenant(id),
  slug text NOT NULL UNIQUE CHECK(gcms_s02.valid_slug(slug)),
  version integer NOT NULL CHECK(version>0), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
  footer_intro text NOT NULL CHECK(length(footer_intro)<=500), footer_body jsonb NOT NULL,
  slug_locked boolean NOT NULL DEFAULT false, public_enabled boolean NOT NULL DEFAULT true,
  canonical_origin text NOT NULL DEFAULT 'http://localhost:5892' CHECK(canonical_origin='http://localhost:5892'),
  updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,updated_by) REFERENCES gcms_s02.membership(tenant_id,user_id)
);
CREATE TABLE gcms_s02.publication_snapshot (
  tenant_id text NOT NULL, service_id text NOT NULL, id text NOT NULL,
  publication_version integer NOT NULL CHECK(publication_version>0),
  draft_version integer NOT NULL CHECK(draft_version>0), site_version integer NOT NULL CHECK(site_version>0),
  request_key text NOT NULL CHECK(request_key ~ '^[a-f0-9-]{36}$'),
  request_fingerprint text NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
  closure jsonb NOT NULL CHECK(jsonb_typeof(closure)='object'),
  published_by text NOT NULL, published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant_id,service_id,id), UNIQUE(tenant_id,service_id,publication_version), UNIQUE(tenant_id,service_id,request_key),
  FOREIGN KEY(tenant_id,service_id) REFERENCES gcms_s02.service_draft(tenant_id,id),
  FOREIGN KEY(tenant_id,published_by) REFERENCES gcms_s02.membership(tenant_id,user_id)
);
CREATE TABLE gcms_s02.publication_pointer (
  tenant_id text NOT NULL, service_id text NOT NULL, snapshot_id text NOT NULL,
  PRIMARY KEY(tenant_id,service_id),
  FOREIGN KEY(tenant_id,service_id,snapshot_id) REFERENCES gcms_s02.publication_snapshot(tenant_id,service_id,id)
);
CREATE TABLE gcms_s02.publication_intent (
  tenant_id text NOT NULL, service_id text NOT NULL, snapshot_id text NOT NULL,
  kind text NOT NULL DEFAULT 'publication.committed' CHECK(kind='publication.committed'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant_id,service_id,snapshot_id),
  FOREIGN KEY(tenant_id,service_id,snapshot_id) REFERENCES gcms_s02.publication_snapshot(tenant_id,service_id,id)
);

CREATE FUNCTION gcms_s02.plain_document(v text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object('type','doc','version',1,'blocks',jsonb_build_array(jsonb_build_object('type','paragraph','children',
    jsonb_build_array(jsonb_build_object('type','text','text',v)))))
$$;
-- SQL guards protect the same supported shape even against direct restricted-role writes.
CREATE FUNCTION gcms_s02.valid_document(v jsonb, maximum integer) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE b jsonb; line jsonb; part jsonb; lines jsonb; total integer:=0; blocks integer:=0; line_count integer;
BEGIN
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR v->>'type' IS DISTINCT FROM 'doc' OR v->'version' IS DISTINCT FROM '1'::jsonb OR
    NOT(v ?& ARRAY['type','version','blocks']) OR (v-ARRAY['type','version','blocks'])<>'{}'::jsonb OR
    jsonb_typeof(v->'blocks') IS DISTINCT FROM 'array' OR jsonb_array_length(v->'blocks')>100 THEN RETURN false; END IF;
  FOR b IN SELECT value FROM jsonb_array_elements(v->'blocks') LOOP
    IF blocks>0 THEN total:=total+1; END IF; blocks:=blocks+1;
    IF jsonb_typeof(b) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(b))<>2 THEN RETURN false; END IF;
    IF b->>'type' IN ('paragraph','heading') AND b ?& ARRAY['type','children'] AND (b-ARRAY['type','children'])='{}'::jsonb THEN lines:=jsonb_build_array(b->'children');
    ELSIF b->>'type'='bulletList' AND b ?& ARRAY['type','items'] AND (b-ARRAY['type','items'])='{}'::jsonb AND jsonb_typeof(b->'items')='array' AND jsonb_array_length(b->'items')<=100 THEN lines:=b->'items';
    ELSE RETURN false; END IF;
    line_count:=0;
    FOR line IN SELECT value FROM jsonb_array_elements(lines) LOOP
      IF line_count>0 THEN total:=total+1; END IF; line_count:=line_count+1;
      IF jsonb_typeof(line) IS DISTINCT FROM 'array' OR jsonb_array_length(line)>100 THEN RETURN false; END IF;
      FOR part IN SELECT value FROM jsonb_array_elements(line) LOOP
        IF jsonb_typeof(part) IS DISTINCT FROM 'object' OR jsonb_typeof(part->'text') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
        total:=total+length(part->>'text');
        IF part->>'type'='text' AND part ?& ARRAY['type','text'] AND (part-ARRAY['type','text'])='{}'::jsonb THEN NULL;
        ELSIF part->>'type'='link' AND part ?& ARRAY['type','text','href'] AND (part-ARRAY['type','text','href'])='{}'::jsonb AND jsonb_typeof(part->'href')='string'
          AND length(part->>'href')<=2048 AND part->>'href' ~* '^https?://[^/@[:space:]]+([/?#]|$)'
          AND part->>'href' !~ '[[:cntrl:][:space:]]' AND part->>'href' !~* '%(0[0-9a-f]|1[0-9a-f]|7f)' THEN NULL;
        ELSE RETURN false; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN coalesce(total<=maximum,false);
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
ALTER TABLE gcms_s02.service_draft ADD CONSTRAINT service_document_valid CHECK(body_document IS NULL OR gcms_s02.valid_document(body_document,20000));
ALTER TABLE gcms_s02.site_draft ADD CONSTRAINT site_footer_valid CHECK(gcms_s02.valid_document(footer_body,2000));

CREATE FUNCTION gcms_s02.guard_draft_compatibility() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.slug_locked AND (NEW.slug IS DISTINCT FROM OLD.slug OR NOT NEW.slug_locked) THEN RAISE EXCEPTION 'Locked slug' USING ERRCODE='23514'; END IF;
    -- Legacy S02 clients change plaintext only. Clear the rich document rather than publish stale structured text.
    IF NEW.body IS DISTINCT FROM OLD.body AND NEW.body_document IS NOT DISTINCT FROM OLD.body_document THEN NEW.body_document:=NULL; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER service_compatibility BEFORE UPDATE ON gcms_s02.service_draft FOR EACH ROW EXECUTE FUNCTION gcms_s02.guard_draft_compatibility();
CREATE FUNCTION gcms_s02.guard_site_slug() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF OLD.slug_locked AND (NEW.slug IS DISTINCT FROM OLD.slug OR NOT NEW.slug_locked) THEN RAISE EXCEPTION 'Locked slug' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER site_slug_lock BEFORE UPDATE ON gcms_s02.site_draft FOR EACH ROW EXECUTE FUNCTION gcms_s02.guard_site_slug();

CREATE FUNCTION gcms_s02.snapshot_closure(d gcms_s02.service_draft,s gcms_s02.site_draft) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object('schemaVersion',1,'locale','vi','site',jsonb_build_object('name',s.name,'footer',
    jsonb_build_object('intro',s.footer_intro,'body',s.footer_body)),'service',jsonb_build_object('slug',d.slug,'title',d.title,
    'summary',d.summary,'body',coalesce(d.body_document,gcms_s02.plain_document(d.body)),
    'seo',jsonb_build_object('title',d.seo_title,'description',d.seo_description)))
$$;
CREATE FUNCTION gcms_s02.guard_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_s02.service_draft%ROWTYPE; s gcms_s02.site_draft%ROWTYPE; latest integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id,7202));
  PERFORM gcms_s02.lock_actor(gcms_s02.current_actor(),nullif(current_setting('gcms.session_id',true),''));
  PERFORM 1 FROM gcms_s02.tenant WHERE id=NEW.tenant_id FOR SHARE;
  PERFORM 1 FROM gcms_s02.membership WHERE tenant_id=NEW.tenant_id AND user_id=gcms_s02.current_actor() FOR SHARE;
  IF NOT gcms_s02.has_membership(NEW.tenant_id) OR NEW.published_by<>gcms_s02.current_actor() OR
    NOT EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=NEW.tenant_id AND status='active') THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM gcms_s02_auth.session se LEFT JOIN gcms_s02_auth.reauth_grant g ON g.session_id=se.id
    WHERE se.id=nullif(current_setting('gcms.session_id',true),'') AND se.user_id=gcms_s02.current_actor() AND se.mfa_verified
      AND ((se.created_at<=clock_timestamp() AND se.created_at>clock_timestamp()-interval '5 minutes') OR
        (g.mfa AND g.verified_at<=clock_timestamp() AND g.verified_at>clock_timestamp()-interval '5 minutes' AND g.expires_at>clock_timestamp())))
    THEN RAISE EXCEPTION 'Reauthentication required' USING ERRCODE='42501'; END IF;
  SELECT * INTO d FROM gcms_s02.service_draft WHERE tenant_id=NEW.tenant_id AND id=NEW.service_id FOR UPDATE;
  SELECT * INTO s FROM gcms_s02.site_draft WHERE tenant_id=NEW.tenant_id FOR UPDATE;
  SELECT coalesce(max(publication_version),0) INTO latest FROM gcms_s02.publication_snapshot WHERE tenant_id=NEW.tenant_id AND service_id=NEW.service_id;
  IF d.id IS NULL OR s.tenant_id IS NULL OR NOT s.public_enabled OR d.slug IS NULL OR
      d.version<>NEW.draft_version OR s.version<>NEW.site_version OR NEW.publication_version<>latest+1 OR
      NOT gcms_s02.valid_document(coalesce(d.body_document,gcms_s02.plain_document(d.body)),20000) OR
      NEW.closure IS DISTINCT FROM gcms_s02.snapshot_closure(d,s) THEN RAISE EXCEPTION 'Publication conflict' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER publication_validation BEFORE INSERT ON gcms_s02.publication_snapshot FOR EACH ROW EXECUTE FUNCTION gcms_s02.guard_publication();
CREATE FUNCTION gcms_s02.immutable_publication() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Immutable publication' USING ERRCODE='23514'; END $$;
CREATE TRIGGER snapshot_immutable BEFORE UPDATE OR DELETE ON gcms_s02.publication_snapshot FOR EACH ROW EXECUTE FUNCTION gcms_s02.immutable_publication();
CREATE TRIGGER intent_immutable BEFORE UPDATE OR DELETE ON gcms_s02.publication_intent FOR EACH ROW EXECUTE FUNCTION gcms_s02.immutable_publication();

CREATE FUNCTION gcms_s02.guard_publication_pointer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE latest text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id,7202));
  SELECT id INTO latest FROM gcms_s02.publication_snapshot WHERE tenant_id=NEW.tenant_id AND service_id=NEW.service_id
    ORDER BY publication_version DESC LIMIT 1;
  IF NEW.snapshot_id IS DISTINCT FROM latest THEN RAISE EXCEPTION 'Publication pointer conflict' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pointer_current BEFORE INSERT OR UPDATE ON gcms_s02.publication_pointer FOR EACH ROW EXECUTE FUNCTION gcms_s02.guard_publication_pointer();
CREATE FUNCTION gcms_s02.require_publication_closure() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM gcms_s02.publication_pointer p JOIN gcms_s02.publication_intent i
      ON i.tenant_id=p.tenant_id AND i.service_id=p.service_id AND i.snapshot_id=p.snapshot_id
      JOIN gcms_s02.service_draft d ON d.tenant_id=p.tenant_id AND d.id=p.service_id
      JOIN gcms_s02.site_draft s ON s.tenant_id=p.tenant_id
      WHERE p.tenant_id=NEW.tenant_id AND p.service_id=NEW.service_id AND p.snapshot_id=NEW.id AND d.slug_locked AND s.slug_locked)
    THEN RAISE EXCEPTION 'Incomplete publication transaction' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER publication_complete AFTER INSERT ON gcms_s02.publication_snapshot
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION gcms_s02.require_publication_closure();

-- One narrow credential-free read contract. No private tables, arbitrary IDs,
-- predicates or host hints are accepted or returned. Current mapping/status wins.
CREATE FUNCTION gcms_s02.read_public_service(tenant_slug text,service_slug text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT snap.closure || jsonb_build_object('publicationId',snap.id,'publicationVersion',snap.publication_version,
    'publishedAt',snap.published_at,'canonicalUrl',s.canonical_origin||'/'||s.slug||'/dich-vu/'||d.slug)
  FROM gcms_s02.site_draft s JOIN gcms_s02.tenant t ON t.id=s.tenant_id
  JOIN gcms_s02.service_draft d ON d.tenant_id=s.tenant_id
  JOIN gcms_s02.publication_pointer p ON p.tenant_id=d.tenant_id AND p.service_id=d.id
  JOIN gcms_s02.publication_snapshot snap ON snap.tenant_id=p.tenant_id AND snap.service_id=p.service_id AND snap.id=p.snapshot_id
  WHERE gcms_s02.valid_slug(tenant_slug) AND gcms_s02.valid_slug(service_slug) AND s.slug=tenant_slug AND d.slug=service_slug
    AND t.status='active' AND s.public_enabled AND s.slug_locked AND d.slug_locked
$$;

ALTER TABLE gcms_s02.site_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_s02.site_draft FORCE ROW LEVEL SECURITY;
CREATE POLICY site_owner ON gcms_s02.site_draft TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE POLICY site_tenant ON gcms_s02.site_draft TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id) AND updated_by=gcms_s02.current_actor());
ALTER TABLE gcms_s02.publication_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_s02.publication_snapshot FORCE ROW LEVEL SECURITY;
CREATE POLICY snapshot_owner ON gcms_s02.publication_snapshot TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE POLICY snapshot_tenant ON gcms_s02.publication_snapshot TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id) AND published_by=gcms_s02.current_actor());
ALTER TABLE gcms_s02.publication_pointer ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_s02.publication_pointer FORCE ROW LEVEL SECURITY;
CREATE POLICY pointer_owner ON gcms_s02.publication_pointer TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE POLICY pointer_tenant ON gcms_s02.publication_pointer TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id));
ALTER TABLE gcms_s02.publication_intent ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_s02.publication_intent FORCE ROW LEVEL SECURITY;
CREATE POLICY intent_owner ON gcms_s02.publication_intent TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE POLICY intent_tenant ON gcms_s02.publication_intent TO gcms_s02_tenant
  USING(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id))
  WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(tenant_id));
GRANT SELECT,INSERT,UPDATE ON gcms_s02.site_draft,gcms_s02.publication_pointer TO gcms_s02_tenant;
GRANT SELECT,INSERT ON gcms_s02.publication_snapshot,gcms_s02.publication_intent TO gcms_s02_tenant;
REVOKE ALL ON FUNCTION gcms_s02.valid_slug(text),gcms_s02.plain_document(text),gcms_s02.valid_document(jsonb,integer),
  gcms_s02.snapshot_closure(gcms_s02.service_draft,gcms_s02.site_draft),gcms_s02.guard_draft_compatibility(),gcms_s02.guard_site_slug(),
  gcms_s02.guard_publication(),gcms_s02.immutable_publication(),gcms_s02.guard_publication_pointer(),
  gcms_s02.require_publication_closure(),gcms_s02.read_public_service(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_s02.valid_slug(text),gcms_s02.plain_document(text),gcms_s02.valid_document(jsonb,integer),
  gcms_s02.snapshot_closure(gcms_s02.service_draft,gcms_s02.site_draft),gcms_s02.read_public_service(text,text) TO gcms_s02_tenant;
