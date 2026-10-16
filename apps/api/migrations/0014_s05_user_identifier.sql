-- AUTH-001 forward repair. Only the assignment user-ID predicate changes.
-- Existing authorization, locks, eligibility, receipts, versions and grants remain.
CREATE OR REPLACE FUNCTION gcms_s05.lead_command(p_tenant text,p_lead text,c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l gcms_s04.lead%ROWTYPE; receipt gcms_s05.operation_receipt%ROWTYPE; kind text:=c->>'kind';
  stamp timestamptz; actor_key text:=gcms_s02.current_actor(); actor_label text; payload jsonb; assigned text; v integer;
BEGIN
  PERFORM gcms_s05.authorize(p_tenant,true); stamp:=clock_timestamp();
  SELECT * INTO l FROM gcms_s04.lead WHERE tenant_id=p_tenant AND id=p_lead FOR UPDATE;
  IF l.id IS NULL OR l.expires_at<=stamp THEN RETURN '{"code":"LEAD_UNAVAILABLE"}'; END IF;
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR jsonb_typeof(c->'operationId') IS DISTINCT FROM 'string' OR
    c->>'operationId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR
    jsonb_typeof(c->'expectedVersion') IS DISTINCT FROM 'number' OR c->>'expectedVersion' !~ '^[1-9][0-9]{0,8}$' OR
    jsonb_typeof(c->'kind') IS DISTINCT FROM 'string' OR kind NOT IN ('assign','note','contact','close','reopen') OR
    NOT(c ?& ARRAY['operationId','expectedVersion','kind']) THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
  IF (kind='assign' AND (NOT(c ? 'assigneeUserId') OR (c-ARRAY['operationId','expectedVersion','kind','assigneeUserId'])<>'{}'::jsonb OR
      (c->'assigneeUserId'<>'null'::jsonb AND (jsonb_typeof(c->'assigneeUserId') IS DISTINCT FROM 'string' OR c->>'assigneeUserId' !~ '^[A-Za-z0-9_-]{1,128}$')))) OR
    (kind='note' AND ((c-ARRAY['operationId','expectedVersion','kind','text'])<>'{}'::jsonb OR jsonb_typeof(c->'text') IS DISTINCT FROM 'string' OR NOT gcms_s05.valid_text(c->>'text'))) OR
    (kind='contact' AND ((c-ARRAY['operationId','expectedVersion','kind','channel','outcome','summary'])<>'{}'::jsonb OR
      jsonb_typeof(c->'summary') IS DISTINCT FROM 'string' OR NOT gcms_s05.valid_text(c->>'summary') OR
      jsonb_typeof(c->'channel') IS DISTINCT FROM 'string' OR jsonb_typeof(c->'outcome') IS DISTINCT FROM 'string' OR
      c->>'channel' NOT IN ('phone','email') OR c->>'outcome' NOT IN ('two_way','unanswered','email_sent') OR
      NOT(c ?& ARRAY['channel','outcome','summary']) OR (c->>'outcome'='unanswered' AND c->>'channel'<>'phone') OR (c->>'outcome'='email_sent' AND c->>'channel'<>'email'))) OR
    (kind='close' AND ((c-ARRAY['operationId','expectedVersion','kind','reason'])<>'{}'::jsonb OR jsonb_typeof(c->'reason') IS DISTINCT FROM 'string' OR c->>'reason' NOT IN ('completed','unreachable','spam','duplicate'))) OR
    (kind='reopen' AND ((c-ARRAY['operationId','expectedVersion','kind','reason'])<>'{}'::jsonb OR jsonb_typeof(c->'reason') IS DISTINCT FROM 'string' OR NOT gcms_s05.valid_text(c->>'reason')))
    THEN RETURN '{"code":"INVALID_INPUT"}'; END IF;
  SELECT * INTO receipt FROM gcms_s05.operation_receipt WHERE tenant_id=p_tenant AND operation_id=c->>'operationId';
  IF receipt.operation_id IS NOT NULL THEN
    IF receipt.lead_id<>p_lead OR receipt.actor_id<>actor_key OR receipt.command<>c THEN RETURN '{"code":"OPERATION_CONFLICT"}'; END IF;
    RETURN jsonb_build_object('operationId',receipt.operation_id,'appliedVersion',receipt.applied_version,'replayed',true);
  END IF;
  IF l.version<>(c->>'expectedVersion')::integer THEN RETURN '{"code":"VERSION_CONFLICT"}'; END IF;
  IF (kind IN ('assign','contact','close') AND l.status='closed') OR (kind='reopen' AND l.status<>'closed') OR
    (kind='close' AND c->>'reason'='completed' AND NOT l.has_two_way_contact) OR
    (kind='close' AND c->>'reason'='unreachable' AND NOT l.has_contact_attempt) THEN RETURN '{"code":"INVALID_TRANSITION"}'; END IF;
  IF kind='assign' THEN
    assigned:=c->>'assigneeUserId';
    IF assigned IS NOT NULL THEN
      PERFORM 1 FROM gcms_s02_auth."user" WHERE id=assigned FOR SHARE;
      PERFORM 1 FROM gcms_s02.membership WHERE tenant_id=p_tenant AND user_id=assigned FOR SHARE;
      IF NOT gcms_s05.eligible(p_tenant,assigned) THEN RETURN '{"code":"ASSIGNEE_UNAVAILABLE"}'; END IF;
    END IF;
    payload:=jsonb_build_object('before',gcms_s05.assignee(p_tenant,l.assignee_user_id),'after',gcms_s05.assignee(p_tenant,assigned));
    l.assignee_user_id:=assigned;
    IF l.status IN ('new','assigned') THEN l.status:=CASE WHEN assigned IS NULL THEN 'new' ELSE 'assigned' END; END IF;
    payload:=payload||jsonb_build_object('status',l.status);
  ELSIF kind='note' THEN payload:=jsonb_build_object('text',c->>'text');
  ELSIF kind='contact' THEN
    l.last_activity_at:=stamp; l.expires_at:=stamp+interval '180 days'; l.has_contact_attempt:=true;
    IF c->>'outcome'='two_way' THEN l.has_two_way_contact:=true; l.status:='contacted'; END IF;
    payload:=jsonb_build_object('channel',c->>'channel','outcome',c->>'outcome','summary',c->>'summary','status',l.status);
  ELSIF kind='close' THEN
    l.status:='closed'; l.closed_at:=stamp; l.closure_reason:=c->>'reason';
    l.expires_at:=least(l.expires_at,stamp+interval '90 days',l.last_activity_at+interval '180 days');
    IF l.closure_reason='spam' THEN l.expires_at:=least(l.expires_at,stamp+interval '30 days'); END IF;
    payload:=jsonb_build_object('reason',l.closure_reason,'status','closed');
    -- An intent already started may be in flight. S05 worker start/completion owns that boundary.
    UPDATE gcms_s04.notification_intent SET status='cancelled' WHERE tenant_id=p_tenant AND lead_id=p_lead AND status IN ('pending','blocked');
  ELSE
    l.status:=CASE WHEN l.has_two_way_contact THEN 'contacted' WHEN gcms_s05.eligible(p_tenant,l.assignee_user_id) THEN 'assigned' ELSE 'new' END;
    l.closed_at:=NULL; l.closure_reason:=NULL;
    payload:=jsonb_build_object('reason',c->>'reason','status',l.status);
  END IF;
  v:=l.version+1;
  UPDATE gcms_s04.lead SET version=v,status=l.status,assignee_user_id=l.assignee_user_id,has_contact_attempt=l.has_contact_attempt,
    has_two_way_contact=l.has_two_way_contact,closed_at=l.closed_at,closure_reason=l.closure_reason,last_activity_at=l.last_activity_at,expires_at=l.expires_at
    WHERE tenant_id=p_tenant AND id=p_lead;
  SELECT name INTO actor_label FROM gcms_s02_auth."user" WHERE id=actor_key;
  INSERT INTO gcms_s05.lead_event VALUES(p_tenant,p_lead,gen_random_uuid()::text,v,actor_key,actor_label,kind,payload,stamp);
  INSERT INTO gcms_s02.audit_event(id,tenant_id,actor_id,event,target_id,created_at) VALUES(gen_random_uuid()::text,p_tenant,actor_key,'lead.'||kind,p_lead,stamp);
  INSERT INTO gcms_s05.operation_receipt VALUES(p_tenant,c->>'operationId',p_lead,actor_key,c,v,stamp);
  RETURN jsonb_build_object('operationId',c->>'operationId','appliedVersion',v,'replayed',false);
END $$;
