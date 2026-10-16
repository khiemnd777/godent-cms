-- Forward repair: retain the configured private primary address during reverification.
-- Current-primary readiness is distinct from the content-only activation precondition.
DO $$ BEGIN IF current_user<>'gcms_s02_owner' THEN RAISE EXCEPTION 'M5 owner required';END IF;END $$;
CREATE OR REPLACE FUNCTION gcms_m5.primary_view(t text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('mode',CASE WHEN p.binding_id IS NULL THEN 'godent' ELSE 'custom' END,'bindingId',p.binding_id,'version',coalesce(p.version,0),
 'origin',CASE WHEN p.binding_id IS NULL THEN coalesce(s.canonical_origin,'http://localhost:5892') ELSE coalesce(b.origin,'http://'||b.host||':5892') END,'basePath',CASE WHEN p.binding_id IS NULL AND s.slug IS NOT NULL THEN '/'||s.slug ELSE '' END)
 FROM gcms_s02.tenant ten LEFT JOIN gcms_s02.site_draft s ON s.tenant_id=ten.id LEFT JOIN gcms_m5.domain_primary p ON p.tenant_id=ten.id LEFT JOIN gcms_m5.domain_binding b ON b.tenant_id=p.tenant_id AND b.id=p.binding_id WHERE ten.id=t
$$;

CREATE OR REPLACE FUNCTION gcms_m5.domains_view(t text,after_id text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE values_json jsonb;more boolean;primary_value jsonb;readiness_value jsonb;BEGIN
 PERFORM gcms_m5.require_read(t);
 SELECT coalesce(jsonb_agg(row_value ORDER BY id),'[]'),count(*)>25 INTO values_json,more FROM (SELECT id,jsonb_build_object('id',id,'tenantId',tenant_id,'host',host,'state',state,'tls',tls,'generation',generation,'version',version,'origin',origin,'verifiedAt',verified_at,'tlsExpiresAt',tls_expires_at) row_value FROM gcms_m5.domain_binding WHERE tenant_id=t AND (after_id IS NULL OR id>after_id) ORDER BY id LIMIT 26) d;
 IF more THEN values_json:=values_json-25;END IF;
 primary_value:=gcms_m5.primary_view(t);readiness_value:=gcms_m5.domain_readiness(t);
 IF primary_value->>'mode'='custom' AND NOT gcms_m5.binding_attested(t,primary_value->>'bindingId') THEN
  readiness_value:=readiness_value||jsonb_build_object('ready',false,'issues',(readiness_value->'issues')||jsonb_build_array('CURRENT_PRIMARY_BINDING_INELIGIBLE'));
 END IF;
 RETURN jsonb_build_object('bindings',values_json,'primary',primary_value,'readiness',readiness_value,'hasMore',more,'nextCursor',NULL);
END $$;
