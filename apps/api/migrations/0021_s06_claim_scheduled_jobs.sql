-- Forward repair: schedule and claim newly due owned jobs in the same poll.
CREATE OR REPLACE FUNCTION gcms_s06.worker_claim(p_tenant text,p_worker text,p_limit integer DEFAULT 10) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l record; j record; target text; stamp timestamptz; result jsonb:='[]';
BEGIN
  PERFORM gcms_s06.require_scope(p_tenant);
  IF p_worker IS NULL OR p_worker !~ '^[a-f0-9-]{36}$' OR p_limit IS NULL OR p_limit<1 OR p_limit>10 THEN RAISE EXCEPTION 'Invalid retention claim' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant,7202)); stamp:=clock_timestamp();
  FOR l IN SELECT x.* FROM gcms_s04.lead x JOIN gcms_s06.lead_scope s ON s.tenant_id=x.tenant_id AND s.lead_id=x.id
    WHERE x.tenant_id=p_tenant AND x.expires_at<=stamp+interval '7 days' AND (x.expires_at<=stamp OR
      NOT EXISTS(SELECT 1 FROM gcms_s06.notice n WHERE n.tenant_id=x.tenant_id AND n.lead_id=x.id AND n.revision=x.retention_revision) OR
      EXISTS(SELECT 1 FROM gcms_s02.membership m WHERE m.tenant_id=x.tenant_id AND gcms_s05.eligible(x.tenant_id,m.user_id) AND NOT EXISTS(
        SELECT 1 FROM gcms_s06.job z WHERE z.tenant_id=x.tenant_id AND z.lead_id=x.id AND z.revision=x.retention_revision AND z.kind='notice' AND z.recipient_id=m.user_id)))
    ORDER BY x.expires_at,x.id LIMIT 100 FOR UPDATE OF x LOOP
    UPDATE gcms_s06.job SET status='cancelled',failure_reason='stale_revision',lease_until=NULL
      WHERE tenant_id=p_tenant AND lead_id=l.id AND revision<>l.retention_revision AND status IN ('pending','processing','blocked');
    IF l.expires_at<=stamp THEN
      UPDATE gcms_s06.job SET status='cancelled',failure_reason='lead_expired',lease_until=NULL WHERE tenant_id=p_tenant AND lead_id=l.id AND kind='notice' AND status IN ('pending','processing','blocked');
      INSERT INTO gcms_s06.job(tenant_id,lead_id,revision,kind,recipient_id) VALUES(p_tenant,l.id,l.retention_revision,'delete','system') ON CONFLICT DO NOTHING;
    ELSIF EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=p_tenant AND status IN ('active','suspended')) THEN
      INSERT INTO gcms_s06.notice(tenant_id,lead_id,revision,expires_at) VALUES(p_tenant,l.id,l.retention_revision,l.expires_at) ON CONFLICT DO NOTHING;
      FOR target IN SELECT m.user_id FROM gcms_s02.membership m WHERE m.tenant_id=p_tenant AND gcms_s05.eligible(p_tenant,m.user_id) LOOP
        INSERT INTO gcms_s06.job(tenant_id,lead_id,revision,kind,recipient_id) VALUES(p_tenant,l.id,l.retention_revision,'notice',target) ON CONFLICT DO NOTHING;
      END LOOP;
      PERFORM gcms_s06.refresh_notice(p_tenant,l.id,l.retention_revision);
    END IF;
  END LOOP;
  -- Newly inserted jobs use clock_timestamp() defaults later than the scheduling stamp.
  stamp:=clock_timestamp();
  FOR j IN SELECT x.* FROM gcms_s06.job x JOIN gcms_s06.lead_scope s ON s.tenant_id=x.tenant_id AND s.lead_id=x.lead_id
    WHERE x.tenant_id=p_tenant AND x.available_at<=stamp AND (x.status IN ('pending','blocked') OR (x.status='processing' AND x.lease_until<=stamp))
    ORDER BY CASE x.kind WHEN 'delete' THEN 0 ELSE 1 END,x.available_at,x.id LIMIT 100 FOR UPDATE OF x SKIP LOCKED LOOP
    EXIT WHEN jsonb_array_length(result)>=p_limit;
    IF NOT pg_try_advisory_xact_lock(hashtextextended(j.id,7606)) THEN CONTINUE; END IF;
    IF j.attempts>=5 THEN
      UPDATE gcms_s06.job SET status='failed',failure_reason='attempts_exhausted',lease_until=NULL WHERE id=j.id;
      IF j.kind='notice' THEN PERFORM gcms_s06.refresh_notice(p_tenant,j.lead_id,j.revision); END IF;
      CONTINUE;
    END IF;
    UPDATE gcms_s06.job SET status='processing',attempts=attempts+1,worker_id=p_worker,fence=fence+1,lease_until=stamp+interval '30 seconds',started_at=NULL WHERE id=j.id RETURNING fence INTO j.fence;
    result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'tenantId',p_tenant,'leadId',j.lead_id,'revision',j.revision,'kind',j.kind,'fence',j.fence));
  END LOOP;
  RETURN result;
END $$;
