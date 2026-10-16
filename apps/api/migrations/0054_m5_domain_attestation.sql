-- Forward repair: runtime JSON cannot attest hostname ownership or synthetic TLS.
-- Only the bootstrap owner enrolls positively owned M5 loopback manifest hosts.
DO $$ BEGIN IF current_user<>'gcms_s02_owner' THEN RAISE EXCEPTION 'M5 owner required';END IF;END $$;
CREATE TABLE gcms_m5.local_domain_attestation(
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id),host text NOT NULL,
 mode text NOT NULL DEFAULT 'local-m5' CHECK(mode='local-m5'),origin text NOT NULL,
 attested_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL,enabled boolean NOT NULL DEFAULT true,
 UNIQUE(tenant_id,host),UNIQUE(host),CHECK(gcms_m5.valid_host(host) AND host LIKE '%.localhost'),
 CHECK(origin='http://'||host||':5892'),CHECK(expires_at>attested_at)
);
ALTER TABLE gcms_m5.local_domain_attestation ENABLE ROW LEVEL SECURITY;ALTER TABLE gcms_m5.local_domain_attestation FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_all ON gcms_m5.local_domain_attestation TO gcms_s02_owner USING(true) WITH CHECK(true);
REVOKE ALL ON TABLE gcms_m5.local_domain_attestation FROM PUBLIC,gcms_s02_auth,gcms_s02_tenant,gcms_s02_platform,gcms_s04_intake;
ALTER TABLE gcms_m5.domain_evidence ADD COLUMN attestation_id text REFERENCES gcms_m5.local_domain_attestation(id);

CREATE FUNCTION gcms_m5.enroll_local_domain(t text,h text,p_expires_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));
 IF NOT gcms_m5.is_readable(t) OR gcms_m5.valid_host(h) IS NOT TRUE OR h NOT LIKE '%.localhost' OR p_expires_at IS NULL OR p_expires_at NOT BETWEEN clock_timestamp()+interval '1 minute' AND clock_timestamp()+interval '24 hours' THEN RAISE EXCEPTION 'Invalid local manifest attestation' USING ERRCODE='23514';END IF;
 INSERT INTO gcms_m5.local_domain_attestation(tenant_id,host,origin,expires_at)VALUES(t,h,'http://'||h||':5892',p_expires_at)
 ON CONFLICT(tenant_id,host)DO UPDATE SET expires_at=EXCLUDED.expires_at,enabled=true,
 attested_at=CASE WHEN gcms_m5.local_domain_attestation.enabled THEN gcms_m5.local_domain_attestation.attested_at ELSE clock_timestamp() END;
END $$;
REVOKE ALL ON FUNCTION gcms_m5.enroll_local_domain(text,text,timestamptz) FROM PUBLIC,gcms_s02_auth,gcms_s02_tenant,gcms_s02_platform,gcms_s04_intake;

CREATE FUNCTION gcms_m5.binding_attested(t text,binding text,at_time timestamptz DEFAULT statement_timestamp()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM gcms_m5.domain_binding b JOIN gcms_m5.domain_evidence e ON e.tenant_id=b.tenant_id AND e.binding_id=b.id AND e.generation=b.generation AND e.host=b.host AND e.origin=b.origin
 JOIN gcms_m5.local_domain_attestation a ON a.id=e.attestation_id AND a.tenant_id=b.tenant_id AND a.host=b.host AND a.origin=b.origin
 WHERE b.tenant_id=t AND b.id=binding AND b.state='active' AND b.tls='valid' AND b.tls_expires_at>at_time AND e.adapter='synthetic-local' AND e.tls='valid' AND e.expires_at>at_time AND e.expires_at<=a.expires_at AND e.verified_at>=a.attested_at AND a.mode='local-m5' AND a.enabled AND a.attested_at<=at_time AND a.expires_at>at_time)
$$;
REVOKE ALL ON FUNCTION gcms_m5.binding_attested(text,text,timestamptz) FROM PUBLIC;

ALTER FUNCTION gcms_m5.domain_command(text,text,jsonb,jsonb) RENAME TO domain_command_before_attestation;
-- ALTER FUNCTION preserves its old ACL/default arguments. Remove the direct role
-- capability explicitly; only the owner-only body below may call this function.
REVOKE ALL ON FUNCTION gcms_m5.domain_command_before_attestation(text,text,jsonb,jsonb) FROM PUBLIC,gcms_s02_auth,gcms_s02_tenant,gcms_s02_platform,gcms_s04_intake;
CREATE FUNCTION gcms_m5.domain_command(t text,b text,c jsonb,e jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE bound gcms_m5.domain_binding%ROWTYPE;attestation gcms_m5.local_domain_attestation%ROWTYPE;proof jsonb;result jsonb;observed_at timestamptz;BEGIN
 PERFORM gcms_s05.authorize(t,true);IF NOT gcms_m5.is_live(t) THEN RAISE EXCEPTION 'Tenant unavailable' USING ERRCODE='42501';END IF;
 IF NOT gcms_s02.has_recent_auth() THEN RETURN '{"code":"REAUTH_REQUIRED"}';END IF;
 IF e IS NOT NULL THEN RAISE EXCEPTION 'Caller attestation denied' USING ERRCODE='42501';END IF;
 -- A historical receipt never mints proof, changes primary or reactivates a host.
 IF EXISTS(SELECT 1 FROM gcms_m5.domain_receipt WHERE tenant_id=t AND operation_id=c->>'operationId') THEN RETURN gcms_m5.domain_command_before_attestation(t,b,c,NULL);END IF;
 IF c->>'action'='verify-local' THEN
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT(c ?& ARRAY['action','operationId','expectedVersion']) OR (c-ARRAY['action','operationId','expectedVersion'])<>'{}' OR gcms_m3.uuid(c->>'operationId') IS NOT TRUE OR gcms_m3.version(c->'expectedVersion') IS NOT TRUE THEN RAISE EXCEPTION 'Invalid local verification' USING ERRCODE='23514';END IF;
  SELECT * INTO bound FROM gcms_m5.domain_binding WHERE tenant_id=t AND id=b FOR UPDATE;
  IF bound.id IS NULL THEN RETURN '{"code":"NOT_FOUND"}';END IF;
  IF bound.state<>'pending' OR bound.version IS DISTINCT FROM (c->>'expectedVersion')::integer THEN RAISE EXCEPTION 'Binding version conflict' USING ERRCODE='40001';END IF;
  SELECT * INTO attestation FROM gcms_m5.local_domain_attestation a WHERE a.tenant_id=t AND a.host=bound.host AND a.origin='http://'||bound.host||':5892' AND a.mode='local-m5' AND a.enabled AND a.attested_at<=clock_timestamp() AND a.expires_at>clock_timestamp() FOR SHARE;
  IF attestation.id IS NULL THEN RAISE EXCEPTION 'Owner local manifest attestation required' USING ERRCODE='42501';END IF;
  observed_at:=clock_timestamp();
  proof:=jsonb_build_object('bindingId',bound.id,'tenantId',t,'siteId',t,'host',bound.host,'generation',bound.generation,'adapter','synthetic-local','tls','valid','origin',attestation.origin,'verifiedAt',observed_at,'expiresAt',least(attestation.expires_at,observed_at+interval '1 hour'));
  result:=gcms_m5.domain_command_before_attestation(t,b,c,proof);
  UPDATE gcms_m5.domain_evidence SET attestation_id=attestation.id WHERE tenant_id=t AND binding_id=b AND generation=bound.generation AND host=bound.host AND verified_at=observed_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'Local attestation closure failed' USING ERRCODE='23514';END IF;RETURN result;
 END IF;
 IF c->>'action'='primary' AND c->>'mode'='custom' AND NOT gcms_m5.binding_attested(t,c->>'bindingId',clock_timestamp()) THEN RAISE EXCEPTION 'Current attested binding required' USING ERRCODE='40001';END IF;
 RETURN gcms_m5.domain_command_before_attestation(t,b,c,NULL);
END $$;
REVOKE ALL ON FUNCTION gcms_m5.domain_command(text,text,jsonb,jsonb) FROM PUBLIC,gcms_s02_auth,gcms_s02_platform,gcms_s04_intake;
GRANT EXECUTE ON FUNCTION gcms_m5.domain_command(text,text,jsonb,jsonb) TO gcms_s02_tenant;

CREATE OR REPLACE FUNCTION gcms_m5.public_primary(t text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE p jsonb;expected text:=current_setting('gcms.m5_primary_version',true);eb text:=current_setting('gcms.m5_entry_binding',true);eg text:=current_setting('gcms.m5_entry_generation',true);BEGIN
 IF NOT gcms_m5.is_live(t) THEN RETURN NULL;END IF;p:=gcms_m5.primary_view(t);IF p IS NULL OR p->>'origin' IS NULL THEN RETURN NULL;END IF;
 IF p->>'mode'='custom' AND NOT gcms_m5.binding_attested(t,p->>'bindingId') THEN RETURN NULL;END IF;
 IF coalesce(expected,'')<>'' AND expected IS DISTINCT FROM p->>'version' THEN RAISE EXCEPTION 'Primary changed' USING ERRCODE='40001';END IF;
 IF coalesce(eb,'')<>'' AND (NOT gcms_m5.binding_attested(t,eb) OR NOT EXISTS(SELECT 1 FROM gcms_m5.domain_binding b WHERE b.tenant_id=t AND b.id=eb AND b.generation::text=eg)) THEN RAISE EXCEPTION 'Entry changed' USING ERRCODE='40001';END IF;
 RETURN p;
END $$;

CREATE OR REPLACE FUNCTION gcms_m5.resolve_entry(host_value text,path_value text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE t text;slug_value text;base text;origin_value text;binding_value text;generation_value integer:=0;page_path text;p jsonb;metadata boolean;BEGIN
 IF host_value IS NULL OR path_value IS NULL OR length(path_value)>2048 OR position('//' IN path_value)>0 THEN RETURN NULL;END IF;
 metadata:=CASE WHEN host_value='localhost:5892' THEN path_value='/robots.txt' OR path_value ~ '^/[a-z0-9]+(-[a-z0-9]+)*/(sitemap\.xml|robots\.txt)$' ELSE path_value IN('/sitemap.xml','/robots.txt') END;
 IF NOT metadata AND path_value !~ '^/([a-z0-9-]+(/[a-z0-9-]+)*)?/?$' THEN RETURN NULL;END IF;
 IF host_value='localhost:5892' THEN slug_value:=split_part(path_value,'/',2);IF NOT gcms_s02.valid_slug(slug_value) THEN RETURN NULL;END IF;
  SELECT tenant_id INTO t FROM gcms_s02.site_draft WHERE slug=slug_value AND public_enabled AND slug_locked;base:='/'||slug_value;origin_value:='http://localhost:5892';page_path:=substr(path_value,length(base)+1);IF page_path='' THEN page_path:='/';END IF;
 ELSE
  SELECT b.tenant_id,b.id,b.generation,b.origin,s.slug INTO t,binding_value,generation_value,origin_value,slug_value FROM gcms_m5.domain_binding b JOIN gcms_s02.site_draft s ON s.tenant_id=b.tenant_id WHERE b.host||':5892'=host_value AND s.public_enabled AND s.slug_locked AND gcms_m5.binding_attested(b.tenant_id,b.id);base:='';page_path:=path_value;
 END IF;
 p:=gcms_m5.public_primary(t);IF t IS NULL OR p IS NULL THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('tenantId',t,'siteId',t,'tenantSlug',slug_value,'entry',jsonb_build_object('mode',CASE WHEN binding_value IS NULL THEN 'platform' ELSE 'custom' END,'origin',origin_value,'basePath',base,'bindingId',binding_value,'generation',generation_value),'primary',p,'sitePagePath',page_path);
END $$;
CREATE OR REPLACE FUNCTION gcms_m5.intake_origin_allowed(origin_value text,slug_value text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(EXISTS(SELECT 1 FROM gcms_s02.site_draft s WHERE s.slug=slug_value AND gcms_m5.is_readable(s.tenant_id) AND (origin_value='http://localhost:5892' OR EXISTS(SELECT 1 FROM gcms_m5.domain_binding b WHERE b.tenant_id=s.tenant_id AND b.origin=origin_value AND gcms_m5.binding_attested(b.tenant_id,b.id)))),false)
$$;
ALTER FUNCTION gcms_m5.delete_domain_data(text) RENAME TO delete_domain_data_before_attestation;
REVOKE ALL ON FUNCTION gcms_m5.delete_domain_data_before_attestation(text) FROM PUBLIC,gcms_s02_auth,gcms_s02_tenant,gcms_s02_platform,gcms_s04_intake;
CREATE FUNCTION gcms_m5.delete_domain_data(t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$BEGIN
 IF NOT gcms_m5.cleanup_authorized(t) THEN RAISE EXCEPTION 'Confirmed cleanup required' USING ERRCODE='42501';END IF;
 PERFORM gcms_m5.delete_domain_data_before_attestation(t);DELETE FROM gcms_m5.local_domain_attestation WHERE tenant_id=t;
END $$;
REVOKE ALL ON FUNCTION gcms_m5.delete_domain_data(text) FROM PUBLIC,gcms_s02_auth,gcms_s02_tenant,gcms_s02_platform,gcms_s04_intake;
