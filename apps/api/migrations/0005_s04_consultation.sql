-- Additive S04. Never modifies the applied S02/S03 migrations or retained rows.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='gcms_s04' AND nspowner=(SELECT oid FROM pg_roles WHERE rolname='gcms_s02_owner'))
    THEN RAISE EXCEPTION 'S04 bootstrap schema ownership required'; END IF;
END $$;
REVOKE ALL ON SCHEMA gcms_s04 FROM PUBLIC;
CREATE TABLE gcms_s04.secret (singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), hmac_key text NOT NULL CHECK(length(hmac_key)=64));

CREATE FUNCTION gcms_s04.valid_payload(p jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE k text; v text;
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR NOT(p ?& ARRAY['sourcePublicationId','preferredLanguage','preferredChannel','consent']) OR
    (p-ARRAY['sourcePublicationId','name','phone','email','preferredLanguage','preferredChannel','message','consent','interestServiceSlug'])<>'{}'::jsonb OR
    jsonb_typeof(p->'sourcePublicationId') IS DISTINCT FROM 'string' OR p->>'sourcePublicationId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR
    jsonb_typeof(p->'preferredLanguage') IS DISTINCT FROM 'string' OR p->>'preferredLanguage' NOT IN ('vi','en') OR
    jsonb_typeof(p->'preferredChannel') IS DISTINCT FROM 'string' OR p->>'preferredChannel' NOT IN ('phone','email') OR
    p->'consent' IS DISTINCT FROM 'true'::jsonb THEN RETURN false; END IF;
  FOREACH k IN ARRAY ARRAY['name','phone','email','message','interestServiceSlug'] LOOP
    IF p ? k THEN
      IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
      v:=p->>k;
      IF length(v)=0 OR v<>btrim(v) OR normalize(v,NFC)<>v OR v ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' THEN RETURN false; END IF;
    END IF;
  END LOOP;
  IF coalesce(length(p->>'name'),0)>120 OR coalesce(length(p->>'message'),0)>500 OR coalesce(length(p->>'email'),0)>254 OR
    (p ? 'phone' AND p->>'phone' !~ '^[0-9]{7,15}$') OR
    (p ? 'email' AND (p->>'email'<>lower(p->>'email') OR p->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')) OR
    (p ? 'interestServiceSlug' AND NOT gcms_s02.valid_slug(p->>'interestServiceSlug')) OR
    NOT(p ? 'phone' OR p ? 'email') OR (p->>'preferredChannel'='phone' AND NOT(p ? 'phone')) OR
    (p->>'preferredChannel'='email' AND NOT(p ? 'email')) THEN RETURN false; END IF;
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;

CREATE TABLE gcms_s04.lead (
  tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id), id text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK(status='new'),
  name text CHECK(name IS NULL OR (length(name) BETWEEN 1 AND 120 AND normalize(name,NFC)=name)),
  phone text CHECK(phone IS NULL OR phone ~ '^[0-9]{7,15}$'),
  email text CHECK(email IS NULL OR (length(email)<=254 AND email=lower(email) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
  message text CHECK(message IS NULL OR (length(message)<=500 AND normalize(message,NFC)=message)),
  preferred_language text NOT NULL CHECK(preferred_language IN ('vi','en')),
  preferred_channel text NOT NULL CHECK(preferred_channel IN ('phone','email')),
  source_service_id text NOT NULL, source_publication_id text NOT NULL,
  source_tenant_slug text NOT NULL CHECK(gcms_s02.valid_slug(source_tenant_slug)),
  source_service_slug text NOT NULL CHECK(gcms_s02.valid_slug(source_service_slug)),
  source_service_title text NOT NULL, source_path text NOT NULL,
  interest_service_id text, interest_service_slug text, interest_service_title text,
  consent_at timestamptz NOT NULL, consent_version text NOT NULL CHECK(consent_version='consultation-vi-v1'),
  consent_copy text NOT NULL CHECK(consent_copy='Tôi đồng ý để phòng khám sử dụng thông tin đã cung cấp để liên hệ tư vấn theo yêu cầu này.'),
  created_at timestamptz NOT NULL, last_activity_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,source_service_id,source_publication_id) REFERENCES gcms_s02.publication_snapshot(tenant_id,service_id,id),
  FOREIGN KEY(tenant_id,interest_service_id) REFERENCES gcms_s02.service_draft(tenant_id,id),
  CHECK(phone IS NOT NULL OR email IS NOT NULL),
  CHECK((preferred_channel='phone' AND phone IS NOT NULL) OR (preferred_channel='email' AND email IS NOT NULL)),
  CHECK(last_activity_at=created_at AND expires_at=last_activity_at+interval '180 days' AND consent_at=created_at),
  CHECK(source_path='/'||source_tenant_slug||'/dich-vu/'||source_service_slug),
  CHECK((interest_service_id IS NULL AND interest_service_slug IS NULL AND interest_service_title IS NULL) OR
    (interest_service_id IS NOT NULL AND gcms_s02.valid_slug(interest_service_slug) AND interest_service_title IS NOT NULL))
);
CREATE INDEX lead_keyset ON gcms_s04.lead(tenant_id,created_at DESC,id DESC);
CREATE TABLE gcms_s04.notification_intent (
  tenant_id text NOT NULL, lead_id text NOT NULL,
  kind text NOT NULL DEFAULT 'consultation.received' CHECK(kind='consultation.received'),
  status text NOT NULL DEFAULT 'pending' CHECK(status='pending'), created_at timestamptz NOT NULL,
  PRIMARY KEY(tenant_id,lead_id), FOREIGN KEY(tenant_id,lead_id) REFERENCES gcms_s04.lead(tenant_id,id)
);
CREATE TABLE gcms_s04.accepted_request (
  tenant_id text NOT NULL, request_key text NOT NULL CHECK(request_key ~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'),
  fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'), lead_id text NOT NULL,
  service_id text NOT NULL, publication_id text NOT NULL,
  accepted_at timestamptz NOT NULL, expires_at timestamptz NOT NULL CHECK(expires_at=accepted_at+interval '24 hours'),
  acknowledgement jsonb NOT NULL DEFAULT '{"status":"accepted"}' CHECK(acknowledgement='{"status":"accepted"}'::jsonb),
  PRIMARY KEY(tenant_id,request_key), FOREIGN KEY(tenant_id,lead_id) REFERENCES gcms_s04.lead(tenant_id,id),
  FOREIGN KEY(tenant_id,service_id,publication_id) REFERENCES gcms_s02.publication_snapshot(tenant_id,service_id,id)
);
-- Expiring abuse records never contain raw IP/contact/message data.
CREATE TABLE gcms_s04.request_event (
  tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL CHECK(expires_at=created_at+interval '1 minute'), PRIMARY KEY(tenant_id,id)
);
CREATE INDEX request_event_expiry ON gcms_s04.request_event(tenant_id,expires_at);
CREATE TABLE gcms_s04.intake_activity (
  tenant_id text NOT NULL, lead_id text NOT NULL, ip_hash text NOT NULL CHECK(ip_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL CHECK(expires_at=created_at+interval '10 minutes'),
  PRIMARY KEY(tenant_id,lead_id), FOREIGN KEY(tenant_id,lead_id) REFERENCES gcms_s04.lead(tenant_id,id)
);
CREATE INDEX intake_activity_ip ON gcms_s04.intake_activity(tenant_id,ip_hash,expires_at);
CREATE TABLE gcms_s04.challenge (
  tenant_id text NOT NULL REFERENCES gcms_s02.tenant(id), token_hash text NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'),
  service_id text NOT NULL, request_key text NOT NULL, ip_hash text NOT NULL CHECK(ip_hash ~ '^[a-f0-9]{64}$'),
  answer_hash text NOT NULL CHECK(answer_hash ~ '^[a-f0-9]{64}$'), expires_at timestamptz NOT NULL,
  used_at timestamptz, PRIMARY KEY(tenant_id,token_hash),
  FOREIGN KEY(tenant_id,service_id) REFERENCES gcms_s02.service_draft(tenant_id,id)
);
CREATE INDEX challenge_expiry ON gcms_s04.challenge(tenant_id,expires_at);

CREATE FUNCTION gcms_s04.has_lead_access(p_tenant text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT p_tenant=nullif(current_setting('gcms.tenant_id',true),'') AND gcms_s02.has_membership(p_tenant,true)
    AND EXISTS(SELECT 1 FROM gcms_s02.tenant WHERE id=p_tenant AND status IN ('active','suspended'))
$$;
-- Owner remains subject to FORCE RLS through its explicit migration/function policy.
ALTER TABLE gcms_s04.secret ENABLE ROW LEVEL SECURITY; ALTER TABLE gcms_s04.secret FORCE ROW LEVEL SECURITY;
CREATE POLICY secret_owner ON gcms_s04.secret TO gcms_s02_owner USING(true) WITH CHECK(true);
ALTER TABLE gcms_s04.lead ENABLE ROW LEVEL SECURITY; ALTER TABLE gcms_s04.lead FORCE ROW LEVEL SECURITY;
CREATE POLICY lead_owner ON gcms_s04.lead TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE POLICY lead_tenant ON gcms_s04.lead FOR SELECT TO gcms_s02_tenant USING(gcms_s04.has_lead_access(tenant_id) AND expires_at>clock_timestamp());
ALTER TABLE gcms_s04.notification_intent ENABLE ROW LEVEL SECURITY; ALTER TABLE gcms_s04.notification_intent FORCE ROW LEVEL SECURITY;
CREATE POLICY intent_owner ON gcms_s04.notification_intent TO gcms_s02_owner USING(true) WITH CHECK(true);
ALTER TABLE gcms_s04.accepted_request ENABLE ROW LEVEL SECURITY; ALTER TABLE gcms_s04.accepted_request FORCE ROW LEVEL SECURITY;
CREATE POLICY accepted_owner ON gcms_s04.accepted_request TO gcms_s02_owner USING(true) WITH CHECK(true);
ALTER TABLE gcms_s04.request_event ENABLE ROW LEVEL SECURITY; ALTER TABLE gcms_s04.request_event FORCE ROW LEVEL SECURITY;
CREATE POLICY request_owner ON gcms_s04.request_event TO gcms_s02_owner USING(true) WITH CHECK(true);
ALTER TABLE gcms_s04.intake_activity ENABLE ROW LEVEL SECURITY; ALTER TABLE gcms_s04.intake_activity FORCE ROW LEVEL SECURITY;
CREATE POLICY activity_owner ON gcms_s04.intake_activity TO gcms_s02_owner USING(true) WITH CHECK(true);
ALTER TABLE gcms_s04.challenge ENABLE ROW LEVEL SECURITY; ALTER TABLE gcms_s04.challenge FORCE ROW LEVEL SECURITY;
CREATE POLICY challenge_owner ON gcms_s04.challenge TO gcms_s02_owner USING(true) WITH CHECK(true);

CREATE FUNCTION gcms_s04.require_intake_closure() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM gcms_s04.accepted_request r JOIN gcms_s04.notification_intent i ON i.tenant_id=r.tenant_id AND i.lead_id=r.lead_id
    WHERE r.tenant_id=NEW.tenant_id AND r.lead_id=NEW.id) THEN RAISE EXCEPTION 'Incomplete intake transaction' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER intake_complete AFTER INSERT ON gcms_s04.lead DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION gcms_s04.require_intake_closure();

-- A technical login receives EXECUTE on this function only. Commands cannot select
-- arbitrary tenant IDs, SQL, retention times, recipients or lead identifiers.
CREATE FUNCTION gcms_s04.intake(c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE tenant_key text; binding record; original gcms_s04.accepted_request%ROWTYPE; ch gcms_s04.challenge%ROWTYPE;
  now_at timestamptz:=clock_timestamp(); p jsonb; semantic jsonb; fingerprint_value text; secret_value text; new_count integer;
  lead_key text; interest_id text; interest_slug text; interest_title text; publication record;
BEGIN
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR
    (c-ARRAY['operation','tenantSlug','serviceSlug','requestKey','ipHash','payload','tokenHash','answerHash'])<>'{}'::jsonb OR
    jsonb_typeof(c->'operation') IS DISTINCT FROM 'string' OR c->>'operation' NOT IN ('accept','challenge') OR
    jsonb_typeof(c->'tenantSlug') IS DISTINCT FROM 'string' OR NOT gcms_s02.valid_slug(c->>'tenantSlug') OR
    jsonb_typeof(c->'serviceSlug') IS DISTINCT FROM 'string' OR NOT gcms_s02.valid_slug(c->>'serviceSlug') OR
    jsonb_typeof(c->'requestKey') IS DISTINCT FROM 'string' OR c->>'requestKey' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR
    jsonb_typeof(c->'ipHash') IS DISTINCT FROM 'string' OR c->>'ipHash' !~ '^[a-f0-9]{64}$' OR
    (c ? 'tokenHash' AND (jsonb_typeof(c->'tokenHash') IS DISTINCT FROM 'string' OR c->>'tokenHash' !~ '^[a-f0-9]{64}$')) OR
    (c ? 'answerHash' AND (jsonb_typeof(c->'answerHash') IS DISTINCT FROM 'string' OR c->>'answerHash' !~ '^[a-f0-9]{64}$')) OR
    ((c ? 'tokenHash') IS DISTINCT FROM (c ? 'answerHash')) THEN RETURN '{"code":"INVALID_INPUT"}'::jsonb; END IF;
  SELECT s.tenant_id INTO tenant_key FROM gcms_s02.site_draft s JOIN gcms_s02.service_draft d ON d.tenant_id=s.tenant_id
    WHERE s.slug=c->>'tenantSlug' AND d.slug=c->>'serviceSlug' AND s.slug_locked AND d.slug_locked;
  IF tenant_key IS NULL THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}'::jsonb; END IF;
  -- Consistent with S02 membership changes and S03 publication. Re-resolve under lock.
  PERFORM pg_advisory_xact_lock(hashtextextended(tenant_key,7202));
  SELECT s.tenant_id,d.id AS service_id,s.public_enabled,t.status,s.slug_locked,d.slug_locked AS service_locked
    INTO binding FROM gcms_s02.site_draft s JOIN gcms_s02.tenant t ON t.id=s.tenant_id
    JOIN gcms_s02.service_draft d ON d.tenant_id=s.tenant_id
    WHERE s.tenant_id=tenant_key AND s.slug=c->>'tenantSlug' AND d.slug=c->>'serviceSlug' AND s.slug_locked AND d.slug_locked
    FOR SHARE OF s,t,d;
  IF binding.tenant_id IS NULL THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}'::jsonb; END IF;
  now_at:=clock_timestamp();
  DELETE FROM gcms_s04.request_event WHERE tenant_id=tenant_key AND expires_at<=now_at;
  DELETE FROM gcms_s04.intake_activity WHERE tenant_id=tenant_key AND expires_at<=now_at;
  DELETE FROM gcms_s04.challenge WHERE tenant_id=tenant_key AND expires_at<=now_at;
  IF (SELECT count(*) FROM gcms_s04.request_event WHERE tenant_id=tenant_key AND expires_at>now_at)>=60 THEN RETURN '{"code":"RATE_LIMITED"}'::jsonb; END IF;
  INSERT INTO gcms_s04.request_event(tenant_id,created_at,expires_at) VALUES(tenant_key,now_at,now_at+interval '1 minute');

  IF c->>'operation'='accept' THEN
    p:=c->'payload';
    IF NOT gcms_s04.valid_payload(p) THEN RETURN '{"code":"INVALID_INPUT"}'::jsonb; END IF;
    SELECT hmac_key INTO secret_value FROM gcms_s04.secret WHERE singleton;
    IF secret_value IS NULL THEN RETURN '{"code":"CAPTCHA_UNAVAILABLE"}'::jsonb; END IF;
    semantic:=p||jsonb_build_object('consentVersion','consultation-vi-v1','tenantSlug',c->>'tenantSlug','serviceSlug',c->>'serviceSlug');
    fingerprint_value:=encode(gcms_s04_crypto.hmac('semantic-v1:'||semantic::text,secret_value,'sha256'),'hex');
    SELECT * INTO original FROM gcms_s04.accepted_request WHERE tenant_id=tenant_key AND request_key=c->>'requestKey' FOR UPDATE;
    IF original.tenant_id IS NOT NULL AND original.expires_at>now_at THEN
      IF original.service_id<>binding.service_id OR original.publication_id<>p->>'sourcePublicationId' OR original.fingerprint<>fingerprint_value
        THEN RETURN '{"code":"REQUEST_CONFLICT"}'::jsonb; END IF;
      RETURN original.acknowledgement;
    END IF;
  END IF;
  -- Only NEW requests/challenges require current eligibility. Accepted retries do not grow data or refresh activity.
  IF binding.status<>'active' OR NOT binding.public_enabled THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}'::jsonb; END IF;
  SELECT snap.id,snap.closure INTO publication FROM gcms_s02.publication_pointer ptr JOIN gcms_s02.publication_snapshot snap
    ON snap.tenant_id=ptr.tenant_id AND snap.service_id=ptr.service_id AND snap.id=ptr.snapshot_id
    WHERE ptr.tenant_id=tenant_key AND ptr.service_id=binding.service_id FOR SHARE OF ptr;
  IF publication.id IS NULL THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}'::jsonb; END IF;
  IF c->>'operation'='challenge' THEN
    IF jsonb_typeof(c->'tokenHash') IS DISTINCT FROM 'string' OR c->>'tokenHash' !~ '^[a-f0-9]{64}$' OR
      jsonb_typeof(c->'answerHash') IS DISTINCT FROM 'string' OR c->>'answerHash' !~ '^[a-f0-9]{64}$' OR c ? 'payload'
      THEN RETURN '{"code":"INVALID_INPUT"}'::jsonb; END IF;
    INSERT INTO gcms_s04.challenge(tenant_id,token_hash,service_id,request_key,ip_hash,answer_hash,expires_at)
      VALUES(tenant_key,c->>'tokenHash',binding.service_id,c->>'requestKey',c->>'ipHash',c->>'answerHash',now_at+interval '5 minutes');
    RETURN jsonb_build_object('expiresAt',now_at+interval '5 minutes');
  END IF;
  IF publication.id<>p->>'sourcePublicationId' THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}'::jsonb; END IF;
  IF p ? 'interestServiceSlug' THEN
    SELECT d.id,d.slug,snap.closure->'service'->>'title' INTO interest_id,interest_slug,interest_title FROM gcms_s02.service_draft d
      JOIN gcms_s02.publication_pointer ptr ON ptr.tenant_id=d.tenant_id AND ptr.service_id=d.id
      JOIN gcms_s02.publication_snapshot snap ON snap.tenant_id=ptr.tenant_id AND snap.service_id=ptr.service_id AND snap.id=ptr.snapshot_id
      WHERE d.tenant_id=tenant_key AND d.slug=p->>'interestServiceSlug' AND d.slug_locked FOR SHARE OF d,ptr;
    IF interest_id IS NULL THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}'::jsonb; END IF;
  END IF;
  SELECT count(*) INTO new_count FROM gcms_s04.intake_activity WHERE tenant_id=tenant_key AND ip_hash=c->>'ipHash' AND expires_at>now_at;
  IF new_count>=5 THEN RETURN '{"code":"RATE_LIMITED"}'::jsonb; END IF;
  IF new_count>=2 THEN
    IF NOT(c ? 'tokenHash' AND c ? 'answerHash') THEN RETURN '{"code":"CAPTCHA_REQUIRED"}'::jsonb; END IF;
    SELECT * INTO ch FROM gcms_s04.challenge WHERE tenant_id=tenant_key AND token_hash=c->>'tokenHash' FOR UPDATE;
    IF ch.tenant_id IS NULL OR ch.service_id<>binding.service_id OR ch.request_key<>c->>'requestKey' OR ch.ip_hash<>c->>'ipHash' OR
      ch.used_at IS NOT NULL OR ch.expires_at<=now_at THEN RETURN '{"code":"CAPTCHA_INVALID"}'::jsonb; END IF;
    UPDATE gcms_s04.challenge SET used_at=now_at WHERE tenant_id=tenant_key AND token_hash=ch.token_hash;
    IF ch.answer_hash IS DISTINCT FROM c->>'answerHash' THEN RETURN '{"code":"CAPTCHA_INVALID"}'::jsonb; END IF;
  END IF;
  lead_key:=gen_random_uuid()::text;
  INSERT INTO gcms_s04.lead(tenant_id,id,name,phone,email,message,preferred_language,preferred_channel,
    source_service_id,source_publication_id,source_tenant_slug,source_service_slug,source_service_title,source_path,
    interest_service_id,interest_service_slug,interest_service_title,consent_at,consent_version,consent_copy,created_at,last_activity_at,expires_at)
    VALUES(tenant_key,lead_key,p->>'name',p->>'phone',p->>'email',p->>'message',p->>'preferredLanguage',p->>'preferredChannel',
      binding.service_id,publication.id,c->>'tenantSlug',c->>'serviceSlug',publication.closure->'service'->>'title',
      '/'||(c->>'tenantSlug')||'/dich-vu/'||(c->>'serviceSlug'),interest_id,interest_slug,interest_title,now_at,'consultation-vi-v1',
      'Tôi đồng ý để phòng khám sử dụng thông tin đã cung cấp để liên hệ tư vấn theo yêu cầu này.',now_at,now_at,now_at+interval '180 days');
  INSERT INTO gcms_s04.notification_intent(tenant_id,lead_id,created_at) VALUES(tenant_key,lead_key,now_at);
  IF original.tenant_id IS NOT NULL THEN DELETE FROM gcms_s04.accepted_request WHERE tenant_id=tenant_key AND request_key=c->>'requestKey'; END IF;
  INSERT INTO gcms_s04.accepted_request(tenant_id,request_key,fingerprint,lead_id,service_id,publication_id,accepted_at,expires_at)
    VALUES(tenant_key,c->>'requestKey',fingerprint_value,lead_key,binding.service_id,publication.id,now_at,now_at+interval '24 hours');
  INSERT INTO gcms_s04.intake_activity(tenant_id,lead_id,ip_hash,created_at,expires_at) VALUES(tenant_key,lead_key,c->>'ipHash',now_at,now_at+interval '10 minutes');
  INSERT INTO gcms_s02.audit_event(id,tenant_id,event,target_id) VALUES(gen_random_uuid()::text,tenant_key,'consultation.accepted',lead_key);
  RETURN '{"status":"accepted"}'::jsonb;
END $$;

GRANT USAGE ON SCHEMA gcms_s04 TO gcms_s02_tenant,gcms_s04_intake;
GRANT SELECT ON gcms_s04.lead TO gcms_s02_tenant;
REVOKE ALL ON ALL TABLES IN SCHEMA gcms_s04 FROM PUBLIC,gcms_s02_auth,gcms_s02_platform,gcms_s04_intake;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gcms_s04 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gcms_s04.has_lead_access(text) TO gcms_s02_tenant;
GRANT EXECUTE ON FUNCTION gcms_s04.intake(jsonb) TO gcms_s04_intake;
