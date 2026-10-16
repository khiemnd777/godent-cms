-- Extend real S04 lead/challenge/receipt graph without changing any retained row or semantic-v1 fingerprint.
ALTER TABLE gcms_s04.lead ALTER COLUMN source_service_id DROP NOT NULL,ALTER COLUMN source_service_slug DROP NOT NULL,ALTER COLUMN source_service_title DROP NOT NULL;
ALTER TABLE gcms_s04.accepted_request ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE gcms_s04.challenge ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE gcms_m4.publication ADD CONSTRAINT publication_source_identity UNIQUE(tenant_id,kind,resource_id,locale,id);
ALTER TABLE gcms_s04.lead ADD COLUMN source_type text NOT NULL DEFAULT 'service' CHECK(source_type IN ('service','landing')),ADD COLUMN source_locale text NOT NULL DEFAULT 'vi' CHECK(gcms_m4.locale(source_locale)),ADD COLUMN source_snapshot jsonb,ADD COLUMN source_m4_kind text,ADD COLUMN source_m4_resource_id text,ADD COLUMN source_m4_publication_id text,
 ADD CONSTRAINT lead_m4_publication_fk FOREIGN KEY(tenant_id,source_m4_kind,source_m4_resource_id,source_locale,source_m4_publication_id) REFERENCES gcms_m4.publication(tenant_id,kind,resource_id,locale,id),
 ADD CONSTRAINT lead_source_union CHECK((source_m4_kind IS NULL AND source_m4_resource_id IS NULL AND source_m4_publication_id IS NULL AND source_snapshot IS NULL AND source_type='service' AND source_service_id IS NOT NULL AND source_service_slug IS NOT NULL AND source_service_title IS NOT NULL) OR (source_m4_kind=source_type AND source_m4_kind IN ('service','landing') AND source_m4_resource_id IS NOT NULL AND source_m4_publication_id=source_publication_id AND source_service_id IS NULL AND source_service_slug IS NULL AND source_service_title IS NULL AND jsonb_typeof(source_snapshot)='object' AND source_snapshot->>'type'=source_type AND source_snapshot->>'resourceId'=source_m4_resource_id AND source_snapshot->>'publicationId'=source_publication_id AND source_snapshot->>'locale'=source_locale AND source_snapshot->>'path'=source_path) IS TRUE);
ALTER TABLE gcms_s04.accepted_request ADD COLUMN m4_kind text,ADD COLUMN m4_resource_id text,ADD COLUMN m4_locale text,ADD COLUMN m4_publication_id text,
 ADD CONSTRAINT accepted_m4_publication_fk FOREIGN KEY(tenant_id,m4_kind,m4_resource_id,m4_locale,m4_publication_id) REFERENCES gcms_m4.publication(tenant_id,kind,resource_id,locale,id),
 ADD CONSTRAINT accepted_source_union CHECK((service_id IS NOT NULL AND m4_kind IS NULL AND m4_resource_id IS NULL AND m4_locale IS NULL AND m4_publication_id IS NULL) OR (service_id IS NULL AND m4_kind IN ('service','landing') AND m4_resource_id IS NOT NULL AND gcms_m4.locale(m4_locale) AND m4_publication_id=publication_id) IS TRUE);
ALTER TABLE gcms_s04.challenge ADD COLUMN m4_kind text,ADD COLUMN m4_resource_id text,ADD COLUMN m4_locale text,ADD COLUMN m4_publication_id text,ADD COLUMN m4_config_publication_id text,
 ADD CONSTRAINT challenge_m4_publication_fk FOREIGN KEY(tenant_id,m4_kind,m4_resource_id,m4_locale,m4_publication_id) REFERENCES gcms_m4.publication(tenant_id,kind,resource_id,locale,id),
 ADD CONSTRAINT challenge_source_union CHECK((service_id IS NOT NULL AND m4_kind IS NULL AND m4_resource_id IS NULL AND m4_locale IS NULL AND m4_publication_id IS NULL AND m4_config_publication_id IS NULL) OR (service_id IS NULL AND m4_kind IN ('service','landing') AND m4_resource_id IS NOT NULL AND gcms_m4.locale(m4_locale) AND m4_publication_id IS NOT NULL) IS TRUE);
DO $$ DECLARE c record;n integer:=0;BEGIN FOR c IN SELECT conname,pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='gcms_s04.lead'::regclass AND contype='c' LOOP IF c.def LIKE '%consent_version = %consultation-vi-v1%' OR c.def LIKE '%consent_copy = %Tôi%' OR c.def LIKE '%source_path = %source_tenant_slug%' THEN EXECUTE format('ALTER TABLE gcms_s04.lead DROP CONSTRAINT %I',c.conname);n:=n+1;END IF;END LOOP;IF n<>3 THEN RAISE EXCEPTION 'Unexpected retained consent/path constraints';END IF;END $$;
ALTER TABLE gcms_s04.lead ADD CONSTRAINT consent_locale_snapshot CHECK((consent_version='consultation-vi-v1' AND consent_copy='Tôi đồng ý để phòng khám sử dụng thông tin đã cung cấp để liên hệ tư vấn theo yêu cầu này.' AND source_locale='vi') OR (consent_version='consultation-en-v1' AND consent_copy='I agree that the clinic may use the information I provided to contact me about this consultation request.' AND source_locale='en')),
 ADD CONSTRAINT source_path_locale CHECK((source_snapshot IS NULL AND source_path='/'||source_tenant_slug||'/dich-vu/'||source_service_slug) OR (source_snapshot IS NOT NULL AND source_path=gcms_m4.path(source_tenant_slug,source_locale,source_type,source_snapshot->>'slug')));
CREATE FUNCTION gcms_m4.intake(c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t text;r text;kind_value text:=c->>'sourceType';lang text:=c->>'locale';now_at timestamptz;original gcms_s04.accepted_request%ROWTYPE;ch gcms_s04.challenge%ROWTYPE;p jsonb;legacy_payload jsonb;semantic jsonb;fingerprint_value text;secret_value text;source jsonb;page jsonb;form jsonb;promotion jsonb;source_snapshot jsonb;count_new integer;lead_key text;interest jsonb;location_data jsonb;consent jsonb;tracking jsonb;v text;BEGIN
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT(c ?& ARRAY['operation','tenantSlug','sourceType','sourceSlug','locale','requestKey','ipHash']) OR (c-ARRAY['operation','tenantSlug','sourceType','sourceSlug','locale','requestKey','ipHash','payload','tokenHash','answerHash'])<>'{}' OR jsonb_typeof(c->'operation') IS DISTINCT FROM 'string' OR c->>'operation' NOT IN ('accept','challenge') OR jsonb_typeof(c->'tenantSlug') IS DISTINCT FROM 'string' OR jsonb_typeof(c->'sourceSlug') IS DISTINCT FROM 'string' OR jsonb_typeof(c->'sourceType') IS DISTINCT FROM 'string' OR jsonb_typeof(c->'locale') IS DISTINCT FROM 'string' OR NOT gcms_s02.valid_slug(c->>'tenantSlug') OR NOT gcms_s02.valid_slug(c->>'sourceSlug') OR kind_value NOT IN ('service','landing') OR NOT gcms_m4.locale(lang) OR coalesce(c->>'requestKey','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR coalesce(c->>'ipHash','') !~ '^[a-f0-9]{64}$' OR ((c ? 'tokenHash') IS DISTINCT FROM (c ? 'answerHash')) OR (c ? 'tokenHash' AND (coalesce(c->>'tokenHash','') !~ '^[a-f0-9]{64}$' OR coalesce(c->>'answerHash','') !~ '^[a-f0-9]{64}$')) THEN RETURN '{"code":"INVALID_INPUT"}';END IF;
 SELECT tenant_id INTO t FROM gcms_s02.site_draft WHERE slug=c->>'tenantSlug';IF t IS NULL THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t,7202));
 r:=CASE kind_value WHEN 'service' THEN (SELECT id FROM gcms_s02.service_draft WHERE tenant_id=t AND slug=c->>'sourceSlug') ELSE (SELECT id FROM gcms_m4.identity WHERE tenant_id=t AND kind='landing' AND slug=c->>'sourceSlug') END;IF r IS NULL THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;
 now_at:=clock_timestamp();DELETE FROM gcms_s04.request_event WHERE tenant_id=t AND expires_at<=now_at;DELETE FROM gcms_s04.intake_activity WHERE tenant_id=t AND expires_at<=now_at;DELETE FROM gcms_s04.challenge WHERE tenant_id=t AND expires_at<=now_at;
 IF (SELECT count(*) FROM gcms_s04.request_event WHERE tenant_id=t AND expires_at>now_at)>=60 THEN RETURN '{"code":"RATE_LIMITED"}';END IF;INSERT INTO gcms_s04.request_event(tenant_id,created_at,expires_at) VALUES(t,now_at,now_at+interval '1 minute');
 IF c->>'operation'='accept' THEN
  p:=c->'payload';IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR NOT(p ?& ARRAY['sourceConfigPublicationId','formLocale']) OR p->>'formLocale' IS DISTINCT FROM lang OR (p->'sourceConfigPublicationId'<>'null'::jsonb AND NOT gcms_m3.uuid(p->>'sourceConfigPublicationId')) THEN RETURN '{"code":"INVALID_INPUT"}';END IF;
  legacy_payload:=p-ARRAY['sourceConfigPublicationId','formLocale','tracking'];IF NOT gcms_s04.valid_payload(legacy_payload) THEN RETURN '{"code":"INVALID_INPUT"}';END IF;
  tracking:=coalesce(p->'tracking','{}');IF jsonb_typeof(tracking) IS DISTINCT FROM 'object' OR (tracking-ARRAY['campaign','medium','source'])<>'{}' THEN RETURN '{"code":"INVALID_INPUT"}';END IF;IF EXISTS(SELECT 1 FROM jsonb_each(tracking) e WHERE jsonb_typeof(e.value) IS DISTINCT FROM 'string') THEN RETURN '{"code":"INVALID_INPUT"}';END IF;FOR v IN SELECT value FROM jsonb_each_text(tracking) LOOP IF v !~ '^[A-Za-z0-9_-]{1,64}$' THEN RETURN '{"code":"INVALID_INPUT"}';END IF;END LOOP;
  SELECT hmac_key INTO secret_value FROM gcms_s04.secret WHERE singleton;IF secret_value IS NULL THEN RETURN '{"code":"CAPTCHA_UNAVAILABLE"}';END IF;consent:=gcms_m4.consent(lang);
  semantic:=p||jsonb_build_object('consentVersion',consent->>'version','tenantSlug',c->>'tenantSlug','sourceType',kind_value,'sourceSlug',c->>'sourceSlug','actualLocale',lang);fingerprint_value:=encode(gcms_s04_crypto.hmac('semantic-m4-v1:'||semantic::text,secret_value,'sha256'),'hex');
  SELECT * INTO original FROM gcms_s04.accepted_request WHERE tenant_id=t AND request_key=c->>'requestKey' FOR UPDATE;
  IF original.tenant_id IS NOT NULL AND original.expires_at>now_at THEN
   IF original.m4_kind IS DISTINCT FROM kind_value OR original.m4_resource_id IS DISTINCT FROM r OR original.m4_locale IS DISTINCT FROM lang OR original.publication_id IS DISTINCT FROM p->>'sourcePublicationId' OR original.fingerprint IS DISTINCT FROM fingerprint_value THEN RETURN '{"code":"REQUEST_CONFLICT"}';END IF;
   IF NOT EXISTS(SELECT 1 FROM gcms_s04.lead WHERE tenant_id=t AND id=original.lead_id AND expires_at>now_at) THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;RETURN original.acknowledgement;
  END IF;
 ELSIF c ? 'payload' OR NOT(c ?& ARRAY['tokenHash','answerHash']) THEN RETURN '{"code":"INVALID_INPUT"}';END IF;
 source:=gcms_m4.read_public(c->>'tenantSlug',lang,kind_value,c->>'sourceSlug');IF source->>'resolution' IS DISTINCT FROM 'page' THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;page:=source->'page';form:=page->'form';IF form IS NULL OR form='null'::jsonb OR page->'legacy'='true'::jsonb THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;
 IF c->>'operation'='challenge' THEN INSERT INTO gcms_s04.challenge(tenant_id,token_hash,service_id,request_key,ip_hash,answer_hash,expires_at,m4_kind,m4_resource_id,m4_locale,m4_publication_id,m4_config_publication_id) VALUES(t,c->>'tokenHash',NULL,c->>'requestKey',c->>'ipHash',c->>'answerHash',now_at+interval '5 minutes',kind_value,r,lang,page->>'publicationId',page->>'configPublicationId');RETURN jsonb_build_object('expiresAt',now_at+interval '5 minutes');END IF;
 IF page->>'publicationId' IS DISTINCT FROM p->>'sourcePublicationId' OR page->'configPublicationId' IS DISTINCT FROM p->'sourceConfigPublicationId' THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;
 IF p ? 'interestServiceSlug' THEN SELECT x INTO interest FROM jsonb_array_elements(form->'serviceOptions') x WHERE x->>'slug'=p->>'interestServiceSlug';IF interest IS NULL THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;END IF;
 IF p ? 'locationId' THEN SELECT jsonb_build_object('id',x->'id','publicationId',x->'publicationId','name',x->'title','address',x->'content'->'address') INTO location_data FROM jsonb_array_elements(form->'locationOptions') x WHERE x->>'id'=p->>'locationId';IF location_data IS NULL THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;END IF;
 IF form->'promotionId'<>'null'::jsonb THEN SELECT x->'promotion' INTO promotion FROM jsonb_array_elements(page->'sections') x WHERE x->'form'<>'null'::jsonb LIMIT 1;IF promotion->>'promotionState' IS DISTINCT FROM 'active' THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;END IF;
 SELECT count(*) INTO count_new FROM gcms_s04.intake_activity WHERE tenant_id=t AND ip_hash=c->>'ipHash' AND expires_at>now_at;IF count_new>=5 THEN RETURN '{"code":"RATE_LIMITED"}';END IF;
 IF count_new>=2 THEN
  IF NOT(c ?& ARRAY['tokenHash','answerHash']) THEN RETURN '{"code":"CAPTCHA_REQUIRED"}';END IF;SELECT * INTO ch FROM gcms_s04.challenge WHERE tenant_id=t AND token_hash=c->>'tokenHash' FOR UPDATE;
  IF ch.tenant_id IS NULL OR ch.service_id IS NOT NULL OR ch.m4_kind IS DISTINCT FROM kind_value OR ch.m4_resource_id IS DISTINCT FROM r OR ch.m4_locale IS DISTINCT FROM lang OR ch.m4_publication_id IS DISTINCT FROM page->>'publicationId' OR ch.m4_config_publication_id IS DISTINCT FROM page->>'configPublicationId' OR ch.request_key IS DISTINCT FROM c->>'requestKey' OR ch.ip_hash IS DISTINCT FROM c->>'ipHash' OR ch.used_at IS NOT NULL OR ch.expires_at<=now_at THEN RETURN '{"code":"CAPTCHA_INVALID"}';END IF;
  UPDATE gcms_s04.challenge SET used_at=now_at WHERE tenant_id=t AND token_hash=ch.token_hash;IF ch.answer_hash IS DISTINCT FROM c->>'answerHash' THEN RETURN '{"code":"CAPTCHA_INVALID"}';END IF;
 END IF;
 source_snapshot:=jsonb_build_object('type',kind_value,'tenantSlug',c->>'tenantSlug','resourceId',r,'slug',c->>'sourceSlug','title',page->'content'->>'title','publicationId',page->'publicationId','configPublicationId',page->'configPublicationId','path',gcms_m4.path(c->>'tenantSlug',lang,kind_value,c->>'sourceSlug'),'locale',lang,'promotion',CASE WHEN promotion IS NULL THEN NULL ELSE jsonb_build_object('id',promotion->'id','publicationId',promotion->'publicationId','title',promotion->'content'->'title') END,'tracking',tracking);
 IF kind_value='service' THEN source_snapshot:=source_snapshot||jsonb_build_object('serviceSlug',c->>'sourceSlug','serviceTitle',page->'content'->'title');END IF;
 IF promotion IS NOT NULL AND (clock_timestamp()<(promotion->'content'->>'startAt')::timestamptz OR clock_timestamp()>=(promotion->'content'->>'endAt')::timestamptz) THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;
 lead_key:=gen_random_uuid()::text;
 INSERT INTO gcms_s04.lead(tenant_id,id,name,phone,email,message,preferred_language,preferred_channel,source_service_id,source_publication_id,source_tenant_slug,source_service_slug,source_service_title,source_path,source_type,source_locale,source_snapshot,source_m4_kind,source_m4_resource_id,source_m4_publication_id,location_snapshot,interest_service_id,interest_service_slug,interest_service_title,consent_at,consent_version,consent_copy,created_at,last_activity_at,expires_at)
 VALUES(t,lead_key,p->>'name',p->>'phone',p->>'email',p->>'message',p->>'preferredLanguage',p->>'preferredChannel',NULL,page->>'publicationId',c->>'tenantSlug',NULL,NULL,source_snapshot->>'path',kind_value,lang,source_snapshot,kind_value,r,page->>'publicationId',location_data,interest->>'id',interest->>'slug',interest->>'title',now_at,consent->>'version',consent->>'copy',now_at,now_at,now_at+interval '180 days');
 INSERT INTO gcms_s04.notification_intent(tenant_id,lead_id,created_at) VALUES(t,lead_key,now_at);
 IF original.tenant_id IS NOT NULL THEN DELETE FROM gcms_s04.accepted_request WHERE tenant_id=t AND request_key=c->>'requestKey';END IF;
 INSERT INTO gcms_s04.accepted_request(tenant_id,request_key,fingerprint,lead_id,service_id,publication_id,accepted_at,expires_at,m4_kind,m4_resource_id,m4_locale,m4_publication_id) VALUES(t,c->>'requestKey',fingerprint_value,lead_key,NULL,page->>'publicationId',now_at,now_at+interval '24 hours',kind_value,r,lang,page->>'publicationId');
 INSERT INTO gcms_s04.intake_activity(tenant_id,lead_id,ip_hash,created_at,expires_at) VALUES(t,lead_key,c->>'ipHash',now_at,now_at+interval '10 minutes');INSERT INTO gcms_s04.audit_event(id,tenant_id,event,target_id) VALUES(gen_random_uuid()::text,t,'consultation.accepted',lead_key);RETURN '{"status":"accepted"}';
END $$;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA gcms_m4 FROM PUBLIC;
GRANT USAGE ON SCHEMA gcms_m4 TO gcms_s04_intake;
GRANT EXECUTE ON FUNCTION gcms_m4.intake(jsonb) TO gcms_s04_intake;

-- Legacy semantic-v1 input/copy/fingerprint remains exact; NULL-safe challenge binding protects source union.
CREATE OR REPLACE FUNCTION gcms_s04.intake(c jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE tenant_key text; binding record; original gcms_s04.accepted_request%ROWTYPE; ch gcms_s04.challenge%ROWTYPE;
  now_at timestamptz:=clock_timestamp(); p jsonb; semantic jsonb; fingerprint_value text; secret_value text; new_count integer;
  lead_key text; location_data jsonb; interest_id text; interest_slug text; interest_title text; publication record;
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
      IF original.service_id IS DISTINCT FROM binding.service_id OR original.publication_id<>p->>'sourcePublicationId' OR original.fingerprint<>fingerprint_value
        THEN RETURN '{"code":"REQUEST_CONFLICT"}'::jsonb; END IF;
      RETURN original.acknowledgement;
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM gcms_m4.variant WHERE tenant_id=tenant_key AND kind='service' AND resource_id=binding.service_id AND locale='vi' AND publication_version>0) THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}';END IF;
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
  IF p ? 'locationId' THEN
    SELECT x INTO location_data FROM jsonb_array_elements(gcms_m3.public_service_links(c->>'tenantSlug',c->>'serviceSlug')->'locations') x WHERE x->>'id'=p->>'locationId';
    IF location_data IS NULL THEN RETURN '{"code":"SOURCE_UNAVAILABLE"}'::jsonb;END IF;
  END IF;
  SELECT count(*) INTO new_count FROM gcms_s04.intake_activity WHERE tenant_id=tenant_key AND ip_hash=c->>'ipHash' AND expires_at>now_at;
  IF new_count>=5 THEN RETURN '{"code":"RATE_LIMITED"}'::jsonb; END IF;
  IF new_count>=2 THEN
    IF NOT(c ? 'tokenHash' AND c ? 'answerHash') THEN RETURN '{"code":"CAPTCHA_REQUIRED"}'::jsonb; END IF;
    SELECT * INTO ch FROM gcms_s04.challenge WHERE tenant_id=tenant_key AND token_hash=c->>'tokenHash' FOR UPDATE;
    IF ch.tenant_id IS NULL OR ch.service_id IS DISTINCT FROM binding.service_id OR ch.request_key<>c->>'requestKey' OR ch.ip_hash<>c->>'ipHash' OR
      ch.used_at IS NOT NULL OR ch.expires_at<=now_at THEN RETURN '{"code":"CAPTCHA_INVALID"}'::jsonb; END IF;
    UPDATE gcms_s04.challenge SET used_at=now_at WHERE tenant_id=tenant_key AND token_hash=ch.token_hash;
    IF ch.answer_hash IS DISTINCT FROM c->>'answerHash' THEN RETURN '{"code":"CAPTCHA_INVALID"}'::jsonb; END IF;
  END IF;
  lead_key:=gen_random_uuid()::text;
  INSERT INTO gcms_s04.lead(tenant_id,id,name,phone,email,message,preferred_language,preferred_channel,
    source_service_id,source_publication_id,source_tenant_slug,source_service_slug,source_service_title,source_path,
    location_snapshot,interest_service_id,interest_service_slug,interest_service_title,consent_at,consent_version,consent_copy,created_at,last_activity_at,expires_at)
    VALUES(tenant_key,lead_key,p->>'name',p->>'phone',p->>'email',p->>'message',p->>'preferredLanguage',p->>'preferredChannel',
      binding.service_id,publication.id,c->>'tenantSlug',c->>'serviceSlug',publication.closure->'service'->>'title',
      '/'||(c->>'tenantSlug')||'/dich-vu/'||(c->>'serviceSlug'),location_data,interest_id,interest_slug,interest_title,now_at,'consultation-vi-v1',
      'Tôi đồng ý để phòng khám sử dụng thông tin đã cung cấp để liên hệ tư vấn theo yêu cầu này.',now_at,now_at,now_at+interval '180 days');
  INSERT INTO gcms_s04.notification_intent(tenant_id,lead_id,created_at) VALUES(tenant_key,lead_key,now_at);
  IF original.tenant_id IS NOT NULL THEN DELETE FROM gcms_s04.accepted_request WHERE tenant_id=tenant_key AND request_key=c->>'requestKey'; END IF;
  INSERT INTO gcms_s04.accepted_request(tenant_id,request_key,fingerprint,lead_id,service_id,publication_id,accepted_at,expires_at)
    VALUES(tenant_key,c->>'requestKey',fingerprint_value,lead_key,binding.service_id,publication.id,now_at,now_at+interval '24 hours');
  INSERT INTO gcms_s04.intake_activity(tenant_id,lead_id,ip_hash,created_at,expires_at) VALUES(tenant_key,lead_key,c->>'ipHash',now_at,now_at+interval '10 minutes');
  INSERT INTO gcms_s04.audit_event(id,tenant_id,event,target_id) VALUES(gen_random_uuid()::text,tenant_key,'consultation.accepted',lead_key);
  RETURN '{"status":"accepted"}'::jsonb;
END $$;

