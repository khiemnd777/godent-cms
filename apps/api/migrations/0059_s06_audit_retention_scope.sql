-- Forward repair: audit retention survives removal of business worker enrollment.
-- Preserve existing enrollment states and exact tenant-less audit identities.
DO $$ BEGIN
  IF current_user<>'gcms_s02_owner' OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='gcms_s06' AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
    THEN RAISE EXCEPTION 'S06 bootstrap ownership required'; END IF;
END $$;

CREATE TABLE gcms_s06.audit_retention_scope (
  tenant_id text PRIMARY KEY REFERENCES gcms_s02.tenant(id), enabled boolean NOT NULL DEFAULT false
);
ALTER TABLE gcms_s06.audit_retention_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_s06.audit_retention_scope FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_only ON gcms_s06.audit_retention_scope TO gcms_s02_owner USING(true) WITH CHECK(true);
REVOKE ALL ON TABLE gcms_s06.audit_retention_scope FROM PUBLIC,gcms_s02_migration,gcms_s02_tenant,gcms_s02_platform,gcms_s02_auth,gcms_s04_intake,gcms_s05_worker,gcms_s06_worker,gcms_s07_worker,gcms_m5_worker;

-- Freeze enrollment changes until the copy and foreign-key transfer commit.
-- The migration runner bounds lock waits; this migration never invokes a worker.
LOCK TABLE gcms_s06.worker_scope IN SHARE MODE;
INSERT INTO gcms_s06.audit_retention_scope(tenant_id,enabled)
  SELECT tenant_id,enabled FROM gcms_s06.worker_scope;
ALTER TABLE gcms_s06.audit_scope DROP CONSTRAINT audit_scope_tenant_id_fkey;
ALTER TABLE gcms_s06.audit_scope ADD CONSTRAINT audit_scope_tenant_id_fkey
  FOREIGN KEY(tenant_id) REFERENCES gcms_s06.audit_retention_scope(tenant_id);

CREATE OR REPLACE FUNCTION gcms_s06.worker_expire_audit(p_tenant text,p_limit integer DEFAULT 100) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a integer; b integer; c integer; stamp timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
  IF NOT EXISTS(SELECT 1 FROM gcms_s06.audit_retention_scope WHERE tenant_id=p_tenant AND enabled) THEN RAISE EXCEPTION 'Audit retention scope denied' USING ERRCODE='42501'; END IF;
  IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'Invalid audit batch' USING ERRCODE='22023'; END IF;
  stamp:=clock_timestamp();
  WITH due AS (SELECT a.id FROM gcms_s02.audit_event a WHERE (a.tenant_id=p_tenant OR (a.tenant_id IS NULL AND EXISTS(SELECT 1 FROM gcms_s06.audit_scope s WHERE s.tenant_id=p_tenant AND s.source='s02' AND s.record_id=a.id))) AND a.created_at<=stamp-interval '365 days' ORDER BY a.created_at,a.id LIMIT p_limit FOR UPDATE SKIP LOCKED)
    DELETE FROM gcms_s02.audit_event WHERE id IN(SELECT id FROM due); GET DIAGNOSTICS a=ROW_COUNT;
  WITH due AS (SELECT id FROM gcms_s04.audit_event WHERE tenant_id=p_tenant AND created_at<=stamp-interval '365 days' ORDER BY created_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED)
    DELETE FROM gcms_s04.audit_event WHERE id IN(SELECT id FROM due); GET DIAGNOSTICS b=ROW_COUNT;
  WITH due AS (SELECT id FROM gcms_s06.audit_event WHERE tenant_id=p_tenant AND created_at<=stamp-interval '365 days' ORDER BY created_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED)
    DELETE FROM gcms_s06.audit_event WHERE id IN(SELECT id FROM due); GET DIAGNOSTICS c=ROW_COUNT;
  RETURN jsonb_build_object('authenticated',a,'anonymous',b,'system',c);
END $$;
REVOKE ALL ON FUNCTION gcms_s06.worker_expire_audit(text,integer) FROM PUBLIC,gcms_s02_migration,gcms_s02_tenant,gcms_s02_platform,gcms_s02_auth,gcms_s04_intake,gcms_s05_worker,gcms_s07_worker,gcms_m5_worker;
GRANT EXECUTE ON FUNCTION gcms_s06.worker_expire_audit(text,integer) TO gcms_s06_worker;

-- Keep audit authorization/mapping while the unchanged cleanup removes business data.
CREATE OR REPLACE FUNCTION gcms_s04.delete_m5_data(t text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NOT gcms_m5.cleanup_authorized(t) THEN RAISE EXCEPTION 'Cleanup denied' USING ERRCODE='42501';END IF;
 DELETE FROM gcms_s04.accepted_request WHERE tenant_id=t;DELETE FROM gcms_s04.intake_activity WHERE tenant_id=t;DELETE FROM gcms_s04.notification_intent WHERE tenant_id=t;DELETE FROM gcms_s04.challenge WHERE tenant_id=t;DELETE FROM gcms_s04.request_event WHERE tenant_id=t;
 -- Existing FK contracts delete lead events/receipts/deliveries and retention children.
 DELETE FROM gcms_s04.lead WHERE tenant_id=t;
 DELETE FROM gcms_s05.delivery WHERE tenant_id=t;DELETE FROM gcms_s05.operation_receipt WHERE tenant_id=t;DELETE FROM gcms_s05.lead_event WHERE tenant_id=t;DELETE FROM gcms_s05.settings_receipt WHERE tenant_id=t;DELETE FROM gcms_s05.recipient_settings WHERE tenant_id=t;DELETE FROM gcms_s05.lead_sequence WHERE tenant_id=t;DELETE FROM gcms_s05.worker_scope WHERE tenant_id=t;
 DELETE FROM gcms_s06.extension_receipt WHERE tenant_id=t;DELETE FROM gcms_s06.notice WHERE tenant_id=t;DELETE FROM gcms_s06.job WHERE tenant_id=t;DELETE FROM gcms_s06.deletion_decision WHERE tenant_id=t;DELETE FROM gcms_s06.lead_scope WHERE tenant_id=t;DELETE FROM gcms_s06.worker_scope WHERE tenant_id=t;
END $$;
