-- Forward repair: newly materialized deliveries are due within their claim transaction.
CREATE OR REPLACE FUNCTION gcms_s05.worker_claim(p_tenant text,p_worker text,p_limit integer DEFAULT 10) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE stamp timestamptz; i record; d record; ids text[]; target text; found_eligible boolean; result jsonb:='[]';
BEGIN
  IF p_worker IS NULL OR p_worker !~ '^[a-f0-9-]{36}$' OR p_limit IS NULL OR p_limit<1 OR p_limit>10 OR NOT EXISTS(SELECT 1 FROM gcms_s05.worker_scope WHERE tenant_id=p_tenant AND enabled)
    THEN RAISE EXCEPTION 'Invalid local worker scope' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202)); stamp:=clock_timestamp();
  FOR i IN SELECT n.*,l.status AS lead_status,l.expires_at,t.status AS tenant_status FROM gcms_s04.notification_intent n
    JOIN gcms_s04.lead l ON l.tenant_id=n.tenant_id AND l.id=n.lead_id JOIN gcms_s02.tenant t ON t.id=n.tenant_id
    WHERE n.tenant_id=p_tenant AND n.status IN ('pending','blocked','processing') AND n.next_attempt_at<=stamp
    ORDER BY n.next_attempt_at,n.created_at,n.lead_id LIMIT 10 FOR UPDATE OF n SKIP LOCKED LOOP
    IF i.expires_at<=stamp OR i.created_at+interval '24 hours'<=stamp THEN
      UPDATE gcms_s04.notification_intent SET status='failed',blocked_reason=CASE WHEN i.expires_at<=stamp THEN 'lead_expired' ELSE 'delivery_deadline' END
        WHERE tenant_id=p_tenant AND lead_id=i.lead_id;
      CONTINUE;
    END IF;
    IF i.lead_status='closed' THEN
      UPDATE gcms_s04.notification_intent SET status='cancelled',blocked_reason=NULL WHERE tenant_id=p_tenant AND lead_id=i.lead_id;
      UPDATE gcms_s05.delivery SET status='cancelled',failure_reason='lead_closed' WHERE tenant_id=p_tenant AND lead_id=i.lead_id AND status IN ('pending','blocked'); CONTINUE;
    END IF;
    IF i.tenant_status<>'active' THEN
      UPDATE gcms_s04.notification_intent SET status='blocked',blocked_reason='tenant_suspended',next_attempt_at=stamp+interval '1 minute' WHERE tenant_id=p_tenant AND lead_id=i.lead_id; CONTINUE;
    END IF;
    ids:=coalesce(gcms_s05.current_recipients(p_tenant),'{}'); found_eligible:=false;
    FOREACH target IN ARRAY ids LOOP
      IF gcms_s05.eligible(p_tenant,target) THEN
        found_eligible:=true;
        INSERT INTO gcms_s05.delivery(tenant_id,lead_id,recipient_user_id,available_at) VALUES(p_tenant,i.lead_id,target,stamp) ON CONFLICT(tenant_id,lead_id,recipient_user_id) DO NOTHING;
        UPDATE gcms_s05.delivery SET status='pending',failure_reason=NULL WHERE tenant_id=p_tenant AND lead_id=i.lead_id AND recipient_user_id=target AND status='cancelled' AND failure_reason='recipient_changed';
      END IF;
    END LOOP;
    UPDATE gcms_s05.delivery SET status='cancelled',failure_reason='recipient_changed' WHERE tenant_id=p_tenant AND lead_id=i.lead_id AND status IN ('pending','blocked') AND NOT(recipient_user_id=ANY(ids));
    IF NOT found_eligible THEN
      UPDATE gcms_s04.notification_intent SET status='blocked',blocked_reason='recipient_unavailable',next_attempt_at=stamp+interval '1 minute' WHERE tenant_id=p_tenant AND lead_id=i.lead_id; CONTINUE;
    END IF;
    FOR d IN SELECT x.* FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=i.lead_id AND x.status='processing'
      AND x.attempts>=5 AND x.lease_until<=stamp AND x.available_at<=stamp FOR UPDATE SKIP LOCKED LOOP
      IF pg_try_advisory_xact_lock(hashtextextended(d.id,7505)) THEN
        UPDATE gcms_s05.delivery SET status='failed',failure_reason='attempts_exhausted',lease_until=NULL WHERE id=d.id;
      END IF;
    END LOOP;
    FOR d IN SELECT x.* FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=i.lead_id AND x.recipient_user_id=ANY(ids)
      AND gcms_s05.eligible(p_tenant,x.recipient_user_id) AND x.attempts<5 AND x.available_at<=stamp
      AND (x.status IN ('pending','blocked') OR (x.status='processing' AND x.lease_until<=stamp)) ORDER BY x.id FOR UPDATE SKIP LOCKED LOOP
      EXIT WHEN jsonb_array_length(result)>=p_limit;
      -- A live worker retains this session advisory lock until its actual I/O promise settles.
      -- An elapsed lease or a timer does not establish cancellation of I/O.
      IF NOT pg_try_advisory_xact_lock(hashtextextended(d.id,7505)) THEN CONTINUE; END IF;
      UPDATE gcms_s05.delivery SET status='processing',fence=fence+1,worker_id=p_worker,lease_until=stamp+interval '30 seconds',failure_reason=NULL
        WHERE id=d.id RETURNING fence INTO d.fence;
      result:=result||jsonb_build_array(jsonb_build_object('id',d.id,'tenantId',p_tenant,'fence',d.fence));
    END LOOP;
    IF EXISTS(SELECT 1 FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=i.lead_id AND x.recipient_user_id=ANY(ids) AND gcms_s05.eligible(p_tenant,x.recipient_user_id) AND x.status='captured')
      AND NOT EXISTS(SELECT 1 FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=i.lead_id AND x.recipient_user_id=ANY(ids) AND gcms_s05.eligible(p_tenant,x.recipient_user_id) AND x.status<>'captured') THEN
      UPDATE gcms_s04.notification_intent SET status='captured',blocked_reason=NULL WHERE tenant_id=p_tenant AND lead_id=i.lead_id;
    ELSIF NOT EXISTS(SELECT 1 FROM unnest(ids) AS recipient_row(recipient_id) WHERE gcms_s05.eligible(p_tenant,recipient_row.recipient_id) AND NOT EXISTS(
      SELECT 1 FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=i.lead_id AND x.recipient_user_id=recipient_row.recipient_id AND x.status IN ('captured','failed'))) THEN
      UPDATE gcms_s04.notification_intent SET status='failed',blocked_reason='attempts_exhausted' WHERE tenant_id=p_tenant AND lead_id=i.lead_id;
    ELSE
      UPDATE gcms_s04.notification_intent SET status=CASE WHEN EXISTS(SELECT 1 FROM gcms_s05.delivery x WHERE x.tenant_id=p_tenant AND x.lead_id=i.lead_id AND x.status='processing') THEN 'processing' ELSE 'pending' END,
        blocked_reason=NULL,next_attempt_at=stamp+interval '1 second' WHERE tenant_id=p_tenant AND lead_id=i.lead_id;
    END IF;
    EXIT WHEN jsonb_array_length(result)>=p_limit;
  END LOOP;
  RETURN result;
END $$;
