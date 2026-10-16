-- M5 suspended reads and exact exposure-reducing commands. No caller-settable bypass.
DO $$ BEGIN IF current_user<>'gcms_s02_owner' THEN RAISE EXCEPTION 'M5 owner required';END IF;END $$;
CREATE FUNCTION gcms_m5.is_safety_command(family text,c jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_typeof(c)='object' AND CASE WHEN family='media' THEN
  c->>'type'='withdrawal' AND c ?& ARRAY['type','reason'] AND (c-ARRAY['type','reason'])='{}' AND jsonb_typeof(c->'reason')='string' AND length(btrim(c->>'reason')) BETWEEN 1 AND 500
 WHEN family IN('m3','m4') THEN
  gcms_m3.uuid(c->>'operationId') AND gcms_m3.version(c->'expectedVersion',family='m4') AND CASE c->>'type'
   WHEN 'unpublish' THEN c ?& ARRAY['type','operationId','expectedVersion','expectedPublicationRevision'] AND (c-ARRAY['type','operationId','expectedVersion','expectedPublicationRevision'])='{}' AND gcms_m3.version(c->'expectedPublicationRevision',true)
   WHEN 'withdraw' THEN c ?& ARRAY['type','operationId','expectedVersion','permissionId','reason'] AND (c-ARRAY['type','operationId','expectedVersion','permissionId','reason'])='{}' AND gcms_m3.uuid(c->>'permissionId') AND jsonb_typeof(c->'reason')='string' AND length(btrim(c->>'reason')) BETWEEN 1 AND 500
   ELSE false END ELSE false END,false)
$$;
CREATE FUNCTION gcms_m5.require_command(t text,family text,c jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN
 IF gcms_m5.is_safety_command(family,c) THEN PERFORM gcms_m5.require_safety(t);
 ELSE
  IF (family IN('m3','m4') AND c->>'type' IN('unpublish','withdraw')) OR (family='media' AND c->>'type'='withdrawal') THEN RAISE EXCEPTION 'Invalid safety command' USING ERRCODE='23514';END IF;
  PERFORM gcms_s05.authorize(t,true);IF NOT gcms_m5.is_live(t) THEN RAISE EXCEPTION 'Business write denied' USING ERRCODE='42501';END IF;
 END IF;
END $$;

-- A current authorized private preview can read its immutable pinned text while
-- public serving is suspended. Anonymous project functions remain active-only.
CREATE FUNCTION gcms_m5.private_reference(t text,ref jsonb,depth integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE k text:=ref->>'kind';r text:=ref->>'id';l text:=coalesce(ref->>'locale','vi');pub text:=ref->>'publicationId';doc jsonb;pins jsonb;version_value integer;legacy_value boolean:=false;child jsonb;children jsonb:='[]';pin jsonb;site_slug text;BEGIN
 PERFORM gcms_m5.require_read(t);IF depth<0 OR depth>3 OR k='config' OR NOT gcms_m4.kind(k) OR NOT gcms_m4.locale(l) THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM gcms_m4.variant d WHERE d.tenant_id=t AND d.kind=k AND d.resource_id=r AND d.locale=l AND d.publication_version>0) THEN
  SELECT p.content,p.reference_pins,p.publication_version INTO doc,pins,version_value FROM gcms_m4.variant d JOIN gcms_m4.publication p ON p.tenant_id=d.tenant_id AND p.kind=d.kind AND p.resource_id=d.resource_id AND p.locale=d.locale AND p.generation=d.generation
  WHERE d.tenant_id=t AND d.kind=k AND d.resource_id=r AND d.locale=l AND d.active_publication_id IS NOT NULL AND p.id=pub AND (NOT(ref ? 'generation') OR (ref->>'generation')::integer=d.generation) AND gcms_m4.text_allowed(t,k,r,l,p.draft_version);
 ELSIF l='vi' AND k='service' AND gcms_m4.legacy_eligible(t,k,r) THEN
  legacy_value:=true;SELECT p.closure->'service',coalesce(links.reference_pins,'[]'),p.publication_version INTO doc,pins,version_value FROM gcms_s02.publication_snapshot p JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=p.tenant_id AND ptr.service_id=p.service_id
  JOIN gcms_m3.service_publication_generation g ON g.tenant_id=p.tenant_id AND g.service_id=p.service_id AND g.publication_id=p.id LEFT JOIN gcms_m3.service_generation current_generation ON current_generation.tenant_id=p.tenant_id AND current_generation.service_id=p.service_id LEFT JOIN gcms_m3.service_publication_links links ON links.tenant_id=p.tenant_id AND links.service_id=p.service_id AND links.publication_id=p.id
  WHERE p.tenant_id=t AND p.service_id=r AND p.id=pub AND g.generation=coalesce(current_generation.generation,0) AND (NOT(ref ? 'generation') OR (ref->>'generation')::integer=g.generation);
 ELSIF l='vi' AND gcms_m3.kind(k) AND gcms_m4.legacy_eligible(t,k,r) THEN
  legacy_value:=true;SELECT p.content,p.reference_pins,p.publication_version INTO doc,pins,version_value FROM gcms_m3.resource d JOIN gcms_m3.publication p ON p.tenant_id=d.tenant_id AND p.resource_id=d.id AND p.generation=d.generation WHERE d.tenant_id=t AND d.kind=k AND d.id=r AND d.active_publication_id IS NOT NULL AND p.id=pub AND (NOT(ref ? 'generation') OR (ref->>'generation')::integer=d.generation) AND gcms_m3.text_allowed(t,r,p.draft_version,k);
 END IF;
 IF doc IS NULL THEN RETURN NULL;END IF;IF k='service' THEN doc:=doc||jsonb_build_object('kind','service');END IF;
 IF octet_length(doc::text)>1048576 THEN RAISE EXCEPTION 'Private preview graph limit' USING ERRCODE='23514';END IF;
 FOR pin IN SELECT value FROM jsonb_array_elements(coalesce(pins,'[]')) LOOP
  child:=gcms_m5.private_reference(t,pin||jsonb_build_object('locale',coalesce(pin->>'locale',l)),depth+1);
  IF child IS NULL AND pin->'required'='true'::jsonb THEN RETURN NULL;END IF;IF child IS NOT NULL THEN IF gcms_m3.graph_nodes(children||jsonb_build_array(child))>250 OR octet_length(children::text)+octet_length(child::text)>1048576 THEN RAISE EXCEPTION 'Private preview graph limit' USING ERRCODE='23514';END IF;children:=children||jsonb_build_array(child);END IF;
 END LOOP;
 IF k='price' AND (NOT EXISTS(SELECT 1 FROM jsonb_array_elements(children)x WHERE x->>'kind'='service') OR (EXISTS(SELECT 1 FROM jsonb_array_elements(pins)x WHERE x->>'kind'='location') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(children)x WHERE x->>'kind'='location'))) THEN RETURN NULL;END IF;
 IF gcms_m3.graph_nodes(children)>250 OR octet_length(doc::text)+octet_length(children::text)>1048576 THEN RAISE EXCEPTION 'Private preview graph limit' USING ERRCODE='23514';END IF;
 SELECT slug INTO site_slug FROM gcms_s02.site_draft WHERE tenant_id=t;
 RETURN jsonb_build_object('id',r,'kind',k,'locale',l,'legacy',legacy_value,'publicationId',pub,'publicationVersion',version_value,'title',doc->'title','slug',doc->'slug','path',gcms_m4.path(site_slug,l,k,doc->>'slug'),'content',doc,'references',children,'media','[]'::jsonb);
END $$;
CREATE FUNCTION gcms_m5.private_references(t text,pins jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE pin jsonb;child jsonb;out jsonb:='[]';BEGIN
 PERFORM gcms_m5.require_read(t);IF jsonb_array_length(pins)>250 THEN RAISE EXCEPTION 'Private preview graph limit' USING ERRCODE='23514';END IF;
 FOR pin IN SELECT value FROM jsonb_array_elements(pins) LOOP child:=gcms_m5.private_reference(t,pin);IF child IS NOT NULL THEN IF gcms_m3.graph_nodes(out||jsonb_build_array(child))>250 OR octet_length(out::text)+octet_length(child::text)>1048576 THEN RAISE EXCEPTION 'Private preview graph limit' USING ERRCODE='23514';END IF;out:=out||jsonb_build_array(child);END IF;END LOOP;
 IF gcms_m3.graph_nodes(out)>250 OR octet_length(out::text)>1048576 THEN RAISE EXCEPTION 'Private preview graph limit' USING ERRCODE='23514';END IF;RETURN out;
END $$;

-- Only the validated legacy-unpublish command can issue this transaction-local
-- authorization. Runtime tenant/platform roles cannot insert or select it.
CREATE TABLE gcms_m5.pointer_delete_authorization(tenant_id text NOT NULL,service_id text NOT NULL,transaction_id bigint NOT NULL,actor_id text NOT NULL,session_id text NOT NULL,snapshot_id text NOT NULL,operation_id text NOT NULL,PRIMARY KEY(tenant_id,service_id,transaction_id));
ALTER TABLE gcms_m5.pointer_delete_authorization ENABLE ROW LEVEL SECURITY;ALTER TABLE gcms_m5.pointer_delete_authorization FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_all ON gcms_m5.pointer_delete_authorization TO gcms_s02_owner USING(true) WITH CHECK(true);
REVOKE ALL ON gcms_m5.pointer_delete_authorization FROM PUBLIC,gcms_s02_tenant,gcms_s02_platform,gcms_s02_auth,gcms_s04_intake;
CREATE FUNCTION gcms_m5.guard_pointer_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN
 IF gcms_m5.cleanup_authorized(OLD.tenant_id) THEN RETURN OLD;END IF;
 PERFORM gcms_m5.require_safety(OLD.tenant_id);
 DELETE FROM gcms_m5.pointer_delete_authorization WHERE tenant_id=OLD.tenant_id AND service_id=OLD.service_id AND transaction_id=txid_current() AND actor_id=gcms_s02.current_actor() AND session_id=current_setting('gcms.session_id',true) AND snapshot_id=OLD.snapshot_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Validated unpublish command required' USING ERRCODE='42501';END IF;RETURN OLD;
END $$;
CREATE TRIGGER m5_pointer_delete_guard BEFORE DELETE ON gcms_s02.publication_pointer FOR EACH ROW EXECUTE FUNCTION gcms_m5.guard_pointer_delete();
REVOKE ALL ON FUNCTION gcms_m5.is_safety_command(text,jsonb),gcms_m5.require_command(text,text,jsonb),gcms_m5.private_reference(text,jsonb,integer),gcms_m5.private_references(text,jsonb),gcms_m5.guard_pointer_delete() FROM PUBLIC;

CREATE FUNCTION gcms_m5.private_current_reference(t text,k text,r text,l text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE d jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);d:=gcms_m4.variant_view(t,k,r,l);IF d->>'publicationId' IS NULL THEN RETURN NULL;END IF;
 PERFORM gcms_m4.admit_public(t,k,r,l,d->>'publicationId');
 RETURN gcms_m5.private_reference(t,jsonb_build_object('kind',k,'id',r,'locale',l,'publicationId',d->>'publicationId'));
END $$;
CREATE OR REPLACE FUNCTION gcms_m4.preview_refs(t text,k text,r text,l text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE draft jsonb;pins jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);draft:=gcms_m4.variant_view(t,k,r,l);IF draft IS NULL THEN RETURN NULL;END IF;
 BEGIN pins:=gcms_m4.pin_refs(t,k,r,l,draft->'content');PERFORM gcms_m4.admit_refs(t,k,l,draft->'content',pins);EXCEPTION WHEN check_violation THEN RETURN '[]';END;
 RETURN gcms_m5.private_references(t,pins);
END $$;
CREATE OR REPLACE FUNCTION gcms_m4.private_live(t text,k text,r text,l text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN
 PERFORM gcms_m5.require_read(t);RETURN gcms_m5.private_current_reference(t,k,r,l) IS NOT NULL;
END $$;
CREATE OR REPLACE FUNCTION gcms_m4.private_target_path(t text,target jsonb,allow_fallback boolean) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE child jsonb;l text:=target->>'locale';BEGIN
 PERFORM gcms_m5.require_read(t);IF NOT gcms_m4.target(target) THEN RETURN NULL;END IF;
 child:=gcms_m5.private_current_reference(t,target->>'kind',target->>'id',l);
 IF child IS NULL AND l='en' AND allow_fallback THEN l:='vi';child:=gcms_m5.private_current_reference(t,target->>'kind',target->>'id',l);END IF;
 IF child IS NULL THEN RETURN NULL;END IF;RETURN jsonb_build_object('path',child->'path','actualLocale',l,'fallback',l IS DISTINCT FROM target->>'locale');
END $$;
CREATE OR REPLACE FUNCTION gcms_m4.reference_options(t text,k text,l text,q text,after_id text,lim integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE row record;page jsonb;out jsonb:='[]';BEGIN
 PERFORM gcms_m5.require_read(t);IF lim NOT BETWEEN 1 AND 51 OR length(q)>160 OR NOT gcms_m4.kind(k) OR NOT gcms_m4.locale(l) THEN RAISE EXCEPTION 'Invalid options' USING ERRCODE='23514';END IF;
 FOR row IN SELECT * FROM gcms_m4.public_candidates(t,k)c WHERE after_id IS NULL OR c.id>after_id ORDER BY c.id LOOP
  page:=gcms_m5.private_current_reference(t,k,row.id,l);IF page IS NULL OR (q<>'' AND position(q IN lower(page->'content'->>'title'))=0 AND position(q IN row.slug)=0) THEN CONTINUE;END IF;
  out:=out||jsonb_build_array(jsonb_build_object('id',row.id,'kind',k,'locale',l,'publicationId',page->'publicationId','publicationVersion',page->'publicationVersion','title',page->'content'->'title','slug',row.slug,'content',page->'content'));IF jsonb_array_length(out)>=lim THEN EXIT;END IF;
 END LOOP;RETURN out;
END $$;
REVOKE ALL ON FUNCTION gcms_m5.private_current_reference(text,text,text,text) FROM PUBLIC;

-- Exact current definitions captured before M5, with only the stated guards/call seams changed.
CREATE OR REPLACE FUNCTION gcms_m3.command(t text, r text, c jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$DECLARE doc jsonb;pins jsonb;site jsonb;BEGIN
 PERFORM gcms_m5.require_command(t,'m3',c);
 -- Replays retain their original result and never recreate an active pointer.
 IF c->>'type'='publish' AND NOT EXISTS(SELECT 1 FROM gcms_m3.receipt WHERE tenant_id=t AND operation_id=c->>'operationId') THEN
  SELECT content INTO doc FROM gcms_m3.resource WHERE tenant_id=t AND id=r;
  IF doc IS NOT NULL THEN
   SELECT jsonb_build_object('name',s.name,'footer',jsonb_build_object('intro',s.footer_intro,'body',s.footer_body)) INTO site FROM gcms_s02.site_draft s WHERE s.tenant_id=t;
   pins:=gcms_m3.pin_refs(t,r,doc->'references');PERFORM gcms_m3.admit_references(t,pins,jsonb_build_object('content',doc,'site',site));
  END IF;
 END IF;
 RETURN gcms_m3.command_before_budget(t,r,c);
END $function$;

CREATE OR REPLACE FUNCTION gcms_m3.command_before_budget(t text, r text, c jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$DECLARE p gcms_m3.permission%ROWTYPE;out jsonb;keys text[];BEGIN
 PERFORM gcms_m5.require_command(t,'m3',c);
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
END $function$;

CREATE OR REPLACE FUNCTION gcms_m3.command_before_integrity(t text, r text, c jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE d gcms_m3.resource%ROWTYPE;old gcms_m3.receipt%ROWTYPE;s gcms_s02.site_draft%ROWTYPE;source gcms_m3.revision%ROWTYPE;perm gcms_m3.permission%ROWTYPE;doc jsonb;pins jsonb;asset jsonb;out jsonb;pid text;scope_key text;action text:=c->>'type';BEGIN
 PERFORM gcms_m5.require_command(t,'m3',c);
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
END $function$;

CREATE OR REPLACE FUNCTION gcms_m4.command(t text, k text, r text, l text, c jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$DECLARE old gcms_m4.receipt%ROWTYPE;d gcms_m4.variant%ROWTYPE;out jsonb;BEGIN
 IF c->>'type' IS DISTINCT FROM 'purge_retry' THEN RETURN gcms_m4.command_before_permission_retry(t,k,r,l,c);END IF;
 PERFORM gcms_m5.require_command(t,'m4',c);
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT(c ?& ARRAY['type','operationId','expectedVersion','permissionId']) OR (c-ARRAY['type','operationId','expectedVersion','permissionId'])<>'{}' OR gcms_m3.uuid(r) IS NOT TRUE OR gcms_m4.kind(k) IS NOT TRUE OR gcms_m4.locale(l) IS NOT TRUE OR gcms_m3.uuid(c->>'operationId') IS NOT TRUE OR jsonb_typeof(c->'operationId') IS DISTINCT FROM 'string' OR gcms_m3.uuid(c->>'permissionId') IS NOT TRUE OR jsonb_typeof(c->'permissionId') IS DISTINCT FROM 'string' OR gcms_m3.version(c->'expectedVersion') IS NOT TRUE THEN RAISE EXCEPTION 'Invalid permission retry' USING ERRCODE='23514';END IF;
 IF NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}';END IF;
 SELECT * INTO old FROM gcms_m4.receipt WHERE tenant_id=t AND operation_id=c->>'operationId';IF old.tenant_id IS NOT NULL THEN
  IF old.kind<>k OR old.resource_id<>r OR old.locale<>l OR old.actor_id<>gcms_s02.current_actor() OR old.command<>c THEN RAISE EXCEPTION 'Operation conflict' USING ERRCODE='23514';END IF;RETURN old.result||'{"replayed":true}';
 END IF;
 SELECT * INTO d FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l FOR UPDATE;IF d.resource_id IS NULL THEN RETURN '{"code":"NOT_FOUND"}';END IF;IF d.version<>(c->>'expectedVersion')::integer THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='23514';END IF;
 UPDATE gcms_m4.purge_job j SET status='pending',attempts=0,failure_code=NULL,lease_until=NULL,worker_id=NULL,completed_at=NULL WHERE j.tenant_id=t AND j.permission_id=c->>'permissionId' AND j.status='failed' AND EXISTS(SELECT 1 FROM gcms_m4.permission p WHERE p.tenant_id=t AND p.id=j.permission_id AND p.kind=k AND p.resource_id=r AND p.locale=l AND p.withdrawn_at IS NOT NULL);
 IF NOT FOUND THEN RAISE EXCEPTION 'No retryable purge' USING ERRCODE='23514';END IF;
 out:=jsonb_build_object('operationId',c->>'operationId','replayed',false);INSERT INTO gcms_m4.receipt(tenant_id,operation_id,kind,resource_id,locale,actor_id,command,result) VALUES(t,c->>'operationId',k,r,l,gcms_s02.current_actor(),c,out);INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id) VALUES(gen_random_uuid()::text,t,gcms_s02.current_actor(),'m4.purge_retry',r);RETURN out;
END $function$;

CREATE OR REPLACE FUNCTION gcms_m4.command_before_permission_retry(t text, k text, r text, l text, c jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$DECLARE out jsonb;d gcms_m4.variant%ROWTYPE;ref jsonb;item jsonb;s jsonb;doc jsonb;BEGIN
 PERFORM gcms_m5.require_command(t,'m4',c);
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
END $function$;

CREATE OR REPLACE FUNCTION gcms_m4.command_before_scope_integrity(t text, k text, r text, l text, c jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE d gcms_m4.variant%ROWTYPE;old gcms_m4.receipt%ROWTYPE;h gcms_m4.revision%ROWTYPE;s gcms_s02.site_draft%ROWTYPE;doc jsonb;keys text[];action text:=c->>'type';pins jsonb;pid text;out jsonb;slug_value text;legacy_state jsonb;initial_version integer;a jsonb;scope_key_value text;perm gcms_m4.permission%ROWTYPE;BEGIN
 PERFORM gcms_m5.require_command(t,'m4',c);
 IF NOT gcms_m4.kind(k) OR NOT gcms_m4.locale(l) OR NOT gcms_m3.uuid(r) OR NOT gcms_m3.uuid(c->>'operationId') THEN RAISE EXCEPTION 'Invalid command identity' USING ERRCODE='23514';END IF;
 keys:=CASE action WHEN 'create' THEN ARRAY['type','operationId','content'] WHEN 'save' THEN ARRAY['type','operationId','expectedVersion','content','expectedLegacyState'] WHEN 'publish' THEN ARRAY['type','operationId','expectedVersion','expectedPublicationVersion','expectedPublicationRevision','expectedConfigPublicationId'] WHEN 'unpublish' THEN ARRAY['type','operationId','expectedVersion','expectedPublicationRevision'] WHEN 'restore' THEN ARRAY['type','operationId','expectedVersion','sourceRevisionId'] WHEN 'grant' THEN ARRAY['type','operationId','expectedVersion','revision','scope','evidenceReference'] WHEN 'withdraw' THEN ARRAY['type','operationId','expectedVersion','permissionId','reason'] END;
 IF keys IS NULL OR jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT(c ?& array_remove(keys,'expectedLegacyState')) OR (c-keys)<>'{}' OR (action<>'create' AND NOT gcms_m3.version(c->'expectedVersion',true)) THEN RAISE EXCEPTION 'Invalid command shape' USING ERRCODE='23514';END IF;
 IF action IN ('publish','unpublish','grant','withdraw') AND NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}';END IF;
 SELECT * INTO old FROM gcms_m4.receipt WHERE tenant_id=t AND operation_id=c->>'operationId';IF old.operation_id IS NOT NULL THEN IF old.actor_id<>gcms_s02.current_actor() OR old.kind<>k OR old.resource_id<>r OR old.locale<>l OR old.command<>c THEN RAISE EXCEPTION 'Operation conflict' USING ERRCODE='23514';END IF;RETURN old.result||'{"replayed":true}';END IF;
 SELECT * INTO d FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l FOR UPDATE;
 IF action IN ('create','save') AND d.resource_id IS NULL THEN
  legacy_state:=gcms_m4.legacy_state(t,k,r);initial_version:=coalesce((legacy_state->>'version')::integer,0);IF legacy_state IS NOT NULL AND c->'expectedLegacyState' IS DISTINCT FROM legacy_state THEN RAISE EXCEPTION 'Legacy source state conflict; reload required' USING ERRCODE='23514';END IF;IF (action='save' AND (c->>'expectedVersion')::integer<>initial_version) OR (action='create' AND legacy_state IS NOT NULL) THEN RAISE EXCEPTION 'Source version conflict' USING ERRCODE='23514';END IF;
  doc:=c->'content';IF gcms_m4.valid_content(k,doc) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid content' USING ERRCODE='23514';END IF;
  slug_value:=gcms_m4.identity_slug(t,k,r);
  IF k IN ('home','page','landing','promotion') AND slug_value IS NULL THEN INSERT INTO gcms_m4.identity(tenant_id,kind,id,slug) VALUES(t,k,r,doc->>'slug');slug_value:=doc->>'slug';END IF;
  IF slug_value IS NULL THEN RAISE EXCEPTION 'Resource identity unavailable' USING ERRCODE='23514';END IF;IF k<>'config' AND doc->>'slug' IS DISTINCT FROM slug_value THEN PERFORM gcms_m4.rename_draft_identity(t,k,r,l,doc->>'slug');legacy_state:=gcms_m4.legacy_state(t,k,r);END IF;
  INSERT INTO gcms_m4.variant(tenant_id,kind,resource_id,locale,version,content,legacy_guard,updated_by) VALUES(t,k,r,l,initial_version+1,doc,legacy_state,gcms_s02.current_actor());
 ELSE
  IF d.resource_id IS NULL THEN RETURN '{"code":"NOT_FOUND"}';END IF;
  IF action='create' OR d.version<>(c->>'expectedVersion')::integer THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='23514';END IF;
  IF action IN ('save','restore') THEN
   IF action='restore' THEN SELECT * INTO h FROM gcms_m4.revision WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l AND id=c->>'sourceRevisionId';IF h.id IS NULL THEN RAISE EXCEPTION 'Restore scope conflict' USING ERRCODE='23514';END IF;doc:=h.content;IF k<>'config' AND gcms_m4.slug_locked(t,k,r) THEN doc:=jsonb_set(doc,'{slug}',to_jsonb(gcms_m4.identity_slug(t,k,r)));END IF;ELSE doc:=c->'content';END IF;
   IF gcms_m4.valid_content(k,doc) IS NOT TRUE THEN RAISE EXCEPTION 'Invalid content' USING ERRCODE='23514';END IF;IF action='save' AND d.legacy_guard IS NOT NULL AND c->'expectedLegacyState' IS DISTINCT FROM gcms_m4.legacy_state(t,k,r) THEN RAISE EXCEPTION 'Legacy source state conflict; reload required' USING ERRCODE='23514';END IF;IF k<>'config' AND doc->>'slug' IS DISTINCT FROM gcms_m4.identity_slug(t,k,r) THEN PERFORM gcms_m4.rename_draft_identity(t,k,r,l,doc->>'slug');END IF;
   UPDATE gcms_m4.variant SET version=version+1,content=doc,legacy_guard=CASE WHEN action='save' AND d.legacy_guard IS NOT NULL THEN gcms_m4.legacy_state(t,k,r) ELSE legacy_guard END,updated_by=gcms_s02.current_actor(),updated_at=clock_timestamp() WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;
  ELSIF action='publish' THEN
   IF NOT gcms_m3.version(c->'expectedPublicationVersion',true) OR NOT gcms_m3.version(c->'expectedPublicationRevision',true) OR d.publication_version<>(c->>'expectedPublicationVersion')::integer OR d.publication_revision<>(c->>'expectedPublicationRevision')::integer THEN RAISE EXCEPTION 'Publication conflict' USING ERRCODE='23514';END IF;
   IF d.legacy_guard IS NOT NULL AND d.legacy_guard IS DISTINCT FROM gcms_m4.legacy_state(t,k,r) THEN RAISE EXCEPTION 'Legacy source changed; reload required' USING ERRCODE='23514';END IF;SELECT * INTO s FROM gcms_s02.site_draft WHERE tenant_id=t FOR SHARE;IF s.tenant_id IS NULL OR s.slug IS NULL THEN RAISE EXCEPTION 'Site identity required' USING ERRCODE='23514';END IF;
   IF k<>'config' AND c->'expectedConfigPublicationId' IS DISTINCT FROM coalesce(to_jsonb((SELECT active_publication_id FROM gcms_m4.variant WHERE tenant_id=t AND kind='config' AND resource_id=t AND locale=l)),'null') THEN RAISE EXCEPTION 'Config publication conflict' USING ERRCODE='23514';END IF;
   IF l='en' AND k<>'config' AND NOT EXISTS(SELECT 1 FROM gcms_m4.variant WHERE tenant_id=t AND kind='config' AND resource_id=t AND locale='en' AND active_publication_id IS NOT NULL) THEN RAISE EXCEPTION 'Published EN config required' USING ERRCODE='23514';END IF;IF k='config' AND c->'expectedConfigPublicationId'<>'null'::jsonb THEN RAISE EXCEPTION 'Config command context' USING ERRCODE='23514';END IF;
   IF NOT gcms_m4.text_allowed(t,k,r,l,d.version) THEN RAISE EXCEPTION 'Locale text permission required' USING ERRCODE='23514';END IF;
   FOR a IN SELECT * FROM gcms_m4.assets(k,d.content) LOOP IF NOT gcms_m4.asset_allowed(t,k,r,l,d.version,a) THEN RAISE EXCEPTION 'Scoped media permission required' USING ERRCODE='23514';END IF;END LOOP;
   pins:=gcms_m4.pin_refs(t,k,r,l,d.content);pid:=gen_random_uuid()::text;
   INSERT INTO gcms_m4.publication(tenant_id,kind,resource_id,locale,id,publication_version,draft_version,generation,content,site,reference_pins,published_by) VALUES(t,k,r,l,pid,d.publication_version+1,d.version,d.generation,d.content,jsonb_build_object('name',s.name,'footer',jsonb_build_object('intro',s.footer_intro,'body',s.footer_body)),pins,gcms_s02.current_actor());
   UPDATE gcms_s02.site_draft SET slug_locked=true WHERE tenant_id=t AND NOT slug_locked;UPDATE gcms_m4.variant SET active_publication_id=pid,publication_version=publication_version+1,publication_revision=publication_revision+1 WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;
   UPDATE gcms_m4.identity SET slug_locked=true WHERE tenant_id=t AND kind=k AND id=r;UPDATE gcms_s02.site_draft SET slug_locked=true WHERE tenant_id=t AND NOT slug_locked;
   INSERT INTO gcms_m4.intent(tenant_id,kind,resource_id,locale,publication_id,event) VALUES(t,k,r,l,pid,'published');
  ELSIF action='unpublish' THEN
   IF NOT gcms_m3.version(c->'expectedPublicationRevision',true) OR d.publication_revision<>(c->>'expectedPublicationRevision')::integer OR d.active_publication_id IS NULL THEN RAISE EXCEPTION 'Publication conflict' USING ERRCODE='23514';END IF;
   UPDATE gcms_m4.variant SET active_publication_id=NULL,generation=generation+1,publication_revision=publication_revision+1 WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;INSERT INTO gcms_m4.intent(tenant_id,kind,resource_id,locale,event) VALUES(t,k,r,l,'unpublished');
  ELSIF action='grant' THEN
   IF c->'revision'<>to_jsonb(d.version) OR NOT gcms_m4.text(c->'evidenceReference',500,true) OR jsonb_typeof(c->'scope') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Permission revision conflict' USING ERRCODE='23514';END IF;
   IF c->'scope'='{ "type":"text"}'::jsonb AND k IN ('case','gallery','testimonial') THEN scope_key_value:='text';
   ELSIF c->'scope'->>'type'='asset' AND ((c->'scope')-ARRAY['type','assetId','assetRevision','usage'])='{}' AND gcms_m3.uuid(c->'scope'->>'assetId') AND gcms_m3.version(c->'scope'->'assetRevision') AND c->'scope'->>'usage' IN ('logo','hero','page') THEN
    IF NOT EXISTS(SELECT 1 FROM gcms_m4.assets(k,d.content) x WHERE x->>'assetId'=c->'scope'->>'assetId' AND x->'revision'=c->'scope'->'assetRevision' AND x->>'usage'=c->'scope'->>'usage') OR NOT gcms_s07.content_asset_ready(t,c->'scope'->>'assetId',(c->'scope'->>'assetRevision')::integer) THEN RAISE EXCEPTION 'Asset scope conflict' USING ERRCODE='23514';END IF;scope_key_value:='asset:'||(c->'scope'->>'usage')||':'||(c->'scope'->>'assetId')||':'||(c->'scope'->>'assetRevision');
   ELSE RAISE EXCEPTION 'Invalid permission scope' USING ERRCODE='23514';END IF;
   INSERT INTO gcms_m4.permission(tenant_id,kind,resource_id,locale,revision,scope,scope_key,evidence_reference,granted_by) VALUES(t,k,r,l,d.version,c->'scope',scope_key_value,c->>'evidenceReference',gcms_s02.current_actor());
  ELSIF action='withdraw' THEN
   IF NOT gcms_m4.text(c->'reason',500,true) OR NOT gcms_m3.uuid(c->>'permissionId') THEN RAISE EXCEPTION 'Invalid withdrawal' USING ERRCODE='23514';END IF;
   UPDATE gcms_m4.permission SET withdrawn_at=clock_timestamp(),withdrawal_reason=c->>'reason' WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l AND id=c->>'permissionId' AND withdrawn_at IS NULL RETURNING * INTO perm;IF perm.id IS NULL THEN RAISE EXCEPTION 'Permission unavailable' USING ERRCODE='23514';END IF;
   IF perm.scope_key='text' THEN UPDATE gcms_m4.variant SET active_publication_id=NULL,generation=generation+1,publication_revision=publication_revision+1 WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;END IF;
   INSERT INTO gcms_m4.intent(tenant_id,kind,resource_id,locale,event) VALUES(t,k,r,l,'permission.withdrawn');
  END IF;
 END IF;
 IF action IN ('create','save','restore') THEN
  SELECT * INTO d FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;
  FOR a IN SELECT * FROM gcms_m4.assets(k,d.content) LOOP IF NOT EXISTS(SELECT 1 FROM gcms_s07.asset WHERE tenant_id=t AND id=a->>'assetId' AND revision>=(a->>'revision')::integer) THEN RAISE EXCEPTION 'Unknown/cross-tenant media' USING ERRCODE='23514';END IF;END LOOP;
  INSERT INTO gcms_m4.revision(tenant_id,kind,resource_id,locale,version,content,event,actor_id,actor_name,restored_from) SELECT t,k,r,l,d.version,d.content,CASE WHEN h.id IS NOT NULL THEN 'restored' WHEN d.version=1 THEN 'created' ELSE 'saved' END,gcms_s02.current_actor(),u.name,h.id FROM gcms_s02_auth."user" u WHERE u.id=gcms_s02.current_actor();
 END IF;
 out:=jsonb_build_object('operationId',c->>'operationId','replayed',false);INSERT INTO gcms_m4.receipt(tenant_id,operation_id,kind,resource_id,locale,actor_id,command,result) VALUES(t,c->>'operationId',k,r,l,gcms_s02.current_actor(),c,out);INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id) VALUES(gen_random_uuid()::text,t,gcms_s02.current_actor(),'m4.'||action,r);RETURN out;
END $function$;

CREATE OR REPLACE FUNCTION gcms_m3.preview_issues(t text, r text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$DECLARE d gcms_m3.resource%ROWTYPE;a jsonb;pins jsonb;issues jsonb:='[]';BEGIN
 PERFORM gcms_m5.require_read(t);
 SELECT * INTO d FROM gcms_m3.resource WHERE tenant_id=t AND id=r;IF d.id IS NULL THEN RETURN '["NOT_FOUND"]';END IF;
 BEGIN
  pins:=gcms_m3.pin_refs(t,r,d.content->'references');
  BEGIN PERFORM gcms_m3.admit_references(t,pins,jsonb_build_object('content',d.content));EXCEPTION WHEN check_violation THEN issues:=issues||'"PUBLIC_GRAPH_LIMIT"'::jsonb;END;
 EXCEPTION WHEN check_violation THEN issues:=issues||'"REFERENCE_UNAVAILABLE"'::jsonb;END;
 IF NOT gcms_m3.text_allowed(t,r,d.version,d.kind) THEN issues:=issues||'"TEXT_PERMISSION_REQUIRED"'::jsonb;END IF;
 FOR a IN SELECT * FROM gcms_m3.asset_refs(d.content) LOOP IF NOT gcms_m3.asset_allowed(t,r,d.version,a->>'assetId',(a->>'revision')::integer) THEN issues:=issues||'"ASSET_PERMISSION_REQUIRED"'::jsonb;END IF;END LOOP;
 RETURN issues;
END $function$;

CREATE OR REPLACE FUNCTION gcms_m3.preview_references(t text, r text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$DECLARE refs jsonb;pins jsonb:='[]';ref jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);
 SELECT content->'references' INTO refs FROM gcms_m3.resource WHERE tenant_id=t AND id=r;
 FOR ref IN SELECT value FROM jsonb_array_elements(coalesce(refs,'[]')) LOOP
  -- Keep the selected immutable version even if a newer version is available.
  IF ref->>'kind'='service' THEN SELECT ref||jsonb_build_object('generation',coalesce(g.generation,0)) INTO ref FROM gcms_s02.publication_snapshot p LEFT JOIN gcms_m3.service_generation g ON g.tenant_id=p.tenant_id AND g.service_id=p.service_id WHERE p.tenant_id=t AND p.service_id=ref->>'id' AND p.id=ref->>'publicationId';
  ELSE SELECT ref||jsonb_build_object('generation',p.generation) INTO ref FROM gcms_m3.publication p WHERE p.tenant_id=t AND p.resource_id=ref->>'id' AND p.id=ref->>'publicationId';END IF;
  IF ref IS NOT NULL THEN pins:=pins||jsonb_build_array(ref);END IF;
 END LOOP;BEGIN PERFORM gcms_m3.admit_references(t,pins,'{}');EXCEPTION WHEN check_violation THEN RETURN '[]';END;RETURN gcms_m5.private_references(t,pins);
END $function$;

CREATE OR REPLACE FUNCTION gcms_m3.service_links_view(t text, r text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$DECLARE d gcms_s02.service_draft%ROWTYPE;refs jsonb;pins jsonb:='[]';ref jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);
 SELECT * INTO d FROM gcms_s02.service_draft WHERE tenant_id=t AND id=r;IF d.id IS NULL THEN RETURN NULL;END IF;
 SELECT l.refs INTO refs FROM gcms_m3.service_links_draft l WHERE l.tenant_id=t AND l.service_id=r;refs:=coalesce(refs,'[]');
 FOR ref IN SELECT value FROM jsonb_array_elements(refs) LOOP BEGIN pins:=pins||gcms_m3.pin_refs(t,r,jsonb_build_array(ref));EXCEPTION WHEN check_violation THEN NULL;END;END LOOP;
 BEGIN PERFORM gcms_m3.admit_references(t,pins,'{}');EXCEPTION WHEN check_violation THEN RETURN jsonb_build_object('serviceId',r,'draftVersion',d.version,'references',refs,'resolved','[]'::jsonb);END;
 RETURN jsonb_build_object('serviceId',r,'draftVersion',d.version,'references',refs,'resolved',gcms_m5.private_references(t,pins));
END $function$;

CREATE OR REPLACE FUNCTION gcms_m4.variant_view(t text, k text, r text, l text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$DECLARE d gcms_m4.variant%ROWTYPE;p gcms_m4.publication%ROWTYPE;legacy record;content jsonb;state jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);state:=gcms_m4.legacy_state(t,k,r);SELECT * INTO d FROM gcms_m4.variant WHERE tenant_id=t AND kind=k AND resource_id=r AND locale=l;
 IF d.resource_id IS NOT NULL THEN SELECT * INTO p FROM gcms_m4.publication WHERE tenant_id=t AND id=d.active_publication_id;RETURN jsonb_build_object('id',r,'tenantId',t,'kind',k,'locale',l,'version',d.version,'publicationVersion',d.publication_version,'publicationRevision',d.publication_revision,'publishedVersion',p.draft_version,'activePublication',d.active_publication_id IS NOT NULL,'publicationId',d.active_publication_id,'slugLocked',gcms_m4.slug_locked(t,k,r),'updatedAt',d.updated_at,'content',d.content,'legacy',false,'virtual',false,'legacySource',CASE WHEN state IS NULL THEN NULL ELSE jsonb_build_object('captured',d.legacy_guard,'current',state) END);END IF;
 IF k='config' THEN SELECT * INTO legacy FROM gcms_s02.site_draft WHERE tenant_id=t;IF legacy.tenant_id IS NULL THEN RETURN NULL;END IF;
 content:=jsonb_build_object('name',legacy.name,'logo',NULL,'theme','clarity','themeVersion',1,'palette','teal','font','system','layout','comfortable','footer',jsonb_build_object('intro',CASE WHEN l='vi' THEN legacy.footer_intro ELSE '' END,'body',CASE WHEN l='vi' THEN legacy.footer_body ELSE gcms_s02.plain_document('') END),'menu','[]'::jsonb);
 ELSIF k='service' THEN SELECT * INTO legacy FROM gcms_s02.service_draft WHERE tenant_id=t AND id=r;IF legacy.id IS NULL THEN RETURN NULL;END IF;content:=(SELECT gcms_s08.service_content(sd) FROM gcms_s02.service_draft sd WHERE sd.tenant_id=t AND sd.id=r)||jsonb_build_object('contentLinks',jsonb_build_object('references',coalesce((SELECT refs FROM gcms_m3.service_links_draft WHERE tenant_id=t AND service_id=r),'[]')));
 ELSIF gcms_m3.kind(k) THEN SELECT * INTO legacy FROM gcms_m3.resource WHERE tenant_id=t AND id=r AND kind=k;IF legacy.id IS NULL THEN RETURN NULL;END IF;content:=legacy.content;
 ELSIF k IN ('home','page','landing','promotion') THEN IF NOT EXISTS(SELECT 1 FROM gcms_m4.identity WHERE tenant_id=t AND kind=k AND id=r) THEN RETURN NULL;END IF;SELECT source.content INTO content FROM gcms_m4.variant source WHERE source.tenant_id=t AND source.kind=k AND source.resource_id=r ORDER BY (source.locale='vi') DESC LIMIT 1;IF content IS NULL THEN RETURN NULL;END IF;content:=gcms_m4.blank_content(k,content,l);
 ELSE RETURN NULL;END IF;
 IF l='en' AND k<>'config' AND (k='service' OR gcms_m3.kind(k)) THEN content:=gcms_m4.blank_content(k,content,l);END IF;
 RETURN jsonb_build_object('id',r,'tenantId',t,'kind',k,'locale',l,'version',CASE WHEN k IN ('config','home','page','landing','promotion') THEN 0 ELSE coalesce((state->>'version')::integer,0) END,'publicationVersion',CASE WHEN l='vi' THEN coalesce((state->>'publicationVersion')::integer,0) ELSE 0 END,'publicationRevision',CASE WHEN l='vi' THEN coalesce((state->>'publicationRevision')::integer,0) ELSE 0 END,'publishedVersion',NULL,'activePublication',l='vi' AND state->>'pointer' IS NOT NULL,'publicationId',CASE WHEN l='vi' THEN state->'pointer' ELSE 'null'::jsonb END,'slugLocked',gcms_m4.slug_locked(t,k,r),'updatedAt',clock_timestamp(),'content',content,'legacy',k='service' OR gcms_m3.kind(k),'virtual',true,'legacySource',CASE WHEN state IS NULL THEN NULL ELSE jsonb_build_object('captured',NULL,'current',state) END);
END $function$;

CREATE OR REPLACE FUNCTION gcms_m4.preview_issues(t text, k text, r text, l text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$DECLARE d jsonb;a jsonb;pins jsonb;issues jsonb:='[]';BEGIN
 PERFORM gcms_m5.require_read(t);d:=gcms_m4.variant_view(t,k,r,l);IF d IS NULL THEN RETURN '["RESOURCE_UNAVAILABLE"]';END IF;IF d->'virtual'='true'::jsonb THEN issues:=issues||'"SAVE_DRAFT_FIRST"'::jsonb;END IF;
 BEGIN pins:=gcms_m4.pin_refs(t,k,r,l,d->'content');BEGIN PERFORM gcms_m4.admit_refs(t,k,l,d->'content',pins);EXCEPTION WHEN check_violation THEN issues:=issues||'"PUBLIC_GRAPH_LIMIT"'::jsonb;END;EXCEPTION WHEN check_violation THEN issues:=issues||'"REFERENCE_UNAVAILABLE"'::jsonb;END;
 IF k IN ('case','gallery','testimonial') AND NOT gcms_m4.text_allowed(t,k,r,l,(d->>'version')::integer) THEN issues:=issues||'"TEXT_PERMISSION_REQUIRED"'::jsonb;END IF;
 FOR a IN SELECT * FROM gcms_m4.assets(k,d->'content') LOOP IF NOT gcms_m4.asset_allowed(t,k,r,l,(d->>'version')::integer,a) THEN issues:=issues||'"MEDIA_PERMISSION_OR_READINESS"'::jsonb;END IF;END LOOP;RETURN issues;
END $function$;

CREATE OR REPLACE FUNCTION gcms_m4.legacy_state(t text, k text, r text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$DECLARE result jsonb;BEGIN PERFORM gcms_m5.require_read(t);SELECT (CASE WHEN k='service' THEN (SELECT jsonb_build_object('version',d.version,'publicationVersion',coalesce(h.publication_version,0),'publicationRevision',coalesce(h.revision,0),'pointer',h.active_snapshot_id,'generation',coalesce((SELECT generation FROM gcms_m3.service_generation WHERE tenant_id=t AND service_id=r),0)) FROM gcms_s02.service_draft d LEFT JOIN gcms_s08.publication_head h ON h.tenant_id=d.tenant_id AND h.service_id=d.id WHERE d.tenant_id=t AND d.id=r) WHEN gcms_m3.kind(k) THEN (SELECT jsonb_build_object('version',version,'publicationVersion',publication_version,'publicationRevision',publication_revision,'pointer',active_publication_id,'generation',generation) FROM gcms_m3.resource WHERE tenant_id=t AND id=r AND kind=k) END) INTO result;RETURN result;END $function$;

CREATE OR REPLACE FUNCTION gcms_s07.private_target(p_tenant text, p_asset text, p_revision integer, p_variant text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$ DECLARE a gcms_s07.asset%ROWTYPE; target jsonb; BEGIN
 PERFORM gcms_m5.require_read(p_tenant);
 SELECT * INTO a FROM gcms_s07.asset WHERE tenant_id=p_tenant AND id=p_asset;
 IF a.id IS NULL OR a.withdrawn_at IS NOT NULL OR a.revision<>p_revision OR a.state<>'ready' THEN RETURN NULL; END IF;
 IF p_variant='original' THEN RETURN jsonb_build_object('key','original/'||p_tenant||'/'||p_asset,'bytes',a.bytes,'checksum',a.checksum); END IF;
 IF p_variant<>'cover' THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('key',object_key,'bytes',bytes) INTO target FROM gcms_s07.derivative
 WHERE tenant_id=p_tenant AND asset_id=p_asset AND revision=p_revision AND ready AND deleted_at IS NULL ORDER BY fence DESC LIMIT 1;
 RETURN target;
END $function$;

CREATE OR REPLACE FUNCTION gcms_s07.require_tenant(p_tenant text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
 PERFORM gcms_s05.authorize(p_tenant,true);IF NOT gcms_m5.is_live(p_tenant) THEN RAISE EXCEPTION 'Tenant write fenced' USING ERRCODE='42501';END IF;
END $function$;

CREATE OR REPLACE FUNCTION gcms_s07.command(p_tenant text, p_asset text, p_operation text, p_expected integer, p_command jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE a gcms_s07.asset%ROWTYPE; prior gcms_s07.receipt%ROWTYPE; result jsonb; stamp timestamptz:=clock_timestamp();
BEGIN
 PERFORM gcms_m5.require_command(p_tenant,'media',p_command);
 IF p_operation IS NULL OR p_operation !~ '^[a-f0-9-]{36}$' OR p_expected IS NULL OR p_expected<1 OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='23514'; END IF;
 SELECT * INTO a FROM gcms_s07.asset WHERE tenant_id=p_tenant AND id=p_asset FOR UPDATE;
 IF a.id IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO prior FROM gcms_s07.receipt WHERE tenant_id=p_tenant AND operation_id=p_operation;
 IF prior.operation_id IS NOT NULL THEN
  IF prior.asset_id<>p_asset OR prior.command<>p_command||jsonb_build_object('expectedVersion',p_expected) THEN RAISE EXCEPTION 'Operation conflict' USING ERRCODE='23514'; END IF;
  RETURN prior.result;
 END IF;
 IF a.version<>p_expected OR (a.withdrawn_at IS NOT NULL AND p_command->>'type'<>'retry') THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='23514'; END IF;
 IF p_command->>'type'='permission' THEN
  IF a.material_kind<>'patient_derived' OR a.state<>'ready' OR (p_command->>'scope') IS DISTINCT FROM 'service_cover' OR coalesce(length(p_command->>'evidenceReference'),0) NOT BETWEEN 1 AND 500
   OR EXISTS(SELECT 1 FROM gcms_s07.permission WHERE tenant_id=p_tenant AND asset_id=p_asset)
   THEN RAISE EXCEPTION 'Permission conflict' USING ERRCODE='23514'; END IF;
  INSERT INTO gcms_s07.permission(tenant_id,asset_id,scope,evidence_reference,granted_by)
   VALUES(p_tenant,p_asset,'service_cover',p_command->>'evidenceReference',gcms_s02.current_actor());
  UPDATE gcms_s07.asset SET version=version+1 WHERE tenant_id=p_tenant AND id=p_asset;
 ELSIF p_command->>'type'='withdrawal' THEN
  IF coalesce(length(p_command->>'reason'),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid reason' USING ERRCODE='23514'; END IF;
  UPDATE gcms_s07.asset SET state='withdrawn',withdrawn_at=stamp,version=version+1,revision=revision+1 WHERE tenant_id=p_tenant AND id=p_asset;
  INSERT INTO gcms_s07.withdrawal_decision(tenant_id,asset_id,revision,withdrawn_at) VALUES(p_tenant,p_asset,a.revision+1,stamp);
  UPDATE gcms_s07.permission SET revoked_at=stamp WHERE tenant_id=p_tenant AND asset_id=p_asset AND revoked_at IS NULL;
  UPDATE gcms_s07.job SET status='cancelled',failure_code='withdrawn' WHERE tenant_id=p_tenant AND asset_id=p_asset AND kind='process' AND status IN ('pending','processing','failed');
  INSERT INTO gcms_s07.job(tenant_id,asset_id,kind,revision) VALUES(p_tenant,p_asset,'purge',a.revision+1);
 ELSIF p_command->>'type'='retry' THEN
  UPDATE gcms_s07.job SET status='pending',attempts=0,available_at=stamp,lease_until=NULL,failure_code=NULL
   WHERE tenant_id=p_tenant AND asset_id=p_asset AND status='failed'
   AND ((kind='purge' AND a.withdrawn_at IS NOT NULL) OR (kind='process' AND a.withdrawn_at IS NULL AND a.state IN ('uploading','processing')));
  IF NOT FOUND THEN RAISE EXCEPTION 'No retryable failure' USING ERRCODE='23514'; END IF;
  UPDATE gcms_s07.asset SET version=version+1 WHERE tenant_id=p_tenant AND id=p_asset;
 ELSE RAISE EXCEPTION 'Invalid command' USING ERRCODE='23514'; END IF;
 SELECT jsonb_build_object('id',id,'version',version,'revision',revision,'withdrawnAt',withdrawn_at) INTO result FROM gcms_s07.asset WHERE tenant_id=p_tenant AND id=p_asset;
 INSERT INTO gcms_s07.receipt(tenant_id,operation_id,asset_id,command,result) VALUES(p_tenant,p_operation,p_asset,p_command||jsonb_build_object('expectedVersion',p_expected),result);
 INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id) VALUES(gen_random_uuid()::text,p_tenant,gcms_s02.current_actor(),'media.'||(p_command->>'type'),p_asset);
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION gcms_s08.unpublish(p_tenant text, p_service text, c jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE old gcms_s08.operation_receipt%ROWTYPE;h gcms_s08.publication_head%ROWTYPE;d gcms_s02.service_draft%ROWTYPE;
BEGIN
 PERFORM gcms_m5.require_safety(p_tenant);
 IF NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}'; END IF;
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT(c ?& ARRAY['operationId','expectedDraftVersion','expectedPublicationVersion','expectedPublicationRevision']) OR
   (c-ARRAY['operationId','expectedDraftVersion','expectedPublicationVersion','expectedPublicationRevision'])<>'{}'::jsonb OR
   jsonb_typeof(c->'operationId') IS DISTINCT FROM 'string' OR
   coalesce(c->>'operationId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
   THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
 IF jsonb_typeof(c->'expectedDraftVersion') IS DISTINCT FROM 'number' OR coalesce(c->>'expectedDraftVersion','') !~ '^[1-9][0-9]{0,8}$' OR
    jsonb_typeof(c->'expectedPublicationVersion') IS DISTINCT FROM 'number' OR coalesce(c->>'expectedPublicationVersion','') !~ '^[1-9][0-9]{0,8}$' OR
    jsonb_typeof(c->'expectedPublicationRevision') IS DISTINCT FROM 'number' OR coalesce(c->>'expectedPublicationRevision','') !~ '^[1-9][0-9]{0,8}$'
   THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
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
 INSERT INTO gcms_m5.pointer_delete_authorization(tenant_id,service_id,transaction_id,actor_id,session_id,snapshot_id,operation_id) VALUES(p_tenant,p_service,txid_current(),gcms_s02.current_actor(),current_setting('gcms.session_id',true),h.active_snapshot_id,c->>'operationId');
 DELETE FROM gcms_s02.publication_pointer WHERE tenant_id=p_tenant AND service_id=p_service;IF NOT FOUND THEN RAISE EXCEPTION 'Publication pointer changed' USING ERRCODE='40001';END IF;
 INSERT INTO gcms_s08.operation_receipt(tenant_id,operation_id,actor_id,resource,resource_id,command,applied_version)
 VALUES(p_tenant,c->>'operationId',gcms_s02.current_actor(),'unpublish',p_service,c,h.revision+1);
 INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id) VALUES(gen_random_uuid()::text,p_tenant,gcms_s02.current_actor(),'service.unpublished',p_service);
 RETURN jsonb_build_object('replayed',false,'operationId',c->>'operationId');
END $function$;

CREATE OR REPLACE FUNCTION gcms_s02.guard_publication_pointer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE h gcms_s08.publication_head%ROWTYPE;latest text;
BEGIN
 PERFORM gcms_s05.authorize(NEW.tenant_id,true);IF NOT gcms_m5.is_live(NEW.tenant_id) THEN RAISE EXCEPTION 'Publication write fenced' USING ERRCODE='42501';END IF;
 IF NOT gcms_s02.has_recent_auth() THEN RAISE EXCEPTION 'Recent authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO h FROM gcms_s08.publication_head WHERE tenant_id=NEW.tenant_id AND service_id=NEW.service_id FOR UPDATE;
 SELECT id INTO latest FROM gcms_s02.publication_snapshot WHERE tenant_id=NEW.tenant_id AND service_id=NEW.service_id ORDER BY publication_version DESC LIMIT 1;
 IF NEW.snapshot_id IS DISTINCT FROM latest OR h.pending_snapshot_id IS DISTINCT FROM NEW.snapshot_id OR h.pending_transaction IS DISTINCT FROM txid_current()
 THEN RAISE EXCEPTION 'Publication pointer requires a new snapshot in this transaction' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $function$;

