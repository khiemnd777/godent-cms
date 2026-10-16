-- Forward repair: allowlisted sign-in link uses the implemented admin login route.
CREATE OR REPLACE FUNCTION gcms_s05.worker_start(p_tenant text,p_delivery text,p_worker text,p_fence integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d gcms_s05.delivery%ROWTYPE; l gcms_s04.lead%ROWTYPE; i gcms_s04.notification_intent%ROWTYPE;
  stamp timestamptz; tenant_status text; recipient_email text; ids text[];
BEGIN
  IF NOT EXISTS(SELECT 1 FROM gcms_s05.worker_scope WHERE tenant_id=p_tenant AND enabled) THEN RAISE EXCEPTION 'Invalid local worker scope' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202)); stamp:=clock_timestamp();
  SELECT * INTO d FROM gcms_s05.delivery WHERE tenant_id=p_tenant AND id=p_delivery FOR UPDATE;
  IF d.id IS NULL OR d.status<>'processing' OR d.worker_id IS DISTINCT FROM p_worker OR d.fence IS DISTINCT FROM p_fence OR d.lease_until<=stamp THEN RETURN NULL; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended(d.id,7505)) THEN RETURN NULL; END IF;
  SELECT status INTO tenant_status FROM gcms_s02.tenant WHERE id=p_tenant FOR SHARE;
  SELECT * INTO l FROM gcms_s04.lead WHERE tenant_id=p_tenant AND id=d.lead_id FOR SHARE;
  SELECT * INTO i FROM gcms_s04.notification_intent WHERE tenant_id=p_tenant AND lead_id=d.lead_id FOR UPDATE;
  SELECT email INTO recipient_email FROM gcms_s02_auth."user" WHERE id=d.recipient_user_id FOR SHARE;
  PERFORM 1 FROM gcms_s02.membership WHERE tenant_id=p_tenant AND user_id=d.recipient_user_id FOR SHARE;
  ids:=coalesce(gcms_s05.current_recipients(p_tenant),'{}');
  IF l.id IS NULL OR l.expires_at<=stamp OR i.created_at+interval '24 hours'<=stamp OR d.attempts>=5 OR i.status IN ('failed','cancelled','captured') OR l.status='closed' THEN
    UPDATE gcms_s05.delivery SET status=CASE WHEN l.status='closed' OR i.status='cancelled' THEN 'cancelled' ELSE 'failed' END,failure_reason='unavailable',lease_until=NULL WHERE id=d.id;
    IF l.status='closed' THEN UPDATE gcms_s04.notification_intent SET status='cancelled',blocked_reason=NULL WHERE tenant_id=p_tenant AND lead_id=d.lead_id;
    ELSIF l.id IS NULL OR l.expires_at<=stamp OR i.created_at+interval '24 hours'<=stamp THEN
      UPDATE gcms_s04.notification_intent SET status='failed',blocked_reason=CASE WHEN l.expires_at<=stamp THEN 'lead_expired' ELSE 'delivery_deadline' END WHERE tenant_id=p_tenant AND lead_id=d.lead_id;
    END IF;
    RETURN NULL;
  END IF;
  IF tenant_status<>'active' OR NOT(d.recipient_user_id=ANY(ids)) OR NOT gcms_s05.eligible(p_tenant,d.recipient_user_id) THEN
    UPDATE gcms_s05.delivery SET status='blocked',failure_reason=CASE WHEN tenant_status<>'active' THEN 'tenant_suspended' ELSE 'recipient_unavailable' END,
      available_at=stamp+interval '1 minute',lease_until=NULL WHERE id=d.id;
    UPDATE gcms_s04.notification_intent SET status='blocked',blocked_reason=CASE WHEN tenant_status<>'active' THEN 'tenant_suspended' ELSE 'recipient_unavailable' END,next_attempt_at=stamp+interval '1 minute'
      WHERE tenant_id=p_tenant AND lead_id=d.lead_id; RETURN NULL;
  END IF;
  -- Persist crash-safe retry eligibility before I/O. Completion can delay retry further.
  UPDATE gcms_s05.delivery SET attempts=attempts+1,started_at=stamp,lease_until=stamp+interval '30 seconds',
    available_at=stamp+CASE d.attempts WHEN 0 THEN interval '1 minute' WHEN 1 THEN interval '5 minutes' WHEN 2 THEN interval '30 minutes' ELSE interval '2 hours' END WHERE id=d.id;
  RETURN jsonb_build_object('deliveryId',d.id,'recipientEmail',recipient_email,'transport','local_capture','signInUrl','http://127.0.0.1:5891/login');
END $$;
