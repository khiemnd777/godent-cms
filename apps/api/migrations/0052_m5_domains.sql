-- S16 exact-host bindings and current-primary projections. Existing snapshots are immutable.
DO $$ BEGIN IF current_user<>'gcms_s02_owner' THEN RAISE EXCEPTION 'M5 owner required';END IF;END $$;
CREATE FUNCTION gcms_m5.valid_host(h text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(length(h) BETWEEN 3 AND 253 AND h=lower(h) AND h ~ '^[a-z0-9.-]+$' AND h LIKE '%.%'
 AND h !~ '^[0-9.]+$' AND h<>'godent.vn' AND h NOT LIKE '%.godent.vn' AND h !~ '\.(local|internal|invalid)$'
 AND NOT EXISTS(SELECT 1 FROM unnest(string_to_array(h,'.')) label WHERE length(label) NOT BETWEEN 1 AND 63 OR label !~ '^([a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])$' OR label LIKE 'xn--%'),false)
$$;
CREATE TABLE gcms_m5.domain_binding(
 tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id),id text NOT NULL,host text NOT NULL CHECK(gcms_m5.valid_host(host)),
 state text NOT NULL CHECK(state IN('pending','active','inactive','removed')),tls text NOT NULL DEFAULT 'unknown' CHECK(tls IN('unknown','valid','invalid')),
 generation integer NOT NULL DEFAULT 1 CHECK(generation>0),version integer NOT NULL DEFAULT 1 CHECK(version>0),origin text,verified_at timestamptz,tls_expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(tenant_id,id),UNIQUE(id),CHECK((state='active') IS NOT TRUE OR (tls='valid' AND origin IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE UNIQUE INDEX domain_host_claim ON gcms_m5.domain_binding(host) WHERE state<>'removed';
CREATE TABLE gcms_m5.domain_evidence(tenant_id text NOT NULL,binding_id text NOT NULL,generation integer NOT NULL,host text NOT NULL,
 adapter text NOT NULL CHECK(adapter='synthetic-local'),origin text NOT NULL,tls text NOT NULL CHECK(tls='valid'),verified_at timestamptz NOT NULL,expires_at timestamptz NOT NULL CHECK(expires_at>verified_at),
 PRIMARY KEY(tenant_id,binding_id,generation),FOREIGN KEY(tenant_id,binding_id) REFERENCES gcms_m5.domain_binding(tenant_id,id));
CREATE TABLE gcms_m5.domain_primary(tenant_id text PRIMARY KEY REFERENCES gcms_s02.tenant(id),binding_id text,version integer NOT NULL CHECK(version>0),
 FOREIGN KEY(tenant_id,binding_id) REFERENCES gcms_m5.domain_binding(tenant_id,id));
CREATE TABLE gcms_m5.domain_receipt(tenant_id text NOT NULL,operation_id text NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(tenant_id,operation_id));
CREATE TABLE gcms_m5.domain_history(tenant_id text NOT NULL,id bigint GENERATED ALWAYS AS IDENTITY,actor_id text NOT NULL,action text NOT NULL,binding_id text,primary_version integer NOT NULL,reason text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(tenant_id,id));
DO $$ DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['domain_binding','domain_evidence','domain_primary','domain_receipt','domain_history'] LOOP
 EXECUTE format('ALTER TABLE gcms_m5.%I ENABLE ROW LEVEL SECURITY',n);EXECUTE format('ALTER TABLE gcms_m5.%I FORCE ROW LEVEL SECURITY',n);
 EXECUTE format('CREATE POLICY owner_all ON gcms_m5.%I TO gcms_s02_owner USING(true) WITH CHECK(true)',n);
 END LOOP;END $$;
CREATE FUNCTION gcms_m5.primary_view(t text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('mode',CASE WHEN p.binding_id IS NULL THEN 'godent' ELSE 'custom' END,'bindingId',p.binding_id,'version',coalesce(p.version,0),
 'origin',CASE WHEN p.binding_id IS NULL THEN coalesce(s.canonical_origin,'http://localhost:5892') ELSE b.origin END,'basePath',CASE WHEN p.binding_id IS NULL AND s.slug IS NOT NULL THEN '/'||s.slug ELSE '' END)
 FROM gcms_s02.tenant ten LEFT JOIN gcms_s02.site_draft s ON s.tenant_id=ten.id LEFT JOIN gcms_m5.domain_primary p ON p.tenant_id=ten.id LEFT JOIN gcms_m5.domain_binding b ON b.tenant_id=p.tenant_id AND b.id=p.binding_id WHERE ten.id=t
$$;
CREATE FUNCTION gcms_m5.binding_view(t text,b text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN
 PERFORM gcms_m5.require_read(t);RETURN (SELECT jsonb_build_object('id',id,'tenantId',tenant_id,'host',host,'state',state,'tls',tls,'generation',generation,'version',version,'origin',origin,'verifiedAt',verified_at,'tlsExpiresAt',tls_expires_at) FROM gcms_m5.domain_binding WHERE tenant_id=t AND id=b);
END $$;
CREATE FUNCTION gcms_m5.domain_readiness(t text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE s text;pages jsonb;issues jsonb:='[]';BEGIN
 SELECT slug INTO s FROM gcms_s02.site_draft WHERE tenant_id=t AND slug_locked AND public_enabled;
 IF NOT gcms_m5.is_live(t) THEN issues:=issues||'"TENANT_NOT_ACTIVE"'::jsonb;END IF;
 IF s IS NULL THEN issues:=issues||'"SITE_NOT_PUBLISHED"'::jsonb;ELSE pages:=gcms_m4.seo(s,NULL,1);END IF;
 IF coalesce(jsonb_array_length(pages),0)=0 THEN issues:=issues||'"NO_ELIGIBLE_PUBLISHED_PAGE"'::jsonb;END IF;
 RETURN jsonb_build_object('ready',jsonb_array_length(issues)=0,'issues',issues,'eligiblePages',coalesce(jsonb_array_length(pages),0));
END $$;
CREATE FUNCTION gcms_m5.domains_view(t text,after_id text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE values_json jsonb;more boolean;BEGIN
 PERFORM gcms_m5.require_read(t);
 SELECT coalesce(jsonb_agg(row_value ORDER BY id),'[]'),count(*)>25 INTO values_json,more FROM (SELECT id,jsonb_build_object('id',id,'tenantId',tenant_id,'host',host,'state',state,'tls',tls,'generation',generation,'version',version,'origin',origin,'verifiedAt',verified_at,'tlsExpiresAt',tls_expires_at) row_value FROM gcms_m5.domain_binding WHERE tenant_id=t AND (after_id IS NULL OR id>after_id) ORDER BY id LIMIT 26) d;
 IF more THEN values_json:=values_json-25;END IF;
 RETURN jsonb_build_object('bindings',values_json,'primary',gcms_m5.primary_view(t),'readiness',gcms_m5.domain_readiness(t),'hasMore',more,'nextCursor',NULL);
END $$;
CREATE FUNCTION gcms_m5.domain_receipt_exists(t text,op text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN PERFORM gcms_m5.require_read(t);RETURN EXISTS(SELECT 1 FROM gcms_m5.domain_receipt WHERE tenant_id=t AND operation_id=op);END $$;
CREATE FUNCTION gcms_m5.domain_command(t text,b text,c jsonb,e jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE old gcms_m5.domain_receipt%ROWTYPE;bound gcms_m5.domain_binding%ROWTYPE;pv integer;target text;act text:=c->>'action';result jsonb;ready jsonb;reason_value text:=coalesce(c->>'reason','');BEGIN
 PERFORM gcms_s05.authorize(t,true);IF NOT gcms_m5.is_live(t) THEN RAISE EXCEPTION 'Tenant unavailable' USING ERRCODE='42501';END IF;
 IF NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}';END IF;
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT gcms_m3.uuid(c->>'operationId') OR act IS NULL OR act NOT IN('register','verify-local','deactivate','remove','reverify','primary') THEN RAISE EXCEPTION 'Invalid domain command' USING ERRCODE='22023';END IF;
 -- Tenant7202 lock in authorize serializes receipts, publication, membership and lifecycle.
 SELECT * INTO old FROM gcms_m5.domain_receipt WHERE tenant_id=t AND operation_id=c->>'operationId';
 IF old.operation_id IS NOT NULL THEN IF old.payload IS DISTINCT FROM (c||jsonb_build_object('target',b)) THEN RAISE EXCEPTION 'Operation conflict' USING ERRCODE='40001';END IF;
 RETURN gcms_m5.domains_view(t)||old.result||jsonb_build_object('replayed',true);END IF;
 SELECT coalesce((SELECT version FROM gcms_m5.domain_primary WHERE tenant_id=t),0) INTO pv;
 IF act='register' THEN
  IF (c-ARRAY['action','operationId','host'])<>'{}' OR NOT gcms_m5.valid_host(c->>'host') THEN RAISE EXCEPTION 'Invalid domain' USING ERRCODE='22023';END IF;
  target:=c->>'operationId';INSERT INTO gcms_m5.domain_binding(tenant_id,id,host,state)VALUES(t,target,c->>'host','pending');
 ELSIF act='primary' THEN
  IF (c-ARRAY['action','operationId','mode','bindingId','expectedBindingVersion','expectedPrimaryVersion','reason','acknowledgeCachedRedirects'])<>'{}' OR (c->>'expectedPrimaryVersion')::integer IS DISTINCT FROM pv OR length(reason_value) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Primary version conflict' USING ERRCODE='40001';END IF;
  IF c->>'mode'='custom' THEN
   target:=c->>'bindingId';SELECT * INTO bound FROM gcms_m5.domain_binding WHERE tenant_id=t AND id=target FOR UPDATE;
   IF bound.id IS NULL OR bound.state<>'active' OR bound.tls<>'valid' OR bound.version IS DISTINCT FROM (c->>'expectedBindingVersion')::integer OR NOT EXISTS(SELECT 1 FROM gcms_m5.domain_evidence e WHERE e.tenant_id=t AND e.binding_id=bound.id AND e.generation=bound.generation AND e.host=bound.host AND e.origin=bound.origin AND e.tls='valid' AND e.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'Binding not eligible' USING ERRCODE='40001';END IF;
   ready:=gcms_m5.domain_readiness(t);IF ready->'ready' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'No equivalent publication ready' USING ERRCODE='40001';END IF;
  ELSIF c->>'mode'='godent' AND c->'acknowledgeCachedRedirects'='true'::jsonb THEN target:=NULL;
  ELSE RAISE EXCEPTION 'Invalid primary' USING ERRCODE='22023';END IF;
  pv:=pv+1;INSERT INTO gcms_m5.domain_primary(tenant_id,binding_id,version)VALUES(t,target,pv)ON CONFLICT(tenant_id)DO UPDATE SET binding_id=EXCLUDED.binding_id,version=EXCLUDED.version;
 ELSE
  SELECT * INTO bound FROM gcms_m5.domain_binding WHERE tenant_id=t AND id=b FOR UPDATE;target:=b;
  IF bound.id IS NULL THEN RETURN '{"code":"NOT_FOUND"}';END IF;
  IF bound.state='removed' OR bound.version IS DISTINCT FROM (c->>'expectedVersion')::integer THEN RAISE EXCEPTION 'Binding version conflict' USING ERRCODE='40001';END IF;
  IF act='verify-local' THEN
   IF (c-ARRAY['action','operationId','expectedVersion'])<>'{}' OR bound.state<>'pending' OR jsonb_typeof(e) IS DISTINCT FROM 'object' OR (e-ARRAY['bindingId','tenantId','siteId','host','generation','adapter','tls','origin','verifiedAt','expiresAt'])<>'{}' OR NOT(e ?& ARRAY['bindingId','tenantId','siteId','host','generation','adapter','tls','origin','verifiedAt','expiresAt']) OR e->>'bindingId' IS DISTINCT FROM b OR e->>'tenantId' IS DISTINCT FROM t OR e->>'siteId' IS DISTINCT FROM t OR e->>'host' IS DISTINCT FROM bound.host OR (e->>'generation')::integer IS DISTINCT FROM bound.generation OR e->>'adapter' IS DISTINCT FROM 'synthetic-local' OR e->>'tls' IS DISTINCT FROM 'valid' OR bound.host NOT LIKE '%.localhost' OR e->>'origin' IS DISTINCT FROM 'http://'||bound.host||':5892' OR (e->>'verifiedAt')::timestamptz NOT BETWEEN clock_timestamp()-interval '1 minute' AND clock_timestamp()+interval '5 seconds' OR (e->>'expiresAt')::timestamptz IS NULL OR (e->>'expiresAt')::timestamptz NOT BETWEEN clock_timestamp() AND clock_timestamp()+interval '61 minutes' THEN RAISE EXCEPTION 'Invalid local verification evidence' USING ERRCODE='22023';END IF;
   INSERT INTO gcms_m5.domain_evidence(tenant_id,binding_id,generation,host,adapter,origin,tls,verified_at,expires_at)VALUES(t,b,bound.generation,bound.host,'synthetic-local',e->>'origin','valid',(e->>'verifiedAt')::timestamptz,(e->>'expiresAt')::timestamptz);
   UPDATE gcms_m5.domain_binding SET state='active',tls='valid',origin=e->>'origin',verified_at=(e->>'verifiedAt')::timestamptz,tls_expires_at=(e->>'expiresAt')::timestamptz,version=version+1 WHERE tenant_id=t AND id=b;
  ELSE
   IF (c-ARRAY['action','operationId','expectedVersion','expectedPrimaryVersion','reason'])<>'{}' OR (c->>'expectedPrimaryVersion')::integer IS DISTINCT FROM pv OR length(reason_value) NOT BETWEEN 1 AND 500 OR (act<>'reverify' AND EXISTS(SELECT 1 FROM gcms_m5.domain_primary WHERE tenant_id=t AND binding_id=b)) THEN RAISE EXCEPTION 'Return or replace primary before changing binding' USING ERRCODE='40001';END IF;
   UPDATE gcms_m5.domain_binding SET state=CASE act WHEN 'deactivate' THEN 'inactive' WHEN 'remove' THEN 'removed' ELSE 'pending' END,tls='unknown',origin=NULL,verified_at=NULL,tls_expires_at=NULL,generation=generation+1,version=version+1 WHERE tenant_id=t AND id=b;
  END IF;
 END IF;
 INSERT INTO gcms_m5.domain_history(tenant_id,actor_id,action,binding_id,primary_version,reason)VALUES(t,gcms_s02.current_actor(),act,target,pv,reason_value);
 INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id)VALUES(gen_random_uuid()::text,t,gcms_s02.current_actor(),'domain.'||act,coalesce(target,t));
 result:=jsonb_build_object('operationId',c->>'operationId','bindingId',target,'appliedPrimaryVersion',pv,'replayed',false);
 INSERT INTO gcms_m5.domain_receipt(tenant_id,operation_id,payload,result)VALUES(t,c->>'operationId',c||jsonb_build_object('target',b),result);
 RETURN gcms_m5.domains_view(t)||result;
END $$;

CREATE FUNCTION gcms_m5.public_primary(t text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE p jsonb;expected text:=current_setting('gcms.m5_primary_version',true);eb text:=current_setting('gcms.m5_entry_binding',true);eg text:=current_setting('gcms.m5_entry_generation',true);BEGIN
 IF NOT gcms_m5.is_live(t) THEN RETURN NULL;END IF;p:=gcms_m5.primary_view(t);IF p IS NULL OR p->>'origin' IS NULL THEN RETURN NULL;END IF;
 IF p->>'mode'='custom' AND NOT EXISTS(SELECT 1 FROM gcms_m5.domain_binding b JOIN gcms_m5.domain_evidence e ON e.tenant_id=b.tenant_id AND e.binding_id=b.id AND e.generation=b.generation AND e.host=b.host AND e.origin=b.origin AND e.expires_at>statement_timestamp() WHERE b.tenant_id=t AND b.id=p->>'bindingId' AND b.state='active' AND b.tls='valid' AND b.tls_expires_at>statement_timestamp()) THEN RETURN NULL;END IF;
 IF coalesce(expected,'')<>'' AND expected IS DISTINCT FROM p->>'version' THEN RAISE EXCEPTION 'Primary changed' USING ERRCODE='40001';END IF;
 IF coalesce(eb,'')<>'' AND NOT EXISTS(SELECT 1 FROM gcms_m5.domain_binding b WHERE b.tenant_id=t AND b.id=eb AND b.generation::text=eg AND b.state='active' AND b.tls='valid' AND b.tls_expires_at>statement_timestamp()) THEN RAISE EXCEPTION 'Entry changed' USING ERRCODE='40001';END IF;
 RETURN p;
END $$;
-- Only URL-bearing typed projection fields change. Authored href/content and API/media paths keep their contracts.
CREATE FUNCTION gcms_m5.project_urls(v jsonb,old_base text,new_base text,old_path text,new_path text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$DECLARE out jsonb;item record;s text;BEGIN
 IF v IS NULL THEN RETURN NULL;END IF;
 IF jsonb_typeof(v)='array' THEN SELECT coalesce(jsonb_agg(gcms_m5.project_urls(value,old_base,new_base,old_path,new_path)),'[]') INTO out FROM jsonb_array_elements(v);RETURN out;END IF;
 IF jsonb_typeof(v)<>'object' THEN RETURN v;END IF;out:='{}';
 FOR item IN SELECT * FROM jsonb_each(v) LOOP
  IF item.key IN('canonicalUrl','url','path') AND jsonb_typeof(item.value)='string' THEN s:=item.value#>>'{}';
   IF item.key IN('canonicalUrl','url') AND (s=old_base OR left(s,length(old_base)+1)=old_base||'/') THEN item.value:=to_jsonb(new_base||substr(s,length(old_base)+1));
   ELSIF item.key='path' AND (s=old_path OR left(s,length(old_path)+1)=old_path||'/') THEN item.value:=to_jsonb(CASE WHEN new_path||substr(s,length(old_path)+1)='' THEN '/' ELSE new_path||substr(s,length(old_path)+1) END);END IF;
  ELSIF item.key NOT IN('content','service','section','body','footer') THEN item.value:=gcms_m5.project_urls(item.value,old_base,new_base,old_path,new_path);END IF;
  out:=out||jsonb_build_object(item.key,item.value);
 END LOOP;RETURN out;
END $$;
CREATE FUNCTION gcms_m5.project_public(slug_value text,v jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE s gcms_s02.site_draft%ROWTYPE;p jsonb;BEGIN
 SELECT * INTO s FROM gcms_s02.site_draft WHERE slug=slug_value;p:=gcms_m5.public_primary(s.tenant_id);IF p IS NULL OR v IS NULL THEN RETURN NULL;END IF;
 RETURN gcms_m5.project_urls(v,s.canonical_origin||'/'||s.slug,(p->>'origin')||(p->>'basePath'),'/'||s.slug,p->>'basePath');
END $$;
CREATE FUNCTION gcms_m5.resolve_entry(host_value text,path_value text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE t text;slug_value text;base text;origin_value text;binding_value text;generation_value integer:=0;page_path text;p jsonb;BEGIN
 IF host_value IS NULL OR path_value IS NULL OR length(path_value)>2048 OR path_value !~ '^/([a-z0-9-]+(/[a-z0-9-]+)*)?/?$' OR position('//' IN path_value)>0 THEN RETURN NULL;END IF;
 IF host_value='localhost:5892' THEN slug_value:=split_part(path_value,'/',2);IF NOT gcms_s02.valid_slug(slug_value) THEN RETURN NULL;END IF;
  SELECT tenant_id INTO t FROM gcms_s02.site_draft WHERE slug=slug_value AND public_enabled AND slug_locked;base:='/'||slug_value;origin_value:='http://localhost:5892';page_path:=substr(path_value,length(base)+1);IF page_path='' THEN page_path:='/';END IF;
 ELSE
  SELECT b.tenant_id,b.id,b.generation,b.origin,s.slug INTO t,binding_value,generation_value,origin_value,slug_value FROM gcms_m5.domain_binding b JOIN gcms_s02.site_draft s ON s.tenant_id=b.tenant_id WHERE b.host||':5892'=host_value AND b.state='active' AND b.tls='valid' AND s.public_enabled AND s.slug_locked AND EXISTS(SELECT 1 FROM gcms_m5.domain_evidence e WHERE e.tenant_id=b.tenant_id AND e.binding_id=b.id AND e.generation=b.generation AND e.host=b.host AND e.origin=b.origin AND e.expires_at>statement_timestamp());base:='';page_path:=path_value;
 END IF;
 p:=gcms_m5.public_primary(t);IF t IS NULL OR p IS NULL THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('tenantId',t,'siteId',t,'tenantSlug',slug_value,'entry',jsonb_build_object('mode',CASE WHEN binding_value IS NULL THEN 'platform' ELSE 'custom' END,'origin',origin_value,'basePath',base,'bindingId',binding_value,'generation',generation_value),'primary',p,'sitePagePath',page_path);
END $$;
CREATE FUNCTION gcms_m5.intake_origin_allowed(origin_value text,slug_value text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(EXISTS(SELECT 1 FROM gcms_s02.site_draft s WHERE s.slug=slug_value AND gcms_m5.is_readable(s.tenant_id) AND (origin_value='http://localhost:5892' OR EXISTS(SELECT 1 FROM gcms_m5.domain_binding b JOIN gcms_m5.domain_evidence e ON e.tenant_id=b.tenant_id AND e.binding_id=b.id AND e.generation=b.generation AND e.host=b.host AND e.origin=b.origin AND e.expires_at>statement_timestamp() WHERE b.tenant_id=s.tenant_id AND b.origin=origin_value AND b.state='active' AND b.tls='valid'))),false)
$$;
CREATE FUNCTION gcms_m5.intake(c jsonb,builder boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE t text;BEGIN
 SELECT tenant_id INTO t FROM gcms_s02.site_draft WHERE slug=c->>'tenantSlug';IF t IS NULL THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));
 -- Suspension preserves accepted replay; irreversible deletion blocks even replay.
 IF NOT gcms_m5.is_readable(t) OR NOT gcms_m5.intake_origin_allowed(c->>'entryOrigin',c->>'tenantSlug') THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;
 IF builder THEN RETURN gcms_m4.intake(c-'entryOrigin');END IF;RETURN gcms_s04.intake(c-'entryOrigin');
END $$;
CREATE FUNCTION gcms_m5.export_domain_rows(t text,after_key text DEFAULT NULL,lim integer DEFAULT 100) RETURNS TABLE(record_key text,data jsonb) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN
 PERFORM gcms_m5.require_read(t);IF lim IS NULL OR lim NOT BETWEEN 1 AND 200 OR length(after_key)>200 THEN RAISE EXCEPTION 'Invalid export cursor' USING ERRCODE='22023';END IF;
 RETURN QUERY SELECT r.k,r.v FROM (
 SELECT 'binding:'||b.id k,to_jsonb(b)-'tenant_id' v FROM gcms_m5.domain_binding b WHERE b.tenant_id=t
 UNION ALL SELECT 'evidence:'||e.binding_id||':'||lpad(e.generation::text,10,'0'),to_jsonb(e)-'tenant_id' FROM gcms_m5.domain_evidence e WHERE e.tenant_id=t
 UNION ALL SELECT 'primary',to_jsonb(p)-'tenant_id' FROM gcms_m5.domain_primary p WHERE p.tenant_id=t
 UNION ALL SELECT 'history:'||lpad(h.id::text,20,'0'),to_jsonb(h)-'tenant_id' FROM gcms_m5.domain_history h WHERE h.tenant_id=t
 UNION ALL SELECT 'receipt:'||d.operation_id,to_jsonb(d)-'tenant_id' FROM gcms_m5.domain_receipt d WHERE d.tenant_id=t
 )r WHERE after_key IS NULL OR r.k>after_key ORDER BY r.k LIMIT lim;
END $$;
CREATE FUNCTION gcms_m5.delete_domain_data(t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN
 IF NOT gcms_m5.cleanup_authorized(t) THEN RAISE EXCEPTION 'Confirmed cleanup required' USING ERRCODE='42501';END IF;
 DELETE FROM gcms_m5.domain_primary WHERE tenant_id=t;DELETE FROM gcms_m5.domain_evidence WHERE tenant_id=t;DELETE FROM gcms_m5.domain_receipt WHERE tenant_id=t;DELETE FROM gcms_m5.domain_history WHERE tenant_id=t;DELETE FROM gcms_m5.domain_binding WHERE tenant_id=t;
END $$;
REVOKE ALL ON TABLE gcms_m5.domain_binding,gcms_m5.domain_evidence,gcms_m5.domain_primary,gcms_m5.domain_receipt,gcms_m5.domain_history FROM PUBLIC,gcms_s02_auth,gcms_s02_tenant,gcms_s02_platform,gcms_s04_intake;
REVOKE ALL ON FUNCTION gcms_m5.valid_host(text),gcms_m5.primary_view(text),gcms_m5.binding_view(text,text),gcms_m5.domain_readiness(text),gcms_m5.domains_view(text,text),gcms_m5.domain_command(text,text,jsonb,jsonb),gcms_m5.domain_receipt_exists(text,text),gcms_m5.public_primary(text),gcms_m5.project_urls(jsonb,text,text,text,text),gcms_m5.project_public(text,jsonb),gcms_m5.resolve_entry(text,text),gcms_m5.intake_origin_allowed(text,text),gcms_m5.intake(jsonb,boolean),gcms_m5.delete_domain_data(text),gcms_m5.export_domain_rows(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_m5.binding_view(text,text),gcms_m5.domains_view(text,text),gcms_m5.domain_command(text,text,jsonb,jsonb),gcms_m5.domain_receipt_exists(text,text),gcms_m5.project_public(text,jsonb),gcms_m5.resolve_entry(text,text),gcms_m5.intake_origin_allowed(text,text) TO gcms_s02_tenant;
GRANT EXECUTE ON FUNCTION gcms_m5.intake(jsonb,boolean) TO gcms_s04_intake;
