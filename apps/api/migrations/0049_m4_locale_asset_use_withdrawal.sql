-- An asset-use permission belongs to one resource and locale. Withdrawal still
-- blocks that asset revision in the same locale's historical/current uses.
-- S07 global asset withdrawal independently blocks every locale and resource.
CREATE OR REPLACE FUNCTION gcms_m4.asset_allowed(t text,k text,r text,l text,v integer,a jsonb) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT gcms_s07.content_asset_ready(t,a->>'assetId',(a->>'revision')::integer)
 AND NOT EXISTS(SELECT 1 FROM gcms_m4.permission p WHERE p.tenant_id=t AND p.kind=k AND p.resource_id=r AND p.locale=l AND p.scope_key='asset:'||(a->>'usage')||':'||(a->>'assetId')||':'||(a->>'revision') AND p.withdrawn_at IS NOT NULL)
 AND (EXISTS(SELECT 1 FROM gcms_s07.asset x WHERE x.tenant_id=t AND x.id=a->>'assetId' AND x.material_kind='ordinary' AND k NOT IN ('case','gallery','testimonial')) OR EXISTS(SELECT 1 FROM gcms_m4.permission p WHERE p.tenant_id=t AND p.kind=k AND p.resource_id=r AND p.locale=l AND p.revision=v AND p.scope_key='asset:'||(a->>'usage')||':'||(a->>'assetId')||':'||(a->>'revision') AND p.withdrawn_at IS NULL))
$$;
CREATE OR REPLACE FUNCTION gcms_m4.legacy_asset_eligible(t text,k text,r text,a text,rev integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT gcms_m4.legacy_eligible(t,k,r) AND NOT EXISTS(SELECT 1 FROM gcms_m4.permission p WHERE p.tenant_id=t AND p.kind=k AND p.resource_id=r AND p.locale='vi' AND p.scope->>'type'='asset' AND p.scope->>'assetId'=a AND p.scope->>'assetRevision'=rev::text AND p.withdrawn_at IS NOT NULL)
$$;
