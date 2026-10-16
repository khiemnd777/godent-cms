-- Complete the irreversible private-read boundary without changing AUTH self access.
-- The original permissive policies still enforce tenant and current membership.
DO $$ DECLARE tab text;BEGIN
 IF current_user<>'gcms_s02_owner' THEN RAISE EXCEPTION 'M5 owner required';END IF;
 CREATE POLICY m5_private_read_fence ON gcms_s02.tenant AS RESTRICTIVE FOR SELECT TO gcms_s02_tenant USING(gcms_m5.is_readable(id));
 FOREACH tab IN ARRAY ARRAY['gcms_s02.membership','gcms_s02.invitation','gcms_s02.audit_event','gcms_s02.publication_intent',
  'gcms_s08.operation_receipt','gcms_m3.receipt','gcms_m3.purge_job','gcms_m3.intent','gcms_m3.service_link_receipt',
  'gcms_m4.receipt','gcms_m4.intent','gcms_m4.purge_job'] LOOP
  EXECUTE format('CREATE POLICY m5_private_read_fence ON %s AS RESTRICTIVE FOR SELECT TO gcms_s02_tenant USING(gcms_m5.is_readable(tenant_id))',tab);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION gcms_s02.same_tenant_user(p_user text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p_user=gcms_s02.current_actor() OR
  (gcms_m5.is_readable(nullif(current_setting('gcms.tenant_id',true),''))
   AND gcms_s02.has_current_membership(nullif(current_setting('gcms.tenant_id',true),''))
   AND EXISTS(SELECT 1 FROM gcms_s02.membership WHERE tenant_id=nullif(current_setting('gcms.tenant_id',true),'') AND user_id=p_user))
$$;

CREATE OR REPLACE FUNCTION gcms_s04.has_lead_access(p_tenant text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p_tenant=nullif(current_setting('gcms.tenant_id',true),'')
  AND gcms_s02.has_current_membership(p_tenant) AND gcms_m5.is_readable(p_tenant)
$$;

CREATE OR REPLACE FUNCTION gcms_s05.authorize(p_tenant text,p_write boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor jsonb;tenant_status text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202));
 actor:=gcms_s02.lock_actor(gcms_s02.current_actor(),nullif(current_setting('gcms.session_id',true),''));
 SELECT status INTO tenant_status FROM gcms_s02.tenant WHERE id=p_tenant FOR SHARE;
 PERFORM 1 FROM gcms_s02.membership WHERE tenant_id=p_tenant AND user_id=gcms_s02.current_actor() FOR SHARE;
 IF p_tenant IS DISTINCT FROM nullif(current_setting('gcms.tenant_id',true),'') OR NOT gcms_s02.has_current_membership(p_tenant)
  OR NOT gcms_m5.is_readable(p_tenant) OR tenant_status IS NULL OR tenant_status NOT IN ('active','suspended')
  OR (p_write AND NOT gcms_m5.is_live(p_tenant)) THEN
  RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
 END IF;
END $$;
