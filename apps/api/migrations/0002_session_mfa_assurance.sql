ALTER TABLE gcms_s02_auth.session ADD COLUMN mfa_verified boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION gcms_s02.has_membership(p_tenant text,p_mfa boolean DEFAULT true) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM gcms_s02.membership m JOIN gcms_s02_auth."user" u ON u.id=m.user_id
    JOIN gcms_s02_auth.session s ON s.user_id=u.id AND s.id=nullif(current_setting('gcms.session_id',true),'')
    WHERE m.tenant_id=p_tenant AND m.user_id=gcms_s02.current_actor() AND m.status='active'
      AND u.active AND u.email_verified AND (NOT p_mfa OR (u.two_factor_enabled AND s.mfa_verified))
      AND s.expires_at>now() AND s.created_at>now()-interval '8 hours')
$$;
CREATE OR REPLACE FUNCTION gcms_s02.lock_actor(p_user text,p_session text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u gcms_s02_auth."user"%ROWTYPE; s gcms_s02_auth.session%ROWTYPE;
BEGIN
  SELECT * INTO u FROM gcms_s02_auth."user" WHERE id=p_user FOR SHARE;
  SELECT * INTO s FROM gcms_s02_auth.session WHERE id=p_session AND user_id=p_user FOR SHARE;
  IF u.id IS NULL OR s.id IS NULL OR NOT u.active OR NOT u.email_verified OR s.expires_at<=clock_timestamp()
     OR s.created_at<=clock_timestamp()-interval '8 hours' THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='28000'; END IF;
  RETURN jsonb_build_object('userId',u.id,'sessionId',s.id,'email',u.email,'name',u.name,'emailVerified',u.email_verified,
    'twoFactorEnabled',u.two_factor_enabled,'mfaVerified',s.mfa_verified,'platformAdmin',u.platform_admin,
    'sessionCreatedAt',s.created_at,'sessionExpiresAt',s.expires_at);
END $$;
