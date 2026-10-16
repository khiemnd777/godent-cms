-- Forward repair: verification readiness must include the attestation linked in this transaction.
-- Rebuild only the returned current view; preserve the exact receipt fields and historical replay branch.
DO $$ BEGIN IF current_user<>'gcms_s02_owner' THEN RAISE EXCEPTION 'M5 owner required';END IF;END $$;
CREATE OR REPLACE FUNCTION gcms_m5.domain_command(t text,b text,c jsonb,e jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
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
  IF NOT FOUND THEN RAISE EXCEPTION 'Local attestation closure failed' USING ERRCODE='23514';END IF;
  RETURN gcms_m5.domains_view(t)||jsonb_build_object('operationId',result->'operationId','bindingId',result->'bindingId','appliedPrimaryVersion',result->'appliedPrimaryVersion','replayed',result->'replayed');
 END IF;
 IF c->>'action'='primary' AND c->>'mode'='custom' AND NOT gcms_m5.binding_attested(t,c->>'bindingId',clock_timestamp()) THEN RAISE EXCEPTION 'Current attested binding required' USING ERRCODE='40001';END IF;
 RETURN gcms_m5.domain_command_before_attestation(t,b,c,NULL);
END $$;
