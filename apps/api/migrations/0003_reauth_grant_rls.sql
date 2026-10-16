-- Reauthentication metadata belongs to one current server session.
ALTER TABLE gcms_s02_auth.reauth_grant ENABLE ROW LEVEL SECURITY;
ALTER TABLE gcms_s02_auth.reauth_grant FORCE ROW LEVEL SECURITY;
CREATE POLICY reauth_owner ON gcms_s02_auth.reauth_grant TO gcms_s02_owner USING(true) WITH CHECK(true);
CREATE POLICY reauth_auth ON gcms_s02_auth.reauth_grant TO gcms_s02_auth USING(true) WITH CHECK(true);
CREATE POLICY reauth_current ON gcms_s02_auth.reauth_grant FOR SELECT TO gcms_s02_tenant,gcms_s02_platform
  USING(session_id=nullif(current_setting('gcms.session_id',true),''));
