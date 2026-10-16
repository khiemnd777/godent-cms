-- M2 S08: preserve all prior snapshots, URLs and applied migrations.
ALTER TABLE gcms_s02.service_draft ADD COLUMN cover_image jsonb;
CREATE FUNCTION gcms_s08.valid_cover(v jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT v IS NULL OR (jsonb_typeof(v)='object' AND v ?& ARRAY['assetId','revision','alt'] AND
   (v-ARRAY['assetId','revision','alt'])='{}'::jsonb AND jsonb_typeof(v->'assetId')='string' AND
   v->>'assetId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' AND
   jsonb_typeof(v->'revision')='number' AND v->>'revision' ~ '^[1-9][0-9]{0,8}$' AND
   jsonb_typeof(v->'alt')='string' AND length(btrim(v->>'alt')) BETWEEN 1 AND 500)
$$;
ALTER TABLE gcms_s02.service_draft ADD CONSTRAINT service_cover_shape CHECK(gcms_s08.valid_cover(cover_image) IS TRUE);

CREATE TABLE gcms_s08.publication_head (
 tenant_id text NOT NULL,service_id text NOT NULL,publication_version integer NOT NULL DEFAULT 0,
 revision integer NOT NULL DEFAULT 0,active_snapshot_id text,pending_snapshot_id text,pending_transaction bigint,
 PRIMARY KEY(tenant_id,service_id),FOREIGN KEY(tenant_id,service_id) REFERENCES gcms_s02.service_draft(tenant_id,id),
 FOREIGN KEY(tenant_id,service_id,active_snapshot_id) REFERENCES gcms_s02.publication_snapshot(tenant_id,service_id,id),
 CHECK(publication_version>=0 AND revision>=0)
);
INSERT INTO gcms_s08.publication_head(tenant_id,service_id,publication_version,revision,active_snapshot_id)
 SELECT d.tenant_id,d.id,coalesce((SELECT max(s.publication_version) FROM gcms_s02.publication_snapshot s WHERE s.tenant_id=d.tenant_id AND s.service_id=d.id),0),
 coalesce((SELECT max(s.publication_version) FROM gcms_s02.publication_snapshot s WHERE s.tenant_id=d.tenant_id AND s.service_id=d.id),0),p.snapshot_id
 FROM gcms_s02.service_draft d LEFT JOIN gcms_s02.publication_pointer p ON p.tenant_id=d.tenant_id AND p.service_id=d.id;

CREATE TABLE gcms_s08.editorial_revision (
 tenant_id text NOT NULL,resource text NOT NULL CHECK(resource IN ('service','site')),resource_id text NOT NULL,
 id text NOT NULL DEFAULT gen_random_uuid()::text,version integer NOT NULL CHECK(version>0),
 kind text NOT NULL CHECK(kind IN ('baseline','created','saved','restored')),content jsonb NOT NULL,
 actor_id text,actor_name text,restored_from text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,resource,resource_id,version),
 FOREIGN KEY(tenant_id) REFERENCES gcms_s02.tenant(id),
 FOREIGN KEY(tenant_id,restored_from) REFERENCES gcms_s08.editorial_revision(tenant_id,id)
);
CREATE INDEX editorial_keyset ON gcms_s08.editorial_revision(tenant_id,resource,resource_id,version DESC,id DESC);
CREATE TABLE gcms_s08.operation_receipt (
 tenant_id text NOT NULL,operation_id text NOT NULL,actor_id text NOT NULL,resource text NOT NULL,
 resource_id text NOT NULL,command jsonb NOT NULL,applied_version integer NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,operation_id),FOREIGN KEY(tenant_id) REFERENCES gcms_s02.tenant(id)
);
CREATE TABLE gcms_s08.publication_event (
 tenant_id text NOT NULL,service_id text NOT NULL,id text NOT NULL DEFAULT gen_random_uuid()::text,
 revision integer NOT NULL,kind text NOT NULL CHECK(kind IN ('published','unpublished')),snapshot_id text,
 actor_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,service_id,revision),
 FOREIGN KEY(tenant_id,service_id) REFERENCES gcms_s02.service_draft(tenant_id,id)
);

CREATE FUNCTION gcms_s08.service_content(d gcms_s02.service_draft) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('slug',d.slug,'title',d.title,'summary',d.summary,'body',coalesce(d.body_document,gcms_s02.plain_document(d.body)),
   'seo',jsonb_build_object('title',d.seo_title,'description',d.seo_description))||
   CASE WHEN d.cover_image IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('coverImage',d.cover_image) END
$$;
INSERT INTO gcms_s08.editorial_revision(tenant_id,resource,resource_id,version,kind,content,actor_id,actor_name)
 SELECT d.tenant_id,'service',d.id,d.version,'baseline',gcms_s08.service_content(d),d.updated_by,u.name
 FROM gcms_s02.service_draft d LEFT JOIN gcms_s02_auth."user" u ON u.id=d.updated_by;
INSERT INTO gcms_s08.editorial_revision(tenant_id,resource,resource_id,version,kind,content,actor_id,actor_name)
 SELECT s.tenant_id,'site',s.tenant_id,s.version,'baseline',jsonb_build_object('name',s.name,'footer',jsonb_build_object('intro',s.footer_intro,'body',s.footer_body)),s.updated_by,u.name
 FROM gcms_s02.site_draft s LEFT JOIN gcms_s02_auth."user" u ON u.id=s.updated_by;

CREATE FUNCTION gcms_s08.capture_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE resource_kind text;resource_key text;document jsonb;source_key text:=nullif(current_setting('gcms.restore_from',true),'');actor_label text;
BEGIN
 resource_kind:=CASE WHEN TG_TABLE_NAME='service_draft' THEN 'service' ELSE 'site' END;
 IF resource_kind='service' THEN
   resource_key:=NEW.id;document:=gcms_s08.service_content(NEW);
   INSERT INTO gcms_s08.publication_head(tenant_id,service_id) VALUES(NEW.tenant_id,NEW.id) ON CONFLICT DO NOTHING;
 ELSE resource_key:=NEW.tenant_id;document:=jsonb_build_object('name',NEW.name,'footer',jsonb_build_object('intro',NEW.footer_intro,'body',NEW.footer_body)); END IF;
 IF TG_OP='UPDATE' AND NEW.version=OLD.version THEN RETURN NEW; END IF;
 IF source_key IS NOT NULL AND NOT EXISTS(SELECT 1 FROM gcms_s08.editorial_revision h WHERE h.tenant_id=NEW.tenant_id AND h.resource=resource_kind AND h.resource_id=resource_key AND h.id=source_key)
   THEN RAISE EXCEPTION 'Restoration source conflict' USING ERRCODE='23514'; END IF;
 SELECT name INTO actor_label FROM gcms_s02_auth."user" WHERE id=NEW.updated_by;
 INSERT INTO gcms_s08.editorial_revision(tenant_id,resource,resource_id,version,kind,content,actor_id,actor_name,restored_from)
 VALUES(NEW.tenant_id,resource_kind,resource_key,NEW.version,CASE WHEN source_key IS NOT NULL THEN 'restored' WHEN TG_OP='INSERT' THEN 'created' ELSE 'saved' END,
   document,NEW.updated_by,actor_label,source_key);
 RETURN NEW;
END $$;
CREATE TRIGGER service_revision AFTER INSERT OR UPDATE ON gcms_s02.service_draft FOR EACH ROW EXECUTE FUNCTION gcms_s08.capture_revision();
CREATE TRIGGER site_revision AFTER INSERT OR UPDATE ON gcms_s02.site_draft FOR EACH ROW EXECUTE FUNCTION gcms_s08.capture_revision();

CREATE FUNCTION gcms_s08.guard_draft_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.cover_image IS NOT NULL AND NOT EXISTS(SELECT 1 FROM gcms_s07.asset a WHERE a.tenant_id=NEW.tenant_id AND a.id=NEW.cover_image->>'assetId' AND a.revision>=(NEW.cover_image->>'revision')::integer)
 THEN RAISE EXCEPTION 'Cross-tenant or future media reference' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER draft_media_reference BEFORE INSERT OR UPDATE ON gcms_s02.service_draft FOR EACH ROW EXECUTE FUNCTION gcms_s08.guard_draft_reference();

CREATE OR REPLACE FUNCTION gcms_s02.snapshot_closure(d gcms_s02.service_draft,s gcms_s02.site_draft) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('schemaVersion',2,'locale','vi','site',jsonb_build_object('name',s.name,'footer',jsonb_build_object('intro',s.footer_intro,'body',s.footer_body)),
 'service',gcms_s08.service_content(d))
$$;
CREATE FUNCTION gcms_s08.guard_snapshot_media() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE image jsonb:=NEW.closure->'service'->'coverImage';
BEGIN
 IF image IS NOT NULL AND image<>'null'::jsonb AND (NOT gcms_s08.valid_cover(image) OR NOT gcms_s07.publishable(NEW.tenant_id,image->>'assetId',(image->>'revision')::integer))
 THEN RAISE EXCEPTION 'Media not eligible' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER snapshot_media BEFORE INSERT ON gcms_s02.publication_snapshot FOR EACH ROW EXECUTE FUNCTION gcms_s08.guard_snapshot_media();
CREATE FUNCTION gcms_s08.track_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE gcms_s08.publication_head SET publication_version=NEW.publication_version,pending_snapshot_id=NEW.id,pending_transaction=txid_current()
 WHERE tenant_id=NEW.tenant_id AND service_id=NEW.service_id;
 RETURN NEW;
END $$;
CREATE TRIGGER snapshot_head AFTER INSERT ON gcms_s02.publication_snapshot FOR EACH ROW EXECUTE FUNCTION gcms_s08.track_snapshot();
-- A previously published snapshot is history, never authorization to recreate a pointer.
CREATE OR REPLACE FUNCTION gcms_s02.guard_publication_pointer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE h gcms_s08.publication_head%ROWTYPE;latest text;
BEGIN
 PERFORM gcms_s05.authorize(NEW.tenant_id,true);
 IF NOT gcms_s02.has_recent_auth() THEN RAISE EXCEPTION 'Recent authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO h FROM gcms_s08.publication_head WHERE tenant_id=NEW.tenant_id AND service_id=NEW.service_id FOR UPDATE;
 SELECT id INTO latest FROM gcms_s02.publication_snapshot WHERE tenant_id=NEW.tenant_id AND service_id=NEW.service_id ORDER BY publication_version DESC LIMIT 1;
 IF NEW.snapshot_id IS DISTINCT FROM latest OR h.pending_snapshot_id IS DISTINCT FROM NEW.snapshot_id OR h.pending_transaction IS DISTINCT FROM txid_current()
 THEN RAISE EXCEPTION 'Publication pointer requires a new snapshot in this transaction' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION gcms_s08.track_pointer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE stamp_revision integer;tenant_key text;service_key text;snapshot_key text;
BEGIN
 tenant_key:=CASE WHEN TG_OP='DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
 service_key:=CASE WHEN TG_OP='DELETE' THEN OLD.service_id ELSE NEW.service_id END;
 snapshot_key:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.snapshot_id END;
 UPDATE gcms_s08.publication_head SET active_snapshot_id=snapshot_key,revision=revision+1,pending_snapshot_id=NULL,pending_transaction=NULL
 WHERE tenant_id=tenant_key AND service_id=service_key RETURNING revision INTO stamp_revision;
 INSERT INTO gcms_s08.publication_event(tenant_id,service_id,revision,kind,snapshot_id,actor_id)
 VALUES(tenant_key,service_key,stamp_revision,CASE WHEN TG_OP='DELETE' THEN 'unpublished' ELSE 'published' END,snapshot_key,gcms_s02.current_actor());
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER pointer_head AFTER INSERT OR UPDATE OR DELETE ON gcms_s02.publication_pointer FOR EACH ROW EXECUTE FUNCTION gcms_s08.track_pointer();

CREATE FUNCTION gcms_s08.unpublish(p_tenant text,p_service text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old gcms_s08.operation_receipt%ROWTYPE;h gcms_s08.publication_head%ROWTYPE;d gcms_s02.service_draft%ROWTYPE;
BEGIN
 PERFORM gcms_s05.authorize(p_tenant,true);
 IF NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}'; END IF;
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT(c ?& ARRAY['operationId','expectedDraftVersion','expectedPublicationVersion','expectedPublicationRevision']) OR
   (c-ARRAY['operationId','expectedDraftVersion','expectedPublicationVersion','expectedPublicationRevision'])<>'{}'::jsonb OR
   c->>'operationId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
 SELECT * INTO old FROM gcms_s08.operation_receipt WHERE tenant_id=p_tenant AND operation_id=c->>'operationId';
 IF old.operation_id IS NOT NULL THEN
   IF old.actor_id<>gcms_s02.current_actor() OR old.resource<>'unpublish' OR old.resource_id<>p_service OR old.command<>c THEN RETURN '{"code":"OPERATION_CONFLICT"}'; END IF;
   RETURN jsonb_build_object('replayed',true,'operationId',old.operation_id);
 END IF;
 SELECT * INTO d FROM gcms_s02.service_draft WHERE tenant_id=p_tenant AND id=p_service FOR UPDATE;
 SELECT * INTO h FROM gcms_s08.publication_head WHERE tenant_id=p_tenant AND service_id=p_service FOR UPDATE;
 IF d.id IS NULL THEN RETURN '{"code":"NOT_FOUND"}'; END IF;
 IF h.active_snapshot_id IS NULL OR d.version<>(c->>'expectedDraftVersion')::integer OR h.publication_version<>(c->>'expectedPublicationVersion')::integer OR h.revision<>(c->>'expectedPublicationRevision')::integer
   THEN RETURN '{"code":"VERSION_CONFLICT"}'; END IF;
 DELETE FROM gcms_s02.publication_pointer WHERE tenant_id=p_tenant AND service_id=p_service;
 INSERT INTO gcms_s08.operation_receipt(tenant_id,operation_id,actor_id,resource,resource_id,command,applied_version)
 VALUES(p_tenant,c->>'operationId',gcms_s02.current_actor(),'unpublish',p_service,c,h.revision+1);
 INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id) VALUES(gen_random_uuid()::text,p_tenant,gcms_s02.current_actor(),'service.unpublished',p_service);
 RETURN jsonb_build_object('replayed',false,'operationId',c->>'operationId');
END $$;

CREATE OR REPLACE FUNCTION gcms_s07.public_reference_exists(p_tenant text,p_asset text,p_revision integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM gcms_s02.publication_pointer p JOIN gcms_s02.publication_snapshot s ON s.tenant_id=p.tenant_id AND s.service_id=p.service_id AND s.id=p.snapshot_id
 WHERE p.tenant_id=p_tenant AND s.closure->'service'->'coverImage'->>'assetId'=p_asset AND s.closure->'service'->'coverImage'->>'revision'=p_revision::text)
$$;
CREATE FUNCTION gcms_s08.eligible_closure(p_tenant text,closure jsonb) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN closure->'service'->'coverImage' IS NOT NULL AND NOT gcms_s07.publishable(p_tenant,closure->'service'->'coverImage'->>'assetId',(closure->'service'->'coverImage'->>'revision')::integer)
   THEN closure#-'{service,coverImage}' ELSE closure END
$$;
CREATE OR REPLACE FUNCTION gcms_s02.read_public_service(tenant_slug text,service_slug text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT gcms_s08.eligible_closure(s.tenant_id,snap.closure)||jsonb_build_object('publicationId',snap.id,'publicationVersion',snap.publication_version,
 'publishedAt',snap.published_at,'canonicalUrl',s.canonical_origin||'/'||s.slug||'/dich-vu/'||d.slug)
 FROM gcms_s02.site_draft s JOIN gcms_s02.tenant t ON t.id=s.tenant_id JOIN gcms_s02.service_draft d ON d.tenant_id=s.tenant_id
 JOIN gcms_s02.publication_pointer p ON p.tenant_id=d.tenant_id AND p.service_id=d.id
 JOIN gcms_s02.publication_snapshot snap ON snap.tenant_id=p.tenant_id AND snap.service_id=p.service_id AND snap.id=p.snapshot_id
 WHERE gcms_s02.valid_slug(tenant_slug) AND gcms_s02.valid_slug(service_slug) AND s.slug=tenant_slug AND d.slug=service_slug
 AND t.status='active' AND s.public_enabled AND s.slug_locked AND d.slug_locked
$$;

DO $$ DECLARE n text;BEGIN
 FOREACH n IN ARRAY ARRAY['publication_head','editorial_revision','operation_receipt','publication_event'] LOOP
 EXECUTE format('ALTER TABLE gcms_s08.%I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('ALTER TABLE gcms_s08.%I FORCE ROW LEVEL SECURITY',n);
 EXECUTE format('CREATE POLICY owner_only ON gcms_s08.%I TO gcms_s02_owner USING(true) WITH CHECK(true)',n);
 EXECUTE format('CREATE POLICY tenant_read ON gcms_s08.%I FOR SELECT TO gcms_s02_tenant USING(tenant_id=nullif(current_setting(''gcms.tenant_id'',true),'''') AND gcms_s02.has_current_membership(tenant_id))',n);
 END LOOP;
END $$;
GRANT SELECT ON ALL TABLES IN SCHEMA gcms_s08 TO gcms_s02_tenant;
GRANT INSERT ON gcms_s08.operation_receipt TO gcms_s02_tenant;
CREATE TRIGGER revision_immutable BEFORE UPDATE OR DELETE ON gcms_s08.editorial_revision FOR EACH ROW EXECUTE FUNCTION gcms_s02.immutable_publication();
CREATE TRIGGER event_immutable BEFORE UPDATE OR DELETE ON gcms_s08.publication_event FOR EACH ROW EXECUTE FUNCTION gcms_s02.immutable_publication();
CREATE POLICY receipt_insert ON gcms_s08.operation_receipt FOR INSERT TO gcms_s02_tenant WITH CHECK(tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND actor_id=gcms_s02.current_actor() AND gcms_s02.has_current_membership(tenant_id));
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gcms_s08 FROM PUBLIC;
GRANT USAGE ON SCHEMA gcms_s08 TO gcms_s02_tenant;
GRANT EXECUTE ON FUNCTION gcms_s08.unpublish(text,text,jsonb),gcms_s08.valid_cover(jsonb),gcms_s08.service_content(gcms_s02.service_draft),gcms_s08.eligible_closure(text,jsonb) TO gcms_s02_tenant;
